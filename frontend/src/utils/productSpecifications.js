/**
 * productSpecifications.js — Product specifications extractor
 * 
 * Extracts structured technical specifications from WooCommerce product meta_data.
 * Provides a unified interface for rendering product specifications across all brands.
 * 
 * Metadata conventions:
 * - _specs_[index]_label: Specification label (e.g., 'Brand', 'SKU')
 * - _specs_[index]_value: Specification value
 * - _includes_[index]_name: Name of an item included in a tool set
 * - _includes_[index]_sku:  SKU of the included item (links to its product page)
 * 
 * Example from WooCommerce:
 * meta_data: [
 *   { key: '_specs_0_label', value: 'Brand' },
 *   { key: '_specs_0_value', value: 'Asgard' },
 *   { key: '_specs_1_label', value: 'SKU' },
 *   { key: '_specs_1_value', value: 'AT01-AD' },
 *   { key: '_includes_0_name', value: '10" Flat Box' },
 *   { key: '_includes_0_sku',  value: 'EZ10-AD' },
 * ]
 */

export function extractSpecifications(product) {
  if (!product || !Array.isArray(product.meta_data)) {
    return [];
  }

  const specsMap = {};
  
  // Parse all spec metadata into a map
  product.meta_data.forEach(({ key, value }) => {
    const labelMatch = key.match(/^_specs_(\d+)_label$/);
    const valueMatch = key.match(/^_specs_(\d+)_value$/);

    if (labelMatch) {
      const index = labelMatch[1];
      if (!specsMap[index]) specsMap[index] = {};
      specsMap[index].label = value;
    }

    if (valueMatch) {
      const index = valueMatch[1];
      if (!specsMap[index]) specsMap[index] = {};
      specsMap[index].value = value;
    }
  });

  // Convert map to sorted array, filtering incomplete entries
  return Object.keys(specsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(index => specsMap[index])
    .filter(spec => spec.label && spec.value);
}

/**
 * parseSpecificationsFromDescription — Extract specs from HTML description
 * 
 * For products where specs aren't yet migrated to meta_data, attempt to
 * extract a specifications table from the HTML description field.
 * 
 * This is a fallback for existing Asgard products with inline HTML tables.
 */
export function parseSpecificationsFromDescription(htmlDescription) {
  if (!htmlDescription || typeof htmlDescription !== 'string') {
    return [];
  }

  const specs = [];
  
  // Look for HTML table with "Technical Specifications" or "Specification" heading
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  const tables = htmlDescription.match(tableRegex);

  if (!tables) return specs;

  for (const table of tables) {
    // Check if this looks like a specs table (has "Specification" or "Detail" header)
    if (!/specification|detail|sku|brand|model/i.test(table)) {
      continue;
    }

    // Extract rows (skip header)
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = table.match(rowRegex);

    if (!rows || rows.length < 2) continue; // Skip header row

    rows.slice(1).forEach(row => {
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let match;

      while ((match = cellRegex.exec(row)) !== null) {
        cells.push(match[1].trim());
      }

      if (cells.length >= 2) {
        specs.push({
          label: cells[0].replace(/<[^>]*>/g, '').trim(),
          value: cells[1],
        });
      }
    });

    // Return first matching specs table
    if (specs.length > 0) {
      return specs;
    }
  }

  return specs;
}

/**
 * parseIncludesList — Split a comma-separated "Includes" string into items.
 *
 * Respects parentheses so that grouped entries like
 * "Repair Kits (AH-RK, FFBR9-10, FFBR9-12)" are kept as a single item.
 *
 * @param {string} str  Raw includes string, e.g. '10" Flat Box, Filler Adapter'
 * @returns {string[]}
 */
export function parseIncludesList(str) {
  if (!str || typeof str !== 'string') return [];

  const items = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed) items.push(trimmed);

  return items;
}

/**
 * extractStructuredIncludes — Parse _includes_N_name / _includes_N_sku from meta_data.
 *
 * Supports a richer includes format where each included item has a dedicated
 * name and optional SKU so the renderer can produce direct product links.
 *
 * @param {Array} meta_data  WooCommerce meta_data array
 * @returns {{ name: string, sku?: string }[]}
 */
function extractStructuredIncludes(meta_data) {
  if (!Array.isArray(meta_data) || meta_data.length === 0) return [];

  const map = {};

  for (const { key, value } of meta_data) {
    const nameMatch = key.match(/^_includes_(\d+)_name$/);
    const skuMatch  = key.match(/^_includes_(\d+)_sku$/);

    if (nameMatch) {
      const idx = nameMatch[1];
      if (!map[idx]) map[idx] = {};
      map[idx].name = value;
    }

    if (skuMatch) {
      const idx = skuMatch[1];
      if (!map[idx]) map[idx] = {};
      map[idx].sku = value;
    }
  }

  return Object.keys(map)
    .sort((a, b) => Number(a) - Number(b))
    .map(idx => map[idx])
    .filter(item => item.name);
}

/** Test whether a spec label refers to the "Includes" row. */
function isIncludesLabel(label) {
  return /^(set\s+)?includes?$/i.test((label || '').trim());
}

/** Test whether a spec label is the "Model Numbers" companion row. */
function isModelNumbersLabel(label) {
  return /^model\s+numbers?$/i.test((label || '').trim());
}

/**
 * enrichIncludesSpec — Attach a structured `items` array to the "Includes" spec.
 *
 * Priority:
 * 1. Structured _includes_N_name / _includes_N_sku meta_data (richest)
 * 2. Zip "Set Includes" items with a sibling "Model Numbers" row 1-to-1
 * 3. Plain comma-split of the "Includes" value (display-only, no links)
 *
 * The returned specs array has the "Model Numbers" row removed when it has
 * been merged into the "Includes" items, and the "Includes" spec gains an
 * `.items` property: `[{ name: string, sku?: string }, ...]`.
 *
 * @param {Array} specs     Specs as returned by extractSpecifications / parseSpecificationsFromDescription
 * @param {Array} meta_data Product meta_data array
 * @returns {Array}         Enriched specs
 */
function enrichIncludesSpec(specs, meta_data) {
  // 1. Structured meta_data includes
  const structuredItems = extractStructuredIncludes(meta_data);
  if (structuredItems.length > 0) {
    return specs.map(spec =>
      isIncludesLabel(spec.label) ? { ...spec, items: structuredItems } : spec
    );
  }

  const includesSpec     = specs.find(s => isIncludesLabel(s.label));
  const modelNumbersSpec = specs.find(s => isModelNumbersLabel(s.label));

  // 2. Pair "Set Includes" + "Model Numbers" if counts match
  if (includesSpec && modelNumbersSpec) {
    const names = parseIncludesList(includesSpec.value);
    const skus  = parseIncludesList(modelNumbersSpec.value);

    if (names.length > 0 && skus.length === names.length) {
      const items = names.map((name, i) => ({ name, sku: skus[i] }));
      return specs
        .filter(s => !isModelNumbersLabel(s.label))
        .map(spec =>
          isIncludesLabel(spec.label) ? { ...spec, items } : spec
        );
    }
  }

  // 3. Plain comma-split into display-only items
  if (includesSpec) {
    const names = parseIncludesList(includesSpec.value);
    if (names.length > 0) {
      return specs.map(spec =>
        isIncludesLabel(spec.label)
          ? { ...spec, items: names.map(name => ({ name })) }
          : spec
      );
    }
  }

  return specs;
}

/**
 * getProductSpecifications — Get specs from product using all available methods
 * 
 * Tries in order:
 * 1. Extract from structured meta_data (_specs_N_label/value)
 * 2. Parse from HTML description table
 * 3. Return empty array if no specs found
 *
 * In all cases the "Includes" spec (if present) is enriched with a structured
 * `.items` array so the renderer can produce a formatted, linkable list.
 */
export function getProductSpecifications(product) {
  const meta_data = Array.isArray(product?.meta_data) ? product.meta_data : [];

  // Try meta_data first (new standard format)
  const metaSpecs = extractSpecifications(product);
  if (metaSpecs.length > 0) {
    return enrichIncludesSpec(metaSpecs, meta_data);
  }

  // Fall back to parsing HTML description
  const descSpecs = parseSpecificationsFromDescription(
    product.description_full || product.description
  );
  if (descSpecs.length > 0) {
    return enrichIncludesSpec(descSpecs, meta_data);
  }

  return [];
}
