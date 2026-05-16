import TrendingProducts from '../components/catalog/TrendingProducts';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_logo_white.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo_white.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import SEOHead from '../components/shared/SEOHead';
import { buildOrganizationSchema, buildSiteLinksSearchBoxSchema } from '../utils/schema';
import StorefrontSection from '../components/storefront/StorefrontSection';
import StorefrontRail from '../components/storefront/StorefrontRail';
import StorefrontHero from '../components/storefront/StorefrontHero';
import StorefrontCategoryTile from '../components/storefront/StorefrontCategoryTile';
import StorefrontBrandTile from '../components/storefront/StorefrontBrandTile';
import StorefrontCTA from '../components/storefront/StorefrontCTA';
import StorefrontProductRail from '../components/storefront/StorefrontProductRail';

const categories = [
  { title: 'Automatic Taping Tools', to: '/products?display_category=automatic_taping_tools' },
  { title: 'Finishing Boxes', to: '/products?display_category=finishing_boxes' },
  { title: 'Corner Tools', to: '/products?display_category=corner_tools' },
  { title: 'Parts', to: '/products?display_category=parts' },
  { title: 'Handles & Extensions', to: '/products?display_category=handles_and_extensions' },
  { title: 'New Arrivals', to: '/products?sort=newest' },
];

const brands = [
  { name: 'TapeTech', logo: tapeTechLogo, to: '/products/brands/tapetech' },
  { name: 'Columbia Taping Tools', logo: columbiaLogo, to: '/products/brands/columbia-taping-tools' },
  { name: 'Level 5', logo: level5Logo, to: '/products/brands/level-5' },
  { name: 'Platinum Drywall Tools', logo: platinumLogo, to: '/products/brands/platinum-drywall-tools' },
  { name: 'Asgard', logo: asgardLogo, to: '/products/brands/asgard' },
  { name: 'SurPro', logo: surproLogo, to: '/products/brands/surpro' },
];

const trustItems = [
  { icon: '🚚', title: 'Free Shipping $75+', desc: 'Contiguous USA only. Same-day processing on in-stock orders.' },
  { icon: '🔧', title: 'Expert Support', desc: 'Real pros answer your questions — no bots, no runaround.' },
  { icon: '🔄', title: 'Easy Returns', desc: '30-day hassle-free return on most stocked items.' },
  { icon: '🛡️', title: 'Secure Checkout', desc: 'SSL encrypted checkout with multiple payment options.' },
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

      <div className="page-wrapper dtb-home-page storefront-shell">
        <div className="container mx-auto px-4 py-4">

          {/* ── Commerce Hero ── */}
          <StorefrontHero />

          {/* ── Popular Categories ── */}
          <StorefrontSection
            eyebrow="Shop"
            title="Popular Categories"
            viewAllHref="/products"
            viewAllLabel="All categories"
          >
            <StorefrontRail label="Popular categories" className="storefront-rail--category">
              {categories.map((category) => (
                <StorefrontCategoryTile key={category.to} {...category} />
              ))}
            </StorefrontRail>
          </StorefrontSection>

          {/* ── Trending / Featured Products (brand-balanced) ── */}
          <TrendingProducts />

          {/* ── New Arrivals ── */}
          <StorefrontSection
            eyebrow="Just In"
            title="New Arrivals"
            viewAllHref="/products?sort=newest"
          >
            <StorefrontProductRail sort="newest" maxItems={10} label="New arrivals" />
          </StorefrontSection>

          {/* ── Replacement Parts ── */}
          <StorefrontSection
            eyebrow="Parts"
            title="Replacement Parts"
            viewAllHref="/parts"
            viewAllLabel="Browse all parts"
          >
            <StorefrontProductRail category="parts" maxItems={10} label="Parts" />
          </StorefrontSection>

          {/* ── Shop by Brand ── */}
          <StorefrontSection
            eyebrow="Brands"
            title="Shop by Brand"
            viewAllHref="/products/brands"
            viewAllLabel="All brands"
          >
            <StorefrontRail label="Brands" className="storefront-rail--brand">
              {brands.map((brand) => (
                <StorefrontBrandTile key={brand.name} {...brand} />
              ))}
            </StorefrontRail>
          </StorefrontSection>

          {/* ── Repair & Schematics CTAs ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <StorefrontCTA
              title="Professional Repair Services"
              copy="Submit repair requests for your drywall tools. Fast turnaround from certified technicians."
              to="/repairs"
              action="Start repair request"
            />
            <StorefrontCTA
              title="Parts & Schematics"
              copy="Exploded diagrams and part references for TapeTech, Columbia, and more."
              to="/schematics"
              action="Browse schematics"
            />
          </div>

          {/* ── Trust / Support blocks ── */}
          <div className="storefront-trust-bar">
            {trustItems.map((item) => (
              <div key={item.title} className="storefront-trust-item">
                <span className="storefront-trust-item__icon" aria-hidden="true">{item.icon}</span>
                <strong className="storefront-trust-item__title">{item.title}</strong>
                <p className="storefront-trust-item__desc">{item.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
