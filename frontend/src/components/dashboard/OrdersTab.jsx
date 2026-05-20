/**
 * frontend/src/components/dashboard/OrdersTab.jsx
 *
 * Dashboard Orders tab — paginated order history.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Package, Clock, CheckCircle, AlertCircle, Truck, Loader, ChevronRight, ShoppingCart } from 'lucide-react';
import { getOrders } from '../../api/orders.js';

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.36, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const STATUS_CFG = {
  pending:    { label: 'Pending',    color: '#d97706', bg: '#fffbeb', Icon: Clock       },
  processing: { label: 'Processing', color: '#2563eb', bg: '#eff6ff', Icon: Package     },
  'on-hold':  { label: 'On Hold',    color: '#d97706', bg: '#fff7ed', Icon: Clock       },
  completed:  { label: 'Completed',  color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle },
  refunded:   { label: 'Refunded',   color: '#64748b', bg: '#f8fafc', Icon: AlertCircle },
  shipped:    { label: 'Shipped',    color: '#2563eb', bg: '#eff6ff', Icon: Truck       },
  failed:     { label: 'Failed',     color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle },
};

function StatusBadge( { status } ) {
  const cfg = STATUS_CFG[ status ] || { label: status, color: '#64748b', bg: '#f8fafc', Icon: Package };
  return (
    <span style={ {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: '999px', background: cfg.bg, color: cfg.color,
      fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
    } }>
      <cfg.Icon size={ 10 } />{ cfg.label }
    </span>
  );
}

const PER_PAGE = 20;

export default function OrdersTab( { userId } ) {
  const [ orders,      setOrders      ] = useState( [] );
  const [ page,        setPage        ] = useState( 1 );
  const [ hasMore,     setHasMore     ] = useState( false );
  const [ loading,     setLoading     ] = useState( true );
  const [ loadingMore, setLoadingMore ] = useState( false );
  const [ error,       setError       ] = useState( null );

  const loadPage = useCallback( async ( pageNum, append = false ) => {
    if ( ! userId ) return;
    append ? setLoadingMore( true ) : setLoading( true );
    setError( null );
    try {
      const data    = await getOrders( pageNum, PER_PAGE );
      const fetched = Array.isArray( data ) ? data : ( data?.orders ?? [] );
      setOrders( ( prev ) => append ? [ ...prev, ...fetched ] : fetched );
      setHasMore( fetched.length === PER_PAGE );
      setPage( pageNum );
    } catch ( err ) {
      setError( err.message || 'Unable to load orders.' );
    } finally {
      append ? setLoadingMore( false ) : setLoading( false );
    }
  }, [ userId ] );

  useEffect( () => { loadPage( 1 ); }, [ loadPage ] );

  if ( loading ) {
    return (
      <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '48px 0' } }>
        <Loader size={ 20 } className="animate-spin" style={ { color: '#2563eb' } } />
        <span style={ { fontSize: '0.875rem', color: 'rgba(15,23,42,0.45)' } }>Loading orders…</span>
      </div>
    );
  }

  return (
    <div style={ { display: 'flex', flexDirection: 'column', gap: '10px' } }>

      { error && (
        <div style={ { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.83rem' } }>
          { error }
        </div>
      ) }

      { orders.length === 0 ? (
        <Motion.div custom={ 0 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' } }
        >
          <Package size={ 38 } style={ { color: 'rgba(15,23,42,0.15)', display: 'block', margin: '0 auto 14px' } } />
          <h3 style={ { fontSize: '0.95rem', fontWeight: 750, color: '#0f172a', margin: '0 0 8px' } }>No orders yet</h3>
          <p style={ { fontSize: '0.83rem', color: 'rgba(15,23,42,0.45)', margin: '0 0 20px' } }>
            Your order history will appear here after your first purchase.
          </p>
          <Link to="/products" style={ { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2563eb', color: 'white', padding: '9px 18px', borderRadius: '8px', fontSize: '0.83rem', fontWeight: 650, textDecoration: 'none' } }>
            <ShoppingCart size={ 13 } /> Browse Products
          </Link>
        </Motion.div>
      ) : (
        <>
          { orders.map( ( order, i ) => (
            <Motion.div
              key={ order.id }
              custom={ i * 0.03 }
              variants={ fadeUp }
              initial="hidden"
              animate="visible"
              style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '11px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', overflow: 'hidden' } }
            >
              <div style={ { display: 'flex', alignItems: 'stretch', overflow: 'hidden' } }>
                <Link to={ `/order/${ order.id }` } style={ { textDecoration: 'none', flex: 1, display: 'block', padding: '14px 16px' } }>
                <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' } }>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '11px' } }>
                    <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                      <Package size={ 15 } style={ { color: '#2563eb' } } />
                    </div>
                    <div>
                      <div style={ { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' } }>
                        <span style={ { fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' } }>Order #{ order.id }</span>
                        <StatusBadge status={ order.status } />
                      </div>
                      <p style={ { margin: 0, fontSize: '0.73rem', color: 'rgba(15,23,42,0.4)' } }>
                        { order.date_created ? new Date( order.date_created ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'short', day: 'numeric' } ) : '' }
                        { order.items_count > 0 && ` · ${ order.items_count } item${ order.items_count !== 1 ? 's' : '' }` }
                        { order.line_items?.length > 0 && ! order.items_count && ` · ${ order.line_items.length } item${ order.line_items.length !== 1 ? 's' : '' }` }
                      </p>
                    </div>
                  </div>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
                    <span style={ { fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' } }>${ parseFloat( order.total ?? 0 ).toFixed( 2 ) }</span>
                    <ChevronRight size={ 14 } style={ { color: 'rgba(15,23,42,0.25)' } } />
                  </div>
                </div>
                </Link>
                { ( order.status === 'processing' || order.status === 'shipped' ) && (
                  <Link
                    to={ `/order-tracking/${ order.id }` }
                    title="Track order"
                    style={ { display: 'flex', alignItems: 'center', padding: '0 14px', borderLeft: '1px solid rgba(15,23,42,0.06)', color: '#2563eb', textDecoration: 'none', fontSize: '0.72rem', fontWeight: 650, flexShrink: 0 } }
                  >
                    <Truck size={ 13 } style={ { marginRight: '4px' } } />Track
                  </Link>
                ) }
              </div>
            </Motion.div>
          ) ) }

          { hasMore && (
            <button
              type="button"
              onClick={ () => loadPage( page + 1, true ) }
              disabled={ loadingMore }
              style={ { display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', padding: '12px', borderRadius: '10px', border: '1px solid rgba(15,23,42,0.1)', background: 'white', fontSize: '0.83rem', fontWeight: 650, color: '#2563eb', cursor: 'pointer' } }
            >
              { loadingMore ? <><Loader size={ 13 } className="animate-spin" /> Loading…</> : 'Load more orders' }
            </button>
          ) }
        </>
      ) }
    </div>
  );
}
