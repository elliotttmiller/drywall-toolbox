/**
 * ui/Accordion.jsx — Reusable animated accordion component
 *
 * Inspired by the SeraUI accordion reference — clean, precise, accessible.
 * Height transitions are driven by framer-motion AnimatePresence.
 * Supports both single-open and multi-open modes.
 *
 * Props:
 *   items       [{ id, question, answer }]
 *   defaultOpen string | null  — id of the item open by default (single mode)
 *   multi       boolean        — allow multiple items open simultaneously
 *   className   string
 *   style       object
 */

import { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';

/* ── AccordionItem ─────────────────────────────────────────────────────────── */
function AccordionItem({ item, isOpen, onToggle, isMobile = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: '1px solid var(--machined-border)',
        borderLeft: `2px solid ${isOpen ? 'var(--primary-600, #2563eb)' : 'transparent'}`,
        paddingLeft: isOpen ? '14px' : '0',
        transition: 'border-left-color 0.22s ease, padding-left 0.22s ease',
        background: hovered && !isOpen ? 'rgba(37,99,235,0.025)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 'clamp(0.9rem, 2vw, 0.985rem)',
          fontWeight: 700,
          color: isOpen ? 'var(--primary-700, #1d4ed8)' : '#0f172a',
          lineHeight: 1.45,
          transition: 'color 0.18s',
        }}>
          {item.question}
        </span>

        {/* Animated +/– icon */}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '26px',
            height: '26px',
            borderRadius: '7px',
            border: `1px solid ${isOpen ? 'rgba(37,99,235,0.35)' : 'var(--machined-border)'}`,
            background: isOpen ? 'rgba(37,99,235,0.10)' : 'rgba(15,23,42,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.20s, border-color 0.20s',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ overflow: 'visible' }}
          >
            {/* Horizontal bar (always visible) */}
            <line
              x1="2" y1="6" x2="10" y2="6"
              stroke={isOpen ? '#2563eb' : '#64748b'}
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{ transition: 'stroke 0.18s' }}
            />
            {/* Vertical bar (visible when closed, hidden when open) */}
            <line
              x1="6" y1="2" x2="6" y2="10"
              stroke={isOpen ? '#2563eb' : '#64748b'}
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{
                transform: isOpen ? 'scaleY(0)' : 'scaleY(1)',
                transformOrigin: '6px 6px',
                transition: 'transform 0.22s ease, stroke 0.18s',
              }}
            />
          </svg>
        </span>
      </button>

      {/* Animated answer panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <Motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{
              margin: '0 0 22px 0',
              fontSize: 'clamp(0.86rem, 2vw, 0.94rem)',
              color: 'rgba(15,23,42,0.62)',
              lineHeight: 1.72,
              paddingRight: isMobile ? '0' : '40px',
            }}>
              {item.answer}
            </p>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Accordion container ───────────────────────────────────────────────────── */
export default function Accordion({
  items = [],
  defaultOpen = null,
  multi = false,
  isMobile = false,
  className = '',
  style = {},
}) {
  const [openMap, setOpenMap] = useState(() => {
    if (defaultOpen) return { [defaultOpen]: true };
    return {};
  });

  const toggle = (id) => {
    setOpenMap((prev) => {
      if (multi) {
        return { ...prev, [id]: !prev[id] };
      }
      /* Single-open mode: close current if same, otherwise open new */
      return { [id]: !prev[id] };
    });
  };

  return (
    <div
      className={className}
      style={{
        borderTop: '1px solid var(--machined-border)',
        ...style,
      }}
    >
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          item={item}
          isOpen={!!openMap[item.id]}
          onToggle={() => toggle(item.id)}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}
