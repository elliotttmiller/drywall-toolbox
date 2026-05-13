/**
 * frontend/src/components/product/ProductPurchasePanel.jsx
 *
 * Combines: variant selector + availability notice + quantity stepper + add-to-cart.
 * This is the unified purchase UI block for the product detail page.
 *
 * Props:
 *   product           — parent product
 *   variations        — all child variations
 *   computed          — computed state from detail endpoint
 *   selectedVariation — currently selected variation
 *   variationState    — string from useSelectedVariation
 *   onVariationSelect — (variation: Object|null) => void
 *   onAddToCart       — (product, selectedVariation, quantity) => void
 */

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import ProductVariantSelector from './ProductVariantSelector';
import ProductAvailabilityNotice from './ProductAvailabilityNotice';
import ProductQuantityStepper from './ProductQuantityStepper';

export default function ProductPurchasePanel({
  product,
  variations,
  computed,
  selectedVariation,
  variationState,
  onVariationSelect,
  onAddToCart,
}) {
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const isVariable = product?.type === 'variable' || product?.is_variable;
  const hasVariations = Array.isArray(variations) && variations.length > 0;

  // Determine if add-to-cart is possible.
  const canAdd =
    variationState === 'variation_ready' ||
    variationState === 'variation_backorder' ||
    (!isVariable && (product?.stock_status === 'instock' || product?.stock_status === 'onbackorder'));

  const handleAddToCart = () => {
    if (!canAdd) return;
    onAddToCart(product, selectedVariation, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  return (
    <div className="product-purchase-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Variation selector */}
      {isVariable && hasVariations && (
        <ProductVariantSelector
          product={product}
          variations={variations}
          computed={computed}
          selectedVariation={selectedVariation}
          onSelect={onVariationSelect}
        />
      )}

      {/* Availability notice */}
      <ProductAvailabilityNotice
        product={product}
        selectedVariation={selectedVariation}
        variationState={variationState}
      />

      {/* Quantity + add-to-cart row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <ProductQuantityStepper
          quantity={quantity}
          onChange={setQuantity}
          disabled={!canAdd}
          max={
            (selectedVariation?.stock_quantity ?? product?.stock_quantity) || 999
          }
        />

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAdd}
          aria-label={isVariable && !selectedVariation ? 'Select options to add to cart' : 'Add to cart'}
          style={addBtnStyle(!canAdd, addedFeedback)}
        >
          <ShoppingCart size={16} aria-hidden="true" />
          <span>
            {addedFeedback
              ? 'Added!'
              : isVariable && !selectedVariation
                ? 'Select Options'
                : 'Add to Cart'}
          </span>
        </button>
      </div>

      {/* Guidance prompt for variable without selection */}
      {isVariable && !selectedVariation && variationState !== 'no_variations' && (
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
          ↑ Choose an option above to add to cart.
        </p>
      )}

      {/* Backorder notice */}
      {(variationState === 'variation_backorder' ||
        (!isVariable && product?.stock_status === 'onbackorder')) && (
        <p style={{ fontSize: '0.78rem', color: '#d97706', margin: 0 }}>
          Available on backorder — orders will ship when stock arrives.
        </p>
      )}
    </div>
  );
}

function addBtnStyle(disabled, success) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 24px',
    borderRadius: '10px',
    border: 'none',
    background: disabled
      ? '#e2e8f0'
      : success
        ? '#16a34a'
        : 'linear-gradient(135deg, var(--primary-600, #2563eb) 0%, var(--primary-700, #1d4ed8) 100%)',
    color: disabled ? '#94a3b8' : '#fff',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: !disabled ? '0 4px 14px rgba(37,99,235,0.25)' : 'none',
    transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: '280px',
  };
}
