/**
 * Centralized in-memory variation cache and fetcher.
 *
 * This cache is session-scoped and shared across listing pages, so variable
 * product variations are fetched only once per parent ID while the app is open.
 */

const variationCache = new Map();
const variationRequestCache = new Map();

export function getCachedVariations(parentId) {
  return variationCache.get(String(parentId)) || null;
}

export function setCachedVariations(parentId, variations = []) {
  variationCache.set(String(parentId), Array.isArray(variations) ? variations : []);
}

export function hasCachedVariations(parentId) {
  return variationCache.has(String(parentId));
}

export async function fetchCachedVariations(parentId, fetchFn) {
  const key = String(parentId);

  if (variationCache.has(key)) {
    return variationCache.get(key) || [];
  }

  if (variationRequestCache.has(key)) {
    return variationRequestCache.get(key);
  }

  const request = Promise.resolve()
    .then(() => fetchFn(parentId))
    .then((vars) => {
      const normalized = Array.isArray(vars) ? vars : [];
      variationCache.set(key, normalized);
      return normalized;
    })
    .catch(() => {
      // Do not cache on error — allow the next request to retry rather than
      // permanently serving a stale-empty result for the session.
      return [];
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
      batch.map((id) =>
        fetchCachedVariations(id, fetchFn).then((vars) => [id, vars])
      )
    );
    fetched.push(...batchResults);
  }

  fetched.forEach(([id, vars]) => {
    const key = String(id);
    variationCache.set(key, vars);
    resultsMap.set(key, vars);
  });

  return keyIds.map((key) => [key, resultsMap.get(key) || []]);
}
