/**
 * frontend/src/services/catalog.js
 *
 * Single source-of-truth for all product data.
 *
 * Loading strategy — Stale-While-Revalidate (SWR):
 *
 *   1. IndexedDB hit (fresh  < 5 min)  → return instantly, NO network call.
 *   2. IndexedDB hit (stale  < 24 h)   → return instantly, fire background refresh.
 *   3. IndexedDB miss / expired        → fetch from WooCommerce REST API, cache result.
 *
 * This guarantees that every visit after the first loads products with
 * ZERO network wait time — the UI renders immediately from the local cache
 * while fresh data silently updates in the background.
 *
 * All paths return objects in the normalizeProduct() shape from services/api.js.
 */

import { fetchProducts as proxyFetchProducts, fetchProduct as proxyFetchProduct } from '../api/products.js';
import { normalizeProduct } from '../services/api.js';
import { readCache, writeCache, bustCache, isCacheAvailable } from './productCache.js';

// ─── In-memory promise cache ──────────────────────────────────────────────────
// Prevents duplicate in-flight requests within the same page session.

let _cache  = null;   // Promise<Product[]> once populated this session
let _source = null;   // 'idb-fresh' | 'idb-stale' | 'idb-expired-fallback' | 'api'

export function getCatalogSource() { return _source; }

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Fetch all products from the WooCommerce REST API (all pages).
 * Throws on network or auth error.
 */
async function fetchFromApi() {
  // Use the server-side drywall/v1 proxy for WooCommerce product loading.
  // This avoids relying on client-side WC auth credentials in the browser.

  let all   = [];
  let page  = 1;
  const PER = 100;
  // Per-request timeout: abort a page fetch that takes longer than 15 s.
  // Without this, a hanging fetch (slow API cold-start or poor mobile network)
  // keeps loadCatalog() pending forever since apiClient's inflightGetRequests
  // dedup causes all components to wait on the same stalled promise.
  const PAGE_TIMEOUT_MS = 15000;

  let done = false;
  while (!done) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    let batch;
    try {
      const result = await proxyFetchProducts(
        { per_page: PER, page, status: 'publish' },
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);
      batch = Array.isArray(result) ? result : result?.products || [];
      batch = batch
        .map(normalizeProduct)
        .filter(Boolean)
        // WooCommerce /wc/v3/products should never return 'variation' type
        // products in the main list, but guard against misconfigured imports
        // that might leak them through (they would show as confusing duplicates
        // alongside their parent variable product).
        .filter((p) => p.type !== 'variation');
    } catch (pageErr) {
      clearTimeout(timeoutId);
      // Treat an abort (timeout) as a distinct failure type so callers can
      // distinguish it from a generic network error if needed.
      const err = pageErr?.name === 'AbortError'
        ? Object.assign(new Error('Catalog page fetch timed out after 15 s.'), { code: 'timeout' })
        : pageErr;
      if (all.length > 0) break;
      throw err;
    }
    all = all.concat(batch);
    if (batch.length < PER) { done = true; break; }
    page++;
  }

  // Deduplicate by product ID — guards against products being imported multiple
  // times into WooCommerce (e.g. repeated CSV imports that create duplicate rows).
  const seenIds = new Set();
  return all.filter((p) => {
    if (!p.id || seenIds.has(p.id)) return false;
    seenIds.add(p.id);
    return true;
  });
}

/**
 * Background revalidation — fetch fresh data and update IndexedDB + memory.
 * Never throws; failures are silently swallowed.
 */
function revalidateInBackground() {
  fetchFromApi()
    .then((fresh) => {
      if (!Array.isArray(fresh) || fresh.length === 0) return;
      _source = 'api';
      _cache  = Promise.resolve(fresh);
      writeCache(fresh).catch(() => {});
      console.info(`[catalog] Background revalidated: ${fresh.length} products`);
    })
    .catch((err) => {
      console.warn('[catalog] Background revalidation failed:', err.message);
    });
}

// ─── Cache loader ─────────────────────────────────────────────────────────────

/**
 * Populate (or return already-populated) the product catalog.
 *
 * SWR flow:
 *   fresh IDB → return instantly
 *   stale IDB → return instantly + trigger background refresh
 *   miss/expired → block on API fetch, then cache
 *
 * @returns {Promise<Object[]>}
 */
export function loadCatalog() {
  // Already resolved this session — return the in-memory promise immediately.
  if (_cache) return _cache;

  _cache = (async () => {
    // ── 1. Try IndexedDB ────────────────────────────────────────────────────
    let cached = null;
    if (isCacheAvailable()) {
      cached = await readCache();

      if (cached && !cached.isExpired) {
        _source = cached.isFresh ? 'idb-fresh' : 'idb-stale';
        console.info(
          `[catalog] Served ${cached.data.length} products from IndexedDB ` +
          `(${_source}, age ${Math.round(cached.age / 1000)}s)`
        );

        // If stale, kick off a background refresh so the next navigation is faster.
        if (!cached.isFresh) {
          revalidateInBackground();
        }

        return cached.data;
      }
    }

    // ── 2. IndexedDB miss / expired — fetch from API ────────────────────────
    try {
      const products = await fetchFromApi();
      _source = 'api';
      console.info(`[catalog] Loaded ${products.length} products from WooCommerce REST API`);

      // Persist to IndexedDB for future visits (non-blocking).
      writeCache(products).catch(() => {});

      return products;
    } catch (apiErr) {
      console.error('[catalog] WooCommerce API unavailable:', apiErr.message);
      if (cached?.data?.length) {
        _source = 'idb-expired-fallback';
        console.warn(
          `[catalog] Falling back to expired IndexedDB cache (${cached.data.length} products, age ${Math.round(cached.age / 1000)}s)`
        );
        return cached.data;
      }
      _cache = null; // allow retry on next call
      return [];
    }
  })();

  return _cache;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return all published products (cached).
 * On return visits this resolves instantly from IndexedDB.
 *
 * @returns {Promise<Object[]>}
 */
export async function getProducts() {
  return loadCatalog();
}

/**
 * Pre-warm the catalog cache. Call this at app boot (main.jsx) so data is
 * ready before the user navigates to any product page.
 */
export function prewarmCatalog() {
  loadCatalog().catch(() => {});
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
      const p = await proxyFetchProduct(key);
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
 * Uses the local catalog to avoid per-keystroke API traffic.
 *
 * @param {string} query
 * @returns {Promise<Object[]>}
 */
export async function searchProducts(query) {
  if (!query) return getProducts();

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
 * Force a full reload of the catalog (clears both memory and IndexedDB cache).
 * Useful after a WooCommerce product sync.
 */
export function invalidateCatalog() {
  _cache  = null;
  _source = null;
  bustCache().catch(() => {});
}
