import ShippingTicker from '../components/ShippingTicker';
import { Link } from 'react-router-dom';
import TrendingProducts from '../components/TrendingProducts';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import SEOHead from '../components/SEOHead';
import { buildOrganizationSchema, buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { ShoppingBag, Wrench, Layers, FileText, Truck, Shield, Phone, ChevronRight } from 'lucide-react';

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
  { name: 'Level5', src: level5Logo },
  { name: 'Platinum Drywall Tools', src: platinumLogo },
  { name: 'Asgard', src: asgardLogo },
  { name: 'SurPro', src: surproLogo },
];

const desktopHeroBrands = [
  { name: 'TapeTech', src: tapeTechLogo },
  { name: 'Columbia', src: columbiaLogo },
  { name: 'Level5', src: level5Logo },
  { name: 'Platinum Drywall Tools', src: platinumLogo },
  { name: 'Asgard', src: asgardLogo },
  { name: 'SurPro', src: surproLogo },
];

const mobileBrandLogoStyles = {
  // Slightly reduced TapeTech and Level5 sizes to better match the visual weight
  // of the other trusted brand logos on small screens.
  TapeTech: { height: 'clamp(26px, 5.2vw, 38px)', maxWidth: '120px' },
  Columbia: { height: 'clamp(56px, 10vw, 86px)', maxWidth: '250px' },
  Level5: { height: 'clamp(18px, 3.5vw, 26px)', maxWidth: '110px' },
  'Platinum Drywall Tools': { height: 'clamp(28px, 5vw, 42px)', maxWidth: '180px' },
  Asgard: { height: 'clamp(34px, 6vw, 48px)', maxWidth: '160px' },
  SurPro: { height: 'clamp(34px, 6vw, 50px)', maxWidth: '170px' },
};

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
            <h1 className="dtb-hero-title">
              The Pros&apos;<br />
              <span>One-Stop Shop</span><br />
              for Drywall Tools.
            </h1>

            <p className="dtb-hero-subtitle">
              Production-grade taping, finishing, and sanding equipment from the industry&apos;s most trusted brands — at unbeatable prices with lightning-fast shipping.
            </p>
          </div>

          {/* Right: Trusted Brands (desktop only) */}
          <div className="dtb-hero-visual">
            <div className="dtb-hero-brands">
              {desktopHeroBrands.map((brand) => (
                <Link
                  key={brand.name}
                  to={`/products?brand=${encodeURIComponent(brand.name === 'Columbia' ? 'Columbia Taping Tools' : brand.name)}`}
                  className="dtb-hero-brand-link"
                >
                  <img
                    src={brand.src}
                    alt={brand.name}
                    loading="lazy"
                    decoding="async"
                    className="dtb-hero-brand-logo"
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── DESKTOP SHIPPING BAR (appears below hero on desktop only) ─── */}
      <div className="dtb-desktop-shipping-bar">
        <ShippingTicker
          items={[
            { icon: <Truck size={14} />, text: 'FREE SHIPPING ON ORDERS $150+ (CONTIGUOUS USA ONLY)' },
            { icon: <Phone size={14} />, text: 'Expert Support — Real Pros' },
            { icon: <Wrench size={14} />, text: 'Professional Repair Services' },
          ]}
          duration={28}
          className="dtb-desktop-shipping-bar"
        />
      </div>

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

      {/* ─── TRUST BADGES (mobile only) ─── */}
      <section className="home-trust-section dtb-mobile-only">
        <div className="trust-badges-grid">
          {trustBadges.map((badge) => (
            <div key={badge.label} className="dtb-trust-badge">
              <div className="dtb-trust-badge__icon">{badge.icon}</div>
              <div>
                <div className="dtb-trust-badge__label">{badge.label}</div>
                <div className="dtb-trust-badge__sub">{badge.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── BRAND LOGOS (mobile only) ─── */}
      <section className="home-brands-section dtb-mobile-only">
        <div className="dtb-trending-header">
          <p className="dtb-section-eyebrow">Trusted Brands</p>
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
                  ...(mobileBrandLogoStyles[brand.name] || { height: 'clamp(28px, 5vw, 42px)', maxWidth: '150px' }),
                  width: 'auto',
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
