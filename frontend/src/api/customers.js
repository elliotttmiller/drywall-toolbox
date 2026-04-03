/**
 * frontend/src/api/customers.js
 *
 * Customer helpers via the drywall/v1 server-side proxy.
 * POST /customers is public (rate-limited).
 * GET /customers/{id} is JWT-gated.
 */

import { apiClient } from './client.js';

/**
 * Register a new WooCommerce customer.
 *
 * @param {Object} data  { email, first_name, last_name, username, password, ... }
 * @returns {Promise<any>}  Created customer object
 */
export async function registerCustomer( data ) {
  return apiClient( '/wp-json/drywall/v1/customers', {
    method: 'POST',
    body: JSON.stringify( data ),
  } );
}

/**
 * Retrieve a customer by WooCommerce ID (JWT-gated).
 *
 * @param {number|string} id  WooCommerce customer ID
 * @returns {Promise<any>}
 */
export async function getCustomer( id ) {
  return apiClient( `/wp-json/drywall/v1/customers/${ encodeURIComponent( id ) }` );
}
