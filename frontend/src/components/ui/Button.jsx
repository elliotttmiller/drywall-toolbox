/**
 * ui/Button.jsx — IndoUI-style versatile button component
 *
 * Variants: primary | ghost | outline | danger | icon
 * Sizes: sm | md | lg
 *
 * Uses project design tokens (--primary-600, --alloy-deep, etc.)
 * and framer-motion for micro-interactions.
 */

import { forwardRef } from 'react';
import { motion as Motion } from 'framer-motion';

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 14px rgba(37,99,235,0.30)',
    hoverShadow: '0 8px 24px rgba(37,99,235,0.40)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--primary-600)',
    border: '1.5px solid var(--primary-600)',
    boxShadow: 'none',
    hoverShadow: '0 4px 12px rgba(37,99,235,0.15)',
  },
  outline: {
    background: '#ffffff',
    color: 'var(--primary-700)',
    border: '1.5px solid rgba(37,99,235,0.30)',
    boxShadow: 'none',
    hoverShadow: '0 4px 14px rgba(37,99,235,0.12)',
  },
  danger: {
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 14px rgba(220,38,38,0.25)',
    hoverShadow: '0 8px 24px rgba(220,38,38,0.35)',
  },
  icon: {
    background: 'white',
    color: 'var(--alloy-deep)',
    border: '1px solid var(--machined-border)',
    boxShadow: '0 2px 6px rgba(15,23,42,0.06)',
    hoverShadow: '0 4px 14px rgba(15,23,42,0.12)',
  },
};

const SIZES = {
  sm: { padding: '7px 16px', fontSize: '0.78rem', borderRadius: '8px', iconSize: '15px' },
  md: { padding: '10px 22px', fontSize: '0.875rem', borderRadius: '10px', iconSize: '18px' },
  lg: { padding: '13px 28px', fontSize: '0.95rem', borderRadius: '12px', iconSize: '20px' },
};

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    onClick,
    type = 'button',
    className = '',
    style = {},
    'aria-label': ariaLabel,
    ...rest
  },
  ref
) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    padding: variant === 'icon' ? s.padding.split(' ')[0] : s.padding,
    fontSize: s.fontSize,
    fontWeight: 700,
    letterSpacing: '0.01em',
    borderRadius: variant === 'icon' ? '50%' : s.borderRadius,
    border: v.border,
    background: v.background,
    color: v.color,
    boxShadow: v.boxShadow,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'box-shadow 0.18s ease, opacity 0.15s ease',
    width: fullWidth ? '100%' : variant === 'icon' ? '38px' : undefined,
    height: variant === 'icon' ? '38px' : undefined,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    textDecoration: 'none',
    ...style,
  };

  return (
    <Motion.button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      className={`dtb-ui-btn dtb-ui-btn--${variant} dtb-ui-btn--${size}${className ? ` ${className}` : ''}`}
      style={baseStyle}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={disabled || loading ? {} : {
        y: -2,
        boxShadow: v.hoverShadow,
      }}
      whileTap={disabled || loading ? {} : { scale: 0.96, y: 0 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: s.iconSize,
            height: s.iconSize,
            border: `2px solid currentColor`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'dtb-spin 0.7s linear infinite',
          }}
          aria-hidden="true"
        />
      ) : leftIcon ? (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      {children && (
        <span>{children}</span>
      )}

      {rightIcon && !loading && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </Motion.button>
  );
});

export default Button;
