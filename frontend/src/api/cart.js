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

