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

export function findMatchingVariation(variations, selectedAttrs) {
  if (!Array.isArray(variations) || variations.length === 0) return null;
  const target = selectedAttrs && typeof selectedAttrs === 'object' ? selectedAttrs : {};
  const targetEntries = Object.entries(target).filter(([, value]) => value != null && `${value}`.trim() !== '');
  if (targetEntries.length === 0) return null;

  return variations.find((variation) => {
    const selected = getVariationSelectionMap(variation);
    return targetEntries.every(([name, value]) => selected[name] === value);
  }) || null;
}
