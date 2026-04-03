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
  'Level5',
  'SurPro',
  'Graco',
  'Platinum',
];

// ─── Auth header (lazy, runtime-safe) ────────────────────────────────────────
//
// Build-time env vars (REACT_APP_WC_AUTH_USER / VITE_WC_AUTH_USER) are baked
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
//   2. build-time REACT_APP_WC_AUTH_USER / VITE_WC_AUTH_USER env vars
//   3. build-time REACT_APP_WC_AUTH_PASS / VITE_WC_AUTH_PASS env vars

function getAuthHeader() {
  // First choice: whatever client.js has set (may be bootstrap-patched at runtime)
  const live = wcClient?.defaults?.headers?.common?.['Authorization'];
  if (live) return { Authorization: live };

  // Second choice: build-time env vars (works when dotenv is properly wired)
  const user = process.env.REACT_APP_WC_AUTH_USER || import.meta.env.VITE_WC_AUTH_USER || '';
  const pass = process.env.REACT_APP_WC_AUTH_PASS || import.meta.env.VITE_WC_AUTH_PASS || '';
  if (user && pass) return { Authorization: 'Basic ' + btoa(`${user}:${pass}`) };

  // No credentials available — request will 401 and catalog.js will fall back to CSV
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

// Parts leaf category names — must match isPartsRow() in parseProductCsv.js
const PARTS_LEAF_NAMES = ['parts & accessories', 'repair kits & parts', 'pumps & parts'];

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
  for (const cat of wcCategories) {
    const key = CATEGORY_MAP[(cat.name || '').toLowerCase()];
    if (key) return key;
  }
  return (wcCategories[0].name || '').toLowerCase();
}

/**
 * Return true when the product belongs to a replacement-parts category.
 *
 * @param {Array<{id:number, name:string, slug:string}>} wcCategories
 * @returns {boolean}
 */
function isPartsFromApi(wcCategories) {
  if (!wcCategories || !wcCategories.length) return false;
  return wcCategories.some(cat =>
    PARTS_LEAF_NAMES.includes((cat.name || '').toLowerCase())
  );
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
      return brandAttr.options[0];
    }
  }

  // 2. Category whose name is one of our known brands
  //    (WooCommerce assigns products to every level of the hierarchy when
  //    importing via CSV, so "TapeTech" appears as a category object.)
  if (wcProduct.categories && wcProduct.categories.length) {
    for (const cat of wcProduct.categories) {
      const catName = cat.name || '';
      const match = KNOWN_BRANDS.find(b => b.toLowerCase() === catName.toLowerCase());
      if (match) return match;
    }
  }

  // 3. First product tag (kept for backward compat, less reliable)
  if (wcProduct.tags && wcProduct.tags.length) return wcProduct.tags[0].name;
  return '';
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

  // Images: prefer array of src strings; keep single `image` for legacy compat
  const images = (wcProduct.images || []).map((img) => img.src).filter(Boolean);
  if (images.length === 0) images.push('/no-image-placeholder.webp');
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
