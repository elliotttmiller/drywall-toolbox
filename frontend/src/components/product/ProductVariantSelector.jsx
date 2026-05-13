/**
 * frontend/src/components/product/ProductVariantSelector.jsx
 *
 * Chip-based variant option selector.  Renders one group per attribute with
 * colored chips per option.  Out-of-stock options are shown with a strikethrough
 * and not disabled — consistent with WooCommerce's standard UX convention of
 * showing all options so users know what exists.
 *
 * Props:
 *   product           — parent product
 *   variations        — all child variations
 *   computed          — computed state from detail endpoint
 *   selectedVariation — currently selected variation
 *   onSelect          — (variation: Object|null) => void  — called when user picks
 * an option
 */

import { useMemo } from 'react';
import { findMatchingVariation, getVariationSelectionMap } from '../../utils/variationSelection.js';

const STOCK_RANK = { instock: 2, onbackorder: 1, outofstock: 0 };

function getOptionStatus(optionMeta) {
  const status = optionMeta?.stock_status || 'outofstock';
  const purchasable = optionMeta?.purchasable ?? false;
  if (!purchasable) return 'unavailable';
  return status;
}

export default function ProductVariantSelector({
  product,
  variations,
  computed,
  selectedVariation,
  onSelect,
}) {
  const isVariable = product?.type === 'variable' || product?.is_variable;

  // Extract variation attributes from the product.
  const variationAttributes = useMemo(() => {
    const attrs = Array.isArray(product?.attributes) ? product.attributes : [];
    return attrs.filter(
      (a) => a?.variation && a?.name && a.name.toLowerCase() !== 'brand'
        && Array.isArray(a.options) && a.options.length > 0
    );
  }, [product]);

  // Current chip selections derived from the selected variation.
  const currentSelections = useMemo(
    () => (selectedVariation ? getVariationSelectionMap(selectedVariation) : {}),
    [selectedVariation]
  );

  // Available option matrix from computed state.
  const optionMatrix = useMemo(
    () => computed?.available_option_matrix || {},
    [computed]
  );

  if (!isVariable || variationAttributes.length === 0) return null;
  if (!Array.isArray(variations) || variations.length === 0) return null;

  const handleOptionClick = (attrName, option) => {
    const newSelections = { ...currentSelections, [attrName]: option };
    const match = findMatchingVariation(variations, newSelections);
    onSelect(match ?? null);
  };

  return (
    <div className="product-variant-selector" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {variationAttributes.map((attr) => {
        const attrName      = attr.name;
        const options       = Array.isArray(attr.options) ? attr.options : [];
        const selectedValue = currentSelections[attrName] ?? null;
        const attrMatrix    = optionMatrix[attrName] ?? {};

        return (
          <div key={attrName} className="product-variant-group">
            <div
              style={{
                fontSize: '0.78rem', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: '#475569', marginBottom: '10px',
              }}
            >
              {attrName.replace(/^pa_/i, '').replace(/[_-]+/g, ' ')}
              {selectedValue && (
                <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '8px', color: '#0f172a' }}>
                  — {selectedValue}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {options.map((option) => {
                const meta        = attrMatrix[option];
                const status      = meta ? getOptionStatus(meta) : 'unavailable';
                const isSelected  = selectedValue === option;
                const isOos       = status === 'outofstock';
                const isUnavail   = status === 'unavailable';

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleOptionClick(attrName, option)}
                    aria-pressed={isSelected}
                    title={isOos ? `${option} — Out of Stock` : isUnavail ? `${option} — Unavailable` : option}
                    style={chipStyle(isSelected, isOos, isUnavail)}
                  >
                    <span
                      style={{
                        textDecoration: isOos || isUnavail ? 'line-through' : 'none',
                        textDecorationColor: '#94a3b8',
                      }}
                    >
                      {option}
                    </span>
                    {isOos && (
                      <span
                        style={{ fontSize: '0.55rem', display: 'block', color: '#94a3b8', lineHeight: 1 }}
                        aria-label="Out of stock"
                      >
                        OOS
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function chipStyle(isSelected, isOos, isUnavail) {
  return {
    minWidth: '56px',
    padding: '7px 14px',
    borderRadius: '8px',
    border: isSelected
      ? '2px solid var(--primary-600, #2563eb)'
      : '2px solid #e2e8f0',
    background: isSelected
      ? 'rgba(37,99,235,0.08)'
      : isOos || isUnavail ? '#f8fafc' : '#fff',
    color: isSelected
      ? 'var(--primary-700, #1d4ed8)'
      : isOos || isUnavail ? '#94a3b8' : '#0f172a',
    fontSize: '0.82rem',
    fontWeight: isSelected ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'center',
    lineHeight: 1.3,
    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
    position: 'relative',
  };
}
