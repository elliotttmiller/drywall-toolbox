import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Eye, Heart } from 'lucide-react';
import ProductCardImage from '../product/ProductCardImage';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
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
  const numeric = typeof value === 'number' ? value : parseFloat(String(value || '0'));
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
}

/** Strip HTML tags and return a plain-text excerpt for the list card description. */
function stripHtml(html, maxLen = 72) {
  if (!html) return '';
  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + '…' : plain;
}

export default function StorefrontProductTile({
  product,
  cardProduct,
  onOpenModal,
  onAddToCart,
  index = 0,
  variant = 'grid',
}) {
  const resolved = cardProduct || product || {};
  const isVariable = Boolean(product?.is_variable);
  const stockStatus = resolved.stock_status || product?.stock_status || 'instock';
  const outOfStock = stockStatus === 'outofstock';
  const name = resolved.name || product?.name || resolved.part_number || 'Product';
  const sku = resolved.sku || product?.sku || '';
  const desc = stripHtml(resolved.short_description || resolved.description || '');
  const priceStr = isVariable && product?.min_price != null
    ? `From $${money(product.min_price)}`
    : `$${money(resolved.price ?? product?.price ?? 0)}`;
  const onSale = !isVariable && resolved.sale_price && resolved.regular_price
    && parseFloat(resolved.sale_price) < parseFloat(resolved.regular_price);

  const isMobile = useIsMobile();
  // Unified overlay state — activated by tap (mobile) or hover (desktop)
  const [overlayActive, setOverlayActive] = useState(false);
  const cardRef = useRef(null);
  const navigate = useNavigate();

  const slug = resolved.slug || product?.slug;
  const productUrl = slug ? `/products/${slug}` : null;

  // Dismiss when user taps/clicks outside the card
  useEffect(() => {
    if (!overlayActive || !isMobile) return undefined;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setOverlayActive(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [overlayActive, isMobile]);

  const handleImageClick = useCallback(() => {
    if (!isMobile) {
      // Desktop: image click navigates directly; overlay is hover-driven
      if (productUrl) navigate(productUrl);
      return;
    }
    if (overlayActive) {
      // Second tap on image (not an overlay button) → navigate
      setOverlayActive(false);
      if (productUrl) navigate(productUrl);
      return;
    }
    setOverlayActive(true);
  }, [isMobile, overlayActive, productUrl, navigate]);

  // Desktop hover handlers
  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setOverlayActive(true);
  }, [isMobile]);
  const handleMouseLeave = useCallback(() => {
    if (!isMobile) setOverlayActive(false);
  }, [isMobile]);

  // When overlay is active any card interaction outside overlay buttons → navigate
  const handleCardInteract = useCallback((fallback) => (e) => {
    if (isMobile && overlayActive) {
      e.stopPropagation();
      setOverlayActive(false);
      if (productUrl) navigate(productUrl);
      return;
    }
    fallback?.(e);
  }, [isMobile, overlayActive, productUrl, navigate]);

  const handleQuickView = useCallback((e) => {
    e.stopPropagation();
    setOverlayActive(false);
    onOpenModal?.();
  }, [onOpenModal]);

  const handleOverlayAddToCart = useCallback((e) => {
    e.stopPropagation();
    setOverlayActive(false);
    onAddToCart?.();
  }, [onAddToCart]);

  // Badge is top-right on grid/rail, top-left on list (image stripe is narrow)
  const badgePositionClass = variant === 'list'
    ? 'dtb-product-card__badge--left'
    : 'dtb-product-card__badge--right';

  const cardClassName = `dtb-product-card dtb-product-card--${variant} storefront-motion-card`;

  return (
    <article
      ref={cardRef}
      className={cardClassName}
      style={{ '--dtb-card-delay': `${Math.min(index, 8) * 30}ms` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="dtb-product-card__image"
        onClick={handleImageClick}
        aria-label={`View ${name}`}
      >
        {outOfStock && (
          <span className={`dtb-product-card__badge dtb-product-card__badge--out ${badgePositionClass}`}>
            Out of Stock
          </span>
        )}
        {onSale && !outOfStock && (
          <span className={`dtb-product-card__badge dtb-product-card__badge--sale ${badgePositionClass}`}>
            Sale
          </span>
        )}
        <ProductCardImage
          product={resolved}
          src={resolved.image_thumbnail || resolved.image}
          srcSet={resolved.image_srcset}
          sizes={
            variant === 'rail'
              ? '(max-width: 767px) 44vw, 188px'
              : variant === 'list'
                ? '(max-width: 767px) 42vw, 240px'
                : '(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 240px'
          }
          alt={name}
          className="dtb-product-card__img"
          padding="0"
          fit="contain"
          preferThumbnail
          eager={index < 4}
        />

        {/* Quick-view / action overlay — always rendered, visibility driven by CSS transitions */}
        {variant !== 'list' && (
          <div
            aria-hidden={!overlayActive}
            className={`dtb-product-card__qv-overlay${overlayActive ? ' dtb-product-card__qv-overlay--active' : ''}`}
            onClick={(e) => {
              // Tap on dim layer (not a button) → navigate
              e.stopPropagation();
              setOverlayActive(false);
              if (productUrl) navigate(productUrl);
            }}
          >
            <div className={`dtb-product-card__qv-actions${overlayActive ? ' dtb-product-card__qv-actions--active' : ''}`}>
              {/* Heart / Save — desktop only */}
              {!isMobile && (
                <button
                  type="button"
                  className="dtb-product-card__qv-icon-btn"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Save ${name} for later`}
                >
                  <Heart size={15} strokeWidth={2.2} />
                </button>
              )}

              {/* Quick View pill */}
              <button
                type="button"
                className="dtb-product-card__qv-btn"
                onClick={handleQuickView}
                aria-label={`Quick view ${name}`}
              >
                <Eye size={14} strokeWidth={2.2} />
                <span>Quick View</span>
              </button>

              {/* Add to Cart — simple products only; variable opens via Quick View.
                  Mobile: always visible, greyed + disabled when out of stock.
                  Desktop: hidden when out of stock (icon-only pill). */}
              {!isVariable && (isMobile || !outOfStock) && (
                <button
                  type="button"
                  disabled={outOfStock}
                  className={isMobile
                    ? `dtb-product-card__qv-btn${outOfStock ? ' dtb-product-card__qv-btn--disabled' : ''}`
                    : 'dtb-product-card__qv-icon-btn'
                  }
                  onClick={outOfStock ? (e) => e.stopPropagation() : handleOverlayAddToCart}
                  aria-label={outOfStock ? `${name} is out of stock` : `Add ${name} to cart`}
                >
                  <ShoppingCart size={isMobile ? 14 : 15} strokeWidth={2.2} />
                  {isMobile && <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>}
                </button>
              )}
            </div>
          </div>
        )}
      </button>

      {/* ── Meta area ─────────────────────────────────────────────── */}
      <div className="dtb-product-card__meta">

        {/* List variant: heart button floated to top-right */}
        {variant === 'list' && (
          <button
            type="button"
            className="dtb-product-card__heart-btn"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Save ${name} for later`}
          >
            <Heart size={14} strokeWidth={2} />
          </button>
        )}

        {resolved.brand ? <span className="dtb-product-card__brand">{resolved.brand}</span> : null}
        <button
          type="button"
          onClick={handleCardInteract(onOpenModal)}
          className="dtb-product-card__name"
          aria-label={`View product details for ${name}`}
        >
          {name}
        </button>

        {/* List variant: description snippet; others: SKU */}
        {variant === 'list'
          ? desc
            ? <p className="dtb-product-card__desc">{desc}</p>
            : sku
              ? <span className="dtb-product-card__sku">SKU: {sku}</span>
              : null
          : sku
            ? <span className="dtb-product-card__sku">SKU: {sku}</span>
            : null
        }

        <div className="dtb-product-card__divider" />

        <div className="dtb-product-card__footer">
          <strong
            className="dtb-product-card__price"
            style={{ color: outOfStock ? 'var(--dtb-muted)' : 'var(--dtb-text)' }}
          >
            {priceStr}
          </strong>
          {!isVariable && (
            <button
              type="button"
              onClick={handleCardInteract(onAddToCart)}
              disabled={outOfStock}
              className={`dtb-product-card__action${isMobile ? ' dtb-product-card__action--hidden-mobile' : ''}`}
              aria-label={`Add ${name} to cart`}
            >
              <ShoppingCart size={14} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}



