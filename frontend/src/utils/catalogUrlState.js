/**
 * frontend/src/utils/catalogUrlState.js
 *
 * Canonical URL ↔ CatalogQuery serializer/deserializer.
 *
 * Used by Products.jsx to keep the URL as the single source of truth for
 * catalog filter state. All brand slug ↔ label conversions go through here.
 */

// ── Brand maps ─────────────────────────────────────────────────────────────────

export const BRAND_TO_SLUG = {
  TapeTech: 'tapetech',
  'Columbia Tools': 'columbia-taping-tools',
  Asgard: 'asgard',
  SurPro: 'surpro',
  Graco: 'graco',
  'Platinum Drywall Tools': 'platinum-drywall-tools',
  'Dura-Stilts': 'dura-stilts',
  'Level 5': 'level5',
};

export const BRAND_ALIASES = {
  Columbia: 'Columbia Tools',
  COLUMBIA: 'Columbia Tools',
  columbia: 'Columbia Tools',
  'Columbia Taping Tools': 'Columbia Tools',
  'columbia taping tools': 'Columbia Tools',
  'COLUMBIA TAPING TOOLS': 'Columbia Tools',
  'columbia-tools': 'Columbia Tools',
  Platinum: 'Platinum Drywall Tools',
  PLATINUM: 'Platinum Drywall Tools',
  TAPETECH: 'TapeTech',
  'Tape Tech': 'TapeTech',
  'Dura Stilts': 'Dura-Stilts',
  'DURA-STILTS': 'Dura-Stilts',
  SURPRO: 'SurPro',
  'Sur-Pro': 'SurPro',
  'SUR PRO': 'SurPro',
  GRACO: 'Graco',
  ASGARD: 'Asgard',
  Level5: 'Level 5',
  'LEVEL 5': 'Level 5',
};

export const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries(BRAND_TO_SLUG).map(([name, slug]) => [slug, name])
);

// Brand visual assets are owned by frontend/src/utils/brandAssets.js so bundled
// imports can resolve through Webpack. Keep URL state free of asset imports.
export const BRAND_LOGOS = {};

// ── DTB category key → display label ─────────────────────────────────────────

export const CATEGORY_LABELS = {
  taping: 'Automatic Taping Tools',
  finishing: 'Finishing Tools',
  corner: 'Corner Tools',
  handles: 'Handles & Extensions',
  mudboxes: 'Mud Boxes & Pumps',
  sanding: 'Sanding Tools',
  stilts: 'Stilts',
  texture: 'Texture Tools',
  parts: 'Replacement Parts',
  services: 'Repair Services',
};

// ── Sort options ──────────────────────────────────────────────────────────────

export const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'az', label: 'A – Z' },
];

// ── Default query ─────────────────────────────────────────────────────────────

export const DEFAULT_QUERY = {
  brands: [],
  category: '',
  displayCategory: '',
  toolFamily: '',
  productKind: '',
  builderSlot: '',
  workflowScope: '',
  search: '',
  page: 1,
  perPage: 24,
  sort: 'popular',
};

// ── Parsers ───────────────────────────────────────────────────────────────────

/**
 * Parse URL search params + optional path params into a canonical CatalogQuery.
 *
 * @param {URLSearchParams} searchParams
 * @param {{ brandSlug?: string, categorySlug?: string }} [pathParams]
 * @returns {typeof DEFAULT_QUERY}
 */
export function parseCatalogQuery(searchParams, pathParams = {}) {
  let brands = [];
  if (pathParams.brandSlug) {
    const label = normalizeBrandParam(pathParams.brandSlug);
    if (label) brands = [label];
  } else {
    const brandParam = searchParams.get('brand');
    if (brandParam) {
      brands = brandParam
        .split(',')
        .map((b) => decodeURIComponent(b.trim()))
        .map((b) => normalizeBrandParam(b))
        .filter(Boolean);
    }
  }

  const displayCategory = pathParams.categorySlug
    ? pathParams.categorySlug
    : (searchParams.get('display_category') || '');

  return {
    brands,
    category: searchParams.get('category') || '',
    displayCategory,
    toolFamily: searchParams.get('tool_family') || '',
    productKind: searchParams.get('product_kind') || '',
    builderSlot: searchParams.get('builder_slot') || '',
    workflowScope: searchParams.get('workflow_scope') || '',
    search: searchParams.get('search')
      ? decodeURIComponent(searchParams.get('search'))
      : '',
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10)),
    perPage: Math.max(1, Math.min(100, parseInt(searchParams.get('per_page') || '24', 10))),
    sort: searchParams.get('sort') || 'popular',
  };
}

/**
 * Serialize a CatalogQuery into a URL string.
 *
 * @param {Partial<typeof DEFAULT_QUERY>} query
 * @param {{ brandSlug?: string, categorySlug?: string }} [pathParams]
 * @returns {string}
 */
export function buildCatalogUrl(query, pathParams = {}) {
  const params = new URLSearchParams();

  if (!pathParams.brandSlug && query.brands && query.brands.length > 0) {
    params.set('brand', query.brands.map((b) => brandToSlug(b)).join(','));
  }
  if (!pathParams.categorySlug && query.displayCategory) {
    params.set('display_category', query.displayCategory);
  }
  if (query.category) params.set('category', query.category);
  if (query.toolFamily) params.set('tool_family', query.toolFamily);
  if (query.productKind) params.set('product_kind', query.productKind);
  if (query.builderSlot) params.set('builder_slot', query.builderSlot);
  if (query.workflowScope) params.set('workflow_scope', query.workflowScope);
  if (query.search) params.set('search', query.search);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.sort && query.sort !== 'popular') params.set('sort', query.sort);

  const search = params.toString();
  const qs = search ? `?${search}` : '';

  if (pathParams.brandSlug && pathParams.categorySlug) {
    return `/products/brands/${pathParams.brandSlug}/categories/${pathParams.categorySlug}${qs}`;
  }
  if (pathParams.brandSlug) {
    return `/products/brands/${pathParams.brandSlug}${qs}`;
  }
  return `/products${qs}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function canonicalBrandLabel(value) {
  if (!value) return '';
  const decoded = decodeURIComponent(String(value).trim());
  if (!decoded) return '';
  if (BRAND_ALIASES[decoded]) return BRAND_ALIASES[decoded];
  if (BRAND_TO_SLUG[decoded]) return decoded;
  if (SLUG_TO_BRAND[decoded]) return SLUG_TO_BRAND[decoded];

  const lower = decoded.toLowerCase();
  for (const [alias, label] of Object.entries(BRAND_ALIASES)) {
    if (alias.toLowerCase() === lower) return label;
  }
  for (const [label] of Object.entries(BRAND_TO_SLUG)) {
    if (label.toLowerCase() === lower) return label;
  }
  for (const [slug, label] of Object.entries(SLUG_TO_BRAND)) {
    if (slug.toLowerCase() === lower) return label;
  }
  return decoded;
}

/**
 * Normalize a URL brand param (slug, alias, or canonical label) to a canonical label.
 *
 * @param {string} param
 * @returns {string|null}
 */
export function normalizeBrandParam(param) {
  const label = canonicalBrandLabel(param);
  return label || null;
}

/**
 * Convert a canonical brand label, alias, or slug to its URL slug.
 *
 * @param {string} value
 * @returns {string}
 */
export function brandToSlug(value) {
  if (!value) return '';
  const label = canonicalBrandLabel(value);
  if (BRAND_TO_SLUG[label]) return BRAND_TO_SLUG[label];
  const decoded = decodeURIComponent(String(value).trim());
  if (SLUG_TO_BRAND[decoded]) return decoded;
  return decoded.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function sortBrandsBy(brands = [], field = 'name') {
  return brands
    .slice()
    .sort((a, b) => String(a?.[field] || '').localeCompare(String(b?.[field] || ''), undefined, { sensitivity: 'base' }));
}
