import { API_BASE_URL } from '../api/client.js';

function backendOrigin() {
  if (typeof window === 'undefined') return API_BASE_URL || '';
  try {
    return new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Canonical full-document WooCommerce checkout URL.
 *
 * React staging builds may live below /staging/{id}, but checkout is not a
 * parallel SPA route. Production and same-origin staging both hand off directly
 * to the root WordPress/WooCommerce checkout so one cookie-backed Woo session,
 * one Checkout Block, and one payment authority are used.
 */
export function getWooCheckoutUrl() {
  const origin = backendOrigin();
  const path = '/checkout/';
  return origin ? new URL(path, origin).toString() : path;
}

/**
 * Direct WordPress fallback used only when the canonical root checkout route is
 * incorrectly served by the React SPA. This bypasses the SPA catch-all without
 * introducing a second checkout implementation.
 */
export function getWooCheckoutFallbackUrl() {
  const origin = backendOrigin();
  const path = '/wp/index.php?pagename=checkout';
  return origin ? new URL(path, origin).toString() : path;
}
