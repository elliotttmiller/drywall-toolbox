/**
 * frontend/src/api/cart.js
 *
 * WooCommerce Store API cart helpers (/wc/store/v1/cart).
 *
 * All calls include:
 *   credentials: 'include'        — sends session cookies cross-origin
 *   X-WC-Store-API-Nonce header   — refreshed via initCart()
 *
 * On 401: initCart() is called to refresh the nonce and the request is
 * retried once.  A second consecutive 401 throws to the caller.
 *
 * Docs: https://github.com/woocommerce/woocommerce/tree/trunk/plugins/woocommerce/src/StoreApi
 */

const STORE_BASE =
  ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' ) +
  ( process.env.REACT_APP_STORE_API_BASE || '/wp-json/wc/store/v1' );

// Nonce stored at module scope — refreshed by initCart().
let _storeNonce = '';

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function storeFetch( path, options = {}, isRetry = false ) {
  const url = `${ STORE_BASE }${ path }`;
  const headers = {
    'Content-Type': 'application/json',
    ...( _storeNonce ? { 'X-WC-Store-API-Nonce': _storeNonce } : {} ),
    ...( options.headers || {} ),
  };

  const res = await fetch( url, {
    credentials: 'include',
    ...options,
    headers,
  } );

  // 401 — refresh nonce via initCart() and retry once.
  if ( res.status === 401 ) {
    if ( isRetry ) {
      let message = `Store API 401: ${ url }`;
      try {
        const body = await res.json();
        if ( body && body.message ) message = body.message;
      } catch { /**/ }
      throw new Error( message );
    }
    await initCart();
    return storeFetch( path, options, true );
  }

  if ( ! res.ok ) {
    let message = `Store API error ${ res.status }: ${ url }`;
    try {
      const body = await res.json();
      if ( body && body.message ) message = body.message;
    } catch { /**/ }
    throw new Error( message );
  }

  if ( res.status === 204 ) return null;
  return res.json();
}

// ─── Cart API ─────────────────────────────────────────────────────────────────

/**
 * Initialise the cart session and capture the Store API nonce.
 * Must be called on mount before any cart operation.
 *
 * @returns {Promise<Object>}  WooCommerce cart object
 */
export async function initCart() {
  const url = `${ STORE_BASE }/cart`;
  const res = await fetch( url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  } );

  const nonce = res.headers.get( 'X-WC-Store-API-Nonce' );
  if ( nonce ) {
    _storeNonce = nonce;
  }

  if ( ! res.ok ) {
    throw new Error( `Store API error ${ res.status }: ${ url }` );
  }

  if ( res.status === 204 ) return null;
  return res.json();
}

/**
 * Retrieve the current cart.
 *
 * @returns {Promise<Object>}
 */
export async function getCart() {
  return storeFetch( '/cart' );
}

/**
 * Add an item to the cart.
 *
 * @param {number|string} productId   WooCommerce product ID
 * @param {number}        qty         Quantity (default: 1)
 * @param {Object}        variation   Variation attribute map (optional)
 * @returns {Promise<Object>}
 */
export async function addToCart( productId, qty = 1, variation = {} ) {
  return storeFetch( '/cart/add-item', {
    method: 'POST',
    body: JSON.stringify( { id: productId, quantity: qty, variation } ),
  } );
}

/**
 * Update the quantity of a cart item.
 *
 * @param {string} key  Cart item key
 * @param {number} qty  New quantity
 * @returns {Promise<Object>}
 */
export async function updateCartItem( key, qty ) {
  return storeFetch( `/cart/items/${ encodeURIComponent( key ) }`, {
    method: 'PUT',
    body: JSON.stringify( { quantity: qty } ),
  } );
}

/**
 * Remove an item from the cart.
 *
 * @param {string} key  Cart item key
 * @returns {Promise<Object>}
 */
export async function removeCartItem( key ) {
  return storeFetch( `/cart/items/${ encodeURIComponent( key ) }`, {
    method: 'DELETE',
  } );
}

/**
 * Apply a coupon to the cart.
 *
 * @param {string} code  Coupon code
 * @returns {Promise<Object>}
 */
export async function applyCoupon( code ) {
  return storeFetch( '/cart/coupons', {
    method: 'POST',
    body: JSON.stringify( { code } ),
  } );
}

/**
 * Remove a coupon from the cart.
 *
 * @param {string} code  Coupon code
 * @returns {Promise<Object>}
 */
export async function removeCoupon( code ) {
  return storeFetch( `/cart/coupons/${ encodeURIComponent( code ) }`, {
    method: 'DELETE',
  } );
}

/**
 * Update the WooCommerce cart customer (billing/shipping address).
 * Call this after syncing items to the WC cart and before selecting a
 * shipping rate so the cart knows which shipping zone applies.
 *
 * @param {Object} customerData  Partial customer object accepted by the Store API.
 * @returns {Promise<Object>}    Updated WooCommerce cart object.
 */
export async function updateCartCustomer( customerData ) {
  return storeFetch( '/cart/update-customer', {
    method: 'POST',
    body: JSON.stringify( customerData ),
  } );
}

/**
 * Select a WooCommerce shipping rate for a specific package.
 *
 * The rate_id must match a rate registered by a WC shipping method, e.g.
 * 'dtb_veeqo_rates:standard' for the standard tier of DTB_Veeqo_Shipping_Method.
 *
 * @param {string} rateId    WC shipping rate ID (method:key format).
 * @param {number} packageId Package index (default: 0 — the default cart package).
 * @returns {Promise<Object>}
 */
export async function selectShippingRate( rateId, packageId = 0 ) {
  return storeFetch( '/cart/select-shipping-rate', {
    method: 'POST',
    body: JSON.stringify( { rate_id: rateId, package_id: packageId } ),
  } );
}



/**
 * Remove all items currently in the WooCommerce server-side cart.
 * Call this before syncing the React CartContext into the Store API cart to
 * avoid accumulating stale items from a previous session.
 *
 * @returns {Promise<Object>}  Empty cart object.
 */
export async function clearStoreCart() {
  const cart = await storeFetch( '/cart' );
  if ( ! cart?.items?.length ) return cart;

  for ( const item of cart.items ) {
    await removeCartItem( item.key );
  }

  return storeFetch( '/cart' );
}

/**
 * Submit the WooCommerce Store API checkout.
 *
 * The WC server-side cart must be populated (via addToCart) before calling
 * this function. On success the server creates the WooCommerce order and
 * returns the order ID + order key used for the confirmation page.
 *
 * Payment method must match a gateway enabled in WP Admin
 * (WooCommerce → Settings → Payments).  Default: 'cod' (Cash on Delivery /
 * Check / Invoice).  For Stripe/PayPal use their respective gateway IDs and
 * pass payment_data from the gateway JS SDK.
 *
 * @param {Object} billingAddress   WC billing address object
 * @param {Object} shippingAddress  WC shipping address object (optional, defaults to billing)
 * @param {string} paymentMethod    WC payment gateway ID (default: 'cod')
 * @param {Array}  paymentData      Gateway-specific payment tokens (default: [])
 * @param {string} customerNote     Optional note for the order
 * @returns {Promise<Object>}       { order_id, order_key, status, payment_result, … }
 */
export async function placeOrder(
  billingAddress,
  shippingAddress = null,
  paymentMethod = 'cod',
  paymentData = [],
  customerNote = '',
) {
  return storeFetch( '/checkout', {
    method: 'POST',
    body: JSON.stringify( {
      billing_address:  billingAddress,
      shipping_address: shippingAddress || billingAddress,
      payment_method:   paymentMethod,
      payment_data:     paymentData,
      customer_note:    customerNote,
      create_account:   false,
    } ),
  } );
}

/**
 * Synchronise the React CartContext items into the WC server-side cart and
 * submit the Store API checkout in one atomic operation.
 *
 * Steps:
 *   1. initCart()              — obtain a fresh Store API nonce
 *   2. clearStoreCart()        — remove any stale server-side items from previous sessions
 *   3. addToCart()             — add each item from cartItems sequentially
 *   4. updateCartCustomer()    — set the shipping address so WC knows the correct zone
 *   5. selectShippingRate()    — select the rate the user chose (when shippingRateId provided)
 *   6. placeOrder()            — POST /wc/store/v1/checkout
 *
 * @param {Array}  cartItems       Items from CartContext (id, quantity required)
 * @param {Object} billingAddress
 * @param {Object} shippingAddress
 * @param {string} paymentMethod
 * @param {Array}  paymentData
 * @param {string} customerNote
 * @param {string} [shippingRateId]  WC rate ID to select (e.g. 'dtb_veeqo_rates:standard').
 *                                   When omitted, WC uses the first available rate.
 * @param {string[]} [couponCodes]   Coupon codes to apply to the cart (e.g. loyalty redemptions).
 * @returns {Promise<Object>}  WC checkout response (order_id, order_key, …)
 */
export async function syncAndPlace(
  cartItems,
  billingAddress,
  shippingAddress = null,
  paymentMethod = 'cod',
  paymentData = [],
  customerNote = '',
  shippingRateId = '',
  couponCodes = [],
) {
  // Initialise session + capture nonce.
  await initCart();

  // Clear any lingering server-side items.
  await clearStoreCart();

  // Sync the local cart to the server.  Sequential to avoid race conditions on
  // the nonce — each response carries the updated nonce in the header.
  for ( const item of cartItems ) {
    await addToCart( item.id, item.quantity );
  }

  // Apply any coupon codes (e.g. loyalty redemption coupons).
  for ( const code of couponCodes ) {
    try {
      await storeFetch( '/cart/apply-coupon', {
        method: 'POST',
        body: JSON.stringify( { code } ),
      } );
    } catch ( err ) {
      console.warn( `[DTB Checkout] Coupon "${ code }" could not be applied (non-fatal):`, err.message );
    }
  }

  // Set the shipping address on the WC cart so the correct shipping zone is
  // resolved, then select the rate the customer chose in the React UI.
  // Failure is non-fatal: WC will fall back to the first available rate.
  if ( shippingRateId ) {
    try {
      await updateCartCustomer( {
        shipping_address: shippingAddress || billingAddress,
      } );
      await selectShippingRate( shippingRateId );
    } catch ( err ) {
      console.warn( 'Shipping rate selection failed (non-fatal):', err.message );
    }
  }

  // Submit the checkout.
  return placeOrder( billingAddress, shippingAddress, paymentMethod, paymentData, customerNote );
}

