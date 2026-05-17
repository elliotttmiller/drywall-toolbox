import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Helpers — purely derived from props, no external state needed.
// ---------------------------------------------------------------------------

function getDisplayCode(part) {
  return part?.sku || part?.source_sku || '';
}

function getCodeLabel(part) {
  return part?.sku ? 'SKU' : part?.source_sku ? 'Ref' : 'SKU';
}

function getPriceLabel(product, part, stockStatus) {
  const livePrice = parseFloat(product?.price);
  if (Number.isFinite(livePrice) && livePrice > 0) return `$${livePrice.toFixed(2)}`;
  if (part?.sku && stockStatus === null) return '...';
  return 'Unavailable';
}

function StockBadge({ stockStatus }) {
  const label =
    stockStatus === 'instock'    ? '● In Stock'
    : stockStatus === 'outofstock' ? '● Out of Stock'
    : stockStatus === 'unknown'    ? '● Unavailable'
    : '…';
  const color =
    stockStatus === 'instock'    ? '#16a34a'
    : stockStatus === 'outofstock' ? '#dc2626'
    : '#6b7280';
  return <span style={{ fontWeight: 700, color, fontSize: 'inherit' }}>{label}</span>;
}

// ---------------------------------------------------------------------------
// SchematicHotspotCard
//
// Renders the hotspot part detail card used in both the mobile overlay modal
// and the desktop detached modal. All backend/catalog wiring (stock-status
// fetch, add-to-cart, lightbox) is owned by the parent (Schematics.jsx) and
// passed in as props — this component is purely presentational.
//
// Props:
//   part           – hotspot part: { name, sku, source_sku, quantity, id }
//   product        – live WC product object (hotspotProduct); null while loading
//   stockStatus    – 'instock' | 'outofstock' | 'unknown' | null (null = loading)
//   addingToCart   – part.id currently being added to cart, or null
//   onAddToCart()  – fires when the add-to-cart button is pressed
//   onClose()      – optional; when provided renders the × close button
//   onLightboxOpen()– optional; makes the thumbnail a lightbox-opening button
//   variant        – 'mobile' (default) | 'desktop'
//
// Layout:
//   mobile  – close btn (absolute) → top-row (thumb + info stack) → footer (price + CTA)
//   desktop – flat children for the CSS-grid .part-modal-detached container:
//             col-1: image / skeleton   col-2: title → SKU → status → price+CTA
// ---------------------------------------------------------------------------

export default function SchematicHotspotCard({
  part,
  product,
  stockStatus,
  addingToCart,
  onAddToCart,
  onClose,
  onLightboxOpen,
  variant = 'mobile',
}) {
  if (!part) return null;

  const displayCode  = getDisplayCode(part);
  const codeLabel    = getCodeLabel(part);
  const priceLabel   = getPriceLabel(product, part, stockStatus);
  const isAdding     = addingToCart === part.id;
  const canAdd       = Boolean(product?.id) && stockStatus !== null;
  const isResolving  = Boolean(part.sku) && stockStatus === null;

  const ctaLabel = isAdding    ? (variant === 'mobile' ? 'Adding…' : '…')
    : isResolving ? (variant === 'mobile' ? 'Resolving…' : 'Resolving…')
    : canAdd      ? (variant === 'mobile' ? 'Add to Cart' : 'Add')
    : 'Unavailable';

  const titleNode = product?.slug ? (
    <Link
      to={`/products/${product.slug}`}
      onClick={(e) => e.stopPropagation()}
      style={{ color: 'inherit', textDecoration: 'none' }}
      className="hotspot-modal-title-link"
    >
      {part.name}
    </Link>
  ) : part.name;

  // ── Desktop variant ────────────────────────────────────────────────────────
  // Renders flat children that slot into the CSS-grid `.part-modal-detached`
  // (col-1: image; col-2: title → sku → status → price/CTA).
  if (variant === 'desktop') {
    return (
      <>
        {/* Column 1 — image or skeleton */}
        {product?.images?.[0] ? (
          <button
            className="hotspot-modal-image-btn"
            onClick={(e) => { e.stopPropagation(); onLightboxOpen?.(); }}
            aria-label="View full-size image"
            title="View full-size image"
          >
            <img
              src={product.images[0]}
              alt={part.name}
              className="hotspot-modal-image"
            />
          </button>
        ) : isResolving ? (
          <div className="hotspot-modal-image-skeleton hotspot-modal-image-skeleton--desktop" aria-hidden="true" />
        ) : null}

        {/* Column 2 — title */}
        <h4 style={{
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          marginBottom: '4px',
          lineHeight: '1.3',
        }}>
          {titleNode}
        </h4>

        {/* Column 2 — SKU */}
        {displayCode ? (
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '4px' }}>
            {codeLabel}: {displayCode}
            {part.quantity > 1 && ` | Qty: ${part.quantity}`}
          </div>
        ) : null}

        {/* Column 2 — stock status */}
        <div className="part-meta" style={{ fontSize: '0.68rem', marginBottom: '8px' }}>
          <StockBadge stockStatus={stockStatus} />
        </div>

        {/* Column 2 — price + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
            {priceLabel}
          </span>
          <button
            className="alloy-button"
            style={{ padding: '8px 16px', fontSize: '0.6rem' }}
            disabled={!canAdd || isAdding}
            onClick={(e) => { e.stopPropagation(); onAddToCart?.(); }}
          >
            {ctaLabel}
          </button>
        </div>
      </>
    );
  }

  // ── Mobile variant (default) ───────────────────────────────────────────────
  // Renders the full card body inside `.mobile-part-modal-overlay`.
  return (
    <>
      {/* Close button */}
      {onClose && (
        <button
          className="mobile-modal-close-btn"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,23,42,0.06)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#0f172a',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}

      {/* Top row — thumbnail (left) + info stack (right) */}
      <div className="mobile-modal-top-row">
        <div className="mobile-modal-thumb">
          {product?.images?.[0] ? (
            <button
              className="hotspot-modal-image-btn hotspot-modal-image-btn--mobile"
              onClick={(e) => { e.stopPropagation(); onLightboxOpen?.(); }}
              aria-label="View full-size image"
              title="View full-size image"
            >
              <img
                src={product.images[0]}
                alt={part.name}
                className="hotspot-modal-image hotspot-modal-image--mobile"
              />
            </button>
          ) : isResolving ? (
            <div className="hotspot-modal-image-skeleton" aria-hidden="true" />
          ) : null}
        </div>

        <div className="mobile-modal-info">
          {/* Product name */}
          <h4 style={{
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            fontWeight: '700',
            letterSpacing: '0.08em',
            marginBottom: '6px',
            lineHeight: '1.35',
            wordBreak: 'break-word',
            color: '#0f172a',
          }}>
            {titleNode}
          </h4>

          {/* SKU — own line, below name */}
          {displayCode ? (
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '4px' }}>
              {codeLabel}: {displayCode}
              {part.quantity > 1 && ` | Qty: ${part.quantity}`}
            </div>
          ) : null}

          {/* Stock status — own line, below SKU */}
          <div className="part-meta" style={{ fontSize: '0.72rem' }}>
            <StockBadge stockStatus={stockStatus} />
          </div>
        </div>
      </div>

      {/* Footer — price (left) + add-to-cart button (right) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '14px',
        borderTop: '1px solid rgba(15,23,42,0.08)',
        gap: '12px',
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
            borderRadius: '8px',
            clipPath: 'none',
            fontWeight: '700',
          }}
          disabled={!canAdd || isAdding}
          onClick={(e) => { e.stopPropagation(); onAddToCart?.(); }}
        >
          {ctaLabel}
        </button>
      </div>
    </>
  );
}
