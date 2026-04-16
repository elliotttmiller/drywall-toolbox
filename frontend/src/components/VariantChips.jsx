/**
 * VariantChips — inline text-based variation selector for product cards.
 *
 * Renders text chips (≤ 6 options) or a dropdown (> 6 options) for a single
 * variation attribute such as "Size" or "Length".  Uses no colour swatches;
 * all labels are contractor-friendly text (e.g. 7", 10", 12").
 *
 * Props
 * ─────
 *   attributes  Array<{ name: string, options: string[] }>
 *               The variation attributes from the parent variable product.
 *
 *   selected    Object — current selection map, e.g. { Size: '10"' }
 *
 *   onSelect    (name: string, value: string) => void
 *               Called whenever the user picks a new option.
 *
 *   compact     boolean — when true, reduces padding (for use inside product cards)
 */
export default function VariantChips({ attributes, selected, onSelect, compact = false }) {
  if (!attributes || attributes.length === 0) return null;

  return (
    <div className="variant-chips-root" style={{ display: 'flex', flexDirection: 'column', gap: compact ? '4px' : '8px' }}>
      {attributes.map((attr) => {
        const { name, options } = attr;
        if (!options || options.length === 0) return null;
        const currentValue = selected?.[name] ?? '';
        const useDropdown  = options.length > 6;

        return (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!compact && (
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(15,23,42,0.45)',
              }}>
                {name}
              </span>
            )}

            {useDropdown ? (
              /* ── Dropdown for many options ────────────────────────────── */
              <select
                value={currentValue}
                onChange={(e) => onSelect(name, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${name}`}
                style={{
                  fontSize: '0.7rem',
                  padding: compact ? '2px 6px' : '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#111827',
                  cursor: 'pointer',
                  maxWidth: '100%',
                }}
              >
                <option value="">Select {name}</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              /* ── Chip row for few options ─────────────────────────────── */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {options.map((opt) => {
                  const isSelected = currentValue === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect(name, opt); }}
                      aria-pressed={isSelected}
                      aria-label={`${name}: ${opt}`}
                      style={{
                        padding: compact ? '2px 7px' : '3px 9px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        lineHeight: 1.4,
                        borderRadius: '5px',
                        border: isSelected ? '1.5px solid #2563eb' : '1.5px solid #d1d5db',
                        background: isSelected ? '#2563eb' : 'white',
                        color: isSelected ? 'white' : '#374151',
                        cursor: 'pointer',
                        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
