/**
 * ui/ProductShoppingCard.jsx — IndoUI Shopping Card (drop-in for ProductCard.jsx)
 *
 * Props (identical to ProductCard.jsx):
 *   product              Source product (parent for variable)
 *   cardProduct          Resolved display product
 *   hasSelectedVariation boolean
 *   onOpenModal          () => void
 *   onAddToCart          () => void
 *   index                number (staggered animation delay)
 *
 * Visual shell replaced; all business logic identical.
 * Importing pages (Products.jsx, AllProducts.jsx, CategoryPage.jsx) only need
 * to swap the import path — no prop changes required.
 */

import { motion as Motion } from 'framer-motion';
import { ShoppingCart, Heart, ChevronRight, Eye } from 'lucide-react';
import ProductCardImage from '../ProductCardImage';

const STOCK_STATUS_OUT_OF_STOCK = 'outofstock';

// Badge configuration
const BADGE_CONFIG = {
  'Best Seller': { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' },
  Popular:       { bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: '#fff' },
  New:           { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' },
  Sale:          { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff' },
};

export default function ProductShoppingCard({
  product,
  cardProduct,
  hasSelectedVariation = false,
  onOpenModal,
  onAddToCart,
  index = 0,
}) {
  const effectiveProduct = cardProduct || product;
  const isOutOfStock = (effectiveProduct?.stock_status || product.stock_status) === STOCK_STATUS_OUT_OF_STOCK;
  const isOnSale = effectiveProduct?.on_sale || product.on_sale;
  const badgeLabel = product.badge || (isOnSale && !product.badge ? 'Sale' : null);
  const badgeStyle = badgeLabel ? (BADGE_CONFIG[badgeLabel] || BADGE_CONFIG.Sale) : null;

  const displayPrice = product.is_variable && !hasSelectedVariation && product.min_price != null
    ? `From $${Number(product.min_price).toFixed(2)}`
    : `$${typeof effectiveProduct.price === 'number'
        ? effectiveProduct.price.toFixed(2)
        : parseFloat(effectiveProduct.price || 0).toFixed(2)
      }`;

  return (
    <Motion.div
      className="dtb-plp-card product-card-enter group"
      style={{ '--card-index': index }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.38,
        delay: index * 0.04,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -4 }}
    >
      {/* ── Image area ──────────────────────────────────────────────────────── */}
      <div
        className="dtb-plp-card__img-wrap"
        style={{
          position: 'relative',
          borderRadius: '12px 12px 0 0',
          overflow: 'hidden',
          background: '#f8fafc',
        }}
      >
        {/* Clickable overlay — opens modal */}
        <button
          type="button"
          className="dtb-plp-card__img-btn"
          onClick={onOpenModal}
          aria-label={`View ${effectiveProduct.name || product.name || 'product'}`}
        >
          <ProductCardImage
            src={effectiveProduct.image || product.image}
            alt={effectiveProduct.name || product.name}
            padding="12px"
          />
        </button>

        {/* Out-of-stock overlay */}
        {isOutOfStock && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.70)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}>
            <span style={{
              background: 'rgba(15,23,42,0.85)', color: 'white',
              fontSize: '0.72rem', fontWeight: 700,
              padding: '5px 14px', borderRadius: '999px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              Out of Stock
            </span>
          </div>
        )}

        {/* Badge */}
        {badgeLabel && badgeStyle && (
          <span
            className={`dtb-plp-card__badge dtb-plp-card__badge--${badgeLabel === 'Best Seller' ? 'bestseller' : badgeLabel.toLowerCase()}`}
            style={{
              position: 'absolute', top: '10px', left: '10px',
              background: badgeStyle.bg, color: badgeStyle.color,
              fontSize: '0.62rem', fontWeight: 800,
              padding: '3px 10px', borderRadius: '999px',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
            }}
          >
            {badgeLabel}
          </span>
        )}

        {/* Wishlist */}
        <button
          type="button"
          className="dtb-plp-card__wishlist"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '30px', height: '30px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(15,23,42,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 6px rgba(15,23,42,0.08)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f6'; e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.color = 'inherit'; }}
        >
          <Heart size={13} />
        </button>

        {/* Quick-view hover CTA */}
        <button
          type="button"
          onClick={onOpenModal}
          aria-label="Quick view"
          style={{
            position: 'absolute', bottom: '10px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15,23,42,0.82)',
            color: 'white',
            border: 'none',
            borderRadius: '999px',
            padding: '6px 16px',
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
            backdropFilter: 'blur(4px)',
            opacity: 0,
            transition: 'opacity 0.18s',
          }}
          className="dtb-plp-card__quickview"
        >
          <Eye size={11} /> Quick View
        </button>
      </div>

      {/* ── Card body ────────────────────────────────────────────────────────── */}
      <div className="dtb-plp-card__body" style={{ padding: '14px 16px 16px' }}>
        {/* Brand eyebrow */}
        {(effectiveProduct.brand || product.brand) && (
          <p className="dtb-plp-card__brand" style={{
            fontSize: '0.65rem', fontWeight: 700,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: 'var(--primary-600)', margin: '0 0 5px',
          }}>
            {effectiveProduct.brand || product.brand}
          </p>
        )}

        {/* Product name */}
        <h3 className="dtb-plp-card__name" style={{ margin: '0 0 4px' }}>
          <button
            type="button"
            onClick={onOpenModal}
            className="dtb-plp-card__name-btn"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textAlign: 'left', fontSize: '0.875rem',
              fontWeight: 700, color: '#0f172a',
              lineHeight: 1.35, width: '100%',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary-600)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#0f172a'; }}
          >
            {effectiveProduct.name || effectiveProduct.part_number || product.name || product.part_number}
          </button>
        </h3>

        {/* SKU */}
        {(effectiveProduct.sku || product.sku || effectiveProduct.part_number) && (
          <p className="dtb-plp-card__sku" style={{
            fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
            color: 'rgba(15,23,42,0.4)', margin: '0 0 12px',
          }}>
            SKU:&nbsp;{effectiveProduct.sku || product.sku || effectiveProduct.part_number}
          </p>
        )}

        {/* Footer: price + CTA */}
        <div className="dtb-plp-card__footer" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        }}>
          <p className={`dtb-plp-card__price${isOutOfStock ? ' dtb-plp-card__price--oos' : ''}`} style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem', fontWeight: 800,
            color: isOutOfStock ? 'rgba(15,23,42,0.35)' : 'var(--primary-600)',
          }}>
            {displayPrice}
          </p>

          {product.is_variable ? (
            hasSelectedVariation ? (
              <button
                type="button"
                className="dtb-plp-card__cta dtb-plp-card__cta--cart"
                onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
                disabled={isOutOfStock}
                aria-label="Add selected variation to cart"
                style={ctaStyle(isOutOfStock, 'cart')}
              >
                <ShoppingCart size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="dtb-plp-card__cta dtb-plp-card__cta--options"
                onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
                aria-label="View options"
                style={ctaStyle(false, 'options')}
              >
                Options&nbsp;<ChevronRight size={11} />
              </button>
            )
          ) : (
            <button
              type="button"
              className="dtb-plp-card__cta dtb-plp-card__cta--cart"
              onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
              disabled={isOutOfStock}
              aria-label="Add to cart"
              style={ctaStyle(isOutOfStock, 'cart')}
            >
              <ShoppingCart size={15} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        .dtb-plp-card:hover .dtb-plp-card__quickview {
          opacity: 1 !important;
        }
      `}</style>
    </Motion.div>
  );
}

function ctaStyle(disabled, variant) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: variant === 'options' ? '7px 12px' : '8px',
    borderRadius: '9px', border: 'none',
    background: disabled
      ? 'rgba(15,23,42,0.08)'
      : variant === 'options'
        ? 'rgba(37,99,235,0.08)'
        : 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
    color: disabled
      ? 'rgba(15,23,42,0.3)'
      : variant === 'options' ? 'var(--primary-700)' : 'white',
    fontSize: '0.78rem', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    flexShrink: 0,
    boxShadow: !disabled && variant === 'cart' ? '0 3px 10px rgba(37,99,235,0.25)' : 'none',
    transition: 'transform 0.15s, box-shadow 0.15s',
  };
}
