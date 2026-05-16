import { useState, useEffect, useRef, useCallback } from 'react';
import { getProducts } from '../../services/catalog';
import { getProductVariations } from '../../services/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import ProductDetail from '../product/ProductDetail';
import ProductModal from '../product/ProductModal';
import LoadingSpinner from '../shared/LoadingSpinner';
import ProductShoppingCard from '../ui/ProductShoppingCard';
import Toast from '../ui/Toast';
import { PLACEHOLDER_IMAGE } from '../../constants/images.js';
import { fetchVariationsBatched } from '../../utils/variationSelection';

export default function TrendingProducts() {
  const [products, setProducts] = useState([]);
  const [variationMap, setVariationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollContainerRef = useRef(null);
  const { addToCart } = useCart();

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const openModal = (product, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setModalProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalProduct(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  useEffect(() => {
    let mounted = true;

    getProducts().then((allProducts) => {
      if (!mounted) return;

      // Filter to only TOOLS (exclude parts and accessories)
      const toolsOnly = allProducts.filter(p => {
        // Exclude products in the 'parts' category
        return p.category !== 'parts';
      });

      // Filter for products with valid prices
      const withPrice = toolsOnly.filter(p => {
        const price = Number(p.price) || Number(p.min_price) || 0;
        return price > 0;
      });

      // Group all tools by brand
      const groupedByBrand = {};
      withPrice.forEach(p => {
        const brandName = p.brand || 'Other';
        if (!groupedByBrand[brandName]) {
          groupedByBrand[brandName] = [];
        }
        groupedByBrand[brandName].push(p);
      });

      let balancedSelection = [];
      const brandKeys = Object.keys(groupedByBrand);

      // For each brand, take the top 4 highest-priced tools and add them to selection
      // This ensures brand variety while showing premium tools
      brandKeys.forEach(brand => {
        const brandTools = groupedByBrand[brand];
        brandTools.sort((a, b) => {
          const aPrice = Number(a.price) || Number(a.min_price) || 0;
          const bPrice = Number(b.price) || Number(b.min_price) || 0;
          return bPrice - aPrice; // Sort descending by price
        });
        balancedSelection.push(...brandTools.slice(0, 4));
      });

      // Final sort: by price descending within the balanced selection
      balancedSelection.sort((a, b) => {
        const aPrice = Number(a.price) || Number(a.min_price) || 0;
        const bPrice = Number(b.price) || Number(b.min_price) || 0;
        if (Math.abs(bPrice - aPrice) > 1) {
          return bPrice - aPrice; // Higher priced first
        }
        return (a.brand || '').localeCompare(b.brand || ''); // Fallback to brand name
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
    if (variableIds.length === 0) return;

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations).then((pairs) => {
      if (!mounted) return;
      const next = {};
      pairs.forEach(([id, vars]) => { next[id] = vars; });
      setVariationMap((prev) => ({ ...prev, ...next }));
    });

    return () => { mounted = false; };
  }, [trendingVariableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const card = scrollContainerRef.current.querySelector('.dtb-trending-card-wrap');
      const scrollAmount = card ? card.getBoundingClientRect().width + 16 : 280;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <section style={{
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 5vw, 2.5rem)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <LoadingSpinner fullPage={false} size="lg" label="Loading products" />
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="dtb-trending-section">
      <div className="dtb-trending-header">
        <h2 className="dtb-trending-title">Trending Products</h2>
      </div>

      <div className="dtb-trending-scroll-wrapper">
        <div ref={scrollContainerRef} className="dtb-trending-scroll">
          {products.map((product, index) => (
            <div key={product.sku || product.id} className="dtb-trending-card-wrap">
              {(() => {
                // Variable products often have no image on the parent in WooCommerce —
                // only the individual variations carry images. Fall back to the first
                // variation image so the card never shows a broken placeholder.
                const variations = variationMap[product.id] || [];
                const firstVarImg = variations.find(
                  (v) => v.image && v.image !== PLACEHOLDER_IMAGE
                )?.image;
                const cardProduct =
                  (product.image === PLACEHOLDER_IMAGE || !product.image) && firstVarImg
                    ? { ...product, image: firstVarImg, image_thumbnail: firstVarImg }
                    : product;
                return (
                  <ProductShoppingCard
                    product={product}
                    cardProduct={cardProduct}
                    variant="rail"
                    hasSelectedVariation={false}
                    onOpenModal={() => openModal(product)}
                    onAddToCart={() => handleAddToCart(product)}
                    index={index}
                  />
                );
              })()}
            </div>
          ))}
        </div>

        <button onClick={() => scroll('left')} className="dtb-scroll-btn dtb-scroll-btn--left scroll-button-left" aria-label="Scroll left">
          <ChevronLeft size={18} />
        </button>

        <button onClick={() => scroll('right')} className="dtb-scroll-btn dtb-scroll-btn--right scroll-button-right" aria-label="Scroll right">
          <ChevronRight size={18} />
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialVariations={variationMap[modalProduct.id] || []}
          />
        )}
      </ProductModal>

      <style>{`
         .dtb-trending-scroll {
           scroll-snap-type: x mandatory;
           scroll-padding-inline: clamp(16px, 4vw, 32px);
         }

         .dtb-trending-card-wrap {
           flex: 0 0 clamp(162px, 21vw, 188px);
           max-width: clamp(162px, 21vw, 188px);
           scroll-snap-align: start;
         }

         .dtb-trending-card-wrap .dtb-product-card {
           width: 100%;
           min-width: 0;
         }

        @media (max-width: 767px) {
          .dtb-trending-section {
            padding-left: 0;
            padding-right: 0;
          }

          .dtb-trending-scroll-wrapper {
            overflow: hidden;
          }

           .dtb-trending-scroll {
             gap: 12px;
             padding-left: 16px;
             padding-right: 16px;
             scroll-padding-inline: 16px;
           }

           .dtb-trending-card-wrap {
             flex-basis: clamp(162px, 44vw, 188px);
             max-width: clamp(162px, 44vw, 188px);
             scroll-snap-align: start;
           }

          .dtb-trending-card-wrap .dtb-plp-card__img-wrap,
          .dtb-trending-card-wrap .dtb-plp-card__img-btn {
            min-height: 185px;
            max-height: 210px;
          }

          .dtb-trending-card-wrap .dtb-plp-card__body {
            padding: 10px 14px 12px !important;
          }

          .dtb-trending-card-wrap .dtb-plp-card__brand {
            font-size: 0.58rem !important;
            letter-spacing: 0.08em !important;
          }

          .dtb-trending-card-wrap .dtb-plp-card__name-btn {
            font-size: 0.82rem !important;
            line-height: 1.28 !important;
          }

          .dtb-trending-card-wrap .dtb-plp-card__sku {
            font-size: 0.64rem !important;
            margin-bottom: 4px !important;
          }

          .dtb-trending-card-wrap .dtb-plp-card__price {
            font-size: 0.92rem !important;
          }
        }
      `}</style>
    </section>
  );
}
