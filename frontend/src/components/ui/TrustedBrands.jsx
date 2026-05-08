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
import { motion as Motion } from 'framer-motion';

const BRAND_SIZE_MAP = {
  TapeTech: { height: 'clamp(22px, 3.8vw, 34px)', maxWidth: '130px' },
  Columbia: { height: 'clamp(44px, 8vw, 70px)', maxWidth: '220px' },
  Level5: { height: 'clamp(16px, 2.8vw, 24px)', maxWidth: '100px' },
  'Platinum Drywall Tools': { height: 'clamp(24px, 4vw, 38px)', maxWidth: '170px' },
  Asgard: { height: 'clamp(28px, 5vw, 44px)', maxWidth: '150px' },
  SurPro: { height: 'clamp(28px, 5vw, 44px)', maxWidth: '150px' },
};

function BrandLogo({ brand }) {
  const sizeStyle = BRAND_SIZE_MAP[brand.name] || { height: 'clamp(24px, 4vw, 38px)', maxWidth: '140px' };
  return (
    <Link
      to={brand.to}
      aria-label={brand.name}
      style={{
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 clamp(16px, 3vw, 28px)',
        flexShrink: 0,
        opacity: 0.65,
        transition: 'opacity 0.22s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.65'; }}
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
        }}
      />
    </Link>
  );
}

export default function TrustedBrands({ brands = [], title = 'Trusted Brands', speed = 30 }) {
  if (!brands.length) return null;

  return (
    <section
      className="dtb-ui-trusted-brands"
      style={{
        background: '#f8fafc',
        borderTop: '1px solid var(--machined-border)',
        borderBottom: '1px solid var(--machined-border)',
        padding: 'clamp(1.5rem, 3vw, 2.5rem) 0',
        overflow: 'hidden',
      }}
    >
      {title && (
        <Motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
          style={{
            textAlign: 'center',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(15,23,42,0.35)',
            margin: '0 0 clamp(1rem, 2vw, 1.5rem)',
          }}
        >
          {title}
        </Motion.p>
      )}

      {/* Marquee container */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Left fade */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '80px', zIndex: 2,
          background: 'linear-gradient(to right, #f8fafc 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        {/* Right fade */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px', zIndex: 2,
          background: 'linear-gradient(to left, #f8fafc 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        <div
          className="dtb-brands-track"
          style={{
            display: 'flex',
            alignItems: 'center',
            width: 'max-content',
            animation: `dtb-marquee ${speed}s linear infinite`,
          }}
        >
          {/* Duplicate twice for seamless loop */}
          {[...brands, ...brands].map((brand, i) => (
            <BrandLogo key={`${brand.name}-${i}`} brand={brand} />
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
      `}</style>
    </section>
  );
}
