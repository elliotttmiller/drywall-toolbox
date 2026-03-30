/**
 * WordPress & WooCommerce REST API module
 *
 * All env vars are injected at build time by webpack DefinePlugin from
 * GitHub Actions secrets (production) or a local .env file (development).
 * They must never be committed to source control.
 *
 *   REACT_APP_WP_BASE_URL        – WordPress site root including /wp subdir
 *                                   e.g. https://drywalltoolbox.com/wp
 *   REACT_APP_WC_CONSUMER_KEY    – WooCommerce REST API consumer key
 *   REACT_APP_WC_CONSUMER_SECRET – WooCommerce REST API consumer secret
 *
 * WordPress REST API docs: https://developer.wordpress.org/rest-api/
 * WooCommerce REST API docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */

const WP_BASE_URL = process.env.REACT_APP_WP_BASE_URL || '';
const WC_KEY      = process.env.REACT_APP_WC_CONSUMER_KEY || '';
const WC_SECRET   = process.env.REACT_APP_WC_CONSUMER_SECRET || '';

// Warn during local development when required variables are not set so that
// misconfigured builds surface immediately rather than failing silently later.
if (process.env.NODE_ENV !== 'production') {
  if (!WP_BASE_URL)  console.warn('[wordpress.js] REACT_APP_WP_BASE_URL is not set — all API calls will fail.');
  if (!WC_KEY)       console.warn('[wordpress.js] REACT_APP_WC_CONSUMER_KEY is not set — WooCommerce calls will fail.');
  if (!WC_SECRET)    console.warn('[wordpress.js] REACT_APP_WC_CONSUMER_SECRET is not set — WooCommerce calls will fail.');
}

// NOTE: WooCommerce Basic Auth credentials are injected at build time and will
// be present in the compiled JavaScript bundle.  This is the documented approach
// for client-side WooCommerce integrations (HTTPS is mandatory to protect them
// in transit).  For higher-security requirements consider routing WooCommerce
// calls through a server-side proxy so credentials remain out of the bundle.

/**
 * Build a Basic Auth header from the WooCommerce API key pair.
 * https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication-over-https
 *
 * @returns {string}
 */
function wcAuthHeader() {
  return 'Basic ' + btoa(`${WC_KEY}:${WC_SECRET}`);
}

/**
 * Shared fetch helper — sets Content-Type, parses JSON, and normalises errors.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
async function apiFetch(url, options = {}) {
  const { headers: extraHeaders, ...rest } = options;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    ...rest,
  });

  if (!response.ok) {
    let message = `API error ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body && body.message) message = body.message;
    } catch {
      // response body was not JSON — keep the status-line message
    }
    throw new Error(message);
  }

  return response.json();
}

// ─── WordPress REST API ───────────────────────────────────────────────────────

/**
 * Fetch published posts.
 * GET {WP_BASE_URL}/wp-json/wp/v2/posts
 * https://developer.wordpress.org/rest-api/reference/posts/
 *
 * @param {Object} params  Optional query parameters (e.g. { per_page: 10, page: 1 })
 * @returns {Promise<Array>}
 */
export async function getPosts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url   = `${WP_BASE_URL}/wp-json/wp/v2/posts${query ? '?' + query : ''}`;
  return apiFetch(url);
}

/**
 * Fetch published pages.
 * GET {WP_BASE_URL}/wp-json/wp/v2/pages
 * https://developer.wordpress.org/rest-api/reference/pages/
 *
 * @param {Object} params  Optional query parameters (e.g. { per_page: 10, page: 1 })
 * @returns {Promise<Array>}
 */
export async function getPages(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url   = `${WP_BASE_URL}/wp-json/wp/v2/pages${query ? '?' + query : ''}`;
  return apiFetch(url);
}

// ─── WooCommerce REST API ─────────────────────────────────────────────────────

/**
 * Fetch all products.
 * GET {WP_BASE_URL}/wp-json/wc/v3/products
 * https://woocommerce.github.io/woocommerce-rest-api-docs/#list-all-products
 *
 * @param {Object} params  Optional query parameters (e.g. { per_page: 20, page: 1 })
 * @returns {Promise<Array>}
 */
export async function getProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url   = `${WP_BASE_URL}/wp-json/wc/v3/products${query ? '?' + query : ''}`;
  return apiFetch(url, { headers: { Authorization: wcAuthHeader() } });
}

/**
 * Fetch a single product by ID.
 * GET {WP_BASE_URL}/wp-json/wc/v3/products/:id
 * https://woocommerce.github.io/woocommerce-rest-api-docs/#retrieve-a-product
 *
 * @param {number|string} id  WooCommerce product ID
 * @returns {Promise<Object>}
 */
export async function getProduct(id) {
  const url = `${WP_BASE_URL}/wp-json/wc/v3/products/${id}`;
  return apiFetch(url, { headers: { Authorization: wcAuthHeader() } });
}

/**
 * Create a new order.
 * POST {WP_BASE_URL}/wp-json/wc/v3/orders
 * https://woocommerce.github.io/woocommerce-rest-api-docs/#create-an-order
 *
 * @param {Object} payload  WooCommerce order object
 * @returns {Promise<Object>}
 */
export async function createOrder(payload) {
  const url = `${WP_BASE_URL}/wp-json/wc/v3/orders`;
  return apiFetch(url, {
    method:  'POST',
    headers: { Authorization: wcAuthHeader() },
    body:    JSON.stringify(payload),
  });
}
