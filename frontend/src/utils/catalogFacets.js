import { brandToSlug, canonicalBrandLabel, sortBrandsBy } from './catalogUrlState.js';

export function normalizeDisplayCategorySlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildDisplayCategoryUrl(slug) {
  return `/products?display_category=${encodeURIComponent(slug)}`;
}

export function toCatalogBrand(rawBrand = {}) {
  const name = canonicalBrandLabel(rawBrand.label || rawBrand.name || rawBrand.key || rawBrand.slug || '');
  if (!name) return null;
  const slug = rawBrand.slug || rawBrand.key || brandToSlug(name);
  if (!slug) return null;
  const count = Number(rawBrand.productCount || rawBrand.count || 0);
  return { name, slug, count };
}

export function mapCatalogBrands(rawBrands = []) {
  const mapped = Array.isArray(rawBrands) ? rawBrands.map(toCatalogBrand).filter(Boolean) : [];
  return sortBrandsBy(mapped, 'name');
}

export function mergeCatalogDisplayCategories(displayCategoriesByBrand = {}) {
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
        label: item?.label || item?.name || item?.key || slug,
        count: (existing?.count || 0) + count,
      });
    });
  });
  return Array.from(merged.values())
    .filter((item) => item.count > 0)
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
}

export function normalizeCatalogCategoryEntry(category) {
  if (typeof category === 'string') {
    return {
      label: category,
      slug: normalizeDisplayCategorySlug(category),
    };
  }
  const label = category?.label || category?.name || '';
  const slug = category?.slug || category?.key || normalizeDisplayCategorySlug(label);
  return { label, slug };
}
