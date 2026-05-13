/**
 * frontend/src/components/product/ProductPrice.jsx
 *
 * Price display with variable/sale/simple formatting.
 *
 * Props:
 *   product           — parent product
 *   selectedVariation — selected variation or null
 */

export default function ProductPrice({ product, selectedVariation }) {
  const isVariable = product?.type === 'variable' || product?.is_variable;
  const hasVariation = !!selectedVariation;

  let displayPrice = null;
  let comparePrice = null;
  let prefix = '';
  let isOnSale = false;

  if (isVariable && !hasVariation) {
    // No selection yet — show "From $X"
    const minPrice = parseFloat(product?.price_min || product?.min_price || 0);
    displayPrice = minPrice > 0 ? minPrice : null;
    prefix = 'From ';
  } else {
    const source = hasVariation ? selectedVariation : product;
    const price   = parseFloat(source?.price ?? source?.regular_price ?? 0);
    const regular = parseFloat(source?.regular_price ?? 0);
    const sale    = parseFloat(source?.sale_price ?? 0);

    displayPrice = price;
    isOnSale     = source?.on_sale && sale > 0 && regular > sale;
    comparePrice = isOnSale ? regular : null;
  }

  if (displayPrice == null || !Number.isFinite(displayPrice)) return null;

  return (
    <div className="product-price" aria-label="Product price">
      {comparePrice != null && Number.isFinite(comparePrice) && (
        <span
          style={{
            fontSize: '0.9rem',
            color: '#94a3b8',
            textDecoration: 'line-through',
            marginRight: '8px',
            fontFamily: 'var(--font-mono)',
          }}
          aria-label={`Regular price $${comparePrice.toFixed(2)}`}
        >
          ${comparePrice.toFixed(2)}
        </span>
      )}
      <span
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: isOnSale ? '#dc2626' : 'var(--primary-700, #1d4ed8)',
          letterSpacing: '-0.02em',
        }}
        aria-label={`${prefix}$${displayPrice.toFixed(2)}`}
      >
        {prefix}${displayPrice.toFixed(2)}
      </span>
      {isOnSale && (
        <span
          style={{
            marginLeft: '8px',
            background: '#dc2626',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '999px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
          aria-label="On sale"
        >
          Sale
        </span>
      )}
    </div>
  );
}
