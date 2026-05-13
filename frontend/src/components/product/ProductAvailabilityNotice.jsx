/**
 * frontend/src/components/product/ProductAvailabilityNotice.jsx
 *
 * Stock/availability notice derived from the selected variation or parent.
 *
 * Props:
 *   product           — parent product
 *   selectedVariation — selected variation or null
 *   variationState    — string from useSelectedVariation
 */

import { CheckCircle2, PackageCheck, AlertTriangle, XCircle } from 'lucide-react';

const STATES = {
  instock:        { icon: CheckCircle2,   color: '#16a34a', label: 'In Stock' },
  onbackorder:    { icon: PackageCheck,   color: '#d97706', label: 'Available on Backorder' },
  outofstock:     { icon: XCircle,        color: '#dc2626', label: 'Out of Stock' },
  unavailable:    { icon: AlertTriangle,  color: '#94a3b8', label: 'Options Temporarily Unavailable' },
};

export default function ProductAvailabilityNotice({ product, selectedVariation, variationState }) {
  const isVariable = product?.type === 'variable' || product?.is_variable;

  let stockStatus;
  if (isVariable) {
    if (variationState === 'variation_out_of_stock') stockStatus = 'outofstock';
    else if (variationState === 'variation_backorder') stockStatus = 'onbackorder';
    else if (variationState === 'variation_ready')     stockStatus = 'instock';
    else if (variationState === 'variation_unavailable') stockStatus = 'unavailable';
    else if (variationState === 'no_variations')       stockStatus = 'unavailable';
    else stockStatus = selectedVariation?.stock_status || 'outofstock';
  } else {
    stockStatus = product?.stock_status || 'instock';
  }

  const cfg = STATES[stockStatus] ?? STATES.unavailable;
  const Icon = cfg.icon;

  return (
    <div
      className="product-availability-notice"
      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: cfg.color }}
      role="status"
      aria-live="polite"
    >
      <Icon size={15} aria-hidden="true" />
      <span>{cfg.label}</span>
    </div>
  );
}
