import { useCallback, useEffect, useRef, useState } from 'react';

import { confirmCheckoutSession, createCheckoutSession, finalizeCheckout } from '../../../api/checkout.js';
import { CHECKOUT_STATES } from '../state/checkoutStates.js';

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

export function useCheckoutController({ quote, formData, couponCodes = [], paymentMethod = '', selectedRateId = '', idempotencyKey, onPaymentRequired, onComplete }) {
	const [state, setState] = useState( CHECKOUT_STATES.EDITING );
	const [error, setError] = useState( null );
	const [remoteSubmitting, setRemoteSubmitting] = useState( false );
	const submittingRef = useRef( false );
	const channelRef = useRef( null );
	const remoteTimerRef = useRef( null );

	useEffect( () => {
		if ( typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined' ) return undefined;
		const channel = new window.BroadcastChannel( 'dtb-checkout-submit-v1' );
		channelRef.current = channel;
		channel.onmessage = ( event ) => {
			if ( event.data?.type === 'start' ) {
				setRemoteSubmitting( true );
				window.clearTimeout( remoteTimerRef.current );
				remoteTimerRef.current = window.setTimeout( () => setRemoteSubmitting( false ), 30000 );
			}
			if ( event.data?.type === 'finish' ) {
				window.clearTimeout( remoteTimerRef.current );
				setRemoteSubmitting( false );
			}
		};
		return () => {
			window.clearTimeout( remoteTimerRef.current );
			channel.close();
			channelRef.current = null;
		};
	}, [] );

	const submitCheckout = useCallback( async ( validate ) => {
		if ( submittingRef.current || remoteSubmitting ) return { blocked: true };
		if ( typeof validate === 'function' && !validate() ) return { blocked: true };
		if ( !quote?.quote_id ) {
			const nextError = new Error( 'The server checkout quote is not ready.' );
			setError( nextError.message );
			setState( CHECKOUT_STATES.RECOVERABLE );
			throw nextError;
		}
		if ( !paymentMethod ) {
			const nextError = new Error( 'A verified payment method is required.' );
			setError( nextError.message );
			setState( CHECKOUT_STATES.FAILED );
			throw nextError;
		}

		const quoteRateId = String( quote.selected_rate_id || '' );
		const requestedRateId = String( selectedRateId || quoteRateId );
		if ( requestedRateId && quoteRateId !== requestedRateId ) {
			const nextError = new Error( 'Shipping options are still refreshing. Wait for the selected rate to finish updating.' );
			setError( nextError.message );
			setState( CHECKOUT_STATES.RECOVERABLE );
			throw nextError;
		}

		submittingRef.current = true;
		channelRef.current?.postMessage( { type: 'start' } );
		setError( null );
		try {
			setState( CHECKOUT_STATES.CONFIRMING );
			const address = addressFromForm( formData );
			const sessionResponse = await createCheckoutSession( {
				quote_id: quote.quote_id,
				billing: address,
				shipping: address,
				shipping_rate_id: requestedRateId,
				coupon_codes: couponCodes,
				payment_method: paymentMethod,
				customer_note: formData.customerNote || '',
				idempotency_key: idempotencyKey,
			} );
			const session = sessionResponse?.session;
			if ( !session?.resume_token || !session?.session_id ) throw new Error( 'Secure checkout session was not created.' );
			setState( CHECKOUT_STATES.SESSION_CREATED );
			const confirmation = await confirmCheckoutSession( { resume_token: session.resume_token } );
			if ( !confirmation?.confirmed ) throw new Error( 'Checkout confirmation failed.' );
			setState( CHECKOUT_STATES.FINALIZING );
			const response = await finalizeCheckout( { resume_token: session.resume_token, idempotency_key: idempotencyKey } );
			const order = response?.order || response?.finalize?.order || {};
			const result = { response, order, session, paymentUrl: order.payment_url || '' };
			if ( result.paymentUrl ) {
				setState( CHECKOUT_STATES.PAYMENT_READY );
				onPaymentRequired?.( result );
			} else {
				if ( order.payment_verified !== true && order.payment_required !== false ) {
					throw new Error( 'Verified payment handoff was not returned by the server.' );
				}
				setState( CHECKOUT_STATES.COMPLETE );
				onComplete?.( result );
			}
			return result;
		} catch ( nextError ) {
			setError( nextError?.message || 'Checkout failed.' );
			setState( nextError?.status === 409 ? CHECKOUT_STATES.RECOVERABLE : CHECKOUT_STATES.FAILED );
			throw nextError;
		} finally {
			submittingRef.current = false;
			channelRef.current?.postMessage( { type: 'finish' } );
		}
	}, [couponCodes, formData, idempotencyKey, onComplete, onPaymentRequired, paymentMethod, quote, remoteSubmitting, selectedRateId] );

	return {
		state,
		error,
		submitting: state === CHECKOUT_STATES.CONFIRMING || state === CHECKOUT_STATES.SESSION_CREATED || state === CHECKOUT_STATES.FINALIZING,
		paymentReady: state === CHECKOUT_STATES.PAYMENT_READY,
		submitCheckout,
	};
}

export default useCheckoutController;
