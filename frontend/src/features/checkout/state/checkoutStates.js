export const CHECKOUT_STATES = Object.freeze({
	LOADING_CART: 'loading_cart',
	EDITING: 'editing',
	QUOTING: 'quoting',
	READY: 'ready',
	CONFIRMING: 'confirming',
	SESSION_CREATED: 'session_created',
	FINALIZING: 'finalizing',
	PAYMENT_READY: 'payment_ready',
	PAYMENT_PROCESSING: 'payment_processing',
	PAYMENT_REQUIRED: 'payment_required',
	VERIFYING: 'verifying',
	COMPLETE: 'complete',
	FAILED: 'failed',
	RECOVERABLE: 'recoverable',
});

export const checkoutInitialState = Object.freeze({
	state: CHECKOUT_STATES.EDITING,
	quote: null,
	rates: [],
	error: null,
	requestId: 0,
});
