import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/catalog';
import { filterProductsWithSchematics } from '../data/schematicMappings';
import { ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import Toast from './Toast';
import ProductDetail from './ProductDetail';
import LoadingSpinner from './LoadingSpinner';

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

      // ── Priority 1: Columbia products that have interactive schematics ────
      // These are the most "featured" products — we have parts diagrams for them.
      const withSchematics = filterProductsWithSchematics(allProducts, 'Columbia Taping Tools')
        .filter(p => p.price);

      if (withSchematics.length >= 6) {
        // Enough schematic-matched products — sort premium first, take top 12.
        withSchematics.sort((a, b) => (b.price || 0) - (a.price || 0));
        setProducts(withSchematics.slice(0, 12));
        setLoading(false);
        return;
      }

      // ── Priority 2: Cross-brand curated selection ─────────────────────────
      // Not enough Columbia/schematic products — build a balanced sample from
      // all brands.  Pick up to 3 products per brand, sorted by price desc.
      const withPrice = allProducts.filter(p => p.price);
      const byBrand = {};
      withPrice.forEach(p => {
        const b = p.brand || 'Other';
        if (!byBrand[b]) byBrand[b] = [];
        byBrand[b].push(p);
      });

      const featured = [];
      Object.values(byBrand).forEach(group => {
        group.sort((a, b) => (b.price || 0) - (a.price || 0));
        featured.push(...group.slice(0, 3));
      });

      // Final sort by price desc, take top 12
      featured.sort((a, b) => (b.price || 0) - (a.price || 0));
      setProducts(featured.slice(0, 12));
      setLoading(false);
    }).catch(() => {
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
    <section style={{
      padding: 'clamp(1.5rem, 5vw, 3rem) clamp(0.75rem, 4vw, 2.5rem)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <p style={{
          textTransform: 'uppercase',
          fontSize: '0.7rem',
          letterSpacing: '0.15em',
          fontWeight: 700,
          color: 'rgba(15,23,42,0.4)',
          margin: '0 0 16px 0',
          display: 'none'
        }}>
          Trending Now
        </p>
        <h2 style={{
          fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
          fontWeight: 800,
          color: 'var(--primary-600)',
          margin: 0,
          letterSpacing: '-0.02em',
          paddingBottom: '8px',
          paddingLeft: '16px',
          paddingRight: '16px',
          display: 'inline-block',
          position: 'relative',
          background: 'linear-gradient(to right, var(--primary-600) 0%, var(--primary-600) 100%) no-repeat bottom',
          backgroundSize: 'calc(100% + 32px) 3px',
          backgroundPosition: '-16px calc(100% + 0px)',
          transition: 'all 0.3s ease-out'
        }}>
          Trending Products
        </h2>
      </div>

      {/* Scrollable Container */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            gap: 'clamp(12px, 3vw, 16px)',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
            paddingBottom: '8px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(37, 99, 235, 0.3) transparent',
            alignItems: 'stretch',
            paddingLeft: 'clamp(4px, 2vw, 8px)',
            paddingRight: 'clamp(4px, 2vw, 8px)'
          }}
          className="trending-scroll-container"
        >
          {products.map((product) => (
            <div
              key={product.sku}
              onClick={() => openModal(product)}
              style={{ textDecoration: 'none', minWidth: 'clamp(240px, 85vw, 280px)', maxWidth: 'clamp(240px, 85vw, 280px)', display: 'flex', flexShrink: 0, cursor: 'pointer' }}
            >
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--machined-border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  height: 'auto',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Product Image */}
                <div style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: '#f8fafc',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {product.image && product.image !== '/no-image-placeholder.webp' ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        objectPosition: 'center',
                        padding: 'clamp(8px, 3vw, 12px)'
                      }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/no-image-placeholder.webp';
                      }}
                    />
                  ) : (
                    <img
                      src="/no-image-placeholder.webp"
                      alt="No image available"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        objectPosition: 'center',
                        padding: 'clamp(8px, 3vw, 12px)'
                      }}
                    />
                  )}
                </div>

                {/* Product Info */}
                <div style={{ padding: 'clamp(10px, 2.5vw, 14px)', display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
                  {/* Brand */}
                  <div style={{
                    fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(15,23,42,0.5)',
                    fontWeight: 600,
                    flexShrink: 0,
                    height: 'clamp(10px, 2vw, 12px)'
                  }}>
                    {product.brand}
                  </div>

                  {/* Spacing after brand */}
                  <div style={{ height: 'clamp(4px, 1vw, 6px)' }}></div>

                  {/* Name */}
                  <h3 style={{
                    fontSize: 'clamp(0.8rem, 2vw, 0.95rem)',
                    fontWeight: 700,
                    color: 'black',
                    margin: 0,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    flexShrink: 0,
                    height: 'clamp(32px, 6vw, 40px)'
                  }}>
                    {product.name}
                  </h3>

                  {/* Spacing after name */}
                  <div style={{ height: 'clamp(4px, 1vw, 6px)' }}></div>

                  {/* SKU & UPC Info - Fixed height */}
                  <div style={{
                    fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)',
                    color: 'rgba(15,23,42,0.6)',
                    margin: 0,
                    lineHeight: 1.3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'clamp(1px, 0.5vw, 2px)',
                    flexShrink: 0,
                    height: 'clamp(32px, 5vw, 40px)'
                  }}>
                    {product.sku && (
                      <div style={{ fontFamily: 'monospace', color: 'rgba(15,23,42,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>SKU:</span> {product.sku}
                      </div>
                    )}
                    {product.upc && (
                      <div style={{ fontFamily: 'monospace', color: 'rgba(15,23,42,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>UPC:</span> {product.upc}
                      </div>
                    )}
                  </div>

                  {/* Spacer that pushes price to bottom */}
                  <div style={{ flex: 1, minHeight: 'clamp(4px, 1vw, 6px)' }}></div>

                  {/* Price */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingTop: 'clamp(6px, 1.5vw, 8px)',
                    borderTop: '1px solid rgba(15,23,42,0.06)',
                    flexShrink: 0,
                    height: 'clamp(28px, 4vw, 34px)'
                  }}>
                    <span style={{
                      fontSize: 'clamp(1rem, 2.8vw, 1.4rem)',
                      fontWeight: 800,
                      color: 'var(--primary-600)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap'
                    }}>
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll Controls - Desktop Only */}
        <button
          onClick={() => scroll('left')}
          style={{
            position: 'absolute',
            left: '-60px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'white',
            border: '1px solid var(--machined-border)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-600)';
            e.currentTarget.style.borderColor = 'var(--primary-600)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.borderColor = 'var(--machined-border)';
            e.currentTarget.style.color = 'black';
          }}
          aria-label="Scroll left"
          className="scroll-button-left"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={() => scroll('right')}
          style={{
            position: 'absolute',
            right: '-60px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'white',
            border: '1px solid var(--machined-border)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-600)';
            e.currentTarget.style.borderColor = 'var(--primary-600)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.borderColor = 'var(--machined-border)';
            e.currentTarget.style.color = 'black';
          }}
          aria-label="Scroll right"
          className="scroll-button-right"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Product detail modal */}
      {isModalOpen && modalProduct && (
        <>
          {/* Backdrop covers full screen */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 10001 }}
            onClick={closeModal}
            aria-hidden="true"
          />
          {/* Scroll container starts below the fixed header */}
          <div
            className="fixed left-0 right-0 bottom-0 overflow-y-auto"
            style={{ zIndex: 10002, top: 'var(--header-height, 100px)' }}
            role="dialog"
            aria-modal="true"
            aria-label={modalProduct.name || 'Product detail'}
          >
            <div
              className="flex items-start justify-center min-h-full p-4 py-6"
              onClick={closeModal}
            >
              <div
                className="w-full max-w-6xl"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductDetail product={modalProduct} onAddToCart={handleAddToCart} onClose={closeModal} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
