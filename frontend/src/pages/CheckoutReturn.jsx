import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, Loader2, ShoppingBag } from 'lucide-react';

import SEOHead from '../components/shared/SEOHead.jsx';
import { getCheckoutStatus } from '../api/checkout.js';
import { useCart } from '../context/CartContext.jsx';
import { clearPendingCheckoutPayment, readPendingCheckoutPayment } from '../utils/checkoutRecovery.js';

const PAID_STATUSES = new Set(['processing', 'completed']);
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'refunded']);

function resolveStatusState( order = null ) {
	if ( order?.payment_verified === true || ( order?.payment_required === false && PAID_STATUSES.has( String( order?.status || '' ).toLowerCase() ) ) ) return 'success';
	const normalized = String( order?.status || '' ).toLowerCase();
	if ( FAILED_STATUSES.has( normalized ) ) return 'failed';
	if ( normalized === 'pending' || normalized === 'on-hold' ) return 'pending';
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
	const pendingPayment = useMemo(() => readPendingCheckoutPayment(), []);
	const resumeToken = pendingPayment?.resumeToken || searchParams.get( 'resume_token' ) || '';
	const [loading, setLoading] = useState( Boolean( resumeToken ) );
	const [error, setError] = useState( null );
	const [order, setOrder] = useState( null );

	useEffect(() => {
		if ( !resumeToken ) return undefined;
		let cancelled = false;
		getCheckoutStatus( resumeToken )
			.then( ( response ) => {
				if ( cancelled ) return;
				const nextOrder = response?.order || null;
				setOrder( nextOrder );
				if ( resolveStatusState( nextOrder ) === 'success' ) {
					clearPendingCheckoutPayment();
					Promise.resolve( clearCart() ).catch( () => {} );
				}
			} )
			.catch( ( requestError ) => {
				if ( !cancelled ) setError( requestError?.message || 'Unable to verify this payment yet.' );
			} )
			.finally( () => {
				if ( !cancelled ) setLoading( false );
			} );
		return () => { cancelled = true; };
	}, [clearCart, resumeToken]);

	const inferredState = fallbackState === 'failed' || fallbackState === 'cancelled' ? 'failed' : 'pending';
	const state = order ? resolveStatusState( order ) : ( resumeToken ? ( loading ? 'unknown' : inferredState ) : inferredState );
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
			? 'Your order was created, but payment was not completed. Return to checkout to try your payment again.'
			: 'Your order was created and payment is still pending. Return to checkout to complete your payment.';
	const orderId = order?.order_id || '';

	return (
		<div className="dtb-checkout min-h-screen bg-slate-50 flex items-center justify-center px-4 py-16 page-wrapper">
			<SEOHead noindex title={title} />
			<div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-[0_18px_48px_rgba(15,23,42,0.10)] sm:p-10">
				<div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
					{loading ? <Loader2 className="h-12 w-12 animate-spin text-primary-600" strokeWidth={1.8} /> : <StatusIcon state={state} />}
				</div>
				<p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary-600">Secure Checkout</p>
				<h1 className="mb-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{loading ? 'Checking payment status…' : title}</h1>
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
