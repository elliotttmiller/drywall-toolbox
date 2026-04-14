import { Link } from 'react-router-dom';
import TrendingProducts from '../components/TrendingProducts';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo.svg';
import duraStiltsLogo from '/brands/Dura-Stilts/dura-stilts-logo.svg';
import SEOHead from '../components/SEOHead';
import { buildOrganizationSchema, buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { ShoppingBag, Wrench, Layers, FileText, Truck, Shield, Phone, ChevronRight, Star } from 'lucide-react';

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
  { name: 'Graco', src: gracoLogo },
  { name: 'Platinum Drywall Tools', src: platinumLogo },
  { name: 'Dura-Stilts', src: duraStiltsLogo },
];

export default function Home() {
  return (
    <>
      <SEOHead
        title="Professional Drywall Tools & Equipment"
        description="Top trusted one-stop shop for professional drywall tools. Get production-grade tools and parts at unbeatable prices with lightning-fast shipping."
        canonical="https://drywalltoolbox.com/"
        schema={[buildOrganizationSchema(), buildSiteLinksSearchBoxSchema()]}
      />
      <div style={{ background: 'white' }} className="page-wrapper">

      {/* ─── MOBILE/TABLET HERO (hidden on desktop ≥ 1025px) ─── */}
      <div className="dtb-hero-mobile-wrapper">
      <section
        className="section-enter home-hero-section"
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
      </div>

      {/* ─── DESKTOP HERO (hidden on mobile/tablet ≤ 1024px) ─── */}
      <section className="dtb-desktop-hero section-enter" aria-label="Hero">
        <div className="dtb-desktop-hero-inner">
          {/* Left: headline + CTAs + trust stats */}
          <div className="dtb-hero-content">
            <span className="dtb-hero-eyebrow">
              <Star size={11} />
              Professional Grade · Trade Trusted
            </span>

            <h1 className="dtb-hero-title">
              The Pros&apos;<br />
              <span>One-Stop Shop</span><br />
              for Drywall Tools.
            </h1>

            <p className="dtb-hero-subtitle">
              Production-grade taping, finishing, and sanding equipment from the industry&apos;s most trusted brands — at unbeatable prices with lightning-fast shipping.
            </p>

            <div className="dtb-hero-actions">
              <Link to="/all-products" className="dtb-hero-cta-primary">
                Shop All Products <ChevronRight size={15} />
              </Link>
              <Link to="/parts" className="dtb-hero-cta-secondary">
                Replacement Parts
              </Link>
            </div>

            <div className="dtb-hero-stats">
              <div className="dtb-hero-stat">
                <span className="dtb-hero-stat-num">7+</span>
                <span className="dtb-hero-stat-label">Pro Brands</span>
              </div>
              <span className="dtb-hero-stat-divider" />
              <div className="dtb-hero-stat">
                <span className="dtb-hero-stat-num">Fast</span>
                <span className="dtb-hero-stat-label">Shipping</span>
              </div>
              <span className="dtb-hero-stat-divider" />
              <div className="dtb-hero-stat">
                <span className="dtb-hero-stat-num">OEM</span>
                <span className="dtb-hero-stat-label">Certified Parts</span>
              </div>
            </div>
          </div>

          {/* Right: quick-navigate category cards */}
          <div className="dtb-hero-visual">
            <p className="dtb-hero-visual-label">Shop by Category</p>
            <div className="dtb-hero-categories">
              <Link to="/products?category=taping" className="dtb-hero-cat-card">
                <div className="dtb-hero-cat-icon"><Wrench size={18} /></div>
                <div>
                  <span className="dtb-hero-cat-name">Taping Tools</span>
                  <span className="dtb-hero-cat-sub">Automatic tapers &amp; more</span>
                </div>
              </Link>
              <Link to="/products?category=finishing" className="dtb-hero-cat-card">
                <div className="dtb-hero-cat-icon"><Layers size={18} /></div>
                <div>
                  <span className="dtb-hero-cat-name">Finishing Tools</span>
                  <span className="dtb-hero-cat-sub">Boxes, pumps &amp; knives</span>
                </div>
              </Link>
              <Link to="/products?category=sanding" className="dtb-hero-cat-card">
                <div className="dtb-hero-cat-icon"><Star size={18} /></div>
                <div>
                  <span className="dtb-hero-cat-name">Sanding Tools</span>
                  <span className="dtb-hero-cat-sub">Sanders &amp; dust control</span>
                </div>
              </Link>
              <Link to="/parts" className="dtb-hero-cat-card">
                <div className="dtb-hero-cat-icon"><FileText size={18} /></div>
                <div>
                  <span className="dtb-hero-cat-name">Parts &amp; Schematics</span>
                  <span className="dtb-hero-cat-sub">OEM parts &amp; diagrams</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DESKTOP FEATURE STRIP (hidden on mobile/tablet) ─── */}
      <div className="dtb-feature-strip" aria-hidden="true">
        <div className="dtb-feature-strip-inner">
          <div className="dtb-feature-item">
            <div className="dtb-feature-icon"><Truck size={18} /></div>
            <div className="dtb-feature-text">
              <strong>Free Shipping</strong>
              <span>On qualifying orders</span>
            </div>
          </div>
          <div className="dtb-feature-item">
            <div className="dtb-feature-icon"><Shield size={18} /></div>
            <div className="dtb-feature-text">
              <strong>Warranty Covered</strong>
              <span>Full manufacturer coverage</span>
            </div>
          </div>
          <div className="dtb-feature-item">
            <div className="dtb-feature-icon"><Wrench size={18} /></div>
            <div className="dtb-feature-text">
              <strong>Repair Services</strong>
              <span>Professional tool repair</span>
            </div>
          </div>
          <div className="dtb-feature-item">
            <div className="dtb-feature-icon"><Phone size={18} /></div>
            <div className="dtb-feature-text">
              <strong>Expert Support</strong>
              <span>Real help from real pros</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TRENDING PRODUCTS ─── */}
      <TrendingProducts />

      {/* ─── TRUST BADGES ─── */}
      <section className="home-trust-section">
        <div className="trust-badges-grid">
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
      <section className="home-brands-section">
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
        <div className="brand-logos-row">
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
                loading="lazy"
                decoding="async"
                style={{ 
                  height: brand.name === 'Columbia' ? 'clamp(60px, 10vw, 100px)' : brand.name === 'Asgard' || brand.name === 'Graco' ? 'clamp(32px, 5vw, 50px)' : brand.name === 'Platinum Drywall Tools' ? 'clamp(28px, 4.5vw, 44px)' : 'clamp(24px, 4vw, 40px)',
                  maxWidth: brand.name === 'Columbia' ? '300px' : brand.name === 'Asgard' || brand.name === 'Graco' ? '150px' : brand.name === 'Platinum Drywall Tools' ? '180px' : '120px',
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
