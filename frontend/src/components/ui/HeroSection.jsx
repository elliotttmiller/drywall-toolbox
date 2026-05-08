/**
 * ui/HeroSection.jsx — Full-width dark centered hero
 *
 * Props:
 *   title        string | ReactNode  — fallback headline (used when titleLines absent)
 *   titleLines   string[]            — if provided, each string becomes an animated line
 *                                      with per-character slide-in stagger
 *   subtitle     string
 *   ctaLinks     [{ to, label }]
 *   brands       [{ name, src, to }] — logo marquee rendered at the very bottom
 *   showCarousel boolean             — render NavigationCarousel above brands (default: true)
 *   className    string
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import TrustedBrands from './TrustedBrands';
import NavigationCarousel from './NavigationCarousel';

/* ── Stagger variants for the overall content block ───────────────────────── */
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

/* ── Per-character slide-in variants ──────────────────────────────────────── */
const charContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.024, delayChildren: 0.08 },
  },
};
const charVariant = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.40, ease: [0.16, 1, 0.3, 1] },
  },
};

/**
 * Returns the display value for a single character inside the animated title.
 * Spaces are replaced with a non-breaking space so that inline-block spans
 * don't collapse adjacent whitespace.
 */
function formatCharForAnimation(char) {
  return char === ' ' ? '\u00A0' : char;
}

/**
 * SlideInTitle — renders each character of every line with a staggered
 * slide-up animation.  Lines are separated by a block-level <span> so
 * natural line-breaking is preserved without needing <br> elements.
 */
function SlideInTitle({ lines }) {
  return (
    <Motion.h1
      className="dtb-hero-title-gradient"
      variants={charContainer}
      /* SlideInTitle manages its own animation; skip the outer `item` variant */
      initial="hidden"
      animate="visible"
      style={{
        margin: '0 0 24px',
        fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
        fontWeight: 800,
        lineHeight: 1.07,
        letterSpacing: '-0.03em',
      }}
    >
      {lines.map((line, li) => (
        <span key={li} style={{ display: 'block' }}>
          {line.split('').map((char, ci) => (
            <Motion.span
              key={`${li}-${ci}`}
              variants={charVariant}
              style={{
                display: 'inline-block',
                /* Replace space with non-breaking space so inline-block doesn't collapse it */
                whiteSpace: 'pre',
              }}
            >
              {formatCharForAnimation(char)}
            </Motion.span>
          ))}
        </span>
      ))}
    </Motion.h1>
  );
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function HeroSection({
  title,
  titleLines,
  subtitle,
  ctaLinks = [],
  brands = [],
  showCarousel = true,
  className = '',
}) {
  return (
    <section
      className={`dtb-ui-hero${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '520px',
        overflow: 'hidden',
        background: '#070d1c',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── Radial glow — top center (blue) ─────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 0%, rgba(29,78,216,0.32) 0%, transparent 55%)',
      }} />
      {/* ── Radial glow — bottom center (sky accent) ────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 110%, rgba(56,189,248,0.13) 0%, transparent 55%)',
      }} />

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <Motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          padding: 'clamp(4rem, 8vw, 6rem) clamp(1.25rem, 5vw, 3rem) clamp(2.5rem, 5vw, 3.5rem)',
          maxWidth: '860px', margin: '0 auto', width: '100%',
        }}
      >
        {/* Eyebrow badge */}
        <Motion.div variants={item}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            marginBottom: '28px',
            padding: '6px 18px',
            borderRadius: '999px',
            border: '1px solid rgba(99,149,255,0.30)',
            background: 'rgba(37,99,235,0.12)',
            backdropFilter: 'blur(8px)',
            color: '#93c5fd',
            fontSize: '0.78rem', fontWeight: 600,
            letterSpacing: '0.04em',
            boxShadow: '0 0 18px rgba(37,99,235,0.18)',
          }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#60a5fa', flexShrink: 0,
              animation: 'dtb-hero-pulse 2.2s ease-in-out infinite',
            }} />
            Pro Drywall Tools
          </span>
        </Motion.div>

        {/* Headline — per-character animation when titleLines is provided */}
        {titleLines && titleLines.length > 0
          ? <SlideInTitle lines={titleLines} />
          : (
            <Motion.h1
              className="dtb-hero-title-gradient"
              variants={item}
              style={{
                margin: '0 0 24px',
                fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
                fontWeight: 800,
                lineHeight: 1.07,
                letterSpacing: '-0.03em',
              }}
            >
              {title}
            </Motion.h1>
          )
        }

        {/* Subtitle */}
        {subtitle && (
          <Motion.p
            variants={item}
            style={{
              margin: '0 0 42px',
              maxWidth: '580px',
              fontSize: 'clamp(0.95rem, 1.8vw, 1.08rem)',
              color: 'rgba(163,192,255,0.60)',
              lineHeight: 1.75,
              fontWeight: 400,
            }}
          >
            {subtitle}
          </Motion.p>
        )}

        {/* CTA buttons */}
        {ctaLinks.length > 0 && (
          <Motion.div
            variants={item}
            className="dtb-hero-cta-wrap"
            style={{
              display: 'flex', flexWrap: 'wrap', gap: '14px',
              justifyContent: 'center',
              marginBottom: '0',
              width: '100%',
            }}
          >
            {ctaLinks.map(({ to, label }, i) => (
              <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                <button
                  type="button"
                  className={`dtb-hero-cta dtb-hero-cta--${i === 0 ? 'primary' : 'ghost'}`}
                >
                  {label}
                </button>
              </Link>
            ))}
          </Motion.div>
        )}
      </Motion.div>

      {/* ── Navigation carousel — above Trusted Brands ──────────────────── */}
      {showCarousel && (
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <NavigationCarousel />
        </div>
      )}

      {/* Brand marquee — transparent so the hero background shows through */}
      {brands.length > 0 && (
        <TrustedBrands
          brands={brands}
          title="Trusted Brands"
          speed={32}
          transparent
        />
      )}

      <style>{`
        .dtb-hero-cta {
          padding: 13px 30px;
          border-radius: 999px;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
          letter-spacing: 0.01em;
        }
        .dtb-hero-cta:active { transform: scale(0.96) !important; }

        .dtb-hero-title-gradient {
          color: transparent;
          background: linear-gradient(180deg, #ffffff 0%, #dbe3ef 55%, #bcc7d8 100%);
          background-size: 220% 220%;
          background-position: 50% 35%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: dtb-hero-title-sheen 8s ease-in-out infinite;
        }

        .dtb-hero-cta--primary {
          border: none;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%);
          color: #ffffff;
          box-shadow: 0 0 22px rgba(37,99,235,0.42);
        }
        .dtb-hero-cta--primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 36px rgba(37,99,235,0.60);
        }

        .dtb-hero-cta--ghost {
          border: 1px solid rgba(148,163,184,0.22);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.82);
          backdrop-filter: blur(8px);
        }
        .dtb-hero-cta--ghost:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(148,163,184,0.38);
        }

        @keyframes dtb-hero-pulse {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.3; transform: scale(0.80); }
        }

        @keyframes dtb-hero-title-sheen {
          0%, 100% { background-position: 50% 35%; }
          50%      { background-position: 50% 65%; }
        }

        /* ── Mobile tweaks ───────────────────────────────────────────── */
        @media (max-width: 767px) {
          .dtb-ui-hero {
            min-height: unset !important;
          }
          .dtb-hero-cta {
            padding: 12px 24px;
            font-size: 0.84rem;
            width: 100%;
            max-width: 320px;
          }
          .dtb-hero-cta-wrap {
            flex-direction: column;
            align-items: center;
          }
          .dtb-trusted-brand-link {
            padding: 0 clamp(10px, 3vw, 18px) !important;
            min-width: unset !important;
          }
        }

        @media (max-width: 479px) {
          .dtb-trusted-brand-link {
            padding: 0 8px !important;
          }
        }
      `}</style>
    </section>
  );
}



