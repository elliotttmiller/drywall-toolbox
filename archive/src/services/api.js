/**
 * src/services/api.js
 *
 * Centralized WooCommerce REST API module.
 *
 * All env vars are injected at build time by webpack DefinePlugin.
 *   REACT_APP_WC_BASE_URL        – WooCommerce REST API base, e.g.
 *                                   https://drywalltoolbox.com/wp-json/wc/v3
 *   REACT_APP_WC_CONSUMER_KEY    – WooCommerce consumer key  (ck_…)
 *   REACT_APP_WC_CONSUMER_SECRET – WooCommerce consumer secret (cs_…)
 *
 * WooCommerce REST API docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */

const WC_BASE  = process.env.REACT_APP_WC_BASE_URL        || '';
const KEY      = process.env.REACT_APP_WC_CONSUMER_KEY    || '';
const SECRET   = process.env.REACT_APP_WC_CONSUMER_SECRET || '';

if (process.env.NODE_ENV !== 'production') {
  if (!WC_BASE)  console.warn('[api.js] REACT_APP_WC_BASE_URL is not set — all WooCommerce calls will fail.');
  if (!KEY)      console.warn('[api.js] REACT_APP_WC_CONSUMER_KEY is not set — WooCommerce calls will fail.');
  if (!SECRET)   console.warn('[api.js] REACT_APP_WC_CONSUMER_SECRET is not set — WooCommerce calls will fail.');
}

// NOTE: WooCommerce Basic Auth credentials are embedded in the compiled bundle.
// This is the documented client-side approach and requires HTTPS to protect them
// in transit. For higher-security requirements, route WooCommerce calls through a
// server-side proxy so credentials remain out of the bundle.
const authHeader = {
  Authorization: 'Basic ' + btoa(`${KEY}:${SECRET}`),
};

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
  const res   = await fetch(url, { headers: authHeader });
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

/**
 * Extract a brand name from a WooCommerce product.
 * WooCommerce stores brand in product attributes (name "Brand") or meta_data.
 *
 * @param {Object} wcProduct
 * @returns {string}
 */
function extractBrand(wcProduct) {
  if (wcProduct.attributes && wcProduct.attributes.length) {
    const brandAttr = wcProduct.attributes.find(
      (a) => a.name && a.name.toLowerCase() === 'brand'
    );
    if (brandAttr && brandAttr.options && brandAttr.options.length) {
      return brandAttr.options[0];
    }
  }
  // Fall back to the first product tag or category name as a brand hint
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
  if (images.length === 0) images.push('/product-placeholder.jpg');
  const image = images[0];

  // Price: prefer numeric parse; keep string fallback
  const priceRaw = wcProduct.price || wcProduct.regular_price || '';
  const price    = priceRaw !== '' ? (parseFloat(priceRaw) || priceRaw) : '';

  // Category: first category name, lower-cased for legacy filter keys
  const categoryName = wcProduct.categories && wcProduct.categories.length
    ? wcProduct.categories[0].name
    : '';

  return {
    // Identity
    id:           wcProduct.id,
    part_number:  wcProduct.sku || String(wcProduct.id),
    sku:          wcProduct.sku || '',
    upc:          '',   // WooCommerce does not expose UPC via base API
    slug:         wcProduct.slug || '',

    // Display
    name:         wcProduct.name || wcProduct.sku || String(wcProduct.id),
    brand:        extractBrand(wcProduct),
    category:     categoryName,
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
