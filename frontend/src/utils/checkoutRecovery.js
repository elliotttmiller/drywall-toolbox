export function makeCheckoutAttemptId() {
	const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: Math.random().toString( 36 ).slice( 2, 12 );
	return `checkout-${ Date.now() }-${ random }`;
}
