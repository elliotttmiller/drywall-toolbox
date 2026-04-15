/**
 * frontend/src/services/catalog.js
 *
 * Single source-of-truth for all product data.
 *
 * Loading strategy (attempted in order, first success wins):
 *
 *   1. WooCommerce REST API  — /wp-json/wc/v3/products
 *      Credentials come from REACT_APP_WC_AUTH_USER / REACT_APP_WC_AUTH_PASS (build-time)
 *      or from the runtime bootstrap in src/api/client.js (/dtb/v1/config).
 *      This is the authoritative live source — all product data comes directly
 *      from the WooCommerce / WP Admin backend.
 *
 * Results are cached in memory for the page lifetime.
 * All paths return objects in the normalizeProduct() shape from services/api.js.
 */

import { getProducts as apiGetProducts, getProduct as apiGetProduct } from './api.js';
import { credentialsReady } from '../api/client.js';

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cache = null;   // Promise<Product[]> once populated
let _source = null;  // 'api' — for diagnostics

export function getCatalogSource() { return _source; }

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Fetch all products from the WooCommerce REST API (all pages).
 * Throws on network or auth error.
 */
async function fetchFromApi() {
  // Wait for runtime credential bootstrap (no-op if build-time creds exist)
  await credentialsReady();

  let all   = [];
  let page  = 1;
  const PER = 100;

  let done = false;
  while (!done) {
    const batch = await apiGetProducts({ per_page: PER, page, status: 'publish' });
    all = all.concat(batch);
    if (batch.length < PER) { done = true; break; }
    page++;
  }

  return all; // already normalized by apiGetProducts → normalizeProduct()
}

// ─── Cache loader ─────────────────────────────────────────────────────────────

/**
 * Populate (or return already-populated) the product cache.
 * Fetches exclusively from the live WooCommerce REST API.
 *
 * @returns {Promise<Object[]>}
 */
function loadCatalog() {
  if (_cache) return _cache;

  _cache = (async () => {
    try {
      const products = await fetchFromApi();
      _source = 'api';
      console.info(`[catalog] Loaded ${products.length} products from WooCommerce REST API`);
      return products;
    } catch (apiErr) {
      console.error('[catalog] WooCommerce API unavailable:', apiErr.message);
      _cache = null; // allow retry on next call
      return [];
    }
  })();

  return _cache;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return all published products (cached).
 *
 * @returns {Promise<Object[]>}
 */
export async function getProducts() {
  return loadCatalog();
}

/**
 * Return a single product by WooCommerce numeric ID or SKU string.
 * Attempts a direct REST API call for numeric IDs when the API is reachable,
 * otherwise searches the cached catalog.
 *
 * @param {string|number} idOrSku
 * @returns {Promise<Object|null>}
 */
export async function getProductById(idOrSku) {
  const key = String(idOrSku);

  // Direct API lookup for numeric IDs (fastest path)
  if (/^\d+$/.test(key)) {
    try {
      await credentialsReady();
      const p = await apiGetProduct(key);
      if (p) { _source = 'api'; return p; }
    } catch {
      // fall through to catalog search
    }
  }

  // Search cached catalog by ID, SKU, slug, or part_number
  const all = await loadCatalog();
  return (
    all.find(p => String(p.id) === key) ||
    all.find(p => p.slug         === key) ||
    all.find(p => p.sku          === key) ||
    all.find(p => p.part_number  === key) ||
    null
  );
}

/**
 * Full-text product search across name, SKU, UPC, and brand.
 * Tries the REST API search first; falls back to in-memory filter.
 *
 * @param {string} query
 * @returns {Promise<Object[]>}
 */
export async function searchProducts(query) {
  if (!query) return getProducts();

  // Try REST search
  try {
    await credentialsReady();
    const { searchProducts: apiSearch } = await import('./api.js');
    const results = await apiSearch(query);
    if (results.length > 0) return results;
  } catch {
    // fall through
  }

  // In-memory fallback
  const q   = query.toLowerCase();
  const all = await loadCatalog();
  return all.filter(p =>
    (p.name         || '').toLowerCase().includes(q) ||
    (p.sku          || '').toLowerCase().includes(q) ||
    (p.upc          || '').toLowerCase().includes(q) ||
    (p.brand        || '').toLowerCase().includes(q) ||
    (p.part_number  || '').toLowerCase().includes(q)
  );
}

/**
 * Return products in a given category (internal key, e.g. "finishing").
 *
 * @param {string} categoryKey
 * @returns {Promise<Object[]>}
 */
export async function getProductsByCategory(categoryKey) {
  const all = await loadCatalog();
  return all.filter(p => p.category === categoryKey);
}

/**
 * Force a full reload of the catalog (clears the cache).
 * Useful after a WooCommerce product sync.
 */
export function invalidateCatalog() {
  _cache  = null;
  _source = null;
}
