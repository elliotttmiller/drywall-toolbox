/**
 * frontend/src/utils/catalogUrlState.js
 *
 * Canonical URL ↔ CatalogQuery serializer/deserializer.
 *
 * Used by Products.jsx to keep the URL as the single source of truth for
 * catalog filter state.  All brand slug ↔ label conversions go through here.
 *
 * Supported URL shapes:
 *   /products                                     — all brands, no filters
 *   /products?brand=tapetech&category=finishing    — query-param filters
 *   /products/brands/:brandSlug                   — path-based brand route
 *   /products/brands/:brandSlug/categories/:cat   — path-based brand+category
 */

// ── Brand maps ─────────────────────────────────────────────────────────────────

export const BRAND_TO_SLUG = {
  'TapeTech':               'tapetech',
  'Columbia Taping Tools':  'columbia-taping-tools',
  'Asgard':                 'asgard',
  'SurPro':                 'surpro',
  'Graco':                  'graco',
  'Platinum Drywall Tools': 'platinum',
  'Dura-Stilts':            'dura-stilts',
  'Level 5':                'level5',
};

export const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries( BRAND_TO_SLUG ).map( ( [ name, slug ] ) => [ slug, name ] )
);

// ── DTB category key → display label ─────────────────────────────────────────

export const CATEGORY_LABELS = {
  taping:    'Automatic Taping Tools',
  finishing: 'Finishing Tools',
  corner:    'Corner Tools',
  handles:   'Handles & Extensions',
  mudboxes:  'Mud Boxes & Pumps',
  sanding:   'Sanding Tools',
  stilts:    'Stilts',
  texture:   'Texture Tools',
  parts:     'Replacement Parts',
  services:  'Repair Services',
};

// ── Sort options ──────────────────────────────────────────────────────────────

export const SORT_OPTIONS = [
  { value: 'popular',    label: 'Most Popular' },
  { value: 'newest',     label: 'Newest' },
  { value: 'price-low',  label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'az',         label: 'A – Z' },
];

// ── Default query ─────────────────────────────────────────────────────────────

export const DEFAULT_QUERY = {
  brands:          [],
  category:        '',
  displayCategory: '',
  toolFamily:      '',
  productKind:     '',
  builderSlot:     '',
  workflowScope:   '',
  search:          '',
  page:            1,
  perPage:         24,
  sort:            'popular',
};

// ── Parsers ───────────────────────────────────────────────────────────────────

/**
 * Parse URL search params + optional path params into a canonical CatalogQuery.
 *
 * @param {URLSearchParams} searchParams
 * @param {{ brandSlug?: string, categorySlug?: string }} [pathParams]
 * @returns {typeof DEFAULT_QUERY}
 */
export function parseCatalogQuery( searchParams, pathParams = {} ) {
  // Path brand takes precedence over query param.
  let brands = [];
  if ( pathParams.brandSlug ) {
    const label = normalizeBrandParam( pathParams.brandSlug );
    if ( label ) brands = [ label ];
  } else {
    const brandParam = searchParams.get( 'brand' );
    if ( brandParam ) {
      brands = brandParam
        .split( ',' )
        .map( b => decodeURIComponent( b.trim() ) )
        .map( b => SLUG_TO_BRAND[ b ] )
        .filter( Boolean );
    }
  }

  const displayCategory = pathParams.categorySlug
    ? pathParams.categorySlug
    : ( searchParams.get( 'display_category' ) || '' );

  return {
    brands,
    category:        searchParams.get( 'category' )       || '',
    displayCategory,
    toolFamily:      searchParams.get( 'tool_family' )    || '',
    productKind:     searchParams.get( 'product_kind' )   || '',
    builderSlot:     searchParams.get( 'builder_slot' )   || '',
    workflowScope:   searchParams.get( 'workflow_scope' ) || '',
    search:          searchParams.get( 'search' )
      ? decodeURIComponent( searchParams.get( 'search' ) )
      : '',
    page:    Math.max( 1, parseInt( searchParams.get( 'page' ) || '1', 10 ) ),
    perPage: Math.max( 1, Math.min( 100, parseInt( searchParams.get( 'per_page' ) || '24', 10 ) ) ),
    sort:    searchParams.get( 'sort' ) || 'popular',
  };
}

/**
 * Serialize a CatalogQuery into a URL string.
 *
 * Generates canonical path-based URLs when pathParams are provided.
 *
 * @param {Partial<typeof DEFAULT_QUERY>} query
 * @param {{ brandSlug?: string, categorySlug?: string }} [pathParams]
 * @returns {string}  e.g. '/products?brand=tapetech&page=2'
 */
export function buildCatalogUrl( query, pathParams = {} ) {
  const params = new URLSearchParams();

  // Only encode brand as a query param when not encoded in the path.
  if ( ! pathParams.brandSlug && query.brands && query.brands.length > 0 ) {
    params.set( 'brand', query.brands.map( b => encodeURIComponent( BRAND_TO_SLUG[ b ] || b ) ).join( ',' ) );
  }
  if ( ! pathParams.categorySlug && query.displayCategory ) {
    params.set( 'display_category', query.displayCategory );
  }
  if ( query.category )       params.set( 'category',       query.category );
  if ( query.toolFamily )     params.set( 'tool_family',    query.toolFamily );
  if ( query.productKind )    params.set( 'product_kind',   query.productKind );
  if ( query.builderSlot )    params.set( 'builder_slot',   query.builderSlot );
  if ( query.workflowScope )  params.set( 'workflow_scope', query.workflowScope );
  if ( query.search )         params.set( 'search',         encodeURIComponent( query.search ) );
  if ( query.page && query.page > 1 ) params.set( 'page', String( query.page ) );
  if ( query.sort && query.sort !== 'popular' ) params.set( 'sort', query.sort );

  const search = params.toString();
  const qs     = search ? `?${ search }` : '';

  if ( pathParams.brandSlug && pathParams.categorySlug ) {
    return `/products/brands/${ pathParams.brandSlug }/categories/${ pathParams.categorySlug }${ qs }`;
  }
  if ( pathParams.brandSlug ) {
    return `/products/brands/${ pathParams.brandSlug }${ qs }`;
  }
  return `/products${ qs }`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a URL brand param (slug or canonical label) to a canonical label.
 *
 * @param {string} param
 * @returns {string|null}  Canonical brand label, or null if unrecognized.
 */
export function normalizeBrandParam( param ) {
  if ( ! param ) return null;
  const decoded = decodeURIComponent( param.trim() );
  // Direct slug lookup.
  if ( SLUG_TO_BRAND[ decoded ] ) return SLUG_TO_BRAND[ decoded ];
  // Case-insensitive slug lookup.
  const lower = decoded.toLowerCase();
  for ( const [ slug, label ] of Object.entries( SLUG_TO_BRAND ) ) {
    if ( slug.toLowerCase() === lower ) return label;
  }
  // Already a canonical label?
  if ( BRAND_TO_SLUG[ decoded ] ) return decoded;
  return null;
}

/**
 * Convert a canonical brand label to its URL slug.
 *
 * @param {string} label
 * @returns {string}
 */
export function brandToSlug( label ) {
  return BRAND_TO_SLUG[ label ] || label.toLowerCase().replace( /\s+/g, '-' );
}
