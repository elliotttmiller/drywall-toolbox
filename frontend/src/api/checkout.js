/**
 * Stripe Embedded Checkout API boundary.
 *
 * Browser code receives only Stripe publishable/client-secret values and sends
 * opaque checkout/session identifiers. Cart snapshots, shipping calculation,
 * payment verification, and WooCommerce order materialization remain server-side.
 */
import { apiClient } from './client.js';
import { getCartToken } from './cart.js';

function cartHeaders() {
	const cartToken = getCartToken();
	return cartToken ? { 'Cart-Token': cartToken } : undefined;
}

function checkoutPost( path, payload = {} ) {
	return apiClient( `/wp-json/dtb/v1/checkout/${ path }`, {
		method: 'POST',
		body: JSON.stringify( payload ),
		headers: cartHeaders(),
	} );
}

export async function getStripeEmbeddedCheckoutConfig() {
	const response = await apiClient( '/wp-json/dtb/v1/checkout/stripe-embedded/config', {
		headers: cartHeaders(),
	} );
	return response?.stripe_embedded_checkout || response || {};
}

export async function createStripeEmbeddedCheckoutSession( payload = {} ) {
	return checkoutPost( 'stripe-embedded/session', payload );
}

export async function updateStripeEmbeddedShippingOptions( payload = {} ) {
	return checkoutPost( 'stripe-embedded/shipping-options', payload );
}

export async function getStripeEmbeddedCheckoutStatus( stripeSessionId = '' ) {
	const sessionId = encodeURIComponent( String( stripeSessionId || '' ) );
	return apiClient( `/wp-json/dtb/v1/checkout/stripe-embedded/status?stripe_session_id=${ sessionId }`, {
		headers: cartHeaders(),
	} );
}
