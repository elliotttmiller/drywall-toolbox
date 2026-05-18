import TrendingProducts from '../components/catalog/TrendingProducts';
import { useMemo } from 'react';
import HeroSection from '../components/ui/HeroSection';
import SEOHead from '../components/shared/SEOHead';
import { buildOrganizationSchema, buildSiteLinksSearchBoxSchema } from '../utils/schema';
import StorefrontSection from '../components/storefront/StorefrontSection';
import StorefrontRail from '../components/storefront/StorefrontRail';
import StorefrontCategoryTile from '../components/storefront/StorefrontCategoryTile';
import StorefrontBrandTile from '../components/storefront/StorefrontBrandTile';
import StorefrontProductRail from '../components/storefront/StorefrontProductRail';
import { useCatalogFacets } from '../hooks/useCatalogFacets.js';
import { brandToSlug, canonicalBrandLabel, sortBrandsBy } from '../utils/catalogUrlState.js';
import { getBrandLogo } from '../utils/brandAssets.js';

const MAX_HOME_BRANDS = 8;
const MAX_HOME_CATEGORIES = 8;

function toCatalogBrand(rawBrand = {}) {
  const name = canonicalBrandLabel(rawBrand.label || rawBrand.name || rawBrand.key || rawBrand.slug || '');
  if (!name) return null;
  const slug = rawBrand.slug || rawBrand.key || brandToSlug(name);
  if (!slug) return null;
  const count = Number(rawBrand.productCount || rawBrand.count || 0);
  return { name, slug, count };
}

function mergeDisplayCategories(displayCategoriesByBrand = {}) {
  const merged = new Map();
  Object.values(displayCategoriesByBrand || {}).forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const slug = item?.slug || item?.key;
      if (!slug) return;
      const count = Number(item?.productCount || item?.count || 0);
      const existing = merged.get(slug);
      merged.set(slug, {
        slug,
        title: item?.label || item?.name || item?.key || slug,
        count: (existing?.count || 0) + count,
      });
    });
  });
  return Array.from(merged.values())
    .filter((item) => item.count > 0)
    .sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title));
}

export default function Home() {
  const { facets } = useCatalogFacets();
  const brands = useMemo(() => {
    const mapped = Array.isArray(facets?.brands) ? facets.brands.map(toCatalogBrand).filter(Boolean) : [];
    return sortBrandsBy(mapped, 'name')
      .slice(0, MAX_HOME_BRANDS)
      .map((brand) => ({
        name: brand.name,
        logo: getBrandLogo(brand.name),
        to: `/products/brands/${brand.slug}`,
      }));
  }, [facets]);
  const heroBrands = useMemo(() => brands.map((brand) => ({
    name: brand.name,
    src: brand.logo,
    to: brand.to,
  })), [brands]);
  const categories = useMemo(() => ([
    ...mergeDisplayCategories(facets?.displayCategoriesByBrand || {})
      .slice(0, MAX_HOME_CATEGORIES)
      .map((category) => ({
        title: category.title,
        to: `/products?display_category=${encodeURIComponent(category.slug)}`,
      })),
    { title: 'New Arrivals', to: '/products?sort=newest' },
  ]), [facets]);

  return (
    <>
      <SEOHead
        title="Professional Drywall Tools & Equipment"
        description="Top trusted one-stop shop for professional drywall tools. Get production-grade tools and parts at unbeatable prices with lightning-fast shipping."
        canonical="https://drywalltoolbox.com/"
        schema={[buildOrganizationSchema(), buildSiteLinksSearchBoxSchema()]}
      />

      <div className="page-wrapper dtb-home-page storefront-shell">
        <HeroSection
          titleLines={['The New Standard', 'in Drywall.']}
          subtitle="Premium tools for every drywall job — unbeatable prices, lightning-fast shipping."
          brands={heroBrands}
        />

        <div className="container mx-auto px-5 pb-4 md:px-4">

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

        </div>
      </div>
    </>
  );
}
