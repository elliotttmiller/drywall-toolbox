/**
 * frontend/src/components/product/ProductQuantityStepper.jsx
 *
 * +/- quantity stepper input.
 *
 * Props:
 *   quantity   — current quantity (number)
 *   onChange   — (newQuantity: number) => void
 *   min        — minimum value (default: 1)
 *   max        — maximum value (default: 999)
 *   disabled   — whether controls are disabled
 */

import { Minus, Plus } from 'lucide-react';

export default function ProductQuantityStepper({
  quantity,
  onChange,
  min = 1,
  max = 999,
  disabled = false,
}) {
  const dec = () => { if (quantity > min) onChange(quantity - 1); };
  const inc = () => { if (quantity < max) onChange(quantity + 1); };

  const handleInput = (e) => {
    const val = parseInt(e.target.value, 10);
    if (Number.isFinite(val) && val >= min && val <= max) onChange(val);
  };

  const btnStyle = (isDisabled) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: isDisabled ? '#f1f5f9' : '#fff',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    color: isDisabled ? '#cbd5e1' : '#374151',
    transition: 'background 0.15s',
    flexShrink: 0,
  });

  return (
    <div
      className="product-quantity-stepper"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', userSelect: 'none' }}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || quantity <= min}
        aria-label="Decrease quantity"
        style={btnStyle(disabled || quantity <= min)}
      >
        <Minus size={14} />
      </button>

      <input
        type="number"
        value={quantity}
        onChange={handleInput}
        min={min}
        max={max}
        disabled={disabled}
        aria-label="Quantity"
        style={{
          width: '52px',
          height: '36px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '0.95rem',
          fontWeight: 700,
          color: '#0f172a',
          background: disabled ? '#f1f5f9' : '#fff',
          outline: 'none',
          MozAppearance: 'textfield',
        }}
      />

      <button
        type="button"
        onClick={inc}
        disabled={disabled || quantity >= max}
        aria-label="Increase quantity"
        style={btnStyle(disabled || quantity >= max)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
