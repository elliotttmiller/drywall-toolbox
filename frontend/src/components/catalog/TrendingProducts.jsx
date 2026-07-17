import { useState, useEffect, useCallback } from 'react';
import { getProducts } from '../../services/catalog';
import { getProductVariations } from '../../services/api';
import { useCart } from '../../context/CartContext';
import ProductDetail from '../product/ProductDetail';
import ProductModal from '../product/ProductModal';
import LoadingCardTransition from '../shared/LoadingCardTransition.jsx';
import StorefrontProductTile from '../storefront/StorefrontProductTile';
import StorefrontSection from '../storefront/StorefrontSection';
import StorefrontRail from '../storefront/StorefrontRail';
import StorefrontSkeletons from '../storefront/StorefrontSkeletons.jsx';
import Toast from '../ui/Toast';
import { PLACEHOLDER_IMAGE } from '../../constants/images.js';
import { fetchVariationsBatched, getVariationSelectionMap } from '../../utils/variationSelection';

export default function TrendingProducts() {
  const [products, setProducts] = useState([]);
  const [variationMap, setVariationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCart } = useCart();

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const openModal = useCallback((product, cardProduct = null, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const initialResolvedVariation = cardProduct?.parent_id ? cardProduct : null;
    setModalProduct({
      product,
      initialResolvedVariation,
      initialSelectedAttrs: initialResolvedVariation
        ? getVariationSelectionMap(initialResolvedVariation)
        : {},
    });
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalProduct(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  const handleAddToCart = useCallback((product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  }, [addToCart]);

  useEffect(() => {
    let mounted = true;

    getProducts().then((allProducts) => {
      if (!mounted) return;

      const toolsOnly = allProducts.filter((p) => !p.is_parts && p.category !== 'parts');
      const withPrice = toolsOnly.filter((p) => {
        const price = Number(p.price) || Number(p.min_price) || Number(p.regular_price) || 0;
        return price > 0;
      });

      const groupedByBrand = {};
      withPrice.forEach((p) => {
        const brandName = p.brand || 'Other';
        if (!groupedByBrand[brandName]) groupedByBrand[brandName] = [];
        groupedByBrand[brandName].push(p);
      });

      let balancedSelection = [];
      Object.keys(groupedByBrand).forEach((brand) => {
        const brandTools = groupedByBrand[brand];
        brandTools.sort((a, b) => {
          const aPrice = Number(a.price) || Number(a.min_price) || Number(a.regular_price) || 0;
          const bPrice = Number(b.price) || Number(b.min_price) || Number(b.regular_price) || 0;
          return bPrice - aPrice;
        });
        balancedSelection.push(...brandTools.slice(0, 4));
      });

      balancedSelection.sort((a, b) => {
        const aPrice = Number(a.price) || Number(a.min_price) || Number(a.regular_price) || 0;
        const bPrice = Number(b.price) || Number(b.min_price) || Number(b.regular_price) || 0;
        if (Math.abs(bPrice - aPrice) > 1) return bPrice - aPrice;
        return (a.brand || '').localeCompare(b.brand || '');
      });

      setProducts(balancedSelection.slice(0, 16));
      setLoading(false);
    }).catch((err) => {
      console.error('Error fetching trending products:', err);
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, []);

  const trendingVariableIdsKey = products
    .filter((product) => product.is_variable && product.id)
    .map((product) => String(product.id))
    .join(',');

  useEffect(() => {
    const variableIds = products
      .filter((product) => product.is_variable && product.id && !variationMap[product.id])
      .map((product) => product.id);
    if (variableIds.length === 0) return undefined;

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations)
      .then((pairs) => {
        if (!mounted) return;
        const next = {};
        pairs.forEach(([id, vars]) => { next[id] = vars; });
        setVariationMap((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, [trendingVariableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && products.length === 0) return null;

  return (
    <StorefrontSection
      eyebrow="Featured"
      title="Trending Products"
      viewAllHref="/products?sort=popular"
    >
      <LoadingCardTransition
        loading={loading}
        skeleton={<StorefrontSkeletons count={4} variant="rail" />}
        label="Loading trending products"
      >
        <StorefrontRail label="Trending products" className="storefront-rail--fixed-tiles">
          {products.map((product, index) => {
            const variations = variationMap[product.id] || [];
            const bestVariation = variations.find((variation) => variation.stock_status !== 'outofstock') || variations[0] || null;
            const cardProduct = bestVariation
              ? {
                  ...bestVariation,
                  image: bestVariation.image && bestVariation.image !== PLACEHOLDER_IMAGE
                    ? bestVariation.image
                    : product.image,
                  images: bestVariation.image && bestVariation.image !== PLACEHOLDER_IMAGE
                    ? bestVariation.images
                    : product.images,
                  image_thumbnail: bestVariation.image_thumbnail || bestVariation.image || product.image_thumbnail,
                  image_srcset: bestVariation.image_srcset || product.image_srcset,
                  image_sizes: bestVariation.image_sizes || product.image_sizes,
                }
              : product;

            return (
              <StorefrontProductTile
                key={product.sku || product.id}
                product={product}
                cardProduct={cardProduct}
                variant="grid"
                onOpenModal={() => openModal(product, cardProduct)}
                onAddToCart={() => handleAddToCart(cardProduct)}
                index={index}
              />
            );
          })}
        </StorefrontRail>
      </LoadingCardTransition>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct?.product || modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            key={`${modalProduct.product?.id || modalProduct.id}:${modalProduct.initialResolvedVariation?.id || 'parent'}`}
            product={modalProduct.product || modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialVariations={variationMap[modalProduct.product?.id || modalProduct.id] || []}
            initialResolvedVariation={modalProduct.initialResolvedVariation}
            initialSelectedAttrs={modalProduct.initialSelectedAttrs}
          />
        )}
      </ProductModal>
    </StorefrontSection>
  );
}
