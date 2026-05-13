import apiClient from './client.js';

/**
 * frontend/src/api/checkout.js
 *
 * Production-grade checkout orchestration client.
 *
 * These endpoints are expected to be implemented server-side behind
 * authenticated WooCommerce/Stripe proxy routes.
 */

export async function createPaymentIntent(payload = {}) {
  return apiClient('/wp-json/dtb/v1/checkout/payment-intent', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function finalizeCheckout(payload = {}) {
  return apiClient('/wp-json/dtb/v1/checkout/finalize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
