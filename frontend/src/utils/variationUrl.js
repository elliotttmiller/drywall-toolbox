/**
 * frontend/src/utils/variationUrl.js
 *
 * URL helpers for the ?variant=<variation_id> query-string contract.
 *
 * Contract:
 *   /products/:slug                  — no variant param; resolve default
 *   /products/:slug?variant=12345    — pre-select variation 12345
 *
 * These helpers are pure functions with no React import so they can be used
 * in hooks, pages, and tests without any React context.
 */

/**
 * Read the current ?variant= value from a URLSearchParams or URL string.
 *
 * @param {URLSearchParams|string|null} search  URLSearchParams instance, a
 *   raw query string such as "?variant=123", or null.
 * @returns {number|null}  Parsed variation ID, or null when absent/invalid.
 */
export function getVariantParam(search) {
  let params;
  if (!search) return null;
  if (typeof search === 'string') {
    params = new URLSearchParams(search);
  } else {
    params = search;
  }
  const raw = params.get('variant');
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Build a URLSearchParams with ?variant=<id> set (or removed when id is null).
 *
 * Preserves all existing query params except 'variant'.
 *
 * @param {URLSearchParams|string|null} currentSearch  Existing query string.
 * @param {number|null} variationId  New variation ID, or null to clear.
 * @returns {string}  New query string (e.g. "?variant=12345") — empty string
 *   when all params were cleared.
 */
export function buildVariantSearch(currentSearch, variationId) {
  const params = new URLSearchParams(
    typeof currentSearch === 'string' ? currentSearch : (currentSearch?.toString() ?? '')
  );

  if (variationId != null && Number.isFinite(variationId) && variationId > 0) {
    params.set('variant', String(variationId));
  } else {
    params.delete('variant');
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Resolve the canonical variation to select on initial load.
 *
 * Resolution order (matches the system contract):
 *   1. ?variant=<id> query param — if it belongs to this parent
 *   2. computed.default_variation_id from the backend
 *   3. computed.first_purchasable_variation_id from the backend
 *   4. First variation in the array (disabled/fallback)
 *   5. null
 *
 * @param {number|null}  variantParam   Parsed ?variant= value.
 * @param {Array}        variations     All child variations.
 * @param {Object|null}  computed       Computed state from the detail endpoint.
 * @returns {Object|null}              The resolved variation object, or null.
 */
export function resolveInitialVariation(variantParam, variations, computed) {
  if (!Array.isArray(variations) || variations.length === 0) return null;

  // 1. Honour the ?variant= param when it belongs to this product.
  if (variantParam != null) {
    const matched = variations.find((v) => v.id === variantParam);
    if (matched) return matched;
    // Invalid param — fall through to backend hints.
  }

  // 2. Backend default variation.
  const defaultId = computed?.default_variation_id;
  if (defaultId) {
    const found = variations.find((v) => v.id === defaultId);
    if (found) return found;
  }

  // 3. First purchasable variation.
  const purchasableId = computed?.first_purchasable_variation_id;
  if (purchasableId) {
    const found = variations.find((v) => v.id === purchasableId);
    if (found) return found;
  }

  // 4. Absolute fallback — first variation (may be out-of-stock).
  return variations[0] ?? null;
}
