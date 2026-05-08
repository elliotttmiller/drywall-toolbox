/**
 * ui/Toast.jsx — IndoUI Alert Toast (drop-in replacement for components/Toast.jsx)
 *
 * Props (identical interface to original Toast.jsx):
 *   message   string
 *   type      'success' | 'error' | 'info' | 'cart'
 *   onClose   () => void
 *   duration  number (ms, default 3000)
 *
 * Visual upgrades vs original:
 *   - Slide-in from right via framer-motion AnimatePresence
 *   - Glass-morphism card with colored left accent bar
 *   - Progress countdown bar
 *   - Accessible role="alert" aria-live="polite"
 */

import { useEffect, useCallback, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, ShoppingCart, AlertTriangle } from 'lucide-react';

const CONFIG = {
  success: {
    icon: CheckCircle,
    accent: '#16a34a',
    bg: '#f0fdf4',
    iconColor: '#16a34a',
    text: '#14532d',
  },
  error: {
    icon: AlertCircle,
    accent: '#dc2626',
    bg: '#fef2f2',
    iconColor: '#dc2626',
    text: '#7f1d1d',
  },
  info: {
    icon: Info,
    accent: 'var(--primary-600)',
    bg: '#eff6ff',
    iconColor: 'var(--primary-600)',
    text: '#1e3a8a',
  },
  cart: {
    icon: ShoppingCart,
    accent: 'var(--primary-600)',
    bg: 'white',
    iconColor: 'var(--primary-600)',
    text: '#0f172a',
  },
  warning: {
    icon: AlertTriangle,
    accent: '#d97706',
    bg: '#fffbeb',
    iconColor: '#d97706',
    text: '#78350f',
  },
};

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  const [progress, setProgress] = useState(100);
  const cfg = CONFIG[type] || CONFIG.info;
  const IconComponent = cfg.icon;

  const handleClose = useCallback(() => { onClose(); }, [onClose]);

  // Auto-dismiss timer
  useEffect(() => {
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  // Countdown progress bar
  useEffect(() => {
    const interval = 50;
    const steps = duration / interval;
    const decrement = 100 / steps;
    let current = 100;
    const id = setInterval(() => {
      current -= decrement;
      setProgress(Math.max(0, current));
    }, interval);
    return () => clearInterval(id);
  }, [duration]);

  return (
    <Motion.div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: '80px',
        right: '16px',
        zIndex: 99999,
        minWidth: '300px',
        maxWidth: '420px',
        background: cfg.bg,
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)',
        border: '1px solid rgba(15,23,42,0.07)',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Colored left accent bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        background: cfg.accent,
        borderRadius: '12px 0 0 12px',
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 14px 10px 18px',
      }}>
        {/* Icon */}
        <span style={{ color: cfg.iconColor, flexShrink: 0, marginTop: '1px' }}>
          <IconComponent size={18} />
        </span>

        {/* Message */}
        <span style={{
          flex: 1,
          fontSize: '0.875rem',
          fontWeight: 600,
          color: cfg.text,
          lineHeight: 1.45,
        }}>
          {message}
        </span>

        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Close notification"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(15,23,42,0.06)',
            color: 'rgba(15,23,42,0.45)',
            cursor: 'pointer',
            transition: 'background 0.15s',
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15,23,42,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(15,23,42,0.06)'; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: 'rgba(15,23,42,0.06)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: cfg.accent,
            transition: 'width 50ms linear',
            borderRadius: '0 0 12px 12px',
          }}
        />
      </div>
    </Motion.div>
  );
}
