/**
 * ui/HeroSection.jsx — IndoUI-style animated hero section
 *
 * Props:
 *   title        string | ReactNode
 *   subtitle     string
 *   ctaLinks     [{ to, label, variant? }]
 *   brands       [{ name, src, to }]  (optional logo row)
 *   stats        [{ value, label }]   (optional stat strip)
 *   children     ReactNode            (optional slot below CTAs)
 *   className    string
 */

import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import Button from './Button.jsx';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.10 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] } },
};

export default function HeroSection({
  title,
  subtitle,
  ctaLinks = [],
  brands = [],
  stats = [],
  children,
  className = '',
}) {
  return (
    <section
      className={`dtb-ui-hero${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(140deg, #0b1120 0%, #0f2150 48%, #1a3a8a 100%)',
        padding: 'clamp(3.5rem, 9vw, 7rem) clamp(1.5rem, 5vw, 3rem)',
      }}
    >
      {/* Animated dot-grid texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
        backgroundSize: '36px 36px',
        pointerEvents: 'none',
      }} />

      {/* Animated radial glow blobs */}
      <Motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '-100px', right: '-60px',
          width: '480px', height: '480px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          position: 'absolute', bottom: '-80px', left: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <Motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          position: 'relative', zIndex: 1,
          maxWidth: '900px', margin: '0 auto',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0',
        }}
      >
        {/* Eyebrow */}
        <Motion.div variants={itemVariants}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px', padding: '5px 16px',
            fontSize: '0.68rem', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.8)', marginBottom: '24px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#93c5fd', flexShrink: 0, animation: 'dtb-hero-pulse 2s ease-in-out infinite' }} />
            Pro Drywall Tools
          </div>
        </Motion.div>

        {/* Title */}
        <Motion.h1
          variants={itemVariants}
          style={{
            color: 'white',
            fontSize: 'clamp(2.2rem, 6vw, 4rem)',
            fontWeight: 900,
            margin: '0 0 20px',
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
          }}
        >
          {title}
        </Motion.h1>

        {/* Subtitle */}
        {subtitle && (
          <Motion.p
            variants={itemVariants}
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)',
              margin: '0 0 32px',
              lineHeight: 1.65,
              maxWidth: '640px',
            }}
          >
            {subtitle}
          </Motion.p>
        )}

        {/* CTAs */}
        {ctaLinks.length > 0 && (
          <Motion.div
            variants={itemVariants}
            style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: stats.length > 0 || brands.length > 0 ? '40px' : '0' }}
          >
            {ctaLinks.map(({ to, label, variant = 'primary' }, i) => (
              <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                <Button
                  variant={i === 0 ? 'primary' : 'outline'}
                  size="lg"
                  style={i === 0 ? {} : { color: 'white', borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' }}
                >
                  {label}
                </Button>
              </Link>
            ))}
          </Motion.div>
        )}

        {children}

        {/* Stats strip */}
        {stats.length > 0 && (
          <Motion.div
            variants={itemVariants}
            style={{
              display: 'flex', gap: '0', alignItems: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px', padding: '14px 0',
              width: '100%', maxWidth: '540px', marginBottom: brands.length > 0 ? '40px' : '0',
            }}
          >
            {stats.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>{stat.value}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</p>
                </div>
              </React.Fragment>
            ))}
          </Motion.div>
        )}

        {/* Brand logos */}
        {brands.length > 0 && (
          <Motion.div variants={itemVariants} style={{ width: '100%' }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '16px' }}>
              Trusted Brands
            </p>
            <div style={{ display: 'flex', gap: 'clamp(16px, 4vw, 32px)', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              {brands.map(({ name, src, to }) => (
                <Link
                  key={name}
                  to={to}
                  style={{ textDecoration: 'none', opacity: 0.65, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.65'; }}
                >
                  <img src={src} alt={name} loading="lazy" style={{ height: 'clamp(22px, 3.5vw, 32px)', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </Link>
              ))}
            </div>
          </Motion.div>
        )}
      </Motion.div>

      <style>{`
        @keyframes dtb-hero-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </section>
  );
}
