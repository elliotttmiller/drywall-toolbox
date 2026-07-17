/**
 * Server-authoritative checkout API.
 *
 * This module carries checkout intent and opaque session credentials only.
 * Prices, stock, tax, shipping, coupons, payment state, and order creation
 * are owned by the DTB backend.
 */
import { apiClient } from './client.js';
import { getCartToken, storeApiRequest } from './cart.js';
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

export async function requestCheckoutPaymentSurface( payload = {} ) {
	const response = await post( 'payment-surface', payload );
	return response?.payment_surface || response || {};
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

function normalizeStoreAddress(address = {}) {
	return {
		first_name: address.first_name || address.firstName || '',
		last_name: address.last_name || address.lastName || '',
		company: address.company || '',
		address_1: address.address_1 || address.address || '',
		address_2: address.address_2 || '',
		city: address.city || '',
		state: address.state || '',
		postcode: address.postcode || address.zip || '',
		country: address.country || 'US',
		email: address.email || '',
		phone: address.phone || '',
	};
}

function normalizePaymentData(paymentData = []) {
	if (Array.isArray(paymentData)) return paymentData;
	if (!paymentData || typeof paymentData !== 'object') return [];
	return Object.entries(paymentData).map(([key, value]) => ({ key, value }));
}

export async function processExistingOrderPayment({
	orderId,
	orderKey,
	billingEmail = '',
	billingAddress = {},
	shippingAddress = {},
	paymentMethod = '',
	paymentData = [],
	extensions = {},
	customerNote = '',
} = {}) {
	const id = Number(orderId);
	if (!Number.isInteger(id) || id <= 0) {
		throw Object.assign(new Error('A valid WooCommerce order id is required for in-checkout payment.'), { code: 'dtb_payment_order_required' });
	}
	if (!orderKey) {
		throw Object.assign(new Error('The WooCommerce order key is required for in-checkout payment.'), { code: 'dtb_payment_order_key_required' });
	}
	if (!paymentMethod) {
		throw Object.assign(new Error('A provider payment method is required for in-checkout payment.'), { code: 'dtb_payment_method_required' });
	}

	const billing = normalizeStoreAddress(billingAddress);
	const shipping = normalizeStoreAddress(shippingAddress);
	const email = billingEmail || billing.email;

	if (!email) {
		throw Object.assign(new Error('Billing email is required for in-checkout payment.'), { code: 'dtb_payment_email_required' });
	}

	return storeApiRequest(`/checkout/${id}`, {
		method: 'POST',
		body: JSON.stringify({
			key: orderKey,
			billing_email: email,
			billing_address: billing,
			shipping_address: shipping,
			customer_note: customerNote,
			payment_method: paymentMethod,
			payment_data: normalizePaymentData(paymentData),
			extensions,
		}),
	});
}
