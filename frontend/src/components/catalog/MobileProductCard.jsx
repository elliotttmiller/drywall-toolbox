import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { ShoppingCart, SlidersHorizontal } from 'lucide-react';
import ProductCardImage from '../product/ProductCardImage';

// ── Helpers ──────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function money(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value || '0'));
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function calcDiscountPct(salePrice, regularPrice) {
  const sale    = parseFloat(salePrice);
  const regular = parseFloat(regularPrice);
  if (!Number.isFinite(sale) || !Number.isFinite(regular) || regular <= 0) return null;
  const pct = Math.round((1 - sale / regular) * 100);
  return pct > 0 ? pct : null;
}

// ── Tag badge SVG (price-tag icon) ──────────────────────────────────────────

function TagIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9A2 2 0 0 0 13 22a2 2 0 0 0 1.41-.59l7-7A2 2 0 0 0 22 13a2 2 0 0 0-.59-1.42zM5.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
    </svg>
  );
}

// ── MobileProductCard ─────────────────────────────────────────────────────────
/**
 * MobileProductCard
 *
 * CSR-inspired mobile-first product card.  Drop-in compatible with StorefrontProductTile
 * (same prop interface) but styled for optimal mobile UX:
 *   • Tag-style discount badge ("29% off" / "Sale") in the upper-left corner
 *   • "From $X.xx USD" format with strikethrough original price for sale items
 *   • Full-width "Add to Cart" or "Options" CTA at the bottom
 *   • Clean white card — no hover-overlay complexity on touch devices
 *
 * Props
 *   product       – canonical product object from the catalog/WC API
 *   cardProduct   – optional override (e.g. first-variation thumbnail substitution)
 *   onOpenModal   – open the detail/quick-view modal
 *   onAddToCart   – add simple product to cart
 *   index         – stagger delay for the entrance animation (0-based)
 *   variant       – 'grid' | 'rail' | 'list'  (default: 'grid')
 */
export default function MobileProductCard({
  product,
  cardProduct,
  onOpenModal,
  onAddToCart,
  index = 0,
  variant = 'grid',
}) {
  const resolved    = cardProduct || product || {};
  const isVariable  = Boolean(product?.is_variable);
  const stockStatus = resolved.stock_status || product?.stock_status || 'instock';
  const outOfStock  = stockStatus === 'outofstock';
  const name        = resolved.name || product?.name || resolved.part_number || 'Product';
  const sku         = resolved.sku  || product?.sku  || '';
  const brand       = resolved.brand || product?.brand || '';

  // ── Price computation ──────────────────────────────────────────────────────
  const salePrice    = resolved.sale_price    ?? product?.sale_price;
  const regularPrice = resolved.regular_price ?? product?.regular_price;
  const price        = resolved.price         ?? product?.price ?? 0;
  const minPrice     = product?.min_price     ?? resolved.min_price;

  const onSale = !isVariable
    && salePrice && regularPrice
    && parseFloat(salePrice) < parseFloat(regularPrice);

  const discountPct    = onSale ? calcDiscountPct(salePrice, regularPrice) : null;
  const isVariableOnSale = isVariable && Boolean(product?.is_on_sale);

  // Badge text (null = no badge)
  let badgeText = null;
  if (outOfStock)        badgeText = 'Out of Stock';
  else if (discountPct)  badgeText = `${discountPct}% off`;
  else if (isVariableOnSale) badgeText = 'Sale';

  // Price display strings
  let priceDisplay    = null;
  let originalDisplay = null;

  if (isVariable && minPrice != null) {
    priceDisplay = `From $${money(minPrice)} USD`;
  } else if (onSale) {
    priceDisplay    = `$${money(salePrice)} USD`;
    originalDisplay = `$${money(regularPrice)}`;
  } else {
    priceDisplay = `$${money(price)} USD`;
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  const isMobile  = useIsMobile();
  const navigate  = useNavigate();
  const cardRef   = useRef(null);
  const slug      = resolved.slug || product?.slug;
  const productUrl = slug ? `/products/${slug}` : null;

  const handleCardClick = useCallback(() => {
    if (productUrl) navigate(productUrl);
  }, [productUrl, navigate]);

  const handleAddToCartClick = useCallback((e) => {
    e.stopPropagation();
    onAddToCart?.();
  }, [onAddToCart]);

  const handleOpenModal = useCallback((e) => {
    e.stopPropagation();
    onOpenModal?.();
  }, [onOpenModal]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const imageAreaSizes = variant === 'rail'
    ? '(max-width: 767px) 44vw, 190px'
    : '(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 240px';

  const isListVariant = variant === 'list';

  return (
    <Motion.article
      ref={cardRef}
      className={`dtb-mobile-card dtb-mobile-card--${variant}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03 }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
      aria-label={`View ${name}`}
    >
      {/* ── Image area ────────────────────────────────────────────────────── */}
      <div className="dtb-mobile-card__image">
        {badgeText && (
          <div
            className={`dtb-mobile-card__badge ${
              outOfStock ? 'dtb-mobile-card__badge--out' : 'dtb-mobile-card__badge--sale'
            }`}
          >
            {!outOfStock && <TagIcon />}
            <span>{badgeText}</span>
          </div>
        )}

        <ProductCardImage
          product={resolved}
          src={resolved.image_thumbnail || resolved.image}
          srcSet={resolved.image_srcset}
          sizes={imageAreaSizes}
          alt={name}
          className="dtb-mobile-card__img"
          padding="0"
          fit="contain"
          preferThumbnail
          eager={index < 4}
        />
      </div>

      {/* ── Meta area ─────────────────────────────────────────────────────── */}
      <div
        className="dtb-mobile-card__meta"
        onClick={(e) => e.stopPropagation()}
      >
        {brand && (
          <span className="dtb-mobile-card__brand">{brand}</span>
        )}

        <button
          type="button"
          className="dtb-mobile-card__name"
          onClick={handleCardClick}
          aria-label={`View product details for ${name}`}
        >
          {name}
        </button>

        {/* SKU — shown in list variant */}
        {isListVariant && sku && (
          <span className="dtb-mobile-card__sku">SKU: {sku}</span>
        )}

        {/* Price row */}
        <div className="dtb-mobile-card__price-row">
          <span
            className={[
              'dtb-mobile-card__price',
              outOfStock ? 'dtb-mobile-card__price--muted' : '',
              (onSale || isVariableOnSale) && !outOfStock ? 'dtb-mobile-card__price--sale' : '',
            ].filter(Boolean).join(' ')}
          >
            {priceDisplay}
          </span>
          {originalDisplay && !outOfStock && (
            <span className="dtb-mobile-card__price-original">{originalDisplay}</span>
          )}
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div className="dtb-mobile-card__actions">
          {isVariable ? (
            <button
              type="button"
              className="dtb-mobile-card__btn dtb-mobile-card__btn--options"
              onClick={isMobile ? handleOpenModal : handleOpenModal}
              aria-label={`Configure ${name}`}
            >
              <SlidersHorizontal size={13} strokeWidth={2.2} />
              <span>Options</span>
            </button>
          ) : (
            <button
              type="button"
              className="dtb-mobile-card__btn"
              onClick={handleAddToCartClick}
              disabled={outOfStock}
              aria-label={outOfStock ? `${name} is out of stock` : `Add ${name} to cart`}
            >
              <ShoppingCart size={13} strokeWidth={2.2} />
              <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>
          )}
        </div>
      </div>
    </Motion.article>
  );
}
