/**
 * frontend/src/components/dashboard/OverviewTab.jsx
 *
 * Dashboard Overview tab — stats, recent orders, account info.
 */

import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  Package, Clock, CheckCircle, Star, ShoppingCart,
  ChevronRight, Loader, CreditCard, Wrench,
} from 'lucide-react';
import { pointsToUsd } from '../../api/rewards.js';

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.38, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const CARD = {
  background:   'white',
  border:       '1px solid rgba(15,23,42,0.08)',
  borderRadius: '12px',
  boxShadow:    '0 1px 8px rgba(15,23,42,0.04)',
};

const ORDER_STATUS = {
  pending:    { label: 'Pending',    color: '#d97706', bg: '#fffbeb' },
  processing: { label: 'Processing', color: '#2563eb', bg: '#eff6ff' },
  'on-hold':  { label: 'On Hold',    color: '#d97706', bg: '#fff7ed' },
  completed:  { label: 'Completed',  color: '#16a34a', bg: '#f0fdf4' },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: '#fef2f2' },
  refunded:   { label: 'Refunded',   color: '#64748b', bg: '#f8fafc' },
  shipped:    { label: 'Shipped',    color: '#2563eb', bg: '#eff6ff' },
  failed:     { label: 'Failed',     color: '#dc2626', bg: '#fef2f2' },
};

function StatusPill( { status } ) {
  const cfg = ORDER_STATUS[ status ] || { label: status, color: '#64748b', bg: '#f8fafc' };
  return (
    <span style={ {
      padding:      '2px 8px',
      borderRadius: '999px',
      background:   cfg.bg,
      color:        cfg.color,
      fontSize:     '0.68rem',
      fontWeight:   700,
      whiteSpace:   'nowrap',
    } }>
      { cfg.label }
    </span>
  );
}

function StatStrip( { stats, delay } ) {
  return (
    <Motion.div custom={ delay } variants={ fadeUp } initial="hidden" animate="visible"
      style={ { ...CARD, display: 'flex', alignItems: 'stretch', overflow: 'hidden' } }
    >
      { stats.map( ( s, i ) => {
        const Icon = s.icon;
        return (
          <div key={ s.label } style={ { display: 'contents' } }>
            { i > 0 && (
              <div style={ { width: '1px', background: 'rgba(15,23,42,0.07)', flexShrink: 0, alignSelf: 'stretch' } } />
            ) }
            <div style={ {
              flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', minWidth: 0,
            } }>
              <div style={ {
                width: '32px', height: '32px', borderRadius: '8px',
                background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              } }>
                <Icon size={ 14 } style={ { color: s.color } } />
              </div>
              <div style={ { minWidth: 0 } }>
                <p style={ { margin: 0, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.38)', fontWeight: 700, whiteSpace: 'nowrap' } }>
                  { s.label }
                </p>
                <p style={ { margin: '1px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, whiteSpace: 'nowrap' } }>
                  { s.value }
                </p>
              </div>
            </div>
          </div>
        );
      } ) }
    </Motion.div>
  );
}

export default function OverviewTab( { user, pointsData, orders, ordersLoading, onTabChange } ) {
  const displayName = [ user.first_name, user.last_name ].filter( Boolean ).join( ' ' ) || user.email;

  const pendingCount   = orders.filter( ( o ) => [ 'pending', 'processing', 'on-hold' ].includes( o.status ) ).length;
  const completedCount = orders.filter( ( o ) => o.status === 'completed' ).length;

  return (
    <div style={ { display: 'flex', flexDirection: 'column', gap: '14px' } }>

      {/* Horizontal stat strip */}
      <StatStrip
        delay={ 0 }
        stats={ [
          { icon: Package,     label: 'Orders',    value: ordersLoading ? '…' : String( orders.length ),                                                             color: '#2563eb', bg: '#eff6ff' },
          { icon: Clock,       label: 'Active',    value: ordersLoading ? '…' : String( pendingCount ),                                                              color: '#d97706', bg: '#fffbeb' },
          { icon: CheckCircle, label: 'Completed', value: ordersLoading ? '…' : String( completedCount ),                                                            color: '#16a34a', bg: '#f0fdf4' },
          { icon: Star,        label: 'Rewards',   value: pointsData ? `$${ pointsToUsd( pointsData.points ).toFixed( 2 ) }` : '—', color: '#d97706', bg: '#fffbeb' },
        ] }
      />

      {/* Recent orders */}
      <Motion.div custom={ 0.12 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { ...CARD, padding: '14px 16px' } }
      >
        <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' } }>
          <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
            <div style={ { width: '28px', height: '28px', borderRadius: '7px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
              <Package size={ 13 } style={ { color: '#2563eb' } } />
            </div>
            <span style={ { fontSize: '0.87rem', fontWeight: 700, color: '#0f172a' } }>Recent Orders</span>
          </div>
          <button
            type="button"
            onClick={ () => onTabChange( 1 ) }
            style={ { fontSize: '0.73rem', fontWeight: 650, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 } }
          >
            View all <ChevronRight size={ 11 } />
          </button>
        </div>

        { ordersLoading ? (
          <div style={ { display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 0' } }>
            <Loader size={ 13 } className="animate-spin" style={ { color: '#2563eb' } } />
            <span style={ { fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)' } }>Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div style={ { textAlign: 'center', padding: '18px 12px', background: '#f8fafc', borderRadius: '7px' } }>
            <Package size={ 22 } style={ { color: 'rgba(15,23,42,0.18)', display: 'block', margin: '0 auto 7px' } } />
            <p style={ { margin: '0 0 10px', fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)' } }>No orders yet.</p>
            <Link to="/products" style={ { fontSize: '0.76rem', fontWeight: 650, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '5px 10px', borderRadius: '6px' } }>
              <ShoppingCart size={ 11 } /> Browse Products
            </Link>
          </div>
        ) : (
          <div>
            { orders.slice( 0, 4 ).map( ( order, i ) => (
              <Link key={ order.id } to={ `/order/${ order.id }` } style={ { textDecoration: 'none', display: 'block' } }>
                <div style={ {
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 0',
                  borderBottom: i < Math.min( orders.length, 4 ) - 1 ? '1px solid rgba(15,23,42,0.055)' : 'none',
                  transition: 'background 0.1s',
                } }
                  onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.padding = '8px 7px'; e.currentTarget.style.borderRadius = '5px'; e.currentTarget.style.margin = '0 -7px'; } }
                  onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.padding = '8px 0'; e.currentTarget.style.borderRadius = '0'; e.currentTarget.style.margin = '0'; } }
                >
                  <div style={ { flex: 1, minWidth: 0 } }>
                    <div style={ { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px', flexWrap: 'wrap' } }>
                      <span style={ { fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' } }>Order #{ order.id }</span>
                      <StatusPill status={ order.status } />
                    </div>
                    <p style={ { margin: 0, fontSize: '0.7rem', color: 'rgba(15,23,42,0.4)' } }>
                      { order.date_created ? new Date( order.date_created ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } ) : '' }
                    </p>
                  </div>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '5px' } }>
                    <span style={ { fontWeight: 750, color: '#0f172a', fontSize: '0.85rem' } }>${ parseFloat( order.total ?? 0 ).toFixed( 2 ) }</span>
                    <ChevronRight size={ 12 } style={ { color: 'rgba(15,23,42,0.25)' } } />
                  </div>
                </div>
              </Link>
            ) ) }
          </div>
        ) }
      </Motion.div>

      {/* Account info */}
      <Motion.div custom={ 0.18 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { ...CARD, padding: '14px 16px' } }
      >
        <div style={ { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } }>
          <div style={ { width: '28px', height: '28px', borderRadius: '7px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <CreditCard size={ 13 } style={ { color: '#64748b' } } />
          </div>
          <span style={ { fontSize: '0.87rem', fontWeight: 700, color: '#0f172a' } }>Account Information</span>
        </div>

        <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' } }>
          { [
            { label: 'Full Name',    value: displayName },
            { label: 'Email',        value: user.email  },
            { label: 'Account Type', value: user.role || '—' },
            { label: 'Member Since', value: user.registered
                ? new Date( user.registered ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'long' } ) : '—' },
          ].map( ( row ) => (
            <div key={ row.label }>
              <p style={ { margin: '0 0 2px', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, color: 'rgba(15,23,42,0.38)' } }>{ row.label }</p>
              <p style={ { margin: 0, fontSize: '0.83rem', color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' } }>{ row.value }</p>
            </div>
          ) ) }
        </div>
      </Motion.div>

      {/* Quick links */}
      <Motion.div custom={ 0.24 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { display: 'flex', gap: '8px', flexWrap: 'wrap' } }
      >
        { [
          { icon: ShoppingCart, label: 'Browse Products', to: '/products',  color: '#2563eb', bg: '#eff6ff' },
          { icon: ShoppingCart, label: 'View Cart',        to: '/cart',      color: '#ea580c', bg: '#fff7ed' },
          { icon: Wrench,       label: 'Book a Repair',    to: '/repairs',   color: '#16a34a', bg: '#f0fdf4' },
        ].map( ( action ) => (
          <Link key={ action.to } to={ action.to } style={ { textDecoration: 'none', flex: '1 1 120px' } }>
            <div style={ {
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px',
              background: 'white', border: '1px solid rgba(15,23,42,0.07)', borderRadius: '9px',
              transition: 'border-color 0.15s, box-shadow 0.15s', cursor: 'pointer',
            } }
              onMouseEnter={ ( e ) => { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.boxShadow = `0 3px 10px ${ action.color }22`; } }
              onMouseLeave={ ( e ) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.07)'; e.currentTarget.style.boxShadow = 'none'; } }
            >
              <div style={ { width: '28px', height: '28px', borderRadius: '7px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                <action.icon size={ 13 } style={ { color: action.color } } />
              </div>
              <span style={ { fontSize: '0.75rem', fontWeight: 650, color: '#374151', whiteSpace: 'nowrap' } }>{ action.label }</span>
            </div>
          </Link>
        ) ) }
      </Motion.div>

    </div>
  );
}
