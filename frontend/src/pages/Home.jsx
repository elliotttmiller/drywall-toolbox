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

const categories = [
  { title: 'Automatic Taping Tools', to: '/products?display_category=automatic_taping_tools' },
  { title: 'Finishing Boxes', to: '/products?display_category=finishing_boxes' },
  { title: 'Parts', to: '/products?display_category=parts' },
  { title: 'All Products', to: '/products' },
];

const brands = [
  { name: 'TapeTech', logo: tapeTechLogo, to: '/products/brands/tapetech' },
  { name: 'Columbia Taping Tools', logo: columbiaLogo, to: '/products/brands/columbia-taping-tools' },
  { name: 'Level 5', logo: level5Logo, to: '/products/brands/level-5' },
  { name: 'Platinum Drywall Tools', logo: platinumLogo, to: '/products/brands/platinum-drywall-tools' },
  { name: 'Asgard', logo: asgardLogo, to: '/products/brands/asgard' },
  { name: 'SurPro', logo: surproLogo, to: '/products/brands/surpro' },
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
          <StorefrontHero />

          <StorefrontSection
            eyebrow="Shop"
            title="Popular Categories"
            subtitle="Jump directly into the most-shopped product groups."
            viewAllHref="/products"
          >
            <StorefrontRail label="Popular categories">
              {categories.map((category) => (
                <StorefrontCategoryTile key={category.to} {...category} />
              ))}
            </StorefrontRail>
          </StorefrontSection>

          <StorefrontSection
            eyebrow="Brands"
            title="Shop by Brand"
            subtitle="Browse the top drywall tool manufacturers."
            viewAllHref="/products/brands"
          >
            <StorefrontRail label="Brands">
              {brands.map((brand) => (
                <StorefrontBrandTile key={brand.name} {...brand} />
              ))}
            </StorefrontRail>
          </StorefrontSection>

          <StorefrontSection title="Automatic Taping Tools" viewAllHref="/products?display_category=automatic_taping_tools">
            <TrendingProducts />
          </StorefrontSection>

          <StorefrontSection title="Finishing Boxes" viewAllHref="/products?display_category=finishing_boxes">
            <StorefrontCTA
              title="Shop Finishing Boxes"
              copy="Browse pro finishing box options and accessories."
              to="/products?display_category=finishing_boxes"
            />
          </StorefrontSection>

          <StorefrontSection title="Parts" viewAllHref="/products?display_category=parts">
            <StorefrontCTA
              title="Find Exact-Fit Parts"
              copy="Get replacement parts by brand and category with fast checkout."
              to="/parts"
            />
          </StorefrontSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
            <StorefrontCTA
              title="Repair Services"
              copy="Submit repair requests for pro tool maintenance and turnaround."
              to="/repairs"
              action="Start repair request"
            />
            <StorefrontCTA
              title="Schematics"
              copy="Find exploded diagrams and part references for core tool lines."
              to="/schematics"
              action="Browse schematics"
            />
          </div>
        </div>
      </div>
    </>
  );
}
