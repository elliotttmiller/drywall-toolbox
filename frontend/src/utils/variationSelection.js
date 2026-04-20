/**
 * Predicate for filtering selected attribute entries to only non-empty values.
 *
 * @param {[string, any]} entry
 * @returns {boolean}
 */
function hasSelectedValue([, value]) {
  return value != null && `${value}`.trim() !== '';
}

/**
 * Build an attribute-name → selected-option map from a variation record.
 *
 * Supports both:
 * - WooCommerce variation `attributes` arrays (preferred, multi-attribute capable)
 * - Legacy single `variation_attribute` fallback
 *
 * @param {Object} variation
 * @returns {Object<string, string>}
 */
export function getVariationSelectionMap(variation) {
  if (!variation) return {};

  const selected = {};
  const attrs = Array.isArray(variation.attributes) ? variation.attributes : [];
  attrs.forEach((attr) => {
    const name = (attr?.name || '').trim();
    const option = (attr?.option || '').trim();
    if (name && option) selected[name] = option;
  });

  if (Object.keys(selected).length === 0 && variation.variation_attribute) {
    const name = (variation.variation_attribute.name || '').trim();
    const option = (variation.variation_attribute.option || '').trim();
    if (name && option) selected[name] = option;
  }

  return selected;
}

/**
 * Find the first variation whose selected attributes match the provided choices.
 *
 * A variation matches when every non-empty entry in `selectedAttrs` matches the
 * variation's selected value for the same attribute name.
 *
 * @param {Array<Object>} variations
 * @param {Object<string, string>} selectedAttrs
 * @returns {Object|null}
 */
export function findMatchingVariation(variations, selectedAttrs) {
  if (!Array.isArray(variations) || variations.length === 0) return null;
  const target = selectedAttrs && typeof selectedAttrs === 'object' ? selectedAttrs : {};
  const targetEntries = Object.entries(target).filter(hasSelectedValue);
  if (targetEntries.length === 0) return null;

  return variations.find((variation) => {
    const selected = getVariationSelectionMap(variation);
    return targetEntries.every(([name, value]) => selected[name] === value);
  }) || null;
}
