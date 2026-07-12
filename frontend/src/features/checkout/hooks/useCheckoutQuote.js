import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { createCheckoutQuote } from '../../../api/checkout.js';
import { checkoutInitialState } from '../state/checkoutStates.js';
import { checkoutReducer } from '../state/checkoutReducer.js';

const QUOTE_DEBOUNCE_MS = 650;

function addressFromForm( form = {} ) {
	return {
		first_name: form.firstName || '',
		last_name: form.lastName || '',
		address_1: form.address || '',
		address_2: '',
		city: form.city || '',
		state: form.state || '',
		postcode: form.zip || '',
		country: form.country || 'US',
		email: form.email || '',
		phone: form.phone || '',
	};
}

function isStaleShippingRateError( error ) {
	return Number( error?.status || 0 ) === 409 && error?.code === 'dtb_checkout_shipping_rate_changed';
}

export function useCheckoutQuote({ formData, couponCodes = [], selectedRateId = '', cartItems = [], isAddressComplete = false }) {
	const [state, dispatch] = useReducer( checkoutReducer, checkoutInitialState );
	const [loading, setLoading] = useState( false );
	const requestSeq = useRef( 0 );

	const refreshQuote = useCallback( async ( preferredRateId ) => {
		const requestId = requestSeq.current + 1;
		requestSeq.current = requestId;
		if ( !isAddressComplete ) {
			dispatch( { type: 'QUOTE_RESET', requestId } );
			return null;
		}
		setLoading( true );
		dispatch( { type: 'QUOTE_START', requestId } );
		const address = addressFromForm( formData );
		const requestedRateId = preferredRateId === undefined ? selectedRateId : preferredRateId;
		const payload = {
			billing: address,
			shipping: address,
			coupon_codes: couponCodes,
			shipping_rate_id: requestedRateId,
		};
		try {
			let quote;
			try {
				quote = await createCheckoutQuote( payload );
			} catch ( error ) {
				if ( !requestedRateId || !isStaleShippingRateError( error ) ) throw error;
				quote = await createCheckoutQuote( { ...payload, shipping_rate_id: '' } );
			}
			if ( requestId !== requestSeq.current ) return null;
			dispatch( { type: 'QUOTE_SUCCESS', quote, requestId } );
			return quote;
		} catch ( error ) {
			if ( requestId !== requestSeq.current ) return null;
			dispatch( { type: 'QUOTE_FAILURE', error: error?.message || 'Could not verify server checkout values.', requestId } );
			throw error;
		} finally {
			if ( requestId === requestSeq.current ) setLoading( false );
		}
	}, [couponCodes, formData, isAddressComplete, selectedRateId] );

	useEffect( () => {
		if ( !isAddressComplete ) {
			requestSeq.current += 1;
			dispatch( { type: 'QUOTE_RESET', requestId: requestSeq.current } );
			return undefined;
		}
		const timer = window.setTimeout( () => { refreshQuote( selectedRateId ).catch( () => {} ); }, QUOTE_DEBOUNCE_MS );
		return () => {
			window.clearTimeout( timer );
			requestSeq.current += 1;
		};
	}, [cartItems, isAddressComplete, refreshQuote, selectedRateId] );

	return {
		quote: state.quote,
		rates: state.rates,
		quoteState: state.state,
		quoteError: state.error,
		loading,
		refreshQuote,
	};
}

export default useCheckoutQuote;
