/**
 * frontend/src/hooks/useSelectedVariation.js
 *
 * URL-driven variation selection state machine.
 *
 * Reads the ?variant=<id> query param from the current URL and resolves the
 * selected variation, keeping URL + state always in sync.  When the user
 * clicks an option the caller invokes `selectVariation(variation)` which
 * updates both the in-memory selection and the URL.
 *
 * Deterministic resolution order:
 *   1. ?variant=<id> query param — if belongs to this parent
 *   2. computed.default_variation_id from backend
 *   3. computed.first_purchasable_variation_id from backend
 *   4. First variation (disabled/unavailable fallback)
 *   5. null (no variations available)
 *
 * State is always re-derivable from URL + backend data — no reliance on
 * previous in-memory state after refresh, back, or forward navigation.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resolveInitialVariation } from '../utils/variationUrl.js';
import { getVariationSelectionMap } from '../utils/variationSelection.js';

/**
 * @param {Array}        variations  All child variations from the detail endpoint.
 * @param {Object|null}  computed    Computed state from the detail endpoint.
 * @returns {{
 *   selectedVariation: Object|null,
 *   selectedAttrs: Object,
 *   selectVariation: (variation: Object|null) => void,
 *   updateAttrs: (attrs: Object) => void,
 *   variationState: string,
 * }}
 */
export function useSelectedVariation(variations, computed) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive the initial selected variation from the URL + backend hints.
  // Re-derives on every navigation (back/forward/refresh) because useSearchParams
  // always reflects the current URL.
  const variantParam = useMemo(() => {
    const raw = searchParams.get('variant');
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [searchParams]);

  const [selectedVariation, setSelectedVariation] = useState(() =>
    resolveInitialVariation(variantParam, variations, computed)
  );

  // Re-resolve when variations or computed arrive from the network.
  useEffect(() => {
    const resolved = resolveInitialVariation(variantParam, variations, computed);
    setSelectedVariation(resolved);

    // If the URL had an invalid ?variant= param, clear it (replace so no back-entry).
    if (variantParam != null && !resolved) {
      setSearchParams(
        (prev) => { prev.delete('variant'); return prev; },
        { replace: true }
      );
    } else if (resolved?.id && !variantParam) {
      // No URL param yet — write the resolved variation into the URL.
      setSearchParams(
        (prev) => { prev.set('variant', String(resolved.id)); return prev; },
        { replace: true }
      );
    }
  }, [variations, computed, variantParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the selected attribute map from the current variation.
  const selectedAttrs = useMemo(
    () => (selectedVariation ? getVariationSelectionMap(selectedVariation) : {}),
    [selectedVariation]
  );

  /**
   * Set the selected variation and push ?variant=<id> into the URL.
   * Pass null to clear the selection.
   */
  const selectVariation = useCallback((variation) => {
    setSelectedVariation(variation ?? null);
    setSearchParams(
      (prev) => {
        if (variation?.id) {
          prev.set('variant', String(variation.id));
        } else {
          prev.delete('variant');
        }
        return prev;
      },
      { replace: false }
    );
  }, [setSearchParams]);

  /**
   * Update the selectedAttrs map directly (partial chip-click update).
   * Finds the matching variation for the new full attrs map.
   */
  const updateAttrs = useCallback((newAttrs) => {
    if (!Array.isArray(variations) || variations.length === 0) return;
    // Import inline to avoid circular dep — variationSelection imports from variationCache.
    import('../utils/variationSelection.js').then(({ findMatchingVariation }) => {
      const match = findMatchingVariation(variations, newAttrs);
      selectVariation(match ?? null);
    });
  }, [variations, selectVariation]);

  // Derive variationState for the purchase panel.
  const variationState = useMemo(() => {
    if (!Array.isArray(variations) || variations.length === 0) return 'no_variations';
    if (!selectedVariation) return 'variation_unavailable';
    const stock = selectedVariation.stock_status;
    if (stock === 'outofstock') return 'variation_out_of_stock';
    if (stock === 'onbackorder') return 'variation_backorder';
    if (!selectedVariation.purchasable) return 'variation_unavailable';
    return 'variation_ready';
  }, [variations, selectedVariation]);

  return { selectedVariation, selectedAttrs, selectVariation, updateAttrs, variationState };
}

export default useSelectedVariation;
