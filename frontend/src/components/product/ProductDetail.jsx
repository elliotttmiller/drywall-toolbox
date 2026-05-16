import { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X } from 'lucide-react';
import Reviews from './Reviews';
import { useCart } from '../../context/CartContext';
import ProductImageGallery from './ProductImageGallery';
import ProductVariationRail from './ProductVariationRail';
import ProductDetailHeader from './ProductDetailHeader';
import ProductPurchasePanel from './ProductPurchasePanel';
import ProductDetailTabs from './ProductDetailTabs';
import ProductSpecTable from './ProductSpecTable';
import { getProductSpecifications } from '../../utils/productSpecifications';
import { getProductVariations } from '../../services/api';
import { findMatchingVariation, getVariationSelectionMap } from '../../utils/variationSelection';
import { setCachedVariations } from '../../utils/variationCache';
import { apiClient } from '../../api/client.js';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import { getSchematicIdForProduct, buildSchematicsUrl } from '../../data/schematicMappings';

const BRAND_LOGOS = {
  'Columbia Taping Tools': columbiaLogo,
  TapeTech: tapeTechLogo,
  SurPro: surproLogo,
  Asgard: asgardLogo,
  Graco: gracoLogo,
  'Level 5': level5Logo,
};

function buildSeedVariations(initialVariations = [], initialResolvedVariation = null) {
  const seeded = [];
  const seen = new Set();

  const pushVariation = (variation) => {
    if (!variation?.id || seen.has(variation.id)) return;
    seen.add(variation.id);
    seeded.push(variation);
  };

  pushVariation(initialResolvedVariation);
  (Array.isArray(initialVariations) ? initialVariations : []).forEach(pushVariation);

  return seeded;
}

function money(value) {
  const parsed = typeof value === 'number' ? value : parseFloat(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function getVariantStatus(variation) {
  if (!variation) return 'unavailable';
  return variation.stock_status === 'outofstock' ? 'sold-out' : 'available';
}

function buildInitialVariationSelection({ autoSelectDefaultVariation, initialSelectedAttrs, seededVariations }) {
  if (Object.keys(initialSelectedAttrs || {}).length > 0) return initialSelectedAttrs;
  if (!autoSelectDefaultVariation) return {};
  return getVariationSelectionMap(seededVariations.find((v) => v.stock_status !== 'outofstock') || seededVariations[0] || {});
}

function getSelectedVariationLabel(selectedVariation, selectedAttrs, variationAttributes) {
  const selectedValues = variationAttributes
    .map((attr) => selectedAttrs?.[attr.name])
    .filter((value) => value != null && `${value}`.trim() !== '')
    .map((value) => `${value}`.trim());

  if (selectedValues.length > 0) return selectedValues.join(' / ');

  const attrValues = getVariationSelectionMap(selectedVariation);
  const variationValues = Object.values(attrValues)
    .filter((value) => value != null && `${value}`.trim() !== '')
    .map((value) => `${value}`.trim());

  if (variationValues.length > 0) return variationValues.join(' / ');

  return '';
}

function normalizeNameToken(value) {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\b(inches|inch|in)\b/g, '')
    .replace(/["']/g, '')
    .replace(/-/g, '.')
    .replace(/[^a-z0-9.]+/g, '')
    .replace(/\.0+$/g, '')
    .trim();
}

function shouldComposeVariationName(parentProduct, selectedVariation, selectedLabel) {
  if (!selectedVariation || !parentProduct?.name || !selectedLabel) return false;

  const rawName = `${selectedVariation.name || ''}`.trim();
  if (!rawName) return true;

  const normalizedRaw = normalizeNameToken(rawName);
  const normalizedLabel = normalizeNameToken(selectedLabel);
  const normalizedParent = normalizeNameToken(parentProduct.name);

  if (normalizedRaw === normalizedLabel) return true;
  if (/^\d+(?:\.\d+)?$/.test(normalizedRaw)) return true;
  if (normalizedParent && !normalizedRaw.includes(normalizedParent)) return true;

  return false;
}

function composeEffectiveVariationProduct(parentProduct, selectedVariation, selectedLabel) {
  if (!selectedVariation) return parentProduct;

  const name = shouldComposeVariationName(parentProduct, selectedVariation, selectedLabel)
    ? `${parentProduct.name} - ${selectedLabel}`
    : (selectedVariation.name || parentProduct.name);

  return {
    ...selectedVariation,
    brand: selectedVariation.brand || parentProduct.brand,
    description: selectedVariation.description || parentProduct.description,
    description_full: selectedVariation.description_full || parentProduct.description_full,
    short_description: selectedVariation.short_description || parentProduct.short_description,
    images: Array.isArray(selectedVariation.images) && selectedVariation.images.length > 0
      ? selectedVariation.images
      : parentProduct.images,
    image: selectedVariation.image || parentProduct.image,
    name,
  };
}

function getBrandLabel(product, effectiveProduct = null) {
  return (
    product?.brand?.label ||
    effectiveProduct?.brand?.label ||
    product?.brandLabel ||
    effectiveProduct?.brandLabel ||
    product?.brand ||
    effectiveProduct?.brand ||
    ''
  );
}

export default function ProductDetail({
  product,
  onAddToCart,
  onClose,
  initialSelectedAttrs = {},
  initialVariations = [],
  initialResolvedVariation = null,
  disableLegacyDetailFetch = false,
  initialComputedData = null,
  autoSelectDefaultVariation = true,
}) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [addToCartError, setAddToCartError] = useState('');

  const seededVariations = buildSeedVariations(initialVariations, initialResolvedVariation);
  const initialVariationSelection = buildInitialVariationSelection({
    autoSelectDefaultVariation,
    initialSelectedAttrs,
    seededVariations,
  });

  const [variations, setVariations] = useState(seededVariations);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [selectedAttrs, setSelectedAttrs] = useState(initialVariationSelection);
  const [computedData, setComputedData] = useState(initialComputedData);

  const hasInitialVariations = Array.isArray(initialVariations) && initialVariations.length > 0;

  useEffect(() => {
    if (!product?.is_variable || !product.id) return;

    let mounted = true;
    const currentSeeded = seededVariations;
    const currentInitialAttrs = initialSelectedAttrs;

    Promise.resolve().then(() => {
      if (!mounted) return;
      setComputedData(initialComputedData);
      setVariations(currentSeeded);
      setSelectedAttrs(buildInitialVariationSelection({
        autoSelectDefaultVariation,
        initialSelectedAttrs: currentInitialAttrs,
        seededVariations: currentSeeded,
      }));
      setVariationsLoading(!hasInitialVariations && !disableLegacyDetailFetch);
    });

    if (disableLegacyDetailFetch && hasInitialVariations) {
      return () => { mounted = false; };
    }

    const applyVariations = (vars) => {
      if (!mounted || !Array.isArray(vars) || vars.length === 0) return false;
      setVariations(vars);
      if (Object.keys(currentInitialAttrs || {}).length > 0) {
        setSelectedAttrs(currentInitialAttrs);
      } else if (autoSelectDefaultVariation) {
        const firstInStock = vars.find((v) => v.stock_status !== 'outofstock') || vars[0];
        setSelectedAttrs(getVariationSelectionMap(firstInStock));
      } else {
        setSelectedAttrs({});
      }
      return true;
    };

    Promise.resolve()
      .then(async () => {
        if (!mounted) return;

        if (product.slug) {
          try {
            const data = await apiClient(`/wp-json/dtb/v1/catalog/products/${encodeURIComponent(product.slug)}/detail`);
            if (!mounted) return;
            if (data?.computed) setComputedData(data.computed);
            const detailVars = Array.isArray(data?.variations) && data.variations.length > 0 ? data.variations : null;
            if (detailVars) {
              setCachedVariations(product.id, detailVars);
              applyVariations(detailVars);
              return;
            }
          } catch {
            if (!mounted) return;
          }
        }

        if (product.slug && !disableLegacyDetailFetch) {
          try {
            const data = await apiClient(`/wp-json/drywall/v1/products/slug/${encodeURIComponent(product.slug)}/detail`);
            if (!mounted) return;
            if (data?.computed) setComputedData(data.computed);
            const detailVars = Array.isArray(data?.variations) && data.variations.length > 0 ? data.variations : null;
            if (detailVars) {
              setCachedVariations(product.id, detailVars);
              applyVariations(detailVars);
              return;
            }
          } catch {
            if (!mounted) return;
          }
        }

        try {
          const vars = await getProductVariations(product.id);
          if (!mounted || !Array.isArray(vars) || vars.length === 0) return;
          setCachedVariations(product.id, vars);
          applyVariations(vars);
        } catch {
          // variations not critical
        }
      })
      .finally(() => {
        if (mounted) setVariationsLoading(false);
      });

    return () => { mounted = false; };
  }, [product?.id, product?.slug, product?.is_variable, hasInitialVariations]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVariation = useMemo(
    () => (product?.is_variable ? findMatchingVariation(variations, selectedAttrs) : null),
    [product?.is_variable, variations, selectedAttrs],
  );

  const variationAttributes = useMemo(
    () => (Array.isArray(product?.variation_attributes)
      ? product.variation_attributes.filter((attr) =>
        attr?.name
        && attr.name.toLowerCase() !== 'brand'
        && Array.isArray(attr.options)
        && attr.options.length > 0,
      )
      : []),
    [product],
  );

  const variantOptionMeta = useMemo(() => {
    const meta = {};
    const matrix = computedData?.available_option_matrix ?? {};

    variationAttributes.forEach((attr) => {
      const name = attr.name;
      const options = Array.isArray(attr.options) ? attr.options : [];
      const attrMatrix = matrix[name] ?? {};
      const lowerMatrix = Object.entries(attrMatrix).reduce((acc, [key, value]) => {
        acc[String(key).toLowerCase()] = value;
        return acc;
      }, {});

      meta[name] = options.map((option) => {
        const matrixEntry = attrMatrix[option] ?? lowerMatrix[String(option).toLowerCase()];

        if (matrixEntry) {
          const matchedVariation = variations.find((v) => v.id === matrixEntry.variation_id) || null;
          const status = !matrixEntry.purchasable ? 'unavailable' : (matrixEntry.stock_status === 'outofstock' ? 'sold-out' : 'available');
          return {
            value: option,
            variation: matchedVariation,
            status,
            price: matchedVariation?.price ?? null,
          };
        }

        const candidateSelection = { ...selectedAttrs, [name]: option };
        const exact = findMatchingVariation(variations, candidateSelection);
        const fallback = exact || variations.find((variation) => {
          const map = getVariationSelectionMap(variation);
          return Object.entries(map).some(([attrName, attrValue]) => (
            attrName.toLowerCase() === name.toLowerCase() && `${attrValue}` === `${option}`
          ));
        });

        return {
          value: option,
          variation: fallback || null,
          status: getVariantStatus(fallback),
          price: fallback?.price ?? null,
        };
      });
    });

    return meta;
  }, [variationAttributes, variations, selectedAttrs, computedData]);

  useEffect(() => {
    if (!product || !onClose) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [product, onClose]);

  if (!product) return null;

  const stripSpecsFromHtml = (html) => {
    if (!html || typeof html !== 'string') return html;
    return html
      .replace(/<p[^>]*>\s*<(?:strong|b)[^>]*>Specifications?:?<\/\s*(?:strong|b)>\s*<\/p>\s*/gi, '')
      .replace(/<p[^>]*>(?:\s*\|[^<]*)+<\/p>/gi, '')
      .replace(/<table[^>]*>([\s\S]*?)(?:Specification|Detail|DETAIL|SPECIFICATION)([\s\S]*?)<\/table>/gi, '');
  };

  const schematicId = getSchematicIdForProduct(product);
  const partsUrl = schematicId ? buildSchematicsUrl(schematicId) : null;
  const selectedVariationLabel = getSelectedVariationLabel(selectedVariation, selectedAttrs, variationAttributes);

  const effectiveProduct = selectedVariation
    ? composeEffectiveVariationProduct(product, selectedVariation, selectedVariationLabel)
    : product;
  const brandLabel = getBrandLabel(product, effectiveProduct);
  const effectiveSku = effectiveProduct.sku || product.sku || '';
  const effectiveStock = effectiveProduct.stock_status || product.stock_status || 'instock';
  const isOutOfStock = effectiveStock === 'outofstock';
  const needsVariation = product.is_variable && variationAttributes.length > 0;
  const hasCompleteSelection = !needsVariation || variationAttributes.every((attr) => selectedAttrs?.[attr.name]);
  const canAddToCart = !isOutOfStock && (!needsVariation || Boolean(selectedVariation && hasCompleteSelection));

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    const productToAdd = selectedVariation ? effectiveProduct : product;
    try {
      setAddToCartError('');
      if (onAddToCart) onAddToCart(productToAdd, quantity);
      else addToCart(productToAdd, quantity);
      if (typeof onClose === 'function') {
        setTimeout(() => onClose(), 220);
      }
    } catch {
      setAddToCartError('Unable to add this item to cart. Please check your selection and try again. If this continues, contact support.');
    }
  };
  const clearAddToCartError = () => {
    if (addToCartError) setAddToCartError('');
  };

  const rawPrice = selectedVariation
    ? (selectedVariation.price || 0)
    : (product.is_variable && product.min_price != null ? product.min_price : (product.price || 0));
  const displayPrice = money(rawPrice);
  const pricePrefix = product.is_variable && !selectedVariation ? 'From $' : '$';
  const compareAt = selectedVariation?.regular_price || product.regular_price;
  const productSpecifications = getProductSpecifications(product);

  const brandLogoClassName = [
    'product-detail-brand-logo',
    brandLabel === 'Columbia Taping Tools' ? 'product-detail-brand-logo--columbia' : '',
  ].filter(Boolean).join(' ');

  const descriptionNode = (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {stripSpecsFromHtml(effectiveProduct.description_full || effectiveProduct.description || effectiveProduct.short_description || 'No description available.')}
    </ReactMarkdown>
  );
  const stockLine = isOutOfStock
    ? 'Currently unavailable'
    : (selectedVariation
      ? `${selectedVariationLabel || 'Selected option'} is ready to ship`
      : 'Ready to ship while supplies last');

  return (
    <div className="dtb-pdp bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl mx-auto flex flex-col relative">
      {onClose ? (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close product detail"
          title="Close"
        >
          <X size={20} className="text-gray-600 hover:text-gray-900" />
        </button>
      ) : null}

      <div className="overflow-x-hidden">
        <div className="dtb-pdp__inner p-4 sm:p-6 md:p-8 lg:p-12 max-w-full">
          <div className="dtb-pdp__topbar">
            <span className="dtb-pdp__topbar-label">{brandLabel || 'Drywall Toolbox'}</span>
            {effectiveSku ? <span className="dtb-pdp__topbar-meta">SKU {effectiveSku}</span> : null}
          </div>

          <div className="dtb-pdp__hero grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
            <div className="dtb-pdp-gallery">
              <ProductImageGallery product={effectiveProduct} />
            </div>

            <div className="flex flex-col">
              <ProductDetailHeader
                product={product}
                effectiveName={(effectiveProduct.name || product.name)}
                effectiveSku={effectiveSku}
                isOutOfStock={isOutOfStock}
                brandLabel={brandLabel}
                brandLogoSrc={brandLabel ? BRAND_LOGOS[brandLabel] : null}
                brandLogoClassName={brandLogoClassName}
                displayPrice={displayPrice}
                pricePrefix={pricePrefix}
                compareAt={compareAt}
                rawPrice={rawPrice}
                onReviewsClick={() => setActiveTab('reviews')}
                money={money}
              />

              {needsVariation ? (
                <ProductVariationRail
                  variationAttributes={variationAttributes}
                  variantOptionMeta={variantOptionMeta}
                  selectedAttrs={selectedAttrs}
                  setSelectedAttrs={(next) => {
                    clearAddToCartError();
                    setSelectedAttrs(next);
                  }}
                  variationsLoading={variationsLoading}
                  selectedVariation={selectedVariation}
                  hasCompleteSelection={hasCompleteSelection}
                />
              ) : null}

              <p className={`dtb-pdp__stock-line${isOutOfStock ? ' is-out' : ''}`}>
                {stockLine}
              </p>

              <ProductPurchasePanel
                quantity={quantity}
                onDecrease={() => {
                  clearAddToCartError();
                  setQuantity((prev) => Math.max(1, prev - 1));
                }}
                onIncrease={() => {
                  clearAddToCartError();
                  setQuantity((prev) => prev + 1);
                }}
                onAddToCart={handleAddToCart}
                canAddToCart={canAddToCart}
                isOutOfStock={isOutOfStock}
                needsVariation={needsVariation}
                hasCompleteSelection={hasCompleteSelection}
                isWishlisted={isWishlisted}
                onToggleWishlist={() => setIsWishlisted((prev) => !prev)}
                partsUrl={partsUrl}
              />
              {addToCartError ? (
                <p className="text-sm text-red-600 mt-2" role="alert" aria-live="assertive">{addToCartError}</p>
              ) : null}
            </div>
          </div>

          <ProductDetailTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            descriptionNode={descriptionNode}
            specsNode={<ProductSpecTable specs={productSpecifications} onItemClick={onClose} />}
            reviewsNode={<Reviews />}
          />

        </div>
      </div>
    </div>
  );
}
