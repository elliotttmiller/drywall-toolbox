/**
 * ui/TrustedBrands.jsx — IndoUI-style infinite-scroll brand marquee
 *
 * Props:
 *   brands  [{ name, src, to }]
 *   title   string (optional eyebrow)
 *   speed   number (animation duration in seconds, default 30)
 *
 * Uses pure CSS keyframe animation — no external library.
 * Double-renders the brand list for seamless infinite loop.
 */

import { Link } from 'react-router-dom';

const BRAND_SIZE_MAP = {
  TapeTech: { height: 'clamp(22px, 3.8vw, 34px)', maxWidth: '130px' },
  Columbia: { height: 'clamp(44px, 8vw, 70px)', maxWidth: '220px' },
  Level5: { height: 'clamp(16px, 2.8vw, 24px)', maxWidth: '100px' },
  'Platinum Drywall Tools': { height: 'clamp(24px, 4vw, 38px)', maxWidth: '170px' },
  Asgard: { height: 'clamp(28px, 5vw, 44px)', maxWidth: '150px' },
  SurPro: { height: 'clamp(28px, 5vw, 44px)', maxWidth: '150px' },
};

function getBaseOpacity({ dark, transparent }) {
  if (dark) return 0.58;
  if (transparent) return 0.82;
  return 0.72;
}

function BrandLogo({ brand, dark = false, transparent = false }) {
  const sizeStyle = BRAND_SIZE_MAP[brand.name] || { height: 'clamp(24px, 4vw, 38px)', maxWidth: '140px' };
  const baseOpacity = getBaseOpacity({ dark, transparent });
  return (
    <Link
      to={brand.to}
      aria-label={brand.name}
      className="dtb-trusted-brand-link"
      style={{
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 clamp(26px, 6vw, 48px)',
        flexShrink: 0,
        minWidth: 'clamp(132px, 28vw, 190px)',
        '--dtb-brand-base-opacity': baseOpacity,
      }}
    >
      <img
        src={brand.src}
        alt={brand.name}
        loading="lazy"
        decoding="async"
        style={{
          ...sizeStyle,
          width: 'auto',
          objectFit: 'contain',
          filter: transparent ? 'drop-shadow(0 2px 10px rgba(255,255,255,0.10))' : 'none',
        }}
      />
    </Link>
  );
}

export default function TrustedBrands({ brands = [], title = 'Trusted Brands', speed = 30, dark = false, transparent = false }) {
  if (!brands.length) return null;

  const bg = transparent
    ? 'transparent'
    : dark
      ? 'radial-gradient(circle at 50% 0%, rgba(29,78,216,0.32) 0%, transparent 55%), radial-gradient(circle at 50% 110%, rgba(56,189,248,0.13) 0%, transparent 55%), #070d1c'
      : '#f8fafc';
  const fadeColor = dark || transparent ? '#070d1c' : '#f8fafc';
  const titleColor = dark || transparent ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.35)';
  const isLight = !dark && !transparent;

  return (
    <section
      className="dtb-ui-trusted-brands"
      style={{
        background: bg,
        borderTop:    isLight ? '1px solid var(--machined-border)' : 'none',
        borderBottom: isLight ? '1px solid var(--machined-border)' : 'none',
        padding: isLight
          ? 'clamp(1.5rem, 3vw, 2.5rem) 0'
          : 'clamp(1rem, 2vw, 1.75rem) 0 clamp(2rem, 4vw, 3rem)',
        overflow: 'hidden',
      }}
    >
      {title && (
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: titleColor,
            fontFamily: !isLight ? 'var(--font-mono, monospace)' : undefined,
            margin: '0 0 clamp(1rem, 2vw, 1.5rem)',
          }}
        >
          {title}
        </p>
      )}

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '80px', zIndex: 2,
          background: `linear-gradient(to right, ${fadeColor} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px', zIndex: 2,
          background: `linear-gradient(to left, ${fadeColor} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />

        <div
          className="dtb-brands-track"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(12px, 2vw, 24px)',
            width: 'max-content',
            animation: `dtb-marquee ${speed}s linear infinite`,
          }}
        >
          {[...brands, ...brands].map((brand, i) => (
            <BrandLogo key={`${brand.name}-${i}`} brand={brand} dark={dark} transparent={transparent} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes dtb-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .dtb-brands-track:hover {
          animation-play-state: paused;
        }
        .dtb-trusted-brand-link {
          opacity: var(--dtb-brand-base-opacity, 0.72);
          transition: opacity 0.22s ease, transform 0.22s ease;
        }
        .dtb-trusted-brand-link:hover {
          opacity: 1;
          transform: translateY(-1px);
        }

        @media (min-width: 1025px) {
          .dtb-trusted-brand-link {
            padding: 0 clamp(28px, 4vw, 54px) !important;
            min-width: clamp(176px, 15vw, 236px) !important;
          }
          .dtb-brands-track {
            gap: clamp(18px, 2.2vw, 34px);
            padding: 0 clamp(24px, 4vw, 44px);
          }
        }

        @media (max-width: 767px) {
          .dtb-brands-track {
            gap: clamp(18px, 4vw, 28px);
            padding: 0 clamp(12px, 4vw, 20px);
          }
          .dtb-trusted-brand-link {
            padding-left: clamp(12px, 3.4vw, 18px) !important;
            padding-right: clamp(12px, 3.4vw, 18px) !important;
            min-width: clamp(126px, 32vw, 156px) !important;
          }
        }

        @media (max-width: 479px) {
          .dtb-brands-track {
            gap: clamp(22px, 5vw, 30px);
            padding: 0 18px;
          }
          .dtb-trusted-brand-link {
            padding-left: 14px !important;
            padding-right: 14px !important;
            min-width: clamp(132px, 34vw, 162px) !important;
          }
        }
      `}</style>
    </section>
  );
}
