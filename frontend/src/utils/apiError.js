/**
 * frontend/src/utils/apiError.js
 *
 * Maps known WooCommerce/proxy error codes to plain-English user messages.
 * Unknown codes return a safe generic fallback.
 *
 * Raw error codes, stack traces, and internal details are never included
 * in the return value — this is intentional.
 */

const ERROR_MESSAGES = {
  // Authentication / authorization
  unauthorized:       'Please sign in to continue.',
  missing_token:      'Please sign in to continue.',
  invalid_token:      'Your session has expired. Please sign in again.',
  rate_limited:       'Too many requests. Please wait a moment and try again.',

  // Cart / store
  woocommerce_cart_error:             'There was a problem with your cart. Please refresh and try again.',
  woocommerce_rest_cart_invalid_product: 'One or more items in your cart are no longer available.',

  // Coupons
  coupon_invalid:     'That coupon code is not valid.',
  coupon_error:       'There was a problem applying your coupon.',

  // Orders
  woocommerce_rest_order_invalid_items: 'Your order contains invalid items. Please review your cart.',

  // Products / categories
  upstream_error:     'We\'re having trouble reaching the product catalog. Please try again shortly.',
  not_found:          'The item you requested could not be found.',

  // Network / generic
  network_error:      'A network error occurred. Please check your connection and try again.',
  api_error:          'An unexpected error occurred. Please try again.',
  forbidden_origin:   'Access denied.',
  config_error:       'The service is not configured correctly. Please contact support.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Map an API error object to a plain-English user message.
 *
 * @param {Object|Error|any} error  Error thrown by apiClient / store helpers
 * @returns {string}  Safe, user-facing message (no raw codes or stack traces)
 */
export function handleApiError( error ) {
  if ( ! error ) return FALLBACK_MESSAGE;

  const code = error.code || '';
  if ( code && Object.prototype.hasOwnProperty.call( ERROR_MESSAGES, code ) ) {
    return ERROR_MESSAGES[ code ];
  }

  return FALLBACK_MESSAGE;
}
