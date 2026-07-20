import { API_BASE_URL } from '../api/client.js';

function backendOrigin() {
  if (typeof window === 'undefined') return API_BASE_URL || '';
  try {
    return new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function storefrontBasePath() {
  const configured = String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (!configured || configured === '/') return '';

  try {
    const pathname = new URL(configured, typeof window !== 'undefined' ? window.location.origin : 'https://drywalltoolbox.com').pathname.replace(/\/+$/, '');
    return /^\/staging\/[A-Za-z0-9_-]+$/.test(pathname) ? pathname : '';
  } catch {
    return /^\/staging\/[A-Za-z0-9_-]+$/.test(configured) ? configured : '';
  }
}

function buildCheckoutUrl(path) {
  const origin = backendOrigin();
  const base = origin ? new URL(path, origin) : new URL(path, 'https://drywalltoolbox.com');
  const storefrontPath = storefrontBasePath();

  if (storefrontPath) {
    base.searchParams.set('dtb_storefront_base_path', storefrontPath);
  }

  return origin ? base.toString() : `${base.pathname}${base.search}`;
}

/**
 * Canonical full-document WooCommerce checkout URL.
 *
 * React staging builds may live below /staging/{id}, but checkout is not a
 * parallel SPA route. Production and same-origin staging both hand off directly
 * to root WordPress/WooCommerce checkout. The optional, validated storefront
 * base-path query value is routing metadata only; WooCommerce persists it so a
 * successful order returns to the same React storefront environment.
 */
export function getWooCheckoutUrl() {
  return buildCheckoutUrl('/checkout/');
}

/**
 * Direct WordPress fallback used only when the canonical root checkout route is
 * incorrectly served by the React SPA. This bypasses the SPA catch-all without
 * introducing a second checkout implementation and preserves storefront return
 * context exactly like the canonical handoff.
 */
export function getWooCheckoutFallbackUrl() {
  return buildCheckoutUrl('/wp/index.php?pagename=checkout');
}
