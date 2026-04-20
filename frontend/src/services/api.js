/**
 * src/services/api.js
 *
 * Centralized WooCommerce REST API module.
 *
 * Authentication: WooCommerce Application Passwords (more secure than consumer keys for client-side).
 * Env vars are injected at build time by webpack DefinePlugin:
 *   REACT_APP_WC_BASE_URL        – WooCommerce REST API base
 *                                   e.g. https://drywalltoolbox.com/wp-json/wc/v3
 *   REACT_APP_WC_AUTH_USER       – WooCommerce Application Password username
 *   REACT_APP_WC_AUTH_PASS       – WooCommerce Application Password password
 *
 * WooCommerce REST API docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */

import { wcClient } from '../api/client.js';
import { CATEGORY_MAP } from '../utils/parseProductCsv.js';

// Prefer build-time env injection, fall back to runtime-origin based paths
const WC_BASE = process.env.REACT_APP_WC_BASE_URL || (typeof window !== 'undefined' ? `${window.location.origin}/wp-json/wc/v3` : '');

// ─── Known brand names (kept in sync with ALLOWED_BRANDS in Products.jsx) ────
const KNOWN_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Asgard',
  'SurPro',
  'Graco',
  'Platinum Drywall Tools',
  'Dura-Stilts',
];

// Maps common brand name variations to the canonical brand name used throughout the UI.
const BRAND_ALIASES = {
  'platinum':                  'Platinum Drywall Tools',
  'platinum tools':            'Platinum Drywall Tools',
  'platinum drywall':          'Platinum Drywall Tools',
  'platinum drywall tools':    'Platinum Drywall Tools',
  'dura stilts':               'Dura-Stilts',
  'dura_stilts':               'Dura-Stilts',
  'columbia':                  'Columbia Taping Tools',
  'columbia taping':           'Columbia Taping Tools',
  'tapetech':                  'TapeTech',
  'tape tech':                 'TapeTech',
  'surpro':                    'SurPro',
  'sur pro':                   'SurPro',
};

// ─── Auth header (lazy, runtime-safe) ────────────────────────────────────────
//
// Build-time env vars (REACT_APP_WC_AUTH_USER / REACT_APP_WC_AUTH_PASS) are baked
// in by webpack DefinePlugin.  If the deploy predates dotenv being wired up,
// they will be empty strings.
//
// client.js runs a runtime bootstrap: it fetches /wp-json/dtb/v1/config and
// patches wcClient.defaults.headers.common['Authorization'] when it resolves.
//
// We MUST read the Authorization header lazily (at call time, not at module
// load time) so we pick up whatever client.js has patched in.  Reading it
// once at module init would always get the empty pre-bootstrap value.
//
// Resolution order:
//   1. wcClient.defaults.headers.common['Authorization']  (patched by bootstrap)
//   2. build-time REACT_APP_WC_AUTH_USER env var
//   3. build-time REACT_APP_WC_AUTH_PASS env var

function getAuthHeader() {
  // First choice: whatever client.js has set (may be bootstrap-patched at runtime)
  const live = wcClient?.defaults?.headers?.common?.['Authorization'];
  if (live) return { Authorization: live };

  // Second choice: build-time env vars (works when dotenv is properly wired)
  const user = process.env.REACT_APP_WC_AUTH_USER || '';
  const pass = process.env.REACT_APP_WC_AUTH_PASS || '';
  if (user && pass) return { Authorization: 'Basic ' + btoa(`${user}:${pass}`) };

  // No credentials available — request will 401; ensure credentials are configured
  return {};
}

/**
 * Core fetch helper — appends query params, authenticates, parses JSON,
 * and normalises errors.
 *
 * @param {string} endpoint  Path appended to WC_BASE, e.g. '/products'
 * @param {Object} params    Optional query parameters
 * @returns {Promise<any>}
 */
const wcFetch = async (endpoint, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url   = `${WC_BASE}${endpoint}${query ? '?' + query : ''}`;
  const res   = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    let message = `WooCommerce API error ${res.status}: ${url}`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch {
      // response was not JSON — keep status-line message
    }
    throw new Error(message);
  }
  return res.json();
};

// ─── Normalizer ──────────────────────────────────────────────────────────────
//
// Maps the WooCommerce product shape to the internal shape expected by the
// existing UI components (ProductDetail, ProductCard, TrendingProducts, etc.).
// This avoids touching every component when the data source changes.

// Parts category name stems (decoded, lowercase) — brand-agnostic.
// Any category whose decoded name matches one of these is a parts category,
// regardless of which brand it belongs to.
const PARTS_LEAF_NAMES = [
  'parts & accessories',
  'repair kits & parts',
  'pumps & parts',
  'replacement parts',
  'spare parts',
];

// Parts slug prefixes — brand-agnostic.
// WooCommerce de-duplicates duplicate category names by appending a brand
// suffix, e.g. "parts-accessories" → "parts-accessories-columbia-taping-tools".
// Matching by prefix means every brand's parts category is caught automatically
// without needing brand-specific entries.
const PARTS_SLUG_PREFIXES = [
  'parts-accessories',
  'repair-kits-parts',
  'pumps-parts',
  'replacement-parts',
  'spare-parts',
];

// Generic catch-all category labels that should be treated as lowest priority
// when a more specific mapped category is also present on the same product.
// NOTE: names are lowercase because category-name normalization lowercases first.
const GENERIC_MAPPED_CATEGORY_NAMES = new Set([
  'tools',
]);

/** Decode common HTML entities that WooCommerce embeds in category names via the REST API. */
function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Map a WooCommerce REST API categories array to our internal category key.
 *
 * This is intentionally separate from the exported `mapCategory` in
 * parseProductCsv.js: that function parses a CSV cell string such as
 * "Drywall Finishing Tools > TapeTech > Parts & Accessories", whereas the
 * WooCommerce REST API delivers categories as an array of objects
 * ({id, name, slug}).  Both functions use the same CATEGORY_MAP.
 *
 * @param {Array<{id:number, name:string, slug:string}>} wcCategories
 * @returns {string}
 */
function mapApiCategory(wcCategories) {
  if (!wcCategories || !wcCategories.length) return '';

  const mapped = wcCategories
    .map((cat) => {
      const normalizedName = decodeHtmlEntities(cat.name).toLowerCase();
      const key = CATEGORY_MAP[normalizedName];
      return key ? { key, normalizedName } : null;
    })
    .filter(Boolean);

  if (mapped.length > 0) {
    const nonGenericMapped = mapped.filter(({ normalizedName }) => !GENERIC_MAPPED_CATEGORY_NAMES.has(normalizedName));
    const preferred = nonGenericMapped.length > 0 ? nonGenericMapped : mapped;
    // WooCommerce category arrays are typically ordered broad → specific.
    // Use the last preferred mapped category so generic ancestors like "Tools"
    // don't override specific leaves like "Tool Sets & Bundles" or parts leaves.
    return preferred[preferred.length - 1].key;
  }

  return decodeHtmlEntities(wcCategories[0].name).toLowerCase();
}

/**
 * Return true when the product belongs to a replacement-parts category.
 *
 * Brand-agnostic: works for all brands without needing brand-specific entries.
 *   • Name check: decodes HTML entities ("&amp;" → "&") then matches against
 *     PARTS_LEAF_NAMES — handles all brands equally.
 *   • Slug check: prefix match on PARTS_SLUG_PREFIXES — catches WooCommerce's
 *     auto-suffixed slugs like "parts-accessories-columbia-taping-tools" and
 *     "parts-accessories-level5" without any brand-specific configuration.
 *
 * @param {Array<{id:number, name:string, slug:string}>} wcCategories
 * @returns {boolean}
 */
function isPartsFromApi(wcCategories) {
  if (!wcCategories || !wcCategories.length) return false;
  return wcCategories.some(cat => {
    const name = decodeHtmlEntities(cat.name).toLowerCase();
    const slug = (cat.slug || '').toLowerCase();
    return (
      PARTS_LEAF_NAMES.includes(name) ||
      PARTS_SLUG_PREFIXES.some(prefix => slug.startsWith(prefix))
    );
  });
}

/**
 * Return the human-readable leaf WC category name for use in category cards.
 * WooCommerce REST API returns categories from most-generic to most-specific
 * (e.g. ["Drywall Finishing Tools", "TapeTech", "Finishing Boxes"]).
 * We iterate the array and return the name of the first category whose name
 * maps to a CATEGORY_MAP key, which is typically the most-specific leaf.
 *
 * @param {Array<{id:number, name:string, slug:string}>} wcCategories
 * @returns {string}  e.g. "Finishing Boxes", "Automatic Tapers"
 */
function extractDisplayCategory(wcCategories) {
  if (!wcCategories || !wcCategories.length) return '';

  const mapped = wcCategories
    .map((cat) => {
      const name = decodeHtmlEntities(cat.name);
      const normalizedName = name.toLowerCase();
      return CATEGORY_MAP[normalizedName] ? { name, normalizedName } : null;
    })
    .filter(Boolean);

  if (mapped.length > 0) {
    const nonGenericMapped = mapped.filter(({ normalizedName }) => !GENERIC_MAPPED_CATEGORY_NAMES.has(normalizedName));
    const preferred = nonGenericMapped.length > 0 ? nonGenericMapped : mapped;
    // Keep the human-readable mapped leaf category for category-card UI grouping.
    return preferred[preferred.length - 1].name;
  }

  return '';
}

/**
 * Extract the UPC/GTIN from WooCommerce product meta_data.
 * WooCommerce CSV importer stores UPC in meta_data under key 'upc'.
 *
 * @param {Array<{key:string, value:any}>} metaData
 * @returns {string}
 */
function extractUpc(metaData) {
  if (!metaData || !metaData.length) return '';
  const upcMeta = metaData.find(m =>
    m.key === 'upc' ||
    m.key === '_upc' ||
    m.key === 'gtin' ||
    m.key === 'Meta: upc'
  );
  return upcMeta ? String(upcMeta.value || '').trim() : '';
}

/**
 * Extract a brand name from a WooCommerce product.
 * Priority:
 *   1. Product attribute named "Brand"
 *   2. Any category whose name matches a known brand
 *   3. First product tag (legacy fallback)
 *
 * @param {Object} wcProduct
 * @returns {string}
 */
function extractBrand(wcProduct) {
  // 1. Explicit "Brand" attribute (set by the WooCommerce CSV importer)
  if (wcProduct.attributes && wcProduct.attributes.length) {
    const brandAttr = wcProduct.attributes.find(
      (a) => a.name && a.name.toLowerCase() === 'brand'
    );
    if (brandAttr && brandAttr.options && brandAttr.options.length) {
      const raw = brandAttr.options[0];
      // Normalize alias → canonical brand name (e.g. "Platinum" → "Platinum Drywall Tools")
      return BRAND_ALIASES[raw.toLowerCase()] || raw;
    }
  }

  // 2. Category whose name is one of our known brands
  //    (WooCommerce assigns products to every level of the hierarchy when
  //    importing via CSV, so "TapeTech" appears as a category object.)
  if (wcProduct.categories && wcProduct.categories.length) {
    for (const cat of wcProduct.categories) {
      const catName = decodeHtmlEntities(cat.name);
      // Try exact canonical match first, then alias normalization
      const match = KNOWN_BRANDS.find(b => b.toLowerCase() === catName.toLowerCase());
      if (match) return match;
      const alias = BRAND_ALIASES[catName.toLowerCase()];
      if (alias) return alias;
    }
  }

  // 3. First product tag (kept for backward compat, less reliable)
  if (wcProduct.tags && wcProduct.tags.length) return wcProduct.tags[0].name;
  return '';
}

/**
 * Resolve the primary `variation_attribute` for a WooCommerce variation product.
 *
 * Prefers the first entry from the already-normalised `variation_attribute_values`
 * list (which strips empty names/options and normalises whitespace).  Falls back
 * to the first raw attribute object from the API when that list is empty.
 *
 * @param {string} productType
 * @param {Array<{name:string, option:string}>|null} variation_attribute_values
 * @param {Array<Object>|undefined} rawAttributes
 * @returns {{name:string, option:string}|null}
 */
function resolveVariationAttribute(productType, variation_attribute_values, rawAttributes) {
  if (productType !== 'variation') return null;
  if (variation_attribute_values && variation_attribute_values.length > 0) {
    return variation_attribute_values[0];
  }
  if (rawAttributes && rawAttributes.length > 0) {
    return rawAttributes[0];
  }
  return null;
}

/**
 * Normalise a WooCommerce product object to the internal product shape used
 * throughout the UI.
 *
 * @param {Object} wcProduct  Raw product from the WooCommerce REST API
 * @returns {Object}          Normalised product
 */
export function normalizeProduct(wcProduct) {
  if (!wcProduct) return null;

  // Images: prefer array of src strings; keep single `image` for legacy compat.
  // Handle both WooCommerce image objects ({ src, id, ... }) and plain string URLs
  // so that this function is idempotent even if called on an already-normalised product.
  const images = (wcProduct.images || [])
    .map((img) => (typeof img === 'string' ? img : (img?.src ?? '')))
    .filter(Boolean);
  if (images.length === 0) images.push('https://www.drywalltoolbox.com/wp/wp-content/uploads/2026/04/no-image-placeholder.webp');
  const image = images[0];

  // Price: prefer numeric parse; keep string fallback
  const priceRaw = wcProduct.price || wcProduct.regular_price || '';
  const price    = priceRaw !== '' ? (parseFloat(priceRaw) || priceRaw) : '';

  // Category: map to internal key (e.g. "finishing") using the same CATEGORY_MAP
  // the CSV parser uses, so filtering works identically regardless of data source.
  const category = mapApiCategory(wcProduct.categories);

  // is_parts: true when any assigned category is a replacement-parts category
  const is_parts = isPartsFromApi(wcProduct.categories);

  // UPC: extract from meta_data (WC CSV importer stores it under key 'upc')
  const upc = extractUpc(wcProduct.meta_data);

  // ── Variable-product support ───────────────────────────────────────────────
  // WooCommerce REST API returns type: 'variable' for variable products and
  // type: 'variation' for individual variation records.
  const productType = wcProduct.type || 'simple';
  const isVariable  = productType === 'variable';

  // Variation-attribute options (only populated for variable products).
  // Each entry: { name: 'Size', options: ['7"', '10"', '12"'], id: 1 }
  const variation_attributes = isVariable
    ? (wcProduct.attributes || [])
        .filter((a) => a.variation)
        .map((a) => ({ id: a.id || 0, name: a.name, options: a.options || [] }))
    : [];

  // For variable products, WC returns price_html with min/max range.
  // Use min_price / max_price when available, fall back to price.
  const min_price = wcProduct.min_price
    ? (parseFloat(wcProduct.min_price) || 0)
    : (isVariable ? (parseFloat(wcProduct.price) || 0) : null);
  const max_price = wcProduct.max_price
    ? (parseFloat(wcProduct.max_price) || 0)
    : null;

  // Human-readable leaf category name for category-card grouping (e.g. "Finishing Boxes").
  const display_category = extractDisplayCategory(wcProduct.categories);

  // For individual variations: the parent product ID and selected attribute.
  const parent_id = wcProduct.parent_id || null;
  const variation_attribute_values = productType === 'variation'
    ? (wcProduct.attributes || [])
        .map((attr) => ({ name: (attr?.name || '').trim(), option: (attr?.option || '').trim() }))
        .filter((attr) => attr.name && attr.option)
    : null;
  const variation_attribute = resolveVariationAttribute(
    productType, variation_attribute_values, wcProduct.attributes
  );

  return {
    // Identity
    id:           wcProduct.id,
    part_number:  wcProduct.sku || String(wcProduct.id),
    sku:          wcProduct.sku || '',
    upc,
    slug:         wcProduct.slug || '',

    // Display
    name:         wcProduct.name || wcProduct.sku || String(wcProduct.id),
    brand:        extractBrand(wcProduct),
    category,
    display_category,
    is_parts,
    categories:   wcProduct.categories || [],

    // Media
    image,
    images,

    // Pricing & inventory
    price,
    regular_price: wcProduct.regular_price || '',
    sale_price:    wcProduct.sale_price    || '',
    on_sale:       wcProduct.on_sale       || false,
    stock_status:  wcProduct.stock_status  || 'instock',
    manage_stock:  wcProduct.manage_stock  || false,
    stock_quantity: wcProduct.stock_quantity || null,

    // Descriptions
    short_description: wcProduct.short_description || '',
    description_full:  wcProduct.description       || '',

    // Attributes / meta (preserved for schematic / parts lookups)
    attributes: wcProduct.attributes || [],
    meta_data:  wcProduct.meta_data  || [],

    // Variable-product fields
    type:                productType,
    is_variable:         isVariable,
    variation_attributes,
    variations:          wcProduct.variations || [],   // array of variation IDs
    min_price,
    max_price,
    parent_id,
    variation_attribute,  // selected attribute for a variation record
    variation_attribute_values,

    // Rating placeholder (WooCommerce provides this via reviews endpoint)
    rating:  Number(wcProduct.average_rating) || 0,
    reviews: Number(wcProduct.rating_count)   || 0,

    // Source tag — matches the '_source' field set by parseProductCsv.js
    _source: 'api',
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

/**
 * Fetch all published products.
 * @param {Object} params  Optional query params (passed to WC API)
 * @returns {Promise<Array>}
 */
export const getProducts = (params = {}) =>
  wcFetch('/products', { per_page: 100, status: 'publish', ...params })
    .then((list) => list.map(normalizeProduct));

/**
 * Fetch a single product by WooCommerce ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export const getProduct = (id) =>
  wcFetch(`/products/${id}`).then(normalizeProduct);

/**
 * Fetch products belonging to a category (by category ID).
 * @param {number|string} categoryId
 * @param {Object} params
 * @returns {Promise<Array>}
 */
export const getProductsByCategory = (categoryId, params = {}) =>
  wcFetch('/products', { category: categoryId, per_page: 100, status: 'publish', ...params })
    .then((list) => list.map(normalizeProduct));

/**
 * Full-text search across products.
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export const searchProducts = (searchTerm) =>
  wcFetch('/products', { search: searchTerm, per_page: 50, status: 'publish' })
    .then((list) => list.map(normalizeProduct));

/**
 * Fetch all variations for a variable product.
 * Returns each variation normalised through normalizeProduct() so the shape
 * is consistent with parent products.
 *
 * @param {number|string} parentId  WooCommerce parent product ID
 * @returns {Promise<Array>}        Array of normalised variation objects
 */
export const getProductVariations = (parentId) =>
  wcFetch(`/products/${parentId}/variations`, { per_page: 100, status: 'publish' })
    .then((list) => list.map(normalizeProduct));

// ─── Categories ──────────────────────────────────────────────────────────────

/**
 * Fetch all product categories.
 * @param {Object} params
 * @returns {Promise<Array>}
 */
export const getCategories = (params = {}) =>
  wcFetch('/products/categories', { per_page: 100, hide_empty: true, ...params });

/**
 * Fetch a single category by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export const getCategory = (id) =>
  wcFetch(`/products/categories/${id}`);
