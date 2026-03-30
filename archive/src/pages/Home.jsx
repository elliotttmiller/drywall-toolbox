import { Link } from 'react-router-dom';
import TrendingProducts from '../components/TrendingProducts';
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
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6A16 16 0 0 0 16 16.68l.96-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    label: 'Expert Support',
    sub: 'Real help from real people'
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
      <div style={{ minHeight: '100vh', background: 'white' }} className="page-wrapper">
      {/* ─── HERO ─── */}
      <section
        className="section-enter home-hero-section"
        style={{
          padding: 'clamp(2.5rem, 5vw, 4rem) clamp(1rem, 5vw, 2.5rem) clamp(1rem, 3vw, 1.5rem)',
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
          </div>
        </div>
      </section>

      {/* ─── TRENDING PRODUCTS ─── */}
      <TrendingProducts />

      {/* ─── TRUST BADGES ─── */}
      <section style={{
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 5vw, 2.5rem)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          placeItems: 'stretch'
        }}>
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding: '20px 24px',
                transition: 'box-shadow 0.2s',
                textAlign: 'center'
              }}
            >
              <div style={{ color: 'var(--primary-600)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px' }}>
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

      {/* ─── BRAND LOGOS ─── */}
      <section style={{
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 5vw, 2.5rem) clamp(3rem, 6vw, 4rem)',
        maxWidth: '1400px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px'
        }}>
          <p style={{
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            fontWeight: 700,
            color: 'var(--primary-600)',
            margin: 0,
            paddingBottom: '6px',
            paddingLeft: '12px',
            paddingRight: '12px',
            borderBottom: '2px solid var(--primary-600)',
            transition: 'all 0.3s ease-out'
          }}>
            Trusted Brands
          </p>
        </div>
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
              style={{ textDecoration: 'none', opacity: 1, transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <img
                src={brand.src}
                alt={brand.name}
                style={{ 
                  height: brand.name === 'Columbia' ? 'clamp(60px, 10vw, 100px)' : brand.name === 'Asgard' || brand.name === 'Graco' ? 'clamp(32px, 5vw, 50px)' : 'clamp(24px, 4vw, 40px)',
                  maxWidth: brand.name === 'Columbia' ? '300px' : brand.name === 'Asgard' || brand.name === 'Graco' ? '150px' : '120px',
                  objectFit: 'contain' 
                }}
              />
            </Link>
          ))}
        </div>
      </section>
      </div>
    </>
  );
}
