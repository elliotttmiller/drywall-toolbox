/**
 * schematicMappings.js
 *
 * Cross-reference between schematic IDs (from Parts.jsx) and product names/SKUs
 * in the products catalog. This allows us to show only products that have
 * detailed schematics in the TrendingProducts component, and to link product
 * detail pages to the correct replacement-parts schematic diagram.
 */

// Defined schematics from Parts.jsx organized by brand
export const SCHEMATIC_DEFINITIONS = {
  'Columbia Taping Tools': [
    { id: 'columbia-matrix', title: 'Predator Matrix Handle', category: 'Handles' },
    { id: 'columbia-predator-taper', title: 'Predator Taper', category: 'Automatic Tapers' },
    { id: 'columbia-2-way-internal-corner', title: '2-Way Internal Corner Applicator', category: 'Applicators' },
    { id: 'columbia-external-corner-applicator', title: 'External Corner Applicator', category: 'Applicators' },
    { id: 'columbia-standard-outside-corner-roller', title: 'Standard Outside Corner Roller', category: 'Corner Rollers' },
    { id: 'columbia-inside-corner-roller', title: 'Inside Corner Roller', category: 'Corner Rollers' },
    { id: 'columbia-throttle-box', title: 'Throttle Box', category: 'Corner Boxes' },
    { id: 'columbia-automatic-flat-box', title: 'Automatic Flat Box', category: 'Finishing Boxes' },
    { id: 'columbia-flat-box', title: 'Flat Box', category: 'Finishing Boxes' },
    { id: 'columbia-fat-boy-box', title: 'Fat Boy Box', category: 'Finishing Boxes' },
    { id: 'columbia-angle-head', title: 'Angle Head', category: 'Angleheads' },
    { id: 'columbia-gooseneck-adapter', title: 'Gooseneck Adapter', category: 'Pumps' },
    { id: 'columbia-mud-pump', title: 'Mud Pump', category: 'Pumps' },
    { id: 'columbia-tall-boy-mud-pump', title: 'Tall Boy Mud Pump', category: 'Pumps' },
    { id: 'columbia-nailspotter', title: 'Nailspotter', category: 'Nailspotters' },
    { id: 'columbia-tomahawk-smoothing-blades', title: 'Tomahawk Smoothing Blades', category: 'Smoothing Blades' },
    { id: 'columbia-standard-corner-flusher', title: 'Standard Corner Flusher', category: 'Corner Flushers' },
    { id: 'columbia-direct-corner-flusher', title: 'Direct Corner Flusher', category: 'Corner Flushers' },
    { id: 'columbia-combo-flusher', title: 'Combo Flusher', category: 'Corner Flushers' },
    { id: 'columbia-sander-head', title: 'Sander Head', category: 'Sanders' },
    { id: 'columbia-compound-tube', title: 'Compound Tube', category: 'Compound Tubes' },
    { id: 'columbia-cam-lock-tube', title: 'Cam Lock Tube', category: 'Compound Tubes' },
    { id: 'columbia-semi-automatic-taper', title: 'Semi-Automatic Taper', category: 'Semi-Automatic Tapers' },
    { id: 'columbia-one', title: 'Columbia One', category: 'Handles' },
    { id: 'columbia-long-extendable-handle', title: 'Long Extendable Handle', category: 'Handles' },
    { id: 'columbia-flat-box-handle', title: 'Flat Box Handle', category: 'Handles' },
    { id: 'columbia-closet-monster-flat-box-handle', title: 'Closet Monster', category: 'Handles' }
  ],
  'TapeTech': [
    { id: 'tapetech-extendable-support-handle', title: 'Extendable Support Handle', category: 'Handles' }
  ],
  'Asgard': [
    { id: 'asgard-at01-ad',  title: 'HAMMER Automatic Taper',              category: 'Tapers' },
    { id: 'asgard-ah25-ad',  title: '2.5″ Angle Head Corner Finisher',     category: 'Angle Heads' },
    { id: 'asgard-ah30-ad',  title: '3″ Angle Head Corner Finisher',       category: 'Angle Heads' },
    { id: 'asgard-ah35-ad',  title: '3.5″ Angle Head Corner Finisher',     category: 'Angle Heads' },
    { id: 'asgard-ca08-ad',  title: '8″ Angle Box Corner Applicator',      category: 'Angle Heads' },
    { id: 'asgard-cfa-ad',   title: 'Angle Head Adapter',                  category: 'Angle Heads' },
    { id: 'asgard-fa01-ad',  title: 'Filler Adapter',                      category: 'Adapters' },
    { id: 'asgard-ehc07-ad', title: '7″ MaxxBox Finishing Box',            category: 'Finishing Boxes' },
    { id: 'asgard-ehc10-ad', title: '10″ MaxxBox Finishing Box',           category: 'Finishing Boxes' },
    { id: 'asgard-ehc12-ad', title: '12″ MaxxBox Finishing Box',           category: 'Finishing Boxes' },
    { id: 'asgard-ez07-ad',  title: '7″ Flat Finishing Box',               category: 'Finishing Boxes' },
    { id: 'asgard-ez10-ad',  title: '10″ Flat Finishing Box',              category: 'Finishing Boxes' },
    { id: 'asgard-ez12-ad',  title: '12″ Flat Finishing Box',              category: 'Finishing Boxes' },
    { id: 'asgard-pa07-ad',  title: '7″ Power Assist Finishing Box',       category: 'Finishing Boxes' },
    { id: 'asgard-pa10-ad',  title: '10″ Power Assist Finishing Box',      category: 'Finishing Boxes' },
    { id: 'asgard-pa12-ad',  title: '12″ Power Assist Finishing Box',      category: 'Finishing Boxes' },
    { id: 'asgard-bbh-ad',   title: 'Brakeless Box Handle',                category: 'Handles' },
    { id: 'asgard-bbhe-ad',  title: 'Brakeless Box Handle – Extendable',   category: 'Handles' },
    { id: 'asgard-fbhe-ad',  title: 'Extendable Flat Box Handle with Brake', category: 'Handles' },
    { id: 'asgard-fh-ad',    title: 'Fiberglass Handle',                   category: 'Handles' },
    { id: 'asgard-xh-ad',    title: 'Extendable Support Handle',           category: 'Handles' },
    { id: 'asgard-gn01-ad',  title: 'Gooseneck',                           category: 'Other' },
    { id: 'asgard-lp01-ad',  title: 'Compound Loading Pump',               category: 'Pumps' },
    { id: 'asgard-cr01-ad',  title: 'Inside Corner Roller',                category: 'Rollers' },
    { id: 'asgard-ns03-ad',  title: '3″ Nail Spotter',                     category: 'Spotters' },
  ],
  'Level5': [
    { id: 'level5-corner-roller-4-707',                  title: 'Corner Roller',               category: 'Corner Rollers'    },
    { id: 'level5-9333-cutter-chain-assembly',            title: 'Cutter Chain Assembly',        category: 'Automatic Tapers'  },
    { id: 'level5-7097-drive-dog-assembly',               title: 'Drive Dog Assembly',            category: 'Automatic Tapers'  },
    { id: 'level5-7293-gooser-assembly',                  title: 'Gooser Assembly',               category: 'Automatic Tapers'  },
    { id: 'level5-7218-taper-wheel-assembly',             title: 'Taper Wheel Assembly',          category: 'Automatic Tapers'  },
    { id: 'level5-7377-cover-plate-assembly-old-style',   title: 'Cover Plate Assembly',          category: 'Automatic Tapers'  },
    { id: 'level5-4-734-3-5-corner-finisher',             title: '3.5" Corner Finisher',          category: 'Corner Finishers'  },
    { id: 'level5-7-inch-flat-box-4-764',                 title: '7" Flat Box',                   category: 'Finishing Boxes'   },
    { id: 'level5-7-inch-mega-flat-box-4-767',            title: '7" Mega Flat Box',              category: 'Finishing Boxes'   },
    { id: 'level5-10-inch-flat-box-4-765',                title: '10" Flat Box',                  category: 'Finishing Boxes'   },
    { id: 'level5-10-inch-mega-flat-box-4-768',           title: '10" Mega Flat Box',             category: 'Finishing Boxes'   },
    { id: 'level5-12-inch-flat-box-4-766',                title: '12" Flat Box',                  category: 'Finishing Boxes'   },
    { id: 'level5-12-inch-mega-box-4-769',                title: '12" Mega Box',                  category: 'Finishing Boxes'   },
    { id: 'level5-14-inch-flat-box-4-770',                title: '14" Flat Box',                  category: 'Finishing Boxes'   },
    { id: 'level5-compound-pump-4-771',                   title: 'Compound Pump',                 category: 'Pumps'             },
  ],
  'Platinum Drywall Tools': [
    { id: 'platinum-compound-pump',          title: 'Compound Pump',          category: 'Pumps'             },
    { id: 'platinum-flat-box',               title: 'Flat Box',               category: 'Finishing Boxes'   },
    { id: 'platinum-outside-corner-roller',  title: 'Outside Corner Roller',  category: 'Corner Rollers'    },
  ]
};

// Mapping of schematic titles/keywords to product catalog search terms
// This helps match products even if names don't match exactly
export const PRODUCT_SEARCH_MAPPINGS = {
  'Predator Taper': ['predator', 'taper', 'automatic'],
  'Predator Matrix Handle': ['matrix', 'handle', 'predator'],
  'Automatic Flat Box': ['automatic', 'flat', 'box'],
  'Flat Box': ['flat', 'box'],
  'Fat Boy Box': ['fat boy', 'box'],
  'Angle Head': ['angle', 'head'],
  'Nailspotter': ['nail', 'spotter'],
  'Tomahawk': ['tomahawk', 'smoothing', 'blade'],
  'Mud Pump': ['mud', 'pump'],
  'Tall Boy': ['tall boy', 'pump'],
  'Corner Roller': ['corner', 'roller'],
  'Throttle Box': ['throttle', 'box'],
  'Compound Tube': ['compound', 'tube'],
  'Cam Lock Tube': ['cam lock', 'tube'],
  'Semi-Automatic Taper': ['semi', 'taper'],
  'External Corner': ['external', 'corner', 'applicator'],
  'Internal Corner': ['internal', 'corner'],
  'Corner Flusher': ['corner', 'flusher'],
  'Sander': ['sander', 'head'],
  'Handle': ['handle'],
  'Flat Box Handle': ['flat box', 'handle'],
  'Closet Monster': ['closet', 'monster'],
  'Columbia One': ['columbia one'],
  'Extendable Handle': ['extendable', 'handle']
};

/**
 * Filter products that have corresponding schematics
 * @param {Array} allProducts - All products from the catalog
 * @param {String} brand - Optional: filter by specific brand
 * @returns {Array} Filtered products that have schematics
 */
export function filterProductsWithSchematics(allProducts, brand = null) {
  const targetBrand = brand || 'Columbia Taping Tools';
  const schematicsForBrand = SCHEMATIC_DEFINITIONS[targetBrand];
  
  if (!schematicsForBrand) return [];

  // Create search terms from all schematic titles
  const searchTerms = [];
  schematicsForBrand.forEach(schematic => {
    const mapping = PRODUCT_SEARCH_MAPPINGS[schematic.title];
    if (mapping) {
      searchTerms.push(...mapping);
    }
    // Also add schematic title itself
    searchTerms.push(schematic.title.toLowerCase());
  });

  // Filter products where brand matches and name/description contains search terms
  return allProducts.filter(product => {
    if (product.brand !== targetBrand) return false;
    
    const searchText = `${product.name} ${product.short_description || ''} ${product.description_full || ''}`.toLowerCase();
    
    // Check if any search term appears in product
    return searchTerms.some(term => searchText.includes(term.toLowerCase()));
  });
}

/**
 * Get all products with schematics for multiple brands
 * @param {Array} allProducts - All products from the catalog
 * @returns {Array} All products that have associated schematics
 */
export function getAllProductsWithSchematics(allProducts) {
  let result = [];
  
  Object.keys(SCHEMATIC_DEFINITIONS).forEach(brand => {
    const brandProducts = filterProductsWithSchematics(allProducts, brand);
    result = [...result, ...brandProducts];
  });
  
  // Remove duplicates by SKU
  const uniqueProducts = {};
  result.forEach(product => {
    if (!uniqueProducts[product.sku]) {
      uniqueProducts[product.sku] = product;
    }
  });
  
  return Object.values(uniqueProducts);
}

/**
 * Get a map of products by schematic ID
 * Useful for linking schematic viewer to products
 * @param {Array} allProducts - All products from the catalog
 * @returns {Object} Map of schematic ID to product
 */
export function getSchematicToProductMap(allProducts) {
  const map = {};
  
  Object.entries(SCHEMATIC_DEFINITIONS).forEach(([brand, schematics]) => {
    const brandProducts = filterProductsWithSchematics(allProducts, brand);
    
    schematics.forEach(schematic => {
      // Find first matching product for this schematic
      const matchingProduct = brandProducts.find(product => {
        const searchText = `${product.name} ${product.short_description || ''} ${product.description_full || ''}`.toLowerCase();
        const mapping = PRODUCT_SEARCH_MAPPINGS[schematic.title];
        
        if (mapping) {
          return mapping.some(term => searchText.includes(term.toLowerCase()));
        }
        
        return searchText.includes(schematic.title.toLowerCase());
      });
      
      if (matchingProduct) {
        map[schematic.id] = matchingProduct;
      }
    });
  });
  
  return map;
}

/**
 * Returns the schematic ID that best matches the given product, or null if
 * no schematic exists for it.  Covers Columbia Taping Tools, TapeTech,
 * Asgard, and Level5.
 *
 * Matching priority: SKU-exact match first (most reliable), then
 * more-specific keyword checks before catch-all checks for the same family.
 *
 * @param {Object} product - A product object from the catalog
 * @returns {string|null} schematic ID (e.g. 'columbia-flat-box') or null
 */
export function getSchematicIdForProduct(product) {
  if (!product) return null;

  const name = (product.name || '').toLowerCase();
  const sku  = (product.sku  || product.part_number || '').toUpperCase().trim();
  const brand = product.brand || '';

  // ── TapeTech ─────────────────────────────────────────────────────────────
  if (brand === 'TapeTech') {
    if (sku.startsWith('XHTT') || name.includes('extendable support handle')) {
      return 'tapetech-extendable-support-handle';
    }
    return null;
  }

  // ── Asgard ────────────────────────────────────────────────────────────────
  if (brand === 'Asgard') {
    // SKU-exact match is the most reliable path for Asgard products
    const asgardSkuMap = {
      'AT01-AD':  'asgard-at01-ad',
      'AH25-AD':  'asgard-ah25-ad',
      'AH30-AD':  'asgard-ah30-ad',
      'AH35-AD':  'asgard-ah35-ad',
      'CA08-AD':  'asgard-ca08-ad',
      'CFA-AD':   'asgard-cfa-ad',
      'FA01-AD':  'asgard-fa01-ad',
      'EHC07-AD': 'asgard-ehc07-ad',
      'EHC10-AD': 'asgard-ehc10-ad',
      'EHC12-AD': 'asgard-ehc12-ad',
      'EZ07-AD':  'asgard-ez07-ad',
      'EZ10-AD':  'asgard-ez10-ad',
      'EZ12-AD':  'asgard-ez12-ad',
      'PA07-AD':  'asgard-pa07-ad',
      'PA10-AD':  'asgard-pa10-ad',
      'PA12-AD':  'asgard-pa12-ad',
      'BBH-AD':   'asgard-bbh-ad',
      'BBHE-AD':  'asgard-bbhe-ad',
      'FBHE-AD':  'asgard-fbhe-ad',
      'FH-AD':    'asgard-fh-ad',
      'XH-AD':    'asgard-xh-ad',
      'GN01-AD':  'asgard-gn01-ad',
      'LP01-AD':  'asgard-lp01-ad',
      'CR01-AD':  'asgard-cr01-ad',
      'NS03-AD':  'asgard-ns03-ad',
    };
    if (asgardSkuMap[sku]) return asgardSkuMap[sku];

    // Name-keyword fallback for Asgard
    if (name.includes('hammer') && (name.includes('taper') || name.includes('automatic'))) return 'asgard-at01-ad';
    if (name.includes('automatic taper')) return 'asgard-at01-ad';
    if (name.includes('2.5') && name.includes('angle head')) return 'asgard-ah25-ad';
    if (name.includes('3.5') && name.includes('angle head')) return 'asgard-ah35-ad';
    if (name.includes('3') && name.includes('angle head') && !name.includes('3.5')) return 'asgard-ah30-ad';
    if (name.includes('8') && name.includes('corner applicator')) return 'asgard-ca08-ad';
    if (name.includes('angle head adapter')) return 'asgard-cfa-ad';
    if (name.includes('filler adapter')) return 'asgard-fa01-ad';
    if (name.includes('maxxbox') && name.includes('7')) return 'asgard-ehc07-ad';
    if (name.includes('maxxbox') && name.includes('10')) return 'asgard-ehc10-ad';
    if (name.includes('maxxbox') && name.includes('12')) return 'asgard-ehc12-ad';
    if (name.includes('maxxbox')) {
      // generic maxxbox without size — can't determine, skip
      return null;
    }
    if (name.includes('power assist') && name.includes('7')) return 'asgard-pa07-ad';
    if (name.includes('power assist') && name.includes('10')) return 'asgard-pa10-ad';
    if (name.includes('power assist') && name.includes('12')) return 'asgard-pa12-ad';
    if (name.includes('flat finishing box') && name.includes('7')) return 'asgard-ez07-ad';
    if (name.includes('flat finishing box') && name.includes('10')) return 'asgard-ez10-ad';
    if (name.includes('flat finishing box') && name.includes('12')) return 'asgard-ez12-ad';
    if (name.includes('brakeless') && name.includes('extendable')) return 'asgard-bbhe-ad';
    if (name.includes('brakeless box handle')) return 'asgard-bbh-ad';
    if (name.includes('extendable flat box handle')) return 'asgard-fbhe-ad';
    if (name.includes('fiberglass handle')) return 'asgard-fh-ad';
    if (name.includes('extendable support handle')) return 'asgard-xh-ad';
    if (name.includes('gooseneck')) return 'asgard-gn01-ad';
    if (name.includes('compound loading pump') || (name.includes('loading pump'))) return 'asgard-lp01-ad';
    if (name.includes('inside corner roller')) return 'asgard-cr01-ad';
    if (name.includes('nail spotter') || name.includes('nailspotter')) return 'asgard-ns03-ad';
    return null;
  }

  // ── Level5 ────────────────────────────────────────────────────────────────
  if (brand === 'Level5') {
    if (sku.includes('4-707') || sku.includes('4707') || name.includes('corner roller')) {
      return 'level5-corner-roller-4-707';
    }
    return null;
  }

  // ── Columbia Taping Tools ─────────────────────────────────────────────────
  if (brand !== 'Columbia Taping Tools') return null;

  // ── Handles ──────────────────────────────────────────────────────────────
  if (name.includes('closet monster')) return 'columbia-closet-monster-flat-box-handle';
  // "Matrix Extendable" and "Short Matrix" handles are the Matrix handle system
  if (name.includes('matrix') && name.includes('handle') && !name.includes('long extendable')) return 'columbia-matrix';
  // The Long Extendable Handle (56"–76") is its own schematic
  if (name.includes('long extendable') && name.includes('handle')) return 'columbia-long-extendable-handle';
  // Flat Box Handles (180-Grip, Featherweight, Bent, or plain)
  if (name.includes('flat box handle')) return 'columbia-flat-box-handle';

  // ── Automatic Tapers ─────────────────────────────────────────────────────
  // Check for predator/automatic taper BEFORE checking "columbia one" handle
  if (name.includes('predator') && name.includes('taper')) return 'columbia-predator-taper';
  if (name.includes('carbon fiber') && name.includes('taper')) return 'columbia-predator-taper';
  if (name.includes('automatic taper')) return 'columbia-predator-taper';
  if (name.includes('sawed off') && name.includes('taper')) return 'columbia-predator-taper';
  if (name.includes('mini automatic taper')) return 'columbia-predator-taper';

  // ── Semi-Automatic Tapers ────────────────────────────────────────────────
  if (name.includes('semi-automatic') || name.includes('semi auto')) return 'columbia-semi-automatic-taper';
  if (name.includes('semi automatic')) return 'columbia-semi-automatic-taper';

  // ── Columbia One Handle (after taper checks above) ───────────────────────
  if (name.includes('columbia one') && !name.includes('taper') && !name.includes('predator')) return 'columbia-one';
  if (name.includes('one handle') && !name.includes('taper')) return 'columbia-one';
  if (name.includes('one extendable') && name.includes('handle') && !name.includes('taper')) return 'columbia-one';

  // ── Finishing Boxes ───────────────────────────────────────────────────────
  // Throttle Box (angle box) before generic flat box
  if (name.includes('throttle') || name.includes('throttlebox') || name.includes('angle box')) return 'columbia-throttle-box';
  // Inside-Track Fat Boy before generic Fat Boy
  if (name.includes('inside track') && name.includes('fat boy')) return 'columbia-fat-boy-box';
  // Automatic Assist before generic fat-boy or flat box
  if (name.includes('automatic assist') && name.includes('flat box')) return 'columbia-automatic-flat-box';
  // Fat Boy (no automatic assist) – also covers Fat Boy combos
  if (name.includes('fat boy') && (name.includes('flat box') || name.includes('finisher') || name.includes('finishing'))) return 'columbia-fat-boy-box';
  // Hinged flat finisher / plain flat box
  if (name.includes('flat box') || name.includes('flat finisher box') || name.includes('finishing box')) return 'columbia-flat-box';

  // ── Compound Tubes ────────────────────────────────────────────────────────
  if (name.includes('cam-lock') || name.includes('cam lock')) return 'columbia-cam-lock-tube';
  if (
    name.includes('compound mud tube') ||
    name.includes('compound tube') ||
    (name.includes('drywall corner finishing') && name.includes('tube'))
  ) return 'columbia-compound-tube';

  // ── Corner Applicators ────────────────────────────────────────────────────
  if (name.includes('corner cobra')) return 'columbia-corner-cobra';
  if (name.includes('inside corner applicator')) return 'columbia-inside-corner-applicator';
  if (
    name.includes('2-way internal corner') ||
    name.includes('two-way internal corner') ||
    name.includes('inside 90 applicator') ||
    name.includes('inside 90 degree mud head')
  ) return 'columbia-2-way-internal-corner';
  if (
    name.includes('external corner applicator') ||
    (name.includes('outside 90 corner') && name.includes('applicator')) ||
    name.includes('outside corner bead mud applicator') ||
    name.includes('outside 90 corner applicator head') ||
    name.includes('l-trim mud applicator') ||
    name.includes('outside corner applicator')
  ) return 'columbia-external-corner-applicator';

  // ── Corner Rollers ────────────────────────────────────────────────────────
  if (name.includes('standard outside 90 corner bead roller')) return 'columbia-standard-outside-corner-roller';
  if (name.includes('superwide outside 90')) return 'columbia-standard-outside-corner-roller';
  if (name.includes('outside bullnose corner roller')) return 'columbia-standard-outside-corner-roller';
  // "Outside Corner Bead Roller" without "applicator" text
  if (name.includes('outside') && name.includes('corner bead roller')) return 'columbia-standard-outside-corner-roller';
  if (name.includes('inside corner roller')) return 'columbia-inside-corner-roller';
  if (name.includes('corner roller')) return 'columbia-inside-corner-roller';

  // ── Corner Flushers ───────────────────────────────────────────────────────
  if (name.includes('combo flusher')) return 'columbia-combo-flusher';
  if (
    (name.includes('direct') && name.includes('corner flusher')) ||
    name.includes('widetrack direct')
  ) return 'columbia-direct-corner-flusher';
  if (name.includes('corner flusher')) return 'columbia-standard-corner-flusher';

  // ── Pumps / Loading ───────────────────────────────────────────────────────
  if (name.includes('box filler')) return 'columbia-box-filler';
  if (name.includes('tall boy') && (name.includes('pump') || name.includes('loading'))) return 'columbia-tall-boy-mud-pump';
  if (name.includes('gooseneck')) return 'columbia-gooseneck-adapter';
  if (name.includes('hot mud pump') || (name.includes('mud pump') && !name.includes('tall boy'))) return 'columbia-mud-pump';

  // ── Angle Heads ───────────────────────────────────────────────────────────
  if (name.includes('angle head')) return 'columbia-angle-head';

  // ── Nail Spotters ─────────────────────────────────────────────────────────
  if (name.includes('nail spotter') || name.includes('nailspotter')) return 'columbia-nailspotter';

  // ── Smoothing Blades ──────────────────────────────────────────────────────
  if (
    name.includes('tomahawk') ||
    name.includes('sabre smoothing blade') ||
    name.includes('smoothing blade') ||
    name.includes('tomalock')
  ) return 'columbia-tomahawk-smoothing-blades';

  // ── Sanders ───────────────────────────────────────────────────────────────
  if (name.includes('sander') || name.includes('pole sander')) return 'columbia-sander-head';

  return null;
}

/**
 * Builds the URL path for the Parts page pre-selected to a given schematic.
 *
 * @param {string} schematicId  - e.g. 'columbia-flat-box'
 * @returns {string} URL path   - e.g. '/parts?schematic=columbia-flat-box'
 */
export function buildPartsUrl(schematicId) {
  if (!schematicId) return '/parts';
  return `/parts?schematic=${encodeURIComponent(schematicId)}`;
}

// Maps each brand name to the URL slug used in /schematics?brand=<slug>
const BRAND_TO_SLUG = {
  'Columbia Taping Tools': 'columbia-taping-tools',
  'TapeTech': 'tapetech',
  'Asgard': 'asgard',
  'Level5': 'level5',
};

// Reverse-lookup: schematic ID → brand name (built once from SCHEMATIC_DEFINITIONS)
const SCHEMATIC_ID_TO_BRAND = (() => {
  const map = {};
  Object.entries(SCHEMATIC_DEFINITIONS).forEach(([brand, entries]) => {
    entries.forEach(({ id }) => { map[id] = brand; });
  });
  return map;
})();

/**
 * Builds the URL path for the Schematics viewer pre-selected to a given schematic.
 *
 * @param {string} schematicId  - e.g. 'asgard-at01-ad'
 * @returns {string} URL path   - e.g. '/schematics?brand=asgard&schematic=asgard-at01-ad'
 */
export function buildSchematicsUrl(schematicId) {
  if (!schematicId) return '/schematics';
  const brand = SCHEMATIC_ID_TO_BRAND[schematicId] || '';
  const slug  = BRAND_TO_SLUG[brand] || '';
  return `/schematics?brand=${encodeURIComponent(slug)}&schematic=${encodeURIComponent(schematicId)}`;
}
