import { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { getBrandLogo } from '../../utils/brandAssets.js';
import { toProductDetailDTO } from '../../utils/catalogDtoAdapters.js';
import { BRAND_TO_SLUG, BRAND_ALIASES } from '../../utils/catalogUrlState.js';
import { getSchematicIdForProduct, buildSchematicsUrl } from '../../data/schematicMappings';
import DOMPurify from 'dompurify';

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

function decodeEscapedHtml(value) {
  if (typeof value !== 'string' || !value.includes('&lt;')) return value;
  if (typeof document === 'undefined') return value;

  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function hasHtmlMarkup(value) {
  return typeof value === 'string' && /<\s*\/?\s*[a-z][^>]*>/i.test(value);
}

function htmlToPlainText(html) {
  if (typeof html !== 'string') return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ');
  }
  const container = document.createElement('div');
  container.innerHTML = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return container.textContent || container.innerText || '';
}

function normalizeDescriptionText(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

const DESCRIPTION_SECTION_HEADINGS = [
  'Specifications',
  'Increased Reach',
  'Easy Connection',
  'Independent Controls',
  'Improve Your Work Quality',
  'Explore More',
  'Conclusion',
  'Note',
];

function splitSentences(text) {
  return normalizeDescriptionText(text)
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
}

function splitDescriptionSections(text) {
  let normalized = normalizeDescriptionText(text);
  DESCRIPTION_SECTION_HEADINGS.forEach((heading) => {
    const pattern = new RegExp(`\\s+(${heading})\\s*[-:–]\\s*`, 'gi');
    normalized = normalized.replace(pattern, `\n\n$1\n`);
  });

  const chunks = normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length > 1) return chunks;

  const sentences = splitSentences(normalized);
  if (sentences.length <= 3) return [normalized].filter(Boolean);

  const groups = [sentences.slice(0, 2).join(' ')];
  for (let i = 2; i < sentences.length; i += 2) {
    groups.push(sentences.slice(i, i + 2).join(' '));
  }
  return groups.filter(Boolean);
}

function ProductDescriptionContent({ html, text }) {
  const sourceText = normalizeDescriptionText(text || '');
  const plainHtmlText = hasHtmlMarkup(html) ? normalizeDescriptionText(htmlToPlainText(html)) : '';
  const shouldFormatPlainText = !hasHtmlMarkup(html) || (
    plainHtmlText
    && plainHtmlText.length > 260
    && !/<\s*(ul|ol|li|table|h[1-6]|blockquote)\b/i.test(html)
  );
  const content = shouldFormatPlainText ? (plainHtmlText || sourceText) : '';
  const sections = shouldFormatPlainText ? splitDescriptionSections(content) : [];

  if (!shouldFormatPlainText && hasHtmlMarkup(html)) {
    return (
      <div className="dtb-pdp-description-content dtb-pdp-description-content--rich">
        <div
          className="dtb-pdp-description-card"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
          }}
        />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="dtb-pdp-description-content dtb-pdp-description-content--empty">
        <p>No description available.</p>
      </div>
    );
  }

  return (
    <div className="dtb-pdp-description-content dtb-pdp-description-content--formatted">
      <p className="dtb-pdp-description-kicker">Product Overview</p>
      {sections.map((section, index) => {
        const heading = DESCRIPTION_SECTION_HEADINGS.find((candidate) => (
          new RegExp(`^${candidate}\\b`, 'i').test(section)
        ));
        const body = heading
          ? section.replace(new RegExp(`^${heading}\\b\\s*`, 'i'), '').trim()
          : section;

        return (
          <section key={`${heading || 'section'}-${index}`} className="dtb-pdp-description-card">
            {heading ? <h3>{heading}</h3> : null}
            <p className={index === 0 && !heading ? 'dtb-pdp-description-lead' : ''}>
              {body}
            </p>
          </section>
        );
      })}
    </div>
  );
}

function toFinitePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickFirstFinitePrice(...candidates) {
  for (const candidate of candidates) {
    const parsed = toFinitePrice(candidate);
    if (parsed != null) return parsed;
  }
  return null;
}

function getCurrentDisplayPrice(source, { preferMin = false } = {}) {
  if (!source) return 0;

  const priceObject = source?.price && typeof source.price === 'object' ? source.price : null;
  const priceValue = pickFirstFinitePrice(
    source?.price,
    source?.price_value,
    priceObject?.value,
  );
  const saleValue = pickFirstFinitePrice(
    source?.sale_price,
    source?.salePrice,
    priceObject?.sale,
  );
  const regularValue = pickFirstFinitePrice(
    source?.regular_price,
    source?.regularPrice,
    priceObject?.regular,
  );
  const minValue = pickFirstFinitePrice(
    source?.min_price,
    source?.price_min,
    source?.minPrice,
    priceObject?.min,
  );

  if (preferMin) {
    return pickFirstFinitePrice(minValue, priceValue, saleValue, regularValue, 0) ?? 0;
  }

  return pickFirstFinitePrice(priceValue, saleValue, regularValue, minValue, 0) ?? 0;
}

function getCompareAtPrice(source) {
  if (!source) return null;
  const priceObject = source?.price && typeof source.price === 'object' ? source.price : null;
  return pickFirstFinitePrice(
    source?.regular_price,
    source?.regularPrice,
    priceObject?.regular,
  );
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

function EmptyReviewsButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dtb-pdp-header__reviews ${className}`.trim()}
      aria-label="View reviews, 0 out of 5 stars, no reviews yet"
    >
      <span className="dtb-pdp-header__reviews-stars" role="img" aria-label="0 out of 5 stars">
        {[...Array(5)].map((_, i) => (
          <svg key={i} className="dtb-pdp-header__review-star" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </span>
      <span className="dtb-pdp-header__reviews-label">No reviews yet</span>
    </button>
  );
}

export default function ProductDetail({
  product,
  onAddToCart,
  onClose,
  onVariationChange,
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
            const detail = toProductDetailDTO(data);
            if (detail?.computed) setComputedData(detail.computed);
            const detailVars = Array.isArray(detail?.variations) && detail.variations.length > 0 ? detail.variations : null;
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

  useEffect(() => {
    if (typeof onVariationChange !== 'function') return;
    onVariationChange(selectedVariation || null);
  }, [onVariationChange, selectedVariation]);

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

  // Build the "browse all compatible parts" URL — prefer the specific schematic link,
  // fall back to the brand's parts page, then to the generic /parts landing.
  const canonicalBrandForParts = BRAND_ALIASES[brandLabel] || brandLabel;
  const brandSlugForParts = BRAND_TO_SLUG[canonicalBrandForParts] || '';
  const browsePartsUrl = partsUrl ||
    (brandSlugForParts ? `/parts?brand=${encodeURIComponent(brandSlugForParts)}` : '/parts');
  const effectiveSku = effectiveProduct.sku || product.sku || '';
  const effectiveStock = effectiveProduct.stock_status || product.stock_status || 'instock';
  const isOutOfStock = effectiveStock === 'outofstock';
  const detailProductUrl = product?.slug
    ? `/products/${product.slug}${selectedVariation?.id ? `/variations/${encodeURIComponent(selectedVariation.id)}` : ''}`
    : '';
  const needsVariation = product.is_variable && variationAttributes.length > 0;
  const hasCompleteSelection = !needsVariation || variationAttributes.every((attr) => selectedAttrs?.[attr.name]);
  const canAddToCart = !isOutOfStock && (!needsVariation || Boolean(selectedVariation && hasCompleteSelection));

  const handleAddToCart = async () => {
    if (!canAddToCart) return;
    const productToAdd = selectedVariation ? effectiveProduct : product;
    try {
      setAddToCartError('');
      if (onAddToCart) await onAddToCart(productToAdd, quantity);
      else await addToCart(productToAdd, quantity);
      if (typeof onClose === 'function') {
        setTimeout(() => onClose(), 220);
      }
    } catch (err) {
      setAddToCartError(
        err?.message ||
        'Unable to add this item to cart. Please check your selection and try again. If this continues, contact support.'
      );
    }
  };
  const clearAddToCartError = () => {
    if (addToCartError) setAddToCartError('');
  };

  const rawPrice = selectedVariation
    ? getCurrentDisplayPrice(selectedVariation)
    : getCurrentDisplayPrice(product, { preferMin: Boolean(product.is_variable) });
  const displayPrice = money(rawPrice);
  const pricePrefix = product.is_variable && !selectedVariation ? 'From $' : '$';
  const compareAt = getCompareAtPrice(selectedVariation) ?? getCompareAtPrice(product);
  const productSpecifications = getProductSpecifications(product);
  const stockQuantityRaw = selectedVariation?.stock_quantity ?? effectiveProduct?.stock_quantity ?? product?.stock_quantity;
  const stockQuantity = Number.isFinite(Number(stockQuantityRaw)) ? Number(stockQuantityRaw) : null;
  const stockProgress = isOutOfStock
    ? 0
    : stockQuantity && stockQuantity > 0
      ? Math.max(18, Math.min(100, Math.round((Math.min(stockQuantity, 36) / 36) * 100)))
      : 72;
  const stockHint = isOutOfStock
    ? 'Temporarily out of stock'
    : stockQuantity && stockQuantity > 0
      ? stockQuantity <= 6
        ? `Only ${stockQuantity} left - hurry while stock lasts`
        : stockQuantity <= 24
          ? `${stockQuantity} in stock - Hurry while stocks last!`
          : `${stockQuantity} in stock`
      : 'In stock and ready to ship';
  const rawDescription = stripSpecsFromHtml(
    effectiveProduct.description_full || effectiveProduct.description || effectiveProduct.short_description || ''
  );
  const decodedDescription = decodeEscapedHtml(rawDescription);
  const descriptionContent = hasHtmlMarkup(decodedDescription)
    ? <ProductDescriptionContent html={decodedDescription} />
    : (
      <ProductDescriptionContent
        text={decodedDescription || 'No description available.'}
      />
      );

  const descriptionNode = descriptionContent;

  return (
    <div className={`dtb-pdp${onClose ? ' dtb-pdp--modal' : ''} w-full max-w-6xl mx-auto flex flex-col relative`}>
      {onClose ? (
        <button
          onClick={onClose}
          className="dtb-pdp__close-btn"
          aria-label="Close product detail"
          title="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      ) : null}

      <div className="overflow-x-hidden">
        <div className="dtb-pdp__inner max-w-full">
          <div className="dtb-pdp__hero grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
            <div className="dtb-pdp-gallery">
              <ProductImageGallery product={effectiveProduct} />
            </div>

            <div className="dtb-pdp__info-column flex flex-col">
              <ProductDetailHeader
                product={product}
                productUrl={detailProductUrl}
                effectiveName={(effectiveProduct.name || product.name)}
                effectiveSku={effectiveSku}
                isOutOfStock={isOutOfStock}
                brandLabel={brandLabel}
                brandLogoSrc={brandLabel ? getBrandLogo(brandLabel) : null}
                brandLogoClassName="product-detail-brand-logo"
                displayPrice={displayPrice}
                pricePrefix={pricePrefix}
                compareAt={compareAt}
                rawPrice={rawPrice}
                onReviewsClick={() => setActiveTab('reviews')}
                money={money}
                reviewsClassName="dtb-pdp-mobile-relocate"
              />

              <p className="dtb-pdp-shipping-note">Shipping calculated at checkout.</p>

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

              <div className={`dtb-pdp-stock-meter dtb-pdp-stock-meter--pre-cart ${isOutOfStock ? 'is-out' : ''}`}>
                <p className="dtb-pdp-stock-meter__label">{stockHint}</p>
                <div className="dtb-pdp-stock-meter__track" aria-hidden="true">
                  <span className="dtb-pdp-stock-meter__fill" style={{ width: `${stockProgress}%` }} />
                </div>
              </div>

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
                onQuantityChange={(val) => {
                  clearAddToCartError();
                  setQuantity(val);
                }}
                onAddToCart={handleAddToCart}
                canAddToCart={canAddToCart}
                isOutOfStock={isOutOfStock}
                needsVariation={needsVariation}
                hasCompleteSelection={hasCompleteSelection}
                isWishlisted={isWishlisted}
                onToggleWishlist={() => setIsWishlisted((prev) => !prev)}
                partsUrl={partsUrl}
                reviewNode={<EmptyReviewsButton onClick={() => setActiveTab('reviews')} className="dtb-pdp-header__reviews--mobile-inline" />}
              />

              <div className="dtb-pdp-mobile-post-purchase">
                {partsUrl ? (
                  <Link to={partsUrl} className="dtb-pdp-parts-link dtb-pdp-parts-link--mobile">
                    View compatible schematics and parts
                  </Link>
                ) : null}
              </div>
              {addToCartError ? (
                <p className="text-sm text-red-600 mt-2" role="alert" aria-live="assertive">{addToCartError}</p>
              ) : null}

            </div>
          </div>

          {getBrandLogo(brandLabel) ? (
            <div className="dtb-pdp-brand-banner">
              <img
                src={getBrandLogo(brandLabel)}
                alt={brandLabel}
                className="dtb-pdp-brand-banner__logo"
              />
            </div>
          ) : null}

          <ProductDetailTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            descriptionNode={descriptionNode}
            specsNode={<ProductSpecTable specs={productSpecifications} onItemClick={onClose} />}
            reviewsNode={<Reviews productId={effectiveProduct.id || product.id || effectiveSku || product.slug || product.name} />}
          />

          <div className="dtb-pdp-browse-parts-row">
            <Link to={browsePartsUrl} className="dtb-pdp-browse-parts-row__link">
              Browse all compatible parts &amp; schematics
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
