/**
 * frontend/src/components/dashboard/OverviewTab.jsx
 *
 * Dashboard Overview tab — stats, ProCare status, recent orders, account info.
 */

import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  Package, Clock, CheckCircle, Star, Shield, ShoppingCart,
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
  boxShadow:    '0 2px 12px rgba(15,23,42,0.05)',
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

function StatCard( { icon, label, value, color, bg, delay } ) {
  const Icon = icon;
  return (
    <Motion.div custom={ delay } variants={ fadeUp } initial="hidden" animate="visible"
      style={ { ...CARD, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' } }
    >
      <div style={ {
        width: '40px', height: '40px', borderRadius: '10px',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      } }>
        <Icon size={ 18 } style={ { color } } />
      </div>
      <div>
        <p style={ { margin: 0, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(15,23,42,0.42)', fontWeight: 700 } }>
          { label }
        </p>
        <p style={ { margin: '2px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 } }>
          { value }
        </p>
      </div>
    </Motion.div>
  );
}

export default function OverviewTab( { user, pointsData, membershipData, orders, ordersLoading, onTabChange } ) {
  const displayName = [ user.first_name, user.last_name ].filter( Boolean ).join( ' ' ) || user.email;
  const tierName    = membershipData?.tier
    ? membershipData.tier.charAt( 0 ).toUpperCase() + membershipData.tier.slice( 1 )
    : null;

  const pendingCount   = orders.filter( ( o ) => [ 'pending', 'processing', 'on-hold' ].includes( o.status ) ).length;
  const completedCount = orders.filter( ( o ) => o.status === 'completed' ).length;

  return (
    <div style={ { display: 'flex', flexDirection: 'column', gap: '18px' } }>

      {/* Stats row */}
      <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' } }>
        <StatCard icon={ Package }     label="Orders"    value={ ordersLoading ? '…' : String( orders.length ) }                                                               color="#2563eb" bg="#eff6ff" delay={ 0 } />
        <StatCard icon={ Clock }       label="Active"    value={ ordersLoading ? '…' : String( pendingCount ) }                                                                color="#d97706" bg="#fffbeb" delay={ 0.05 } />
        <StatCard icon={ CheckCircle } label="Completed" value={ ordersLoading ? '…' : String( completedCount ) }                                                              color="#16a34a" bg="#f0fdf4" delay={ 0.1 } />
        <StatCard icon={ Star }        label="Rewards"   value={ pointsData ? `$${ pointsToUsd( pointsData.points ).toFixed( 2 ) }` : '—' } color="#d97706" bg="#fffbeb" delay={ 0.15 } />
      </div>

      {/* ProCare card */}
      <Motion.div custom={ 0.18 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { ...CARD, padding: '18px 20px' } }
      >
        <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } }>
          <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
            <div style={ { width: '34px', height: '34px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
              <Shield size={ 16 } style={ { color: '#16a34a' } } />
            </div>
            <span style={ { fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' } }>ProCare Membership</span>
          </div>
          { membershipData?.tier !== 'fleet' && (
            <button
              type="button"
              onClick={ () => onTabChange( 3 ) }
              style={ { fontSize: '0.76rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: 'none', padding: '5px 11px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' } }
              onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#dbeafe'; } }
              onMouseLeave={ ( e ) => { e.currentTarget.style.background = '#eff6ff'; } }
            >
              { membershipData?.tier === 'essential' ? 'Join ProCare →' : 'Upgrade →' }
            </button>
          ) }
        </div>

        { membershipData ? (
          <div style={ { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }>
            <span style={ {
              padding: '3px 10px', borderRadius: '999px', fontSize: '0.73rem', fontWeight: 700,
              background: membershipData.tier === 'fleet' ? '#f0fdf4' : membershipData.tier === 'professional' ? '#eff6ff' : '#f1f5f9',
              color:      membershipData.tier === 'fleet' ? '#16a34a' : membershipData.tier === 'professional' ? '#2563eb' : 'rgba(15,23,42,0.45)',
            } }>{ tierName }</span>
            { membershipData.tier !== 'essential' && (
              <span style={ { fontSize: '0.76rem', color: 'rgba(15,23,42,0.5)' } }>
                { membershipData.labor_discount > 0 && `${ ( membershipData.labor_discount * 100 ).toFixed( 0 ) }% labor off` }
                { ' · ' }{ membershipData.free_diagnostics_remaining } free diag.
              </span>
            ) }
          </div>
        ) : (
          <p style={ { margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)' } }>
            <button type="button" onClick={ () => onTabChange( 3 ) } style={ { color: '#2563eb', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' } }>
              Join ProCare
            </button>{ ' ' }— discounts, extended warranty, and free diagnostics.
          </p>
        ) }
      </Motion.div>

      {/* Recent orders */}
      <Motion.div custom={ 0.24 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { ...CARD, padding: '18px 20px' } }
      >
        <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' } }>
          <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
            <div style={ { width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
              <Package size={ 16 } style={ { color: '#2563eb' } } />
            </div>
            <span style={ { fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' } }>Recent Orders</span>
          </div>
          <button
            type="button"
            onClick={ () => onTabChange( 1 ) }
            style={ { fontSize: '0.76rem', fontWeight: 650, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 } }
          >
            View all <ChevronRight size={ 12 } />
          </button>
        </div>

        { ordersLoading ? (
          <div style={ { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' } }>
            <Loader size={ 15 } className="animate-spin" style={ { color: '#2563eb' } } />
            <span style={ { fontSize: '0.82rem', color: 'rgba(15,23,42,0.45)' } }>Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div style={ { textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: '8px' } }>
            <Package size={ 26 } style={ { color: 'rgba(15,23,42,0.18)', display: 'block', margin: '0 auto 8px' } } />
            <p style={ { margin: '0 0 12px', fontSize: '0.82rem', color: 'rgba(15,23,42,0.45)' } }>No orders yet.</p>
            <Link to="/products" style={ { fontSize: '0.78rem', fontWeight: 650, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px' } }>
              <ShoppingCart size={ 12 } /> Browse Products
            </Link>
          </div>
        ) : (
          <div>
            { orders.slice( 0, 4 ).map( ( order, i ) => (
              <Link key={ order.id } to={ `/order/${ order.id }` } style={ { textDecoration: 'none', display: 'block' } }>
                <div style={ {
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 0',
                  borderBottom: i < Math.min( orders.length, 4 ) - 1 ? '1px solid rgba(15,23,42,0.055)' : 'none',
                  transition: 'background 0.1s',
                } }
                  onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.padding = '10px 8px'; e.currentTarget.style.borderRadius = '6px'; e.currentTarget.style.margin = '0 -8px'; } }
                  onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.padding = '10px 0'; e.currentTarget.style.borderRadius = '0'; e.currentTarget.style.margin = '0'; } }
                >
                  <div style={ { flex: 1 } }>
                    <div style={ { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' } }>
                      <span style={ { fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' } }>Order #{ order.id }</span>
                      <StatusPill status={ order.status } />
                    </div>
                    <p style={ { margin: 0, fontSize: '0.72rem', color: 'rgba(15,23,42,0.4)' } }>
                      { order.date_created ? new Date( order.date_created ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } ) : '' }
                    </p>
                  </div>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '6px' } }>
                    <span style={ { fontWeight: 750, color: '#0f172a', fontSize: '0.88rem' } }>${ parseFloat( order.total ?? 0 ).toFixed( 2 ) }</span>
                    <ChevronRight size={ 13 } style={ { color: 'rgba(15,23,42,0.25)' } } />
                  </div>
                </div>
              </Link>
            ) ) }
          </div>
        ) }
      </Motion.div>

      {/* Account info */}
      <Motion.div custom={ 0.3 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { ...CARD, padding: '18px 20px' } }
      >
        <div style={ { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' } }>
          <div style={ { width: '34px', height: '34px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <CreditCard size={ 16 } style={ { color: '#64748b' } } />
          </div>
          <span style={ { fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' } }>Account Information</span>
        </div>

        <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' } }>
          { [
            { label: 'Full Name',    value: displayName },
            { label: 'Email',        value: user.email  },
            { label: 'Account Type', value: user.role || '—' },
            { label: 'Member Since', value: user.registered
                ? new Date( user.registered ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'long' } ) : '—' },
          ].map( ( row ) => (
            <div key={ row.label }>
              <p style={ { margin: '0 0 3px', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, color: 'rgba(15,23,42,0.38)' } }>{ row.label }</p>
              <p style={ { margin: 0, fontSize: '0.86rem', color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' } }>{ row.value }</p>
            </div>
          ) ) }
        </div>
      </Motion.div>

      {/* Quick links */}
      <Motion.div custom={ 0.36 } variants={ fadeUp } initial="hidden" animate="visible"
        style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' } }
      >
        { [
          { icon: ShoppingCart, label: 'Browse Products', to: '/products',  color: '#2563eb', bg: '#eff6ff' },
          { icon: ShoppingCart, label: 'View Cart',        to: '/cart',      color: '#ea580c', bg: '#fff7ed' },
          { icon: Wrench,       label: 'Book a Repair',    to: '/repairs',   color: '#16a34a', bg: '#f0fdf4' },
        ].map( ( action ) => (
          <Link key={ action.to } to={ action.to } style={ { textDecoration: 'none' } }>
            <div style={ {
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '8px', padding: '16px 12px',
              background: 'white', border: '1px solid rgba(15,23,42,0.07)', borderRadius: '10px',
              textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.12s', cursor: 'pointer',
            } }
              onMouseEnter={ ( e ) => { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.boxShadow = `0 4px 14px ${ action.color }22`; e.currentTarget.style.transform = 'translateY(-1px)'; } }
              onMouseLeave={ ( e ) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.07)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; } }
            >
              <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                <action.icon size={ 16 } style={ { color: action.color } } />
              </div>
              <span style={ { fontSize: '0.75rem', fontWeight: 650, color: '#374151' } }>{ action.label }</span>
            </div>
          </Link>
        ) ) }
      </Motion.div>

    </div>
  );
}
