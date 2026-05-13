/**
 * frontend/src/components/product/ProductSkuBlock.jsx
 *
 * Displays SKU (and optionally MPN) for the selected variation or parent.
 *
 * Props:
 *   product           — parent product
 *   selectedVariation — selected variation or null
 */

export default function ProductSkuBlock({ product, selectedVariation }) {
  const sku = selectedVariation?.sku || product?.sku;
  const mpn = selectedVariation?.mpn || product?.mpn;

  if (!sku && !mpn) return null;

  return (
    <div
      className="product-sku-block"
      style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}
    >
      {sku && (
        <span>
          <span style={{ color: '#94a3b8', marginRight: '4px' }}>SKU:</span>
          {sku}
        </span>
      )}
      {mpn && (
        <span style={{ marginLeft: sku ? '16px' : 0 }}>
          <span style={{ color: '#94a3b8', marginRight: '4px' }}>MPN:</span>
          {mpn}
        </span>
      )}
    </div>
  );
}
