import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/catalog';
import { ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import Toast from './Toast';
import ProductDetail from './ProductDetail';
import ProductModal from './ProductModal';
import LoadingSpinner from './LoadingSpinner';
import ProductCardImage from './ProductCardImage';

export default function TrendingProducts() {
  const [products, setProducts] = useState([]);
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

  // Escape key closes modal
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

      // ── Diversified Trending Selection: Automatic Tapers prioritized ─────
      // We specifically look for Automatic Taper products across all brands
      // and ensure they are mixed for diversity.

      const taperKeywords = ['automatic taper', 'taper', 'taping tool'];
      const withPrice = allProducts.filter(p => (p.price || 0) > 0);

      // Categorize products into "Tapers" and "Other Main Tools"
      const groupedByBrand = {};

      withPrice.forEach(p => {
        const brandName = p.brand || 'Other';
        if (!groupedByBrand[brandName]) {
          groupedByBrand[brandName] = { tapers: [], others: [] };
        }

        const isTaper = taperKeywords.some(key =>
          (p.name || '').toLowerCase().includes(key) ||
          (p.category || '').toLowerCase().includes(key)
        );

        if (isTaper) {
          groupedByBrand[brandName].tapers.push(p);
        } else if (p.price > 100) { // Keep high-value tools as secondary options
          groupedByBrand[brandName].others.push(p);
        }
      });

      let balancedSelection = [];
      const brandKeys = Object.keys(groupedByBrand);

      // Strategy: 1. Take tapers from every brand first
      brandKeys.forEach(brand => {
        const brandGroup = groupedByBrand[brand];
        // Sort tapers by price descending (main tools first)
        brandGroup.tapers.sort((a, b) => (b.price || 0) - (a.price || 0));
        // Take up to 3 tapers per brand
        balancedSelection.push(...brandGroup.tapers.slice(0, 3));
      });

      // Strategy: 2. If we need more variety, add high-value tools from different brands
      if (balancedSelection.length < 12) {
        brandKeys.forEach(brand => {
          const brandGroup = groupedByBrand[brand];
          brandGroup.others.sort((a, b) => (b.price || 0) - (a.price || 0));
          balancedSelection.push(...brandGroup.others.slice(0, 2));
        });
      }

      // Final Mix: Maintain a diverse mix of tapers at the front
      balancedSelection.sort((a, b) => {
        const aIsTaper = taperKeywords.some(key => (a.name || '').toLowerCase().includes(key));
        const bIsTaper = taperKeywords.some(key => (b.name || '').toLowerCase().includes(key));

        if (aIsTaper && !bIsTaper) return -1;
        if (!aIsTaper && bIsTaper) return 1;

        // Equal priority (both tapers or both others): Compare price with brand spacing
        if (Math.abs((b.price || 0) - (a.price || 0)) > 50) {
          return (b.price || 0) - (a.price || 0);
        }
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

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320; // card width + gap
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

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="dtb-trending-section">
      {/* Header */}
      <div className="dtb-trending-header">
        <h2 className="dtb-trending-title">Trending Products</h2>
      </div>

      {/* Scrollable Container */}
      <div className="dtb-trending-scroll-wrapper">
        <div
          ref={scrollContainerRef}
          className="dtb-trending-scroll"
        >
          {products.map((product) => (
            <div
              key={product.sku}
              onClick={() => openModal(product)}
              className="dtb-trending-card-wrap"
            >
              <div className="dtb-trending-card">
                {/* Product Image */}
                <div className="dtb-trending-card-img">
                  <ProductCardImage
                    src={product.image}
                    alt={product.name}
                    padding="10px"
                  />
                </div>

                {/* Product Info */}
                <div className="dtb-trending-card-body">
                  {/* Brand */}
                  <div className="dtb-trending-card-brand">{product.brand}</div>

                  {/* Name */}
                  <h3 className="dtb-trending-card-name">{product.name}</h3>

                  {/* SKU & UPC */}
                  {product.sku && (
                    <div className="dtb-trending-card-meta">
                      <span style={{ fontWeight: 600 }}>SKU:</span> {product.sku}
                    </div>
                  )}
                  {product.upc && (
                    <div className="dtb-trending-card-meta">
                      <span style={{ fontWeight: 600 }}>UPC:</span> {product.upc}
                    </div>
                  )}

                  {/* Price row */}
                  <div className="dtb-trending-card-footer">
                    <span className="dtb-trending-card-price">
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll Controls — desktop only (hidden via CSS at narrow widths) */}
        <button
          onClick={() => scroll('left')}
          className="dtb-scroll-btn dtb-scroll-btn--left scroll-button-left"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={() => scroll('right')}
          className="dtb-scroll-btn dtb-scroll-btn--right scroll-button-right"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Product detail modal */}
      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail product={modalProduct} onAddToCart={handleAddToCart} onClose={closeModal} />
        )}
      </ProductModal>
    </section>
  );
}
