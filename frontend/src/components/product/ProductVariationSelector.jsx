import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

function attributeLabel(attr) {
  return (attr?.name || '').replace(/^pa_/i, '').replace(/[_-]+/g, ' ').trim();
}

export default function ProductVariationSelector({
  variationAttributes,
  variantOptionMeta,
  selectedAttrs,
  setSelectedAttrs,
  variationsLoading,
  selectedVariation,
  hasCompleteSelection,
}) {
  if (!Array.isArray(variationAttributes) || variationAttributes.length === 0) return null;

  return (
    <div className="product-variation-panel" aria-label="Product options">
      {variationAttributes.map((attr) => {
        const selectedValue = selectedAttrs?.[attr.name] || '';
        const options = variantOptionMeta[attr.name] || [];

        return (
          <section key={attr.name} className="product-variation-group">
            <div className="product-variation-group__header">
              <span className="product-variation-group__label">{attributeLabel(attr)}</span>
              <AnimatePresence mode="wait">
                {selectedValue && (
                  <Motion.span
                    key={String(selectedValue)}
                    className="product-variation-group__selected"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  >
                    Selected: {selectedValue}
                  </Motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="dtb-variant-rail">
              {options.map((option) => {
                const selected = `${selectedValue}` === `${option.value}`;
                const soldOut = option.status === 'sold-out';
                const unavailable = option.status === 'unavailable';
                const disabled = variationsLoading || unavailable;

                return (
                  <Motion.button
                    key={`${attr.name}-${option.value}`}
                    type="button"
                    onClick={() => setSelectedAttrs((prev) => ({ ...prev, [attr.name]: option.value }))}
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-disabled={disabled || soldOut}
                    aria-label={`${option.value}${soldOut ? ' - sold out' : unavailable ? ' - unavailable' : ''}`}
                    className={`dtb-variant-pill${selected ? ' is-selected dtb-variant-pill--selected' : ''}${soldOut ? ' is-sold-out dtb-variant-pill--disabled' : ''}${disabled ? ' is-disabled dtb-variant-pill--disabled' : ''}`}
                    whileTap={disabled ? undefined : { scale: 0.985 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="dtb-variant-pill__label">{option.value}</span>
                    {!variationsLoading && selected ? (
                      <AnimatePresence>
                        <Motion.span
                          className="dtb-variant-pill__check"
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ duration: 0.16 }}
                        >
                          <Check size={13} strokeWidth={3} />
                        </Motion.span>
                      </AnimatePresence>
                    ) : null}
                    {variationsLoading ? (
                      <span className="dtb-variant-pill__status"><Loader2 size={12} /> Loading</span>
                    ) : soldOut ? (
                      <span className="dtb-variant-pill__status">Sold out</span>
                    ) : unavailable ? (
                      <span className="sr-only">Unavailable</span>
                    ) : null}
                  </Motion.button>
                );
              })}
            </div>
          </section>
        );
      })}

      <AnimatePresence>
        {selectedVariation?.stock_status === 'outofstock' && (
          <Motion.p className="product-variation-alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            This option is currently out of stock.
          </Motion.p>
        )}
        {!variationsLoading && hasCompleteSelection && !selectedVariation && (
          <Motion.p className="product-variation-alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            This option combination is not available.
          </Motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
