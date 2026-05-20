/**
 * frontend/src/api/orders.js
 *
 * DTB product-order API client — wraps the dtb/v1/orders/* endpoints.
 *
 * All routes are JWT-gated — a valid Bearer token must be in the in-memory
 * token store (see src/auth/tokenStore.js) before calling authenticated functions.
 *
 * Guest customers may access tracking via the order_key query param without a JWT.
 */

import { apiClient } from './client.js';

// ─── Terminal order statuses ───────────────────────────────────────────────────

/** Statuses after which polling / SSE streaming should stop. */
export const ORDER_TERMINAL_STATUSES = [
  'completed',
  'cancelled',
  'refunded',
  'failed',
];

// ─── Customer-safe status labels ──────────────────────────────────────────────

export const ORDER_STATUS_LABELS = {
  pending:    'Order Received',
  'on-hold':  'Payment Under Review',
  processing: 'Processing',
  shipped:    'Shipped',
  completed:  'Delivered / Completed',
  cancelled:  'Cancelled',
  refunded:   'Refunded',
  failed:     'Payment Failed',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the WP-JSON base URL for DTB endpoints.
 *
 * @returns {string}
 */
function dtbBase() {
  const base = ( process.env.REACT_APP_WP_BASE_URL || '' ).replace( /\/+$/, '' );
  if ( base ) {
    return base.endsWith( '/wp-json' ) ? base : `${ base }/wp-json`;
  }
  return typeof window !== 'undefined' ? `${ window.location.origin }/wp-json` : '';
}

/**
 * Return the SSE stream URL for an order (used directly by EventSource).
 *
 * @param {number|string} orderId
 * @param {string}        [orderKey]  WooCommerce order_key for guest access
 * @returns {string}
 */
export function getOrderEventStreamUrl( orderId, orderKey = '' ) {
  const params = orderKey ? `?order_key=${ encodeURIComponent( orderKey ) }` : '';
  return `${ dtbBase() }/dtb/v1/orders/${ encodeURIComponent( orderId ) }/events/stream${ params }`;
}

// ─── REST API wrappers ────────────────────────────────────────────────────────

/**
 * Retrieve the authenticated customer's order list.
 *
 * @param {number} [page=1]
 * @param {number} [perPage=20]
 * @returns {Promise<Array>}
 */
export async function getOrders( page = 1, perPage = 20 ) {
  const params = new URLSearchParams( { page, per_page: perPage } ).toString();
  return apiClient( `/wp-json/dtb/v1/orders?${ params }` );
}

/**
 * Retrieve a single order's customer-safe detail.
 *
 * @param {number|string} orderId
 * @returns {Promise<Object>}
 */
export async function getOrder( orderId ) {
  return apiClient( `/wp-json/dtb/v1/orders/${ encodeURIComponent( orderId ) }` );
}

/**
 * Retrieve the customer-safe tracking projection for an order.
 *
 * Guest customers can provide an order_key to access without a JWT.
 *
 * @param {number|string} orderId
 * @param {string}        [orderKey]  WooCommerce order_key for guest access
 * @returns {Promise<Object>}
 */
export async function getOrderTracking( orderId, orderKey = '' ) {
  const params = orderKey ? `?order_key=${ encodeURIComponent( orderKey ) }` : '';
  return apiClient( `/wp-json/dtb/v1/orders/${ encodeURIComponent( orderId ) }/tracking${ params }` );
}

/**
 * Retrieve the ordering subsystem health status.
 *
 * @returns {Promise<{ ok: boolean, woocommerce: boolean, payments: boolean, queue: boolean, veeqo: boolean, quickbooks: boolean, events_table: boolean }>}
 */
export async function getOrdersHealth() {
  return apiClient( '/wp-json/dtb/v1/orders/health' );
}

// ─── Legacy proxy compat ──────────────────────────────────────────────────────

/**
 * @deprecated Use getOrder() which now calls the dtb/v1 endpoint.
 * Kept for backward-compat with existing order confirmation code.
 *
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function createOrder( payload ) {
  // Create via WooCommerce REST API proxy (existing flow via drywall/v1).
  return apiClient( '/wp-json/drywall/v1/orders', {
    method: 'POST',
    body: JSON.stringify( payload ),
  } );
}

/**
 * @deprecated Use getOrders() which calls the dtb/v1 endpoint.
 *
 * @param {number} customerId
 * @param {number} [page=1]
 * @param {number} [perPage=20]
 */
export async function getCustomerOrders( customerId, page = 1, perPage = 20 ) {
  return getOrders( page, perPage );
}

