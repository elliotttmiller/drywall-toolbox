import { CHECKOUT_STATES, checkoutInitialState } from './checkoutStates.js';

export function checkoutReducer(state = checkoutInitialState, action = {}) {
	switch ( action.type ) {
		case 'QUOTE_START':
			return {
				...state,
				state: CHECKOUT_STATES.QUOTING,
				quote: null,
				rates: [],
				error: null,
				requestId: action.requestId,
			};
		case 'QUOTE_SUCCESS':
			return {
				...state,
				state: CHECKOUT_STATES.READY,
				quote: action.quote,
				rates: Array.isArray( action.quote?.rates ) ? action.quote.rates : [],
				error: null,
				requestId: action.requestId,
			};
		case 'QUOTE_FAILURE':
			return { ...state, state: CHECKOUT_STATES.RECOVERABLE, quote: null, rates: [], error: action.error || 'Checkout quote failed.', requestId: action.requestId };
		case 'QUOTE_RESET':
			return { ...state, state: CHECKOUT_STATES.EDITING, quote: null, rates: [], error: null, requestId: action.requestId };
		case 'CHECKOUT_FAILED':
			return { ...state, state: CHECKOUT_STATES.FAILED, error: action.error || 'Checkout failed.' };
		case 'CHECKOUT_COMPLETE':
			return { ...state, state: CHECKOUT_STATES.COMPLETE, error: null };
		default:
			return state;
	}
}
