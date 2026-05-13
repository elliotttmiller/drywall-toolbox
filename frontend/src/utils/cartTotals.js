/**
 * frontend/src/utils/cartTotals.js
 *
 * Centralized pricing/totals normalization utilities.
 *
 * Production rules:
 * - Prefer WooCommerce Store API totals whenever available.
 * - Browser-side calculations are fallback-only.
 * - Tax/shipping estimates are provisional unless returned by Store API.
 */

function parseMoney(value) {
  const raw = typeof value === 'number'
    ? value
    : parseFloat(String(value || '0'));

  if (!Number.isFinite(raw)) return 0;

  // Woo Store API totals are commonly integer minor units.
  return raw > 999 ? raw / 100 : raw;
}

export function getAuthoritativeSubtotal(cart, cartItems = []) {
  const storeSubtotal = cart?.totals?.subtotal;
  if (storeSubtotal != null) {
    return parseMoney(storeSubtotal);
  }

  return cartItems.reduce(
    (total, item) => total + ((item.price || 0) * (item.quantity || 0)),
    0,
  );
}

export function getAuthoritativeTax(cart, fallbackSubtotal = 0, fallbackRate = 0.08) {
  const storeTax = cart?.totals?.total_tax;
  if (storeTax != null) {
    return parseMoney(storeTax);
  }

  return fallbackSubtotal * fallbackRate;
}

export function getAuthoritativeShipping(cart, fallbackShipping = 0) {
  const storeShipping = cart?.totals?.total_shipping;
  if (storeShipping != null) {
    return parseMoney(storeShipping);
  }

  return fallbackShipping;
}

export function getAuthoritativeTotal(cart, subtotal, shipping, tax) {
  const storeTotal = cart?.totals?.total_price;
  if (storeTotal != null) {
    return parseMoney(storeTotal);
  }

  return subtotal + shipping + tax;
}
