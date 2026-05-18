/**
 * frontend/src/pages/OrderConfirmation.jsx
 *
 * Order status page: /order/:id
 *
 * Fetches the WooCommerce order via the drywall/v1 proxy.
 * The proxy endpoint (GET /drywall/v1/orders/{id}) is JWT-gated, so this page
 * is only fully functional for authenticated customers.
 *
 * Guest customers can still see the summary shown on the Checkout success
 * screen; this page provides the persistent "order status" URL.
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getOrder } from '../api/orders.js';
import {
  CheckCircle,
  Clock,
  Package,
  Truck,
  AlertCircle,
  Loader,
  ArrowLeft,
  Star,
} from 'lucide-react';
import SEOHead from '../components/shared/SEOHead';
import { calculatePointsEarned, pointsToUsd } from '../api/rewards.js';

// ─── Status badge helpers ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:           { label: 'Pending Payment',    color: 'yellow', Icon: Clock         },
  processing:        { label: 'Processing',          color: 'blue',   Icon: Package       },
  'on-hold':         { label: 'On Hold',             color: 'orange', Icon: Clock         },
  completed:         { label: 'Completed',           color: 'green',  Icon: CheckCircle   },
  cancelled:         { label: 'Cancelled',           color: 'red',    Icon: AlertCircle   },
  refunded:          { label: 'Refunded',            color: 'gray',   Icon: AlertCircle   },
  failed:            { label: 'Payment Failed',      color: 'red',    Icon: AlertCircle   },
  shipped:           { label: 'Shipped',             color: 'blue',   Icon: Truck         },
  // ── Repair-specific WooCommerce statuses ──────────────────────────────────
  'repair-received': { label: 'Repair Received',     color: 'blue',   Icon: Package       },
  'repair-in-progress': { label: 'Repair In Progress', color: 'blue', Icon: Package      },
  'repair-awaiting-approval': { label: 'Awaiting Your Approval', color: 'orange', Icon: Clock },
  'repair-approved': { label: 'Repair Approved',    color: 'blue',   Icon: Package       },
  'repair-complete': { label: 'Repair Complete',    color: 'green',  Icon: CheckCircle   },
  'repair-shipped':  { label: 'Tool Shipped Back',  color: 'green',  Icon: Truck         },
};

const COLOR_CLASSES = {
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  blue:   'bg-blue-50   text-blue-800   border-blue-200',
  orange: 'bg-orange-50 text-orange-800 border-orange-200',
  green:  'bg-green-50  text-green-800  border-green-200',
  red:    'bg-red-50    text-red-800    border-red-200',
  gray:   'bg-gray-100  text-gray-800   border-gray-200',
};

function StatusBadge( { status } ) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'gray', Icon: Package };
  const { label, color, Icon } = cfg;
  return (
    <span className={ `inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${ COLOR_CLASSES[color] }` }>
      <Icon size={ 14 } />
      { label }
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderConfirmation() {
  const { id }                            = useParams();
  const navigate                          = useNavigate();
  const [order,    setOrder   ]           = useState( null );
  const [loading,  setLoading ]           = useState( true );
  const [error,    setError   ]           = useState( null );

  useEffect( () => {
    if ( ! id ) return;

    let cancelled = false;

    getOrder( id )
      .then( ( data ) => {
        if ( ! cancelled ) setOrder( data );
      } )
      .catch( ( err ) => {
        if ( ! cancelled ) {
          if ( err.status === 401 ) {
            setError( 'Please log in to view order details.' );
          } else {
            setError( err.message || 'Unable to load order details.' );
          }
        }
      } )
      .finally( () => {
        if ( ! cancelled ) setLoading( false );
      } );

    return () => { cancelled = true; };
  }, [id] );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if ( loading ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if ( error ) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to load order</h2>
            <p className="text-gray-600 mb-6">{ error }</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={ () => navigate( -1 ) }
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-5 py-3 rounded-lg font-semibold transition-all"
              >
                <ArrowLeft size={ 16 } /> Go Back
              </button>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-lg font-semibold transition-all"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Order detail ─────────────────────────────────────────────────────────────
  const billing  = order?.billing  || {};
  const lineItems = order?.line_items || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 page-wrapper">
      <SEOHead noindex title={`Order #${id}`} />
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Order #{ id }</h1>
          { order?.status && <StatusBadge status={ order.status } /> }
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Items Ordered</h2>
            <div className="space-y-3">
              { lineItems.map( ( item ) => (
                <div key={ item.id } className="flex justify-between text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{ item.name }</p>
                    <p className="text-gray-500">Qty: { item.quantity }</p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ${ parseFloat( item.total || 0 ).toFixed( 2 ) }
                  </p>
                </div>
              ) ) }
            </div>

            { order && (
              <div className="border-t border-gray-200 mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>${ parseFloat( order.subtotal || 0 ).toFixed( 2 ) }</span>
                </div>
                { order.shipping_total && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span>
                      { parseFloat( order.shipping_total ) === 0
                        ? <span className="text-green-600">FREE</span>
                        : `$${ parseFloat( order.shipping_total ).toFixed( 2 ) }` }
                    </span>
                  </div>
                ) }
                { order.total_tax && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span>${ parseFloat( order.total_tax ).toFixed( 2 ) }</span>
                  </div>
                ) }
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary-600">${ parseFloat( order.total || 0 ).toFixed( 2 ) }</span>
                </div>
              </div>
            ) }
          </div>

          {/* Billing Address */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Billing &amp; Contact</h2>
            { billing.email && (
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">Email:</span> { billing.email }
              </p>
            ) }
            { ( billing.first_name || billing.last_name ) && (
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">Name:</span>{' '}
                { billing.first_name } { billing.last_name }
              </p>
            ) }
            { billing.address_1 && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Address:</span>{' '}
                { [billing.address_1, billing.city, billing.state, billing.postcode]
                    .filter( Boolean )
                    .join( ', ' ) }
              </p>
            ) }

            { order?.payment_method_title && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Payment:</span>{' '}
                  { order.payment_method_title }
                </p>
              </div>
            ) }

            { order?.date_created && (
              <p className="text-xs text-gray-500 mt-3">
                Placed on { new Date( order.date_created ).toLocaleString() }
              </p>
            ) }
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center mt-8 flex-wrap">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
          >
            Continue Shopping
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-semibold transition-all"
          >
            Back to Home
          </Link>
        </div>

        {/* Points earned notice */}
        { order?.status === 'completed' && order?.total && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 max-w-md mx-auto">
            <Star size={ 18 } style={ { color: '#16a34a', flexShrink: 0 } } />
            <div>
              <p className="text-sm font-semibold text-green-800">
                +{ calculatePointsEarned( parseFloat( order.total ) ) } points earned on this order!
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                That's ${ pointsToUsd( calculatePointsEarned( parseFloat( order.total ) ) ).toFixed( 2 ) } toward your next order.&nbsp;
                <Link to="/dashboard?tab=rewards" className="underline font-semibold">View your balance</Link>
              </p>
            </div>
          </div>
        ) }
      </div>
    </div>
  );
}
