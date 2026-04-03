/**
 * frontend/src/api/cart.js
 *
 * WooCommerce Store API cart helpers (/wc/store/v1/cart).
 *
 * The Store API uses cookie-based sessions — no JWT or Application Password
 * required.  All fetch calls include `credentials: 'include'` so session
 * cookies are sent cross-origin.
 *
 * Docs: https://github.com/woocommerce/woocommerce/tree/trunk/plugins/woocommerce/src/StoreApi
 */

function getSiteUrl() {
  return import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

const STORE_API_BASE = `${getSiteUrl()}/wp-json/wc/store/v1`;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function storeFetch(path, options = {}) {
  const url = `${STORE_API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include',           // Send session cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Store API error ${res.status}: ${url}`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch {
      // response was not JSON — keep status-line message
    }
    throw new Error(message);
  }

  // 204 No Content — return null
  if (res.status === 204) return null;
  return res.json();
}

// ─── Cart API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve the current cart.
 *
 * @returns {Promise<Object>}  WooCommerce cart object
 */
export async function getCart() {
  return storeFetch('/cart');
}

/**
 * Add an item to the cart.
 *
 * @param {number|string} productId   WooCommerce product ID
 * @param {number}        quantity    Quantity to add (default: 1)
 * @param {Object}        variation   Variation attributes map (optional)
 * @returns {Promise<Object>}         Updated cart object
 */
export async function addToCart(productId, quantity = 1, variation = {}) {
  return storeFetch('/cart/add-item', {
    method: 'POST',
    body: JSON.stringify({ id: productId, quantity, variation }),
  });
}

/**
 * Update the quantity of a cart item.
 *
 * @param {string} itemKey   Cart item key (from cart item object)
 * @param {number} quantity  New quantity
 * @returns {Promise<Object>}
 */
export async function updateCartItem(itemKey, quantity) {
  return storeFetch('/cart/update-item', {
    method: 'POST',
    body: JSON.stringify({ key: itemKey, quantity }),
  });
}

/**
 * Remove an item from the cart.
 *
 * @param {string} itemKey  Cart item key
 * @returns {Promise<Object>}
 */
export async function removeCartItem(itemKey) {
  return storeFetch('/cart/remove-item', {
    method: 'POST',
    body: JSON.stringify({ key: itemKey }),
  });
}

/**
 * Clear all items from the cart.
 *
 * @returns {Promise<null>}
 */
export async function clearCart() {
  return storeFetch('/cart/items', { method: 'DELETE' });
}
