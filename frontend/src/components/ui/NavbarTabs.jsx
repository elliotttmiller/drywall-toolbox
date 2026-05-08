/**
 * ui/NavbarTabs.jsx — IndoUI-style animated tab navigation
 *
 * Props:
 *   tabs        [{ id, label, shortLabel?, icon? }]
 *   activeIndex number
 *   onChange    (index) => void
 *   className   string
 *   style       object
 *
 * Used by: AccountHub.jsx (dashboard), FAQ.jsx (category switcher)
 *
 * Features:
 *   - Animated sliding indicator pill
 *   - Smooth icon + label layout
 *   - Horizontally scrollable on mobile (no overflow clip)
 *   - framer-motion whileTap for tactile feedback
 */

import { useRef, useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';

export default function NavbarTabs({ tabs = [], activeIndex = 0, onChange, className = '', style = {} }) {
  const containerRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Keep the animated indicator in sync with the active tab button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll('.dtb-navtab-btn');
    const active = buttons[activeIndex];
    if (!active) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = active.getBoundingClientRect();
    setIndicatorStyle({
      left: btnRect.left - containerRect.left + container.scrollLeft,
      width: btnRect.width,
    });
  }, [activeIndex, tabs]);

  return (
    <div
      className={`dtb-navtabs${className ? ` ${className}` : ''}`}
      style={{
        background: 'white',
        borderRadius: '14px',
        boxShadow: '0 2px 12px rgba(15,23,42,0.07)',
        border: '1px solid rgba(15,23,42,0.07)',
        padding: '5px',
        ...style,
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'flex',
          overflowX: 'auto',
          gap: '2px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        className="dtb-navtabs-inner scrollbar-none"
      >
        {/* Sliding background indicator */}
        <Motion.div
          className="dtb-navtab-indicator"
          animate={indicatorStyle}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            top: 0,
            height: '100%',
            background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(37,99,235,0.35)',
            zIndex: 0,
          }}
        />

        {tabs.map((tab, index) => {
          const isActive = activeIndex === index;
          const Icon = tab.icon;
          return (
            <Motion.button
              key={tab.id}
              type="button"
              className="dtb-navtab-btn"
              onClick={() => onChange(index)}
              whileTap={{ scale: 0.93 }}
              transition={{ duration: 0.1 }}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 15px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '0.83rem',
                fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                background: 'transparent',
                color: isActive ? 'white' : 'rgba(15,23,42,0.5)',
                transition: 'color 0.2s',
              }}
            >
              {Icon && (
                <Icon
                  size={14}
                  style={{
                    opacity: isActive ? 1 : 0.65,
                    transition: 'opacity 0.2s',
                    flexShrink: 0,
                  }}
                />
              )}
              <span className="dtb-navtab-label">
                {tab.label}
              </span>
            </Motion.button>
          );
        })}
      </div>
    </div>
  );
}
