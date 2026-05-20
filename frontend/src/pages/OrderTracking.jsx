/**
 * frontend/src/pages/OrderTracking.jsx
 *
 * Customer-facing order tracking page.
 *
 * Routes:
 *   /order-tracking/:id              — authenticated customer tracking
 *   /order-tracking/:id?order_key=…  — guest tracking via order key
 *
 * Behaviour:
 *   - Fetches the DTB tracking projection on mount
 *   - Subscribes to SSE for live updates (polling fallback when SSE unavailable)
 *   - Authenticated customers see full detail
 *   - Guests access via order_key URL param
 *   - Raw integration errors never rendered to customers
 *   - Skeleton UI while loading
 */

import { useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  ArrowLeft,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import SEOHead from '../components/shared/SEOHead';
import { useOrderStatus } from '../hooks/useOrderStatus.js';
import { useOrderEventStream } from '../hooks/useOrderEventStream.js';
import { ORDER_STATUS_LABELS, ORDER_TERMINAL_STATUSES } from '../api/orders.js';

// ─── Status icon map ─────────────────────────────────────────────────────────

const STATUS_ICONS = {
  pending:    Clock,
  'on-hold':  Clock,
  processing: Package,
  shipped:    Truck,
  completed:  CheckCircle,
  cancelled:  AlertCircle,
  refunded:   AlertCircle,
  failed:     AlertCircle,
};

const STATUS_COLORS = {
  pending:    'yellow',
  'on-hold':  'yellow',
  processing: 'blue',
  shipped:    'blue',
  completed:  'green',
  cancelled:  'red',
  refunded:   'gray',
  failed:     'red',
};

const COLOR_CLASSES = {
  yellow: 'bg-yellow-50  text-yellow-800  border-yellow-200',
  blue:   'bg-blue-50    text-blue-800    border-blue-200',
  green:  'bg-green-50   text-green-800   border-green-200',
  red:    'bg-red-50     text-red-800     border-red-200',
  gray:   'bg-gray-100   text-gray-700    border-gray-200',
};

// ─── Timeline event icon ──────────────────────────────────────────────────────

const TIMELINE_ICONS = {
  'order.created':           Package,
  'order.payment_confirmed': CheckCircle,
  'order.inventory_reserved': Package,
  'order.picked':            Package,
  'order.packed':            Package,
  'order.shipped':           Truck,
  'order.delivered':         CheckCircle,
  'order.completed':         CheckCircle,
  'order.cancelled':         AlertCircle,
  'order.refunded':          AlertCircle,
};

function TimelineIcon( { type } ) {
  const Icon = TIMELINE_ICONS[ type ] || Package;
  return <Icon size={ 16 } className="flex-shrink-0" />;
}

// ─── Skeleton UI ─────────────────────────────────────────────────────────────

function TrackingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="h-6 bg-gray-200 rounded w-32" />
      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        { [ 1, 2, 3 ].map( ( i ) => (
          <div key={ i } className="flex gap-3 items-center">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-gray-200 rounded w-40" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          </div>
        ) ) }
      </div>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge( { status, label } ) {
  const color = STATUS_COLORS[ status ] || 'gray';
  const Icon  = STATUS_ICONS[ status ] || Package;
  return (
    <span className={ `inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${ COLOR_CLASSES[ color ] }` }>
      <Icon size={ 14 } />
      { label || ORDER_STATUS_LABELS[ status ] || status }
    </span>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function OrderTimeline( { timeline } ) {
  if ( ! timeline?.length ) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Order Timeline</h3>
      <ol className="relative border-l border-gray-200 ml-3 space-y-4">
        { [ ...timeline ].reverse().map( ( event, i ) => (
          <li key={ i } className="ml-4">
            <div className="absolute -left-1.5 mt-1 flex items-center justify-center w-3 h-3 bg-blue-500 rounded-full ring-2 ring-white" />
            <div className="flex items-center gap-2">
              <TimelineIcon type={ event.type } />
              <p className="text-sm font-medium text-gray-900">{ event.label }</p>
            </div>
            <time className="text-xs text-gray-500">
              { event.occurred_at
                ? new Date( event.occurred_at ).toLocaleString()
                : '' }
            </time>
          </li>
        ) ) }
      </ol>
    </div>
  );
}

// ─── TrackingCard ─────────────────────────────────────────────────────────────

function TrackingCard( { tracking } ) {
  if ( ! tracking?.tracking_number ) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Truck size={ 16 } />
        Shipment Tracking
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500 w-32">Carrier:</span>
          <span className="font-medium">{ tracking.carrier || '—' }</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-32">Tracking #:</span>
          <span className="font-mono font-medium">{ tracking.tracking_number }</span>
        </div>
        { tracking.estimated_delivery && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-32">Est. Delivery:</span>
            <span className="font-medium">
              { new Date( tracking.estimated_delivery ).toLocaleDateString( undefined, { weekday: 'short', month: 'short', day: 'numeric' } ) }
            </span>
          </div>
        ) }
        { tracking.tracking_url && (
          <a
            href={ tracking.tracking_url }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:underline text-sm font-medium"
          >
            Track your package <ExternalLink size={ 12 } />
          </a>
        ) }
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrderTracking() {
  const { id }                   = useParams();
  const [ searchParams ]         = useSearchParams();
  const orderKey                 = searchParams.get( 'order_key' ) || '';

  const { data, loading, error, refresh } = useOrderStatus( id, orderKey );
  const { streaming }                      = useOrderEventStream( id, orderKey );

  // Refresh periodically when streaming is active as a lightweight heartbeat.
  // Use a long interval (60s) to catch any SSE frames that may have been missed,
  // without duplicating real-time updates.
  useEffect( () => {
    if ( ! streaming ) return;
    const timer = setInterval( refresh, 60_000 );
    return () => clearInterval( timer );
  }, [ streaming, refresh ] );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if ( loading && ! data ) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <SEOHead noindex title={ `Order #${ id } — Tracking` } />
        <div className="container mx-auto px-4 max-w-2xl">
          <TrackingSkeleton />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if ( error && ! data ) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <SEOHead noindex title="Order Tracking" />
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to load order tracking</h2>
            <p className="text-gray-600 mb-6">
              { error.includes( '401' ) || error.includes( 'Authentication' )
                ? 'Please log in to view your order.'
                : error.includes( '403' ) || error.includes( 'access' )
                ? 'You do not have access to this order.'
                : 'We\'re having trouble loading your tracking information. Please try again shortly.' }
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={ refresh }
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
              >
                Try Again
              </button>
              <Link
                to="/dashboard?tab=orders"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
              >
                My Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTerminal = data && ORDER_TERMINAL_STATUSES.includes( data.status );

  return (
    <div className="min-h-screen bg-gray-50 py-8 page-wrapper">
      <SEOHead noindex title={ `Order #${ id } — Tracking` } />
      <div className="container mx-auto px-4 max-w-2xl">

        {/* Back link */}
        <Link
          to="/dashboard?tab=orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft size={ 14 } /> Back to orders
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Order #{ id }</h1>
            { streaming && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            ) }
          </div>
          { data && (
            <StatusBadge status={ data.status } label={ data.label } />
          ) }
        </div>

        <div className="space-y-4">
          {/* Tracking card */}
          { data && <TrackingCard tracking={ data } /> }

          {/* Items */}
          { data?.items?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package size={ 16 } /> Items
              </h3>
              <ul className="space-y-2 text-sm">
                { data.items.map( ( item, i ) => (
                  <li key={ i } className="flex justify-between">
                    <span className="text-gray-800">{ item.name }</span>
                    <span className="text-gray-500">Qty: { item.quantity }</span>
                  </li>
                ) ) }
              </ul>
            </div>
          ) }

          {/* Timeline */}
          <OrderTimeline timeline={ data?.timeline } />

          {/* Placed / last updated */}
          { data && (
            <p className="text-xs text-gray-400 text-center pb-4">
              Placed { data.placed_at ? new Date( data.placed_at ).toLocaleString() : '—' }
              { data.last_updated_at && ` · Updated ${ new Date( data.last_updated_at ).toLocaleString() }` }
            </p>
          ) }

          {/* Actions */}
          <div className="flex gap-3 justify-center flex-wrap pt-2">
            { ! isTerminal && (
              <button
                onClick={ refresh }
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-all"
              >
                <Loader size={ 14 } /> Refresh
              </button>
            ) }
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
