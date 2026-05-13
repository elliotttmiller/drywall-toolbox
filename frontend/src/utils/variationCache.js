/**
 * Centralized in-memory variation cache and fetcher.
 *
 * This cache is session-scoped and shared across listing pages, so variable
 * product variations are fetched only once per parent ID while the app is open.
 *
 * Cache key: `<parentId>:<modifiedSignal>` where modifiedSignal is an optional
 * product version/modified timestamp string.  When omitted the key is just the
 * parentId.  This ensures that a product update (new import, stock change, etc.)
 * always causes a cache miss and forces a fresh fetch.
 *
 * Guard rules:
 *   - Empty arrays are NOT stored (a 0-variation response is treated as a miss
 *     so the next request can retry and pick up variations once they appear).
 *   - Malformed (non-array) responses are also rejected.
 *   - Failed responses are never stored — errors propagate to the caller.
 */

const variationCache = new Map();
const variationRequestCache = new Map();

function buildKey(parentId, modifiedSignal) {
  const base = String(parentId);
  return modifiedSignal ? `${base}:${String(modifiedSignal)}` : base;
}

export function getCachedVariations(parentId, modifiedSignal) {
  return variationCache.get(buildKey(parentId, modifiedSignal)) || null;
}

export function setCachedVariations(parentId, variations = [], modifiedSignal) {
  // Reject malformed or empty responses — they indicate an upstream error or
  // a product not yet having variations registered, not a true empty result.
  if (!Array.isArray(variations) || variations.length === 0) return;
  variationCache.set(buildKey(parentId, modifiedSignal), variations);
}

export function hasCachedVariations(parentId, modifiedSignal) {
  return variationCache.has(buildKey(parentId, modifiedSignal));
}

/**
 * Invalidate all cached entries for a specific parent ID across all signals.
 * Called after a known product update (e.g. admin flush, successful import).
 */
export function invalidateVariationCache(parentId) {
  const base = String(parentId);
  for (const key of variationCache.keys()) {
    if (key === base || key.startsWith(`${base}:`)) {
      variationCache.delete(key);
    }
  }
  for (const key of variationRequestCache.keys()) {
    if (key === base || key.startsWith(`${base}:`)) {
      variationRequestCache.delete(key);
    }
  }
}

export async function fetchCachedVariations(parentId, fetchFn, modifiedSignal) {
  const key = buildKey(parentId, modifiedSignal);

  if (variationCache.has(key)) {
    return variationCache.get(key) || [];
  }

  if (variationRequestCache.has(key)) {
    return variationRequestCache.get(key);
  }

  const request = Promise.resolve()
    .then(() => fetchFn(parentId))
    .then((vars) => {
      if (!Array.isArray(vars) || vars.length === 0) {
        // Non-cacheable result — do not store, let the next request retry.
        return [];
      }
      variationCache.set(key, vars);
      return vars;
    })
    .catch((error) => {
      // Do not cache on error — allow the next request to retry rather than
      // permanently serving a stale-empty result for the session.
      throw error;
    })
    .finally(() => {
      variationRequestCache.delete(key);
    });

  variationRequestCache.set(key, request);
  return request;
}

export async function fetchVariationsBatched(ids, fetchFn, concurrency = 5) {
  const keyIds = ids.map((id) => String(id));
  const resultsMap = new Map(keyIds.map((key) => [key, variationCache.get(key) || null]));
  const idsToFetch = keyIds.filter((key) => !variationCache.has(key));

  if (idsToFetch.length === 0) {
    return keyIds.map((key) => [key, resultsMap.get(key) || []]);
  }

  const fetched = [];
  for (let i = 0; i < idsToFetch.length; i += concurrency) {
    const batch = idsToFetch.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          const vars = await fetchCachedVariations(id, fetchFn);
          return [id, vars, true];
        } catch {
          return [id, null, false];
        }
      })
    );
    fetched.push(...batchResults);
  }

  fetched.forEach(([id, vars, ok]) => {
    if (!ok || !Array.isArray(vars) || vars.length === 0) return;
    const key = String(id);
    variationCache.set(key, vars);
    resultsMap.set(key, vars);
  });

  return keyIds.map((key) => [key, resultsMap.get(key) || []]);
}
