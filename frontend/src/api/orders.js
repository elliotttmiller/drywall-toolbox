/**
 * frontend/src/api/orders.js
 *
 * Order helpers via the drywall/v1 server-side proxy.
 * Both routes are JWT-gated — a valid Bearer token must be in the in-memory
 * token store (see src/auth/tokenStore.js) before calling these functions.
 */

import { apiClient } from './client.js';

/**
 * Create a new WooCommerce order.
 *
 * Required WooCommerce order fields:
 *   payment_method        {string}  — e.g. 'stripe', 'paypal', 'cod'
 *   payment_method_title  {string}  — human-readable label
 *   set_paid              {boolean} — true once payment is confirmed
 *   billing               {Object}  — first_name, last_name, address_1, city,
 *                                     state, postcode, country, email, phone
 *   shipping              {Object}  — same shape as billing (optional)
 *   line_items            {Array}   — [{ product_id, quantity, variation_id? }]
 *   shipping_lines        {Array}   — [{ method_id, method_title, total }]
 *
 * @param {Object} payload  WooCommerce order request body
 * @returns {Promise<any>}  Created order object
 */
export async function createOrder( payload ) {
  return apiClient( '/wp-json/drywall/v1/orders', {
    method: 'POST',
    body: JSON.stringify( payload ),
  } );
}

/**
 * Retrieve an existing order by ID.
 *
 * @param {number|string} id  WooCommerce order ID
 * @returns {Promise<any>}
 */
export async function getOrder( id ) {
  return apiClient( `/wp-json/drywall/v1/orders/${ encodeURIComponent( id ) }` );
}

/**
 * Retrieve a paginated list of orders for a specific customer.
 *
 * The server enforces that the `customer` param matches the JWT's user_id —
 * never pass another user's ID here.
 *
 * @param {number}  customerId  WooCommerce customer ID (same as WP user ID)
 * @param {number}  [page=1]
 * @param {number}  [perPage=20]
 * @returns {Promise<Array<any>>}
 */
export async function getCustomerOrders( customerId, page = 1, perPage = 20 ) {
  const params = new URLSearchParams( {
    customer: customerId,
    page,
    per_page: perPage,
    orderby: 'date',
    order:   'desc',
  } ).toString();
  return apiClient( `/wp-json/drywall/v1/orders?${ params }` );
}
