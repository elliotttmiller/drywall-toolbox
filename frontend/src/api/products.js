/**
 * frontend/src/api/products.js
 *
 * Product API helpers via the drywall/v1 server-side proxy.
 * Proxy namespace: /wp-json/drywall/v1/
 *
 * Also exports backward-compatible helpers used by existing services
 * (getProductBySku, getProductCategories, etc.).
 */

import { apiClient, wcClient, credentialsReady } from './client.js';

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
 * @param {string} sku
 * @returns {Promise<Object|null>}
 */
export async function getProductBySku( sku ) {
  if ( ! sku ) return null;
  try {
    await credentialsReady();
    const response = await wcClient.get( '/products', { params: { sku, per_page: 1 } } );
    const products = response.data;
    return Array.isArray( products ) && products.length > 0 ? products[ 0 ] : null;
  } catch {
    return null;
  }
}

