import { Link } from 'react-router-dom';
import PartsDiagrams from '../components/SchematicDiagrams';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';

const trustBadges = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
    label: 'Free Shipping',
    sub: 'On qualifying orders'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    label: 'Warranty Covered',
    sub: 'Full manufacturer coverage'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    label: '100% Pro-Grade',
    sub: 'Contractor trusted brands'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6A16 16 0 0 0 16 16.68l.96-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    label: 'Expert Support',
    sub: 'Real help from real people'
  }
];

const categories = [
  {
    id: 'taping',
    title: 'Automatic Taping Tools',
    subtitle: 'Professional-grade automatic tapers, banjos, and applicators',
    cta: 'Shop Taping',
    brand: 'TapeTech',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)',
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v-1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10v1.5C10 7.33 9.33 8 8.5 8S7 7.33 7 6.5 7.67 5 8.5 5z"/>
      </svg>
    )
  },
  {
    id: 'finishing',
    title: 'Finishing & Corner Tools',
    subtitle: 'Skimming blades, corner tools, and finishing knives',
    cta: 'Shop Finishing',
    brand: 'Columbia',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 60%, #3b82f6 100%)',
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  }
];

const brandLogos = [
  { name: 'TapeTech', src: tapeTechLogo },
  { name: 'Columbia', src: columbiaLogo },
  { name: 'SurPro', src: surproLogo },
  { name: 'Asgard', src: asgardLogo },
  { name: 'Graco', src: gracoLogo }
];

export default function Home() {
  return (
    <>
      {/* ─── HERO ─── */}
      <section
        className="section-enter home-hero-section"
        style={{
          padding: 'clamp(4px, 2vw, 24px) clamp(1rem, 5vw, 2.5rem) clamp(1.5rem, 5vw, 2.5rem)',
          minHeight: '100vh'
        }}
      >
        <div
          className="home-hero-grid"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'clamp(1.25rem, 4vw, 2rem)',
            maxWidth: '1400px',
            margin: '0 auto',
            minHeight: '100%'
          }}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'clamp(1.25rem, 4vw, 2rem)' }}>
            <h1 className="machined-title" style={{ marginBottom: 0, color: 'var(--primary-600)', lineHeight: 1.1 }}>
              TOP TRUSTED<br />ONE-STOP SHOP.
            </h1>
            <p style={{
              maxWidth: '700px',
              marginBottom: 0,
              fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
              opacity: 0.7,
              color: 'black',
              lineHeight: 1.6
            }}>
              Everything you need to ensure a flawless finish every time. Get production-grade tools and parts at unbeatable prices with lightning-fast shipping.
            </p>
            <Link to="/products" className="alloy-button" style={{ textDecoration: 'none', marginTop: 'clamp(0.5rem, 2vw, 1rem)' }}>
              Shop Products
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CATEGORY BANNERS ─── */}
      <section style={{
        padding: '0 clamp(1rem, 5vw, 2.5rem) clamp(2rem, 5vw, 3rem)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/products?category=${cat.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: cat.gradient,
                  borderRadius: '4px',
                  padding: 'clamp(2rem, 5vw, 3rem) clamp(1.5rem, 4vw, 2.5rem)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.3s var(--ease-tension), box-shadow 0.3s var(--ease-tension)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
                }}
              >
                {/* Background dot grid texture */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
                  backgroundSize: '40px 40px',
                  pointerEvents: 'none'
                }} />
                {/* Large background icon */}
                <div style={{ position: 'absolute', top: '50%', right: '-10px', transform: 'translateY(-50%) scale(2.5)', opacity: 0.15, pointerEvents: 'none' }}>
                  {cat.icon}
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '3px',
                    padding: '3px 10px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.8)',
                    marginBottom: '12px'
                  }}>
                    {cat.brand}
                  </div>
                  <h2 style={{
                    color: 'white',
                    fontSize: 'clamp(1.3rem, 3vw, 1.75rem)',
                    fontWeight: 800,
                    margin: '0 0 8px 0',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em'
                  }}>
                    {cat.title}
                  </h2>
                  <p style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    margin: '0 0 24px 0',
                    lineHeight: 1.5
                  }}>
                    {cat.subtitle}
                  </p>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    borderBottom: '2px solid rgba(255,255,255,0.4)',
                    paddingBottom: '2px'
                  }}>
                    {cat.cta}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── TRUST BADGES ─── */}
      <section style={{
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 5vw, 2.5rem)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding: '20px 24px',
                transition: 'box-shadow 0.2s'
              }}
            >
              <div style={{ color: 'var(--primary-600)', flexShrink: 0 }}>
                {badge.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'black', marginBottom: '2px' }}>{badge.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.5)' }}>{badge.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PARTS / SCHEMATICS ─── */}
      <PartsDiagrams />

      {/* ─── BRAND LOGOS ─── */}
      <section style={{
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 5vw, 2.5rem) clamp(3rem, 6vw, 4rem)',
        maxWidth: '1400px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <p style={{
          textTransform: 'uppercase',
          fontSize: '0.7rem',
          letterSpacing: '0.15em',
          fontWeight: 700,
          color: 'rgba(15,23,42,0.4)',
          marginBottom: '32px'
        }}>
          Trusted Brands
        </p>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(24px, 5vw, 56px)'
        }}>
          {brandLogos.map((brand) => (
            <Link
              key={brand.name}
              to={`/products?brand=${encodeURIComponent(brand.name === 'Columbia' ? 'Columbia Taping Tools' : brand.name)}`}
              style={{ textDecoration: 'none', opacity: 0.55, transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.55')}
            >
              <img
                src={brand.src}
                alt={brand.name}
                style={{ height: 'clamp(24px, 4vw, 40px)', maxWidth: '120px', objectFit: 'contain', filter: 'grayscale(100%)' }}
              />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
