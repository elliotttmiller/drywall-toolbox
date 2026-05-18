/**
 * frontend/src/services/productCache.js
 *
 * Production-grade, persistent client-side product cache using IndexedDB.
 *
 * Strategy: Stale-While-Revalidate
 *   1. On first visit  → fetch from API, store in IndexedDB, return data.
 *   2. On return visit → return IndexedDB data INSTANTLY (zero network wait),
 *                        then revalidate in the background and update the store.
 *
 * This means every page after the first visit loads products with 0ms wait.
 *
 * TTL:
 *   - Products are considered "fresh" for FRESH_TTL_MS (5 min).
 *   - Stale data is still returned immediately; a background revalidation fires.
 *   - Entries older than STALE_TTL_MS (24 h) are forced to hard-refresh.
 *
 * DB schema:
 *   Database : dtb_cache  (version 1)
 *   Store    : products
 *   Key      : 'catalog'   (single entry holding the full normalised array)
 *   Value    : { data: Product[], fetchedAt: number, version: string }
 */

const DB_NAME    = 'dtb_cache';
const DB_VERSION = 1;
const STORE      = 'products';
const CACHE_KEY  = 'catalog';

// Treat cache as "fresh" (skip background revalidate) for 5 minutes.
const FRESH_TTL_MS  = 5 * 60 * 1000;
// Hard-expire after 24 hours — force a blocking refresh.
const STALE_TTL_MS  = 24 * 60 * 60 * 1000;
// App version stamp — bump this to bust the cache on breaking schema changes.
// Bumped 2026-05-10: invalidate cached placeholder-heavy product catalogs after
// image sync and ProductCardImage src-state fix.
const APP_VERSION   = '1.0.4';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    // 5-second safety timeout: if IndexedDB.open() never fires onsuccess or
    // onerror (e.g. DB blocked by another tab holding an old connection after
    // the user cleared site data), we reject instead of hanging forever.
    const timeoutId = setTimeout(
      () => reject(new Error('IndexedDB open timed out')),
      5000,
    );

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = (e) => {
      clearTimeout(timeoutId);
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => {
      clearTimeout(timeoutId);
      reject(req.error);
    };
  });
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null; // IndexedDB unavailable (private browsing, etc.)
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // Silently fail — we'll just re-fetch next time.
  }
}

async function idbDelete(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
    });
  } catch {
    // ignore
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the cached product catalog.
 *
 * Returns { data, age, isFresh, isExpired } or null if nothing is cached.
 *
 * @returns {Promise<{data: Object[], age: number, isFresh: boolean, isExpired: boolean}|null>}
 */
export async function readCache() {
  const entry = await idbGet(CACHE_KEY);
  if (!entry || !Array.isArray(entry.data) || entry.data.length === 0) return null;

  // Bust cache if app version changed (schema break).
  if (entry.version !== APP_VERSION) {
    await idbDelete(CACHE_KEY);
    return null;
  }

  const age       = Date.now() - (entry.fetchedAt || 0);
  const isFresh   = age < FRESH_TTL_MS;
  const isExpired = age > STALE_TTL_MS;

  return { data: entry.data, age, isFresh, isExpired };
}

/**
 * Write the product catalog to IndexedDB.
 *
 * @param {Object[]} products  Array of normalised product objects.
 */
export async function writeCache(products) {
  if (!Array.isArray(products) || products.length === 0) return;
  await idbSet(CACHE_KEY, {
    data:      products,
    fetchedAt: Date.now(),
    version:   APP_VERSION,
  });
}

/**
 * Invalidate (delete) the cached catalog.
 * Call this after admin product sync.
 */
export async function bustCache() {
  await idbDelete(CACHE_KEY);
}

/**
 * Returns true if IndexedDB is available in this environment.
 */
export function isCacheAvailable() {
  return typeof indexedDB !== 'undefined';
}
