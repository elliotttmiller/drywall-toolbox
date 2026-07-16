/**
 * Server-authoritative checkout API.
 *
 * This module carries checkout intent and opaque session credentials only.
 * Prices, stock, tax, shipping, coupons, payment state, and order creation
 * are owned by the DTB backend.
 */
import { apiClient } from './client.js';
import { getCartToken } from './cart.js';
import {
	applyCheckoutPaymentPreference,
	rememberCheckoutCapabilities,
} from '../features/checkout/paymentGatewaySelection.js';

const CHECKOUT_CAPABILITIES_TIMEOUT_MS = 8000;

function post( path, payload = {} ) {
	const cartToken = getCartToken();
	return apiClient( `/wp-json/dtb/v1/checkout/${ path }`, {
		method: 'POST',
		body: JSON.stringify( payload ),
		headers: cartToken ? { 'Cart-Token': cartToken } : undefined,
	} );
}

export async function getCheckoutCapabilities() {
	const controller = new AbortController();
	const timeoutId = window.setTimeout( () => controller.abort(), CHECKOUT_CAPABILITIES_TIMEOUT_MS );
	try {
		const response = await apiClient( '/wp-json/dtb/v1/checkout/capabilities', { signal: controller.signal } );
		const capabilities = response?.capabilities || response || {};
		rememberCheckoutCapabilities( capabilities );
		return capabilities;
	} catch ( error ) {
		if ( error?.name === 'AbortError' ) {
			throw Object.assign( new Error( 'Checkout payment capabilities timed out.' ), { code: 'checkout_capabilities_timeout' } );
		}
		throw error;
	} finally {
		window.clearTimeout( timeoutId );
	}
}

export async function createCheckoutQuote( payload = {} ) {
	const response = await post( 'quote', payload );
	return response?.quote || response || {};
}

export async function createCheckoutSession( payload = {} ) {
	return post( 'session', applyCheckoutPaymentPreference( payload ) );
}

export async function confirmCheckoutSession( payload = {} ) {
	return post( 'confirm', payload );
}

export async function finalizeCheckout( payload = {} ) {
	return post( 'finalize', payload );
}

export async function getCheckoutStatus( resumeToken ) {
	const token = encodeURIComponent( String( resumeToken || '' ) );
	return apiClient( `/wp-json/dtb/v1/checkout/status?resume_token=${ token }` );
}

export async function resumeCheckoutPayment( resumeToken ) {
	return post( 'resume-payment', { resume_token: resumeToken } );
}

export async function cancelCheckoutSession( resumeToken ) {
	return post( 'cancel', { resume_token: resumeToken } );
}
