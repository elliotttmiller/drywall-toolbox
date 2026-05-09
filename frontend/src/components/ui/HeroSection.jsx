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

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import TrustedBrands from './TrustedBrands';
import NavigationCarousel from './NavigationCarousel';

const HERO_TITLE_AURORA_COLORS = [
  '#ffffff',
  '#7f8794',
  '#f8fafc',
  '#b6bfcd',
  '#3f4652',
  '#eef2f7',
  '#9aa5b5',
  '#ffffff',
];

const AuroraText = memo(function AuroraText({
  children,
  className = '',
  colors = HERO_TITLE_AURORA_COLORS,
  speed = 0.62,
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(110deg, ${colors.join(', ')}, ${colors[0]})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animationDuration: `${10 / speed}s`,
  };

  return (
    <span className={`dtb-aurora-text ${className}`}>
      <span className="dtb-sr-only">{children}</span>
      <span className="dtb-aurora-text__visible" style={gradientStyle} aria-hidden="true">
        {children}
      </span>
    </span>
  );
});

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

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

function formatCharForAnimation(char) {
  return char === ' ' ? '\u00A0' : char;
}

function AnimatedAuroraLine({ line, lineIndex }) {
  return (
    <span style={{ display: 'block' }}>
      <AuroraText>
        {line.split('').map((char, charIndex) => (
          <Motion.span
            key={`${lineIndex}-${charIndex}`}
            variants={charVariant}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
            }}
          >
            {formatCharForAnimation(char)}
          </Motion.span>
        ))}
      </AuroraText>
    </span>
  );
}

function SlideInTitle({ lines }) {
  return (
    <Motion.h1
      className="dtb-hero-title-gradient"
      variants={charContainer}
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
        <AnimatedAuroraLine key={li} line={line} lineIndex={li} />
      ))}
    </Motion.h1>
  );
}

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
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 0%, rgba(29,78,216,0.32) 0%, transparent 55%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 110%, rgba(56,189,248,0.13) 0%, transparent 55%)',
      }} />

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
            Top Brands. One Place.
          </span>
        </Motion.div>

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
              <AuroraText>{title}</AuroraText>
            </Motion.h1>
          )
        }

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

      {showCarousel && (
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <NavigationCarousel />
        </div>
      )}

      {brands.length > 0 && showCarousel && (
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(920px, calc(100% - 2.5rem))',
            height: '1px',
            margin: '0 auto clamp(0.75rem, 2vw, 1.15rem)',
            background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(226,232,240,0.44) 18%, rgba(248,250,252,0.75) 50%, rgba(226,232,240,0.44) 82%, rgba(255,255,255,0) 100%)',
          }}
        />
      )}

      {brands.length > 0 && (
        <TrustedBrands
          brands={brands}
          title="Trusted Brands"
          speed={32}
          transparent
        />
      )}

      <style>{`
        .dtb-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .dtb-aurora-text {
          position: relative;
          display: inline-block;
        }

        .dtb-aurora-text::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg,
              rgba(255,255,255,0.92) 0%,
              rgba(255,255,255,0.18) 13%,
              rgba(8,13,24,0.18) 38%,
              rgba(255,255,255,0.52) 52%,
              rgba(13,20,34,0.28) 68%,
              rgba(255,255,255,0.72) 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          mix-blend-mode: screen;
          opacity: 0.58;
        }

        .dtb-aurora-text__visible {
          position: relative;
          display: inline-block;
          color: transparent;
          background-size: 360% auto;
          background-position: 0% 50%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation-name: dtb-hero-aurora;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          text-shadow:
            0 1px 0 rgba(255,255,255,0.48),
            0 -1px 0 rgba(15,23,42,0.62),
            0 18px 42px rgba(148,163,184,0.14);
        }

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
          text-shadow:
            0 1px 0 rgba(255,255,255,0.30),
            0 -1px 0 rgba(2,6,23,0.72),
            0 14px 38px rgba(148,163,184,0.18),
            0 0 44px rgba(96,165,250,0.10);
          filter:
            drop-shadow(0 1px 0 rgba(255,255,255,0.18))
            drop-shadow(0 12px 24px rgba(2,6,23,0.32));
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

        @keyframes dtb-hero-aurora {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .dtb-aurora-text__visible { animation: none; }
        }

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
