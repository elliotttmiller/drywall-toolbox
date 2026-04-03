/**
 * frontend/src/api/products.js
 *
 * WooCommerce product helpers via the wcClient (REST API v3).
 * Base URL: VITE_WC_API_BASE (e.g. https://drywalltoolbox.com/wp-json/wc/v3)
 *
 * Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#products
 */

import { wcClient, credentialsReady } from './client.js';

// ─── Product helpers ──────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of products.
 *
 * @param {Object} params  WooCommerce query parameters (per_page, page, category, etc.)
 * @returns {Promise<Array>}
 */
export async function getProducts(params = {}) {
  const response = await wcClient.get('/products', { params: { per_page: 20, ...params } });
  return response.data;
}

/**
 * Fetch a single product by its WooCommerce ID.
 *
 * @param {number|string} id  WooCommerce product ID
 * @returns {Promise<Object>}
 */
export async function getProductById(id) {
  const response = await wcClient.get(`/products/${id}`);
  return response.data;
}

/**
 * Fetch products belonging to a specific WooCommerce category.
 *
 * @param {number|string} categoryId  WooCommerce category ID
 * @param {Object}        params      Additional WooCommerce query parameters
 * @returns {Promise<Array>}
 */
export async function getProductsByCategory(categoryId, params = {}) {
  const response = await wcClient.get('/products', {
    params: { category: categoryId, per_page: 20, ...params },
  });
  return response.data;
}

/**
 * Search products by keyword.
 *
 * @param {string} query   Search keyword
 * @param {Object} params  Additional WooCommerce query parameters
 * @returns {Promise<Array>}
 */
export async function searchProducts(query, params = {}) {
  const response = await wcClient.get('/products', {
    params: { search: query, per_page: 20, ...params },
  });
  return response.data;
}

/**
 * Fetch all product categories.
 *
 * @param {Object} params  WooCommerce query parameters (per_page, parent, etc.)
 * @returns {Promise<Array>}
 */
export async function getProductCategories(params = {}) {
  const response = await wcClient.get('/products/categories', {
    params: { per_page: 100, ...params },
  });
  return response.data;
}

/**
 * Fetch a single WooCommerce product by its SKU.
 *
 * WooCommerce GET /products?sku=<sku> returns an array; we return the first
 * match or null if nothing is found.
 *
 * @param {string} sku  The product SKU (e.g. "CT119", "FA362")
 * @returns {Promise<Object|null>}  WooCommerce product object or null
 */
export async function getProductBySku(sku) {
  if (!sku) return null;
  try {
    // Ensure credentials are bootstrapped before making the authenticated call.
    // Without this, a hotspot click immediately after page load may race against
    // the /dtb/v1/config fetch and send an unauthenticated request that returns
    // 401 → null, causing the modal to show stale JSON data instead of live
    // WooCommerce prices and images.
    await credentialsReady();
    const response = await wcClient.get('/products', { params: { sku, per_page: 1 } });
    const products = response.data;
    return Array.isArray(products) && products.length > 0 ? products[0] : null;
  } catch {
    return null;
  }
}
