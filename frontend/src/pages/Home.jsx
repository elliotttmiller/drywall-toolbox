import TrendingProducts from '../components/catalog/TrendingProducts';
import FeatureSection from '../components/ui/FeatureSection';
import HeroSection from '../components/ui/HeroSection';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_logo_white.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo_white.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import SEOHead from '../components/shared/SEOHead';
import { buildOrganizationSchema, buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { Truck, Shield, Phone, Wrench } from 'lucide-react';

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
  { name: 'TapeTech',              src: tapeTechLogo,  to: '/products?brand=TapeTech' },
  { name: 'Columbia',              src: columbiaLogo,  to: '/products?brand=Columbia%20Taping%20Tools' },
  { name: 'Level5',                src: level5Logo,    to: '/products?brand=Level5' },
  { name: 'Platinum Drywall Tools', src: platinumLogo, to: '/products?brand=Platinum%20Drywall%20Tools' },
  { name: 'Asgard',                src: asgardLogo,    to: '/products?brand=Asgard' },
  { name: 'SurPro',                src: surproLogo,    to: '/products?brand=SurPro' },
];

const HOME_FEATURES = [
  { icon: Truck,   title: 'Free Shipping',    description: 'On all qualifying orders $75+ to the contiguous USA.' },
  { icon: Shield,  title: 'Warranty Covered', description: 'Full manufacturer coverage. We handle all claims for you.' },
  { icon: Wrench,  title: 'Repair Services',  description: 'Professional tool repair by industry-trained technicians.' },
  { icon: Phone,   title: 'Expert Support',   description: 'Real help from real drywall pros — not a call center.' },
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
      <div className="page-wrapper dtb-home-page">

      {/* --- HERO (all breakpoints) --- */}
      <HeroSection
        titleLines={["Pro-Grade Drywall Tools", "Built for Faster Finishes."]}
        subtitle="Shop trusted taping, finishing, and sanding tools from top brands—with competitive pricing and fast shipping."
        brands={brandLogos}
      />

      {/* --- DESKTOP FEATURE SECTION (hidden on mobile/tablet) --- */}
      <div className="dtb-feature-strip" aria-label="Key features">
        <FeatureSection
          features={HOME_FEATURES}
          style={{ padding: 'clamp(1.5rem, 3vw, 2.5rem) clamp(1.5rem, 5vw, 3rem)', background: 'white' }}
        />
      </div>

      {/* --- TRENDING PRODUCTS --- */}
      <TrendingProducts />

      {/* --- TRUST BADGES (mobile only) --- */}
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

      </div>
    </>
  );
}
