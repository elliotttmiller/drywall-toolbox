/**
 * ui/Dropdown.jsx — IndoUI-style generic dropdown
 *
 * Drop-in for SortDropdown / CalcDropdown / FilterPanel selects.
 *
 * Props:
 *   value        current selected value
 *   onChange     (value) => void
 *   options      [{ value, label, description? }]
 *   placeholder  string (default "Select…")
 *   label        string (optional visible label above)
 *   disabled     boolean
 *   className    string
 *   style        object
 */

import { useState, useRef, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  label,
  disabled = false,
  className = '',
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const toggle = () => { if (!disabled) setIsOpen((o) => !o); };
  const select = (val) => { onChange(val); setIsOpen(false); };

  return (
    <div
      ref={containerRef}
      className={`dtb-ui-dropdown${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      {label && (
        <p style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'rgba(15,23,42,0.45)',
          marginBottom: '6px',
        }}>
          {label}
        </p>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '9px 14px',
          background: 'white',
          border: `1.5px solid ${isOpen ? 'var(--primary-600)' : 'rgba(15,23,42,0.12)'}`,
          borderRadius: '10px',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(37,99,235,0.12)'
            : '0 1px 4px rgba(15,23,42,0.06)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: selectedOption ? '#0f172a' : 'rgba(15,23,42,0.4)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          minWidth: '160px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ display: 'flex', flexShrink: 0 }}
        >
          <ChevronDown size={15} style={{ color: 'rgba(15,23,42,0.45)' }} />
        </Motion.span>
      </button>

      {/* Menu */}
      <AnimatePresence>
        {isOpen && (
          <Motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: '100%',
              background: 'white',
              border: '1px solid rgba(15,23,42,0.09)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
              overflow: 'hidden',
              zIndex: 10000,
              padding: '4px',
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(option.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isSelected ? 'rgba(37,99,235,0.07)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>
                    <span style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--primary-700)' : '#0f172a',
                      lineHeight: 1.3,
                    }}>
                      {option.label}
                    </span>
                    {option.description && (
                      <span style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        color: 'rgba(15,23,42,0.45)',
                        marginTop: '1px',
                      }}>
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <span style={{ color: 'var(--primary-600)', flexShrink: 0 }}>
                      <Check size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
