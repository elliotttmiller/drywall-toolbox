/**
 * frontend/src/api/products.js
 *
 * Product API helpers via the drywall/v1 server-side proxy.
 * Proxy namespace: /wp-json/drywall/v1/
 *
 * Also exports backward-compatible helpers used by existing services
 * (getProductBySku, getProductCategories, etc.).
 */

import { apiClient, wcClient } from './client.js';
import { normalizeProduct } from '../services/api.js';
import { getProductById as getCatalogProductById } from '../services/catalog.js';

// ─── drywall/v1 proxy helpers ─────────────────────────────────────────────────

/**
 * Fetch a paginated list of products.
 *
 * @param {Object} params  Supported: page, per_page, category, search,
 *                         orderby, order, min_price, max_price, stock_status
 * @returns {Promise<any>}
 */
export async function fetchProducts( params = {} ) {
  const qs = new URLSearchParams( params ).toString();
  return apiClient( `/wp-json/drywall/v1/products${ qs ? `?${ qs }` : '' }` );
}

/**
 * Fetch a single product by its WooCommerce ID.
 *
 * @param {number|string} id
 * @returns {Promise<any>}
 */
export async function fetchProduct( id ) {
  return apiClient( `/wp-json/drywall/v1/products/${ encodeURIComponent( id ) }` );
}

/**
 * Fetch a single product by its slug.
 *
 * @param {string} slug
 * @returns {Promise<any>}
 */
export async function fetchProductBySlug( slug ) {
  return apiClient( `/wp-json/drywall/v1/products/slug/${ encodeURIComponent( slug ) }` );
}

/**
 * Fetch product categories.
 *
 * @param {Object} params  Supported: page, per_page, parent
 * @returns {Promise<any>}
 */
export async function fetchCategories( params = {} ) {
  const qs = new URLSearchParams( params ).toString();
  return apiClient( `/wp-json/drywall/v1/categories${ qs ? `?${ qs }` : '' }` );
}

/**
 * Fetch all product attributes.
 *
 * @returns {Promise<any>}
 */
export async function fetchAttributes() {
  return apiClient( '/wp-json/drywall/v1/attributes' );
}

/**
 * Search products by keyword.
 *
 * @param {string} query
 * @param {Object} params  Additional params (page, per_page)
 * @returns {Promise<any>}
 */
export async function searchProducts( query, params = {} ) {
  const merged = { q: query, ...params };
  const qs = new URLSearchParams( merged ).toString();
  return apiClient( `/wp-json/drywall/v1/search?${ qs }` );
}

// ─── Backward-compatible helpers (used by Schematics.jsx / services/) ─────────

/**
 * Fetch a paginated list of products (legacy alias via wcClient).
 *
 * @param {Object} params
 * @returns {Promise<Array>}
 */
export async function getProducts( params = {} ) {
  const response = await wcClient.get( '/products', { params: { per_page: 20, ...params } } );
  return response.data;
}

/**
 * Fetch a single product by WooCommerce ID (legacy alias via wcClient).
 *
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function getProduct( id ) {
  const response = await wcClient.get( `/products/${ id }` );
  return response.data;
}

/**
 * Fetch a single product by WooCommerce ID (alias for getProduct).
 */
export const getProductById = getProduct;

/**
 * Fetch products belonging to a specific category (legacy, via wcClient).
 *
 * @param {number|string} categoryId
 * @param {Object}        params
 * @returns {Promise<Array>}
 */
export async function getProductsByCategory( categoryId, params = {} ) {
  const response = await wcClient.get( '/products', {
    params: { category: categoryId, per_page: 20, ...params },
  } );
  return response.data;
}

/**
 * Fetch all product categories (legacy alias via wcClient).
 *
 * @param {Object} params
 * @returns {Promise<Array>}
 */
export async function getProductCategories( params = {} ) {
  const response = await wcClient.get( '/products/categories', {
    params: { per_page: 100, ...params },
  } );
  return response.data;
}

/**
 * Fetch a single product by SKU (used by Schematics.jsx hotspot lookup).
 *
 * Routes through the drywall/v1 server-side proxy so no client-side WC
 * credentials are required and CORS is handled server-side.
 *
 * @param {string} sku
 * @returns {Promise<Object|null>}
 */
export async function getProductBySku( sku ) {
  if ( ! sku ) return null;
  try {
    const result = await fetchProducts( { sku, per_page: 1 } );
    const products = Array.isArray( result ) ? result : result?.products ?? [];
    if ( products.length > 0 ) {
      // Normalize the raw WC/proxy response to the internal product shape so
      // callers (e.g. the schematic hotspot modal) can reliably access
      // .stock_status, .images, .price, .name, .sku, etc.
      return normalizeProduct( products[ 0 ] );
    }
    // WC proxy returned an empty list — fall through to catalog fallback below.
  } catch {
    // Network error or proxy unavailable (e.g. GitHub Pages) — fall through to
    // catalog fallback which loads from CSV when the WC backend is unreachable.
  }

  // WC proxy returned nothing (e.g. GitHub Pages, offline, product not yet in WC).
  // catalog.js getProductById accepts both numeric IDs and SKU strings — it
  // searches the in-memory catalog by id, slug, sku, and part_number in order.
  // The catalog has a CSV fallback with product images, so this reliably returns
  // a product (with image) even without a live WordPress backend.
  try {
    return await getCatalogProductById( sku ) ?? null;
  } catch {
    // Catalog load also failed — nothing more we can do.
    return null;
  }
}

