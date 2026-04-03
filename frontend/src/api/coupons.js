/**
 * frontend/src/api/coupons.js
 *
 * Coupon helpers via the drywall/v1 server-side proxy.
 */

import { apiClient } from './client.js';

/**
 * Validate a coupon code.
 *
 * Throws { code: 'coupon_invalid' } when the coupon is not found (404).
 *
 * @param {string} code  Coupon code
 * @returns {Promise<any>}  Coupon object on success
 */
export async function validateCoupon( code ) {
  try {
    return await apiClient( `/wp-json/drywall/v1/coupons/${ encodeURIComponent( code ) }` );
  } catch ( err ) {
    if ( err && err.status === 404 ) {
      throw { code: 'coupon_invalid', message: 'Coupon not found.', status: 404 };
    }
    throw err;
  }
}
