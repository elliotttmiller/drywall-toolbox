import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, Loader2, ShoppingBag } from 'lucide-react';

import SEOHead from '../components/shared/SEOHead.jsx';
import { getStripeEmbeddedCheckoutStatus } from '../api/checkout.js';
import { useCart } from '../context/CartContext.jsx';

const PAID_STATUSES = new Set(['processing', 'completed']);
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'refunded']);
const STATUS_POLL_MS = 2500;
const STATUS_MAX_POLLS = 8;

function resolveStatusState( order = null, checkout = null ) {
	if ( order?.payment_verified === true || PAID_STATUSES.has( String( order?.status || '' ).toLowerCase() ) ) return 'success';
	const normalized = String( order?.status || checkout?.state || '' ).toLowerCase();
	if ( FAILED_STATUSES.has( normalized ) || ['failed', 'expired'].includes( normalized ) ) return 'failed';
	if ( normalized === 'pending' || normalized === 'on-hold' || normalized === 'paid_awaiting_order' ) return 'pending';
	return 'unknown';
}

function StatusIcon({ state }) {
	if ( state === 'success' ) return <CheckCircle className="h-12 w-12 text-emerald-500" strokeWidth={1.8} />;
	if ( state === 'failed' ) return <AlertCircle className="h-12 w-12 text-red-500" strokeWidth={1.8} />;
	if ( state === 'pending' ) return <Clock className="h-12 w-12 text-amber-500" strokeWidth={1.8} />;
	return <Loader2 className="h-12 w-12 animate-spin text-primary-600" strokeWidth={1.8} />;
}

export default function CheckoutReturn({ fallbackState = 'complete' }) {
	const [searchParams] = useSearchParams();
	const { clearCart } = useCart();
	const stripeSessionId = searchParams.get( 'stripe_session_id' ) || searchParams.get( 'session_id' ) || '';
	const [loading, setLoading] = useState( Boolean( stripeSessionId ) );
	const [error, setError] = useState( null );
	const [order, setOrder] = useState( null );
	const [checkout, setCheckout] = useState( null );

	useEffect(() => {
		if ( !stripeSessionId ) return undefined;
		let cancelled = false;
		let pollCount = 0;
		let timeoutId = 0;

		const checkStatus = () => {
			setLoading( true );
			getStripeEmbeddedCheckoutStatus( stripeSessionId )
				.then( ( response ) => {
					if ( cancelled ) return;
					const nextOrder = response?.order || null;
					const nextCheckout = response?.checkout || null;
					setOrder( nextOrder );
					setCheckout( nextCheckout );
					setError( null );
					const state = resolveStatusState( nextOrder, nextCheckout );
					if ( state === 'success' ) {
						Promise.resolve( clearCart() ).catch( () => {} );
						return;
					}
					if ( state === 'pending' && pollCount < STATUS_MAX_POLLS ) {
						pollCount += 1;
						timeoutId = window.setTimeout( checkStatus, STATUS_POLL_MS );
					}
				} )
				.catch( ( requestError ) => {
					if ( !cancelled ) setError( requestError?.message || 'Unable to verify this checkout yet.' );
				} )
				.finally( () => {
					if ( !cancelled ) setLoading( false );
				} );
		};

		checkStatus();
		return () => {
			cancelled = true;
			window.clearTimeout( timeoutId );
		};
	}, [clearCart, stripeSessionId]);

	const inferredState = fallbackState === 'failed' || fallbackState === 'cancelled' ? 'failed' : 'pending';
	const state = order || checkout ? resolveStatusState( order, checkout ) : ( stripeSessionId ? ( loading ? 'unknown' : inferredState ) : inferredState );
	const title = state === 'success'
		? 'Payment received'
		: state === 'failed'
			? 'Payment was not completed'
			: state === 'pending'
				? 'Payment pending'
				: 'Checking payment status';
	const description = state === 'success'
		? 'Your order has been received and is now being processed. A confirmation email will be sent to your inbox.'
		: state === 'failed'
			? 'Stripe checkout was not completed. Return to checkout to retry with a fresh session.'
			: 'Stripe has not finished processing this checkout yet. This page will keep checking briefly.';
	const orderId = order?.order_id || '';

	return (
		<div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-16 page-wrapper">
			<SEOHead noindex title={title} />
			<div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-[0_18px_48px_rgba(15,23,42,0.10)] sm:p-10">
				<div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
					{loading && state === 'unknown' ? <Loader2 className="h-12 w-12 animate-spin text-primary-600" strokeWidth={1.8} /> : <StatusIcon state={state} />}
				</div>
				<p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary-600">Stripe Secure Checkout</p>
				<h1 className="mb-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{loading && state === 'unknown' ? 'Checking payment status…' : title}</h1>
				<p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-slate-600">{error || description}</p>

				{orderId ? (
					<div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm">
						<div className="flex items-center justify-between gap-3"><span className="text-slate-500">Order</span><span className="font-bold text-slate-950">#{orderId}</span></div>
						{order?.status ? <div className="mt-1 flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><span className="font-bold capitalize text-slate-950">{String( order.status ).replace( /-/g, ' ' )}</span></div> : null}
					</div>
				) : null}

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					{state !== 'success' ? (
						<Link to="/checkout" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-primary-700">
							Return to Checkout
						</Link>
					) : null}
					{state === 'success' && orderId ? (
						<Link to={`/order/${ orderId }`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-primary-700">
							View Order
						</Link>
					) : null}
					<Link to="/products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
						<ShoppingBag size={14} /> Continue Shopping
					</Link>
				</div>
			</div>
		</div>
	);
}
