const PENDING_CHECKOUT_KEY = 'dtb:checkout:pending-payment:v2';

function canUseSessionStorage() {
	return typeof window !== 'undefined' && Boolean( window.sessionStorage );
}

export function makeCheckoutAttemptId() {
	const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: Math.random().toString( 36 ).slice( 2, 12 );
	return `checkout-${ Date.now() }-${ random }`;
}

export function readPendingCheckoutPayment() {
	// Legacy order-pay resume badges are retired. Same-shell checkout keeps payment
	// context in the active checkout runtime and must not resurrect stale order-pay
	// recovery links after refresh/navigation.
	clearPendingCheckoutPayment();
	return null;
}

export function writePendingCheckoutPayment() {
	// Do not persist resumable payment redirects. The WooPayments same-shell flow
	// either completes inside /checkout or shows an in-shell provider readiness
	// error without creating a legacy resume badge.
	clearPendingCheckoutPayment();
	return null;
}

export function clearPendingCheckoutPayment() {
	if ( !canUseSessionStorage() ) return;
	try {
		window.sessionStorage.removeItem( PENDING_CHECKOUT_KEY );
	} catch {
		// Non-fatal storage cleanup failure.
	}
}
