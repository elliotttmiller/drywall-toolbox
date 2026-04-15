/**
 * frontend/src/pages/Orders.jsx
 *
 * Customer's order history page — /orders
 *
 * Fetches the authenticated user's WooCommerce orders via
 * GET /drywall/v1/orders?customer={id} and displays them in a paginated list.
 *
 * Auth: Redirects to /login if unauthenticated (via AccountLayout).
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Package, Clock, CheckCircle, AlertCircle, Truck, Loader, ChevronRight, ShoppingCart } from 'lucide-react';
import { useAuthContext } from '../auth/AuthContext.js';
import AccountLayout from '../components/AccountLayout.jsx';
import SEOHead from '../components/SEOHead';
import { getCustomerOrders } from '../api/orders.js';

// ─── Status badge helpers ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     color: '#d97706', bg: '#fffbeb', Icon: Clock         },
  processing: { label: 'Processing',  color: '#2563eb', bg: '#eff6ff', Icon: Package       },
  'on-hold':  { label: 'On Hold',     color: '#d97706', bg: '#fff7ed', Icon: Clock         },
  completed:  { label: 'Completed',   color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle   },
  cancelled:  { label: 'Cancelled',   color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle   },
  refunded:   { label: 'Refunded',    color: '#64748b', bg: '#f8fafc', Icon: AlertCircle   },
  failed:     { label: 'Failed',      color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle   },
  shipped:    { label: 'Shipped',     color: '#2563eb', bg: '#eff6ff', Icon: Truck         },
};

function StatusBadge( { status } ) {
  const cfg = STATUS_CONFIG[ status ] || { label: status, color: '#64748b', bg: '#f8fafc', Icon: Package };
  const { label, color, bg, Icon } = cfg;
  return (
    <span style={ {
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '4px',
      padding:       '3px 10px',
      borderRadius:  '999px',
      background:    bg,
      color,
      fontSize:      '0.7rem',
      fontWeight:    700,
      whiteSpace:    'nowrap',
    } }>
      <Icon size={ 11 } />
      { label }
    </span>
  );
}

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: ( delay ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [ 0.16, 1, 0.3, 1 ], delay: delay ?? 0 },
  } ),
};

const PER_PAGE = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Orders() {
  const { user } = useAuthContext();

  const [ orders,      setOrders      ] = useState( [] );
  const [ page,        setPage        ] = useState( 1 );
  const [ hasMore,     setHasMore     ] = useState( false );
  const [ loading,     setLoading     ] = useState( true );
  const [ loadingMore, setLoadingMore ] = useState( false );
  const [ error,       setError       ] = useState( null );

  const loadPage = useCallback( async ( pageNum, append = false ) => {
    if ( ! user?.id ) return;
    append ? setLoadingMore( true ) : setLoading( true );
    setError( null );
    try {
      const data    = await getCustomerOrders( user.id, pageNum, PER_PAGE );
      const fetched = Array.isArray( data ) ? data : ( data?.orders ?? [] );
      setOrders( ( prev ) => append ? [ ...prev, ...fetched ] : fetched );
      setHasMore( fetched.length === PER_PAGE );
      setPage( pageNum );
    } catch ( err ) {
      setError( err.message || 'Unable to load orders.' );
    } finally {
      append ? setLoadingMore( false ) : setLoading( false );
    }
  }, [ user?.id ] );

  useEffect( () => { loadPage( 1 ); }, [ loadPage ] );

  return (
    <AccountLayout title="My Orders" subtitle="View and track your order history">
      <SEOHead noindex title="My Orders" />

      { error && (
        <div style={ { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px', color: '#dc2626', fontSize: '0.85rem' } }>
          { error }
        </div>
      ) }

      { loading ? (
        <div style={ { display: 'flex', alignItems: 'center', gap: '10px', padding: '32px 0', justifyContent: 'center' } }>
          <Loader size={ 22 } className="animate-spin" style={ { color: '#2563eb' } } />
          <span style={ { color: 'rgba(15,23,42,0.5)', fontSize: '0.9rem' } }>Loading orders…</span>
        </div>
      ) : orders.length === 0 ? (
        <Motion.div custom={ 0 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ {
            background:   'white',
            border:       '1px solid rgba(15,23,42,0.08)',
            borderRadius: '14px',
            padding:      '48px 24px',
            textAlign:    'center',
            boxShadow:    '0 2px 14px rgba(15,23,42,0.05)',
          } }
        >
          <Package size={ 40 } style={ { color: 'rgba(15,23,42,0.18)', margin: '0 auto 16px', display: 'block' } } />
          <h2 style={ { fontSize: '1rem', fontWeight: 750, color: '#0f172a', margin: '0 0 8px' } }>No orders yet</h2>
          <p style={ { fontSize: '0.85rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 20px' } }>
            Your order history will appear here after your first purchase.
          </p>
          <Link
            to="/products"
            style={ {
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '6px',
              background:     '#2563eb',
              color:          'white',
              padding:        '9px 20px',
              borderRadius:   '8px',
              fontSize:       '0.85rem',
              fontWeight:     650,
              textDecoration: 'none',
              transition:     'background 0.15s',
            } }
          >
            <ShoppingCart size={ 14 } /> Browse Products
          </Link>
        </Motion.div>
      ) : (
        <div style={ { display: 'flex', flexDirection: 'column', gap: '10px' } }>
          { orders.map( ( order, i ) => (
            <Motion.div
              key={ order.id }
              custom={ i * 0.04 }
              variants={ fadeUp }
              initial="hidden"
              animate="visible"
              style={ {
                background:   'white',
                border:       '1px solid rgba(15,23,42,0.08)',
                borderRadius: '12px',
                boxShadow:    '0 2px 12px rgba(15,23,42,0.05)',
                overflow:     'hidden',
              } }
            >
              <Link to={ `/order/${ order.id }` } style={ { textDecoration: 'none', display: 'block', padding: '15px 18px' } }>
                <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' } }>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '12px' } }>
                    <div style={ { width: '38px', height: '38px', borderRadius: '9px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                      <Package size={ 16 } style={ { color: '#2563eb' } } />
                    </div>
                    <div>
                      <div style={ { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' } }>
                        <span style={ { fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' } }>Order #{ order.id }</span>
                        <StatusBadge status={ order.status } />
                      </div>
                      <p style={ { margin: 0, fontSize: '0.75rem', color: 'rgba(15,23,42,0.42)' } }>
                        { order.date_created ? new Date( order.date_created ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'short', day: 'numeric' } ) : '' }
                        { order.line_items?.length > 0 && ` · ${ order.line_items.length } item${ order.line_items.length !== 1 ? 's' : '' }` }
                      </p>
                    </div>
                  </div>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
                    <span style={ { fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' } }>
                      ${ parseFloat( order.total ?? 0 ).toFixed( 2 ) }
                    </span>
                    <ChevronRight size={ 15 } style={ { color: 'rgba(15,23,42,0.28)' } } />
                  </div>
                </div>
              </Link>
            </Motion.div>
          ) ) }

          { hasMore && (
            <button
              type="button"
              onClick={ () => loadPage( page + 1, true ) }
              disabled={ loadingMore }
              style={ {
                marginTop:      '4px',
                display:        'flex',
                alignItems:     'center',
                gap:            '6px',
                justifyContent: 'center',
                padding:        '12px',
                borderRadius:   '10px',
                border:         '1px solid rgba(15,23,42,0.1)',
                background:     'white',
                fontSize:       '0.85rem',
                fontWeight:     650,
                color:          '#2563eb',
                cursor:         'pointer',
                transition:     'background 0.15s',
              } }
            >
              { loadingMore
                ? <><Loader size={ 14 } className="animate-spin" /> Loading…</>
                : 'Load more orders' }
            </button>
          ) }
        </div>
      ) }
    </AccountLayout>
  );
}

// ─── Status badge helpers ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     color: 'yellow', Icon: Clock         },
  processing: { label: 'Processing',  color: 'blue',   Icon: Package       },
  'on-hold':  { label: 'On Hold',     color: 'orange', Icon: Clock         },
  completed:  { label: 'Completed',   color: 'green',  Icon: CheckCircle   },
  cancelled:  { label: 'Cancelled',   color: 'red',    Icon: AlertCircle   },
  refunded:   { label: 'Refunded',    color: 'gray',   Icon: AlertCircle   },
  failed:     { label: 'Failed',      color: 'red',    Icon: AlertCircle   },
  shipped:    { label: 'Shipped',     color: 'blue',   Icon: Truck         },
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
  const cfg = STATUS_CONFIG[ status ] || { label: status, color: 'gray', Icon: Package };
  const { label, color, Icon } = cfg;
  return (
    <span className={ `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${ COLOR_CLASSES[ color ] }` }>
      <Icon size={ 11 } />
      { label }
    </span>
  );
}

const cardVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: ( delay ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [ 0.16, 1, 0.3, 1 ], delay: delay ?? 0 },
  } ),
};

const PER_PAGE = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Orders() {
  const navigate                          = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuthContext();

  const [orders,       setOrders     ] = useState( [] );
  const [page,         setPage       ] = useState( 1 );
  const [hasMore,      setHasMore    ] = useState( false );
  const [loading,      setLoading    ] = useState( true );
  const [loadingMore,  setLoadingMore ] = useState( false );
  const [error,        setError      ] = useState( null );

  useEffect( () => {
    if ( ! isLoading && ! isAuthenticated ) {
      navigate( '/login', { replace: true } );
    }
  }, [ isLoading, isAuthenticated, navigate ] );

  const loadPage = useCallback( async ( pageNum, append = false ) => {
    if ( ! user?.id ) return;
    append ? setLoadingMore( true ) : setLoading( true );
    setError( null );
    try {
      const data = await getCustomerOrders( user.id, pageNum, PER_PAGE );
      const fetched = Array.isArray( data ) ? data : ( data?.orders ?? [] );
      setOrders( ( prev ) => append ? [ ...prev, ...fetched ] : fetched );
      setHasMore( fetched.length === PER_PAGE );
      setPage( pageNum );
    } catch ( err ) {
      setError( err.message || 'Unable to load orders.' );
    } finally {
      append ? setLoadingMore( false ) : setLoading( false );
    }
  }, [ user?.id ] );

  useEffect( () => {
    loadPage( 1 );
  }, [ loadPage ] );

  if ( isLoading || ( loading && orders.length === 0 ) ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div style={ { textAlign: 'center' } }>
          <Loader className="animate-spin text-primary-600 mx-auto mb-4" size={ 36 } />
          <p style={ { color: 'rgba(15,23,42,0.5)', fontSize: '0.9rem' } }>Loading orders…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f8fafc' } }>
      <SEOHead noindex title="My Orders" />

      {/* Hero strip */}
      <div style={ {
        background:  'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding:     'clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem) clamp(2rem, 5vw, 3.5rem)',
        position:    'relative',
        overflow:    'hidden',
      } }>
        <div style={ { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)', backgroundSize: '40px 40px', pointerEvents: 'none' } } />
        <div style={ { position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' } }>
          <Motion.div initial={ { opacity: 0, y: 14 } } animate={ { opacity: 1, y: 0 } } transition={ { duration: 0.5, ease: [ 0.16, 1, 0.3, 1 ] } }>
            <h1 style={ { color: 'white', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' } }>
              My Orders
            </h1>
          </Motion.div>
        </div>
      </div>

      <div style={ { maxWidth: '900px', margin: '0 auto', padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 2.5rem)' } }>

        { error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            { error }
          </div>
        ) }

        { orders.length === 0 && ! loading ? (
          <Motion.div custom={ 0 } variants={ cardVariants } initial="hidden" animate="visible"
            style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' } }
          >
            <Package size={ 40 } style={ { color: 'rgba(15,23,42,0.2)', margin: '0 auto 16px' } } />
            <h2 style={ { fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' } }>No orders yet</h2>
            <p style={ { fontSize: '0.875rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 20px' } }>
              Your order history will appear here after your first purchase.
            </p>
            <Link to="/products" className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all">
              Browse Products <ChevronRight size={ 14 } />
            </Link>
          </Motion.div>
        ) : (
          <div style={ { display: 'flex', flexDirection: 'column', gap: '12px' } }>
            { orders.map( ( order, i ) => (
              <Motion.div
                key={ order.id }
                custom={ i * 0.05 }
                variants={ cardVariants }
                initial="hidden"
                animate="visible"
                style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', overflow: 'hidden' } }
              >
                <Link to={ `/order/${ order.id }` } style={ { textDecoration: 'none', display: 'block', padding: '16px 20px' } }>
                  <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' } }>
                    <div>
                      <div style={ { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' } }>
                        <span style={ { fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' } }>Order #{ order.id }</span>
                        <StatusBadge status={ order.status } />
                      </div>
                      <p style={ { margin: 0, fontSize: '0.78rem', color: 'rgba(15,23,42,0.45)' } }>
                        { order.date_created ? new Date( order.date_created ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'short', day: 'numeric' } ) : '' }
                        { order.line_items?.length > 0 && ` · ${ order.line_items.length } item${ order.line_items.length !== 1 ? 's' : '' }` }
                      </p>
                    </div>
                    <div style={ { display: 'flex', alignItems: 'center', gap: '12px' } }>
                      <span style={ { fontWeight: 800, color: 'var(--primary-600)', fontSize: '1rem' } }>
                        ${ parseFloat( order.total ?? 0 ).toFixed( 2 ) }
                      </span>
                      <ChevronRight size={ 16 } style={ { color: 'rgba(15,23,42,0.3)' } } />
                    </div>
                  </div>
                </Link>
              </Motion.div>
            ) ) }

            { hasMore && (
              <button
                type="button"
                onClick={ () => loadPage( page + 1, true ) }
                disabled={ loadingMore }
                style={ { marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', padding: '12px', borderRadius: '8px', border: '1px solid rgba(15,23,42,0.12)', background: 'white', fontSize: '0.85rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer', transition: 'background 0.15s' } }
              >
                { loadingMore ? <><Loader size={ 14 } className="animate-spin" /> Loading…</> : 'Load more orders' }
              </button>
            ) }
          </div>
        ) }

        <div style={ { marginTop: '24px' } }>
          <Link to="/dashboard" style={ { fontSize: '0.85rem', fontWeight: 600, color: 'rgba(15,23,42,0.5)', textDecoration: 'none' } }>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
