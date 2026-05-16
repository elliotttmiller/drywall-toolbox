import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCodeLabel(part) {
  return part?.sku ? 'SKU' : part?.source_sku ? 'Ref' : 'SKU';
}

function getDisplayCode(part) {
  return part?.sku || part?.source_sku || '';
}

function getPriceLabel(product, stockStatus, part) {
  const livePrice = parseFloat(product?.price);
  if (Number.isFinite(livePrice) && livePrice > 0) {
    return `$${livePrice.toFixed(2)}`;
  }
  if (part?.sku && stockStatus === null) return '…';
  return 'Unavailable';
}

// ── Stock badge ────────────────────────────────────────────────────────────────

function StockBadge({ status }) {
  const label =
    status === 'instock'    ? '● In Stock'    :
    status === 'outofstock' ? '● Out of Stock' :
    status === 'unknown'    ? '● Unavailable'  : '…';

  const color =
    status === 'instock'    ? '#16a34a' :
    status === 'outofstock' ? '#dc2626' : '#6b7280';

  return (
    <span style={{ marginLeft: 6, fontWeight: 700, color }}>
      {label}
    </span>
  );
}

// ── PartTitle (linked if product has a slug) ───────────────────────────────────

function PartTitle({ part, product, titleStyle }) {
  if (product?.slug) {
    return (
      <Link
        to={`/products/${product.slug}`}
        onClick={(e) => e.stopPropagation()}
        style={{ color: 'inherit', textDecoration: 'none' }}
        className="hotspot-modal-title-link"
      >
        {part?.name}
      </Link>
    );
  }
  return <>{part?.name}</>;
}

// ── Desktop detached modal content ────────────────────────────────────────────

function DesktopCard({ cardRef, part, product, stockStatus, addingToCart, onAddToCart, onLightbox, modalPosition }) {
  const codeLabel    = getCodeLabel(part);
  const displayCode  = getDisplayCode(part);
  const priceLabel   = getPriceLabel(product, stockStatus, part);
  const isLoading    = part?.sku && stockStatus === null;

  return (
    <div
      ref={cardRef}
      className="part-modal part-modal-detached"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top:  `${modalPosition.top}px`,
        left: `${modalPosition.left}px`,
      }}
    >
      {/* Product thumbnail */}
      {product?.images?.[0] ? (
        <button
          className="hotspot-modal-image-btn"
          onClick={(e) => { e.stopPropagation(); onLightbox?.(); }}
          aria-label="View full-size image"
          title="View full-size image"
        >
          <img
            src={product.images[0]}
            alt={part?.name}
            className="hotspot-modal-image"
          />
        </button>
      ) : isLoading ? (
        <div
          className="hotspot-modal-image-skeleton hotspot-modal-image-skeleton--desktop"
          aria-hidden="true"
        />
      ) : null}

      {/* Part name */}
      <h4 style={{
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        letterSpacing: '0.1em',
        marginBottom: 8,
        lineHeight: 1.3,
        color: '#0f172a',
      }}>
        <PartTitle part={part} product={product} />
      </h4>

      {/* Meta: SKU / stock */}
      <div className="part-meta">
        {codeLabel}: {displayCode}
        {part?.quantity > 1 && ` | Qty: ${part.quantity}`}
        <StockBadge status={stockStatus} />
      </div>

      {/* Price + CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
          {priceLabel}
        </span>
        <button
          className="alloy-button"
          style={{ padding: '8px 16px', fontSize: '0.6rem' }}
          disabled={!product?.id || stockStatus === null || addingToCart === part?.id}
          onClick={(e) => { e.stopPropagation(); onAddToCart?.(part); }}
        >
          {addingToCart === part?.id
            ? '…'
            : isLoading
              ? 'Resolving…'
              : product?.id
                ? 'Add'
                : 'Unavailable'}
        </button>
      </div>
    </div>
  );
}

// ── Mobile overlay ─────────────────────────────────────────────────────────────

function MobileCard({ part, product, stockStatus, addingToCart, onAddToCart, onClose, onLightbox }) {
  const codeLabel   = getCodeLabel(part);
  const displayCode = getDisplayCode(part);
  const priceLabel  = getPriceLabel(product, stockStatus, part);
  const isLoading   = part?.sku && stockStatus === null;

  return (
    <>
      {/* Backdrop */}
      <div className="mobile-modal-backdrop" onClick={onClose} />

      {/* Card */}
      <div
        className="mobile-part-modal-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="mobile-modal-close-btn"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,23,42,0.06)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#0f172a',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Top row: thumbnail + info */}
        <div className="mobile-modal-top-row">
          <div className="mobile-modal-thumb">
            {product?.images?.[0] ? (
              <button
                className="hotspot-modal-image-btn hotspot-modal-image-btn--mobile"
                onClick={(e) => { e.stopPropagation(); onLightbox?.(); }}
                aria-label="View full-size image"
                title="View full-size image"
              >
                <img
                  src={product.images[0]}
                  alt={part?.name}
                  className="hotspot-modal-image hotspot-modal-image--mobile"
                />
              </button>
            ) : isLoading ? (
              <div className="hotspot-modal-image-skeleton" aria-hidden="true" />
            ) : null}
          </div>

          <div className="mobile-modal-info">
            <h4 style={{
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 6,
              lineHeight: 1.35,
              wordBreak: 'break-word',
              color: '#0f172a',
            }}>
              <PartTitle part={part} product={product} />
            </h4>

            <div className="part-meta" style={{ fontSize: '0.75rem' }}>
              {codeLabel}: {displayCode}
              {part?.quantity > 1 && ` | Qty: ${part.quantity}`}
              <StockBadge status={stockStatus} />
            </div>
          </div>
        </div>

        {/* Bottom row: price + CTA */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 14,
          borderTop: '1px solid rgba(15,23,42,0.08)',
          gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: '1.3rem',
            color: 'var(--tension-accent)',
          }}>
            {priceLabel}
          </span>

          <button
            className="alloy-button"
            style={{
              padding: '10px 20px',
              fontSize: '0.75rem',
              borderRadius: 8,
              clipPath: 'none',
              fontWeight: 700,
            }}
            disabled={!product?.id || stockStatus === null || addingToCart === part?.id}
            onClick={(e) => { e.stopPropagation(); onAddToCart?.(part); }}
          >
            {addingToCart === part?.id
              ? 'Adding…'
              : isLoading
                ? 'Resolving…'
                : product?.id
                  ? 'Add to Cart'
                  : 'Unavailable'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── SchematicHotspotCard ──────────────────────────────────────────────────────
/**
 * SchematicHotspotCard
 *
 * Encapsulates the hotspot detail card shown when a user clicks a schematic
 * hotspot.  Renders two distinct layouts determined by `isMobile`:
 *
 *   Desktop (isMobile=false)
 *     A compact 2-column card positioned absolutely inside .schematic-container
 *     (but outside the transform wrapper so it never scales/pans with the image).
 *     The ref forwarded to this component is attached to the inner card div so
 *     the parent can measure its dimensions for boundary-aware positioning.
 *
 *   Mobile (isMobile=true)
 *     A full-screen backdrop + centred sheet overlay (both position:fixed) that
 *     renders on top of the schematic viewer.  The fixed positioning is immune
 *     to any transform ancestor in the DOM.
 *
 * Props
 *   part          – active hotspot part data ({ id, name, sku, quantity, … })
 *   product       – live WooCommerce product fetched by SKU (may be null while loading)
 *   stockStatus   – 'instock' | 'outofstock' | 'unknown' | null (null = loading)
 *   addingToCart  – part.id string while add-to-cart in flight, else null
 *   onAddToCart   – (part) => void
 *   onClose       – () => void  (mobile close button / backdrop tap)
 *   onLightbox    – () => void  (open full-size image lightbox)
 *   isMobile      – boolean
 *   modalPosition – { top: number, left: number }  (desktop only, px from container origin)
 */
const SchematicHotspotCard = forwardRef(function SchematicHotspotCard(
  {
    part,
    product,
    stockStatus,
    addingToCart,
    onAddToCart,
    onClose,
    onLightbox,
    isMobile,
    modalPosition,
  },
  ref,
) {
  if (!part) return null;

  if (isMobile) {
    return (
      <MobileCard
        part={part}
        product={product}
        stockStatus={stockStatus}
        addingToCart={addingToCart}
        onAddToCart={onAddToCart}
        onClose={onClose}
        onLightbox={onLightbox}
      />
    );
  }

  // Desktop — ref goes directly to the .part-modal-detached div
  return (
    <DesktopCard
      cardRef={ref}
      part={part}
      product={product}
      stockStatus={stockStatus}
      addingToCart={addingToCart}
      onAddToCart={onAddToCart}
      onLightbox={onLightbox}
      modalPosition={modalPosition}
    />
  );
});

export default SchematicHotspotCard;
