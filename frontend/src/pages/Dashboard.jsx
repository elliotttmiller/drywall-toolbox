/**
 * frontend/src/pages/Dashboard.jsx
 *
 * Authenticated user account dashboard — /dashboard
 *
 * Mobile (< 1024 px):
 *   Full-width hero → profile card → iOS-style menu list (My Orders, Rewards,
 *   ProCare Plan, Saved Addresses, Notifications, Account Settings) → stats row.
 *
 * Desktop (≥ 1024 px):
 *   Gradient hero → 2-column grid:
 *     Left  280 px sidebar  — profile card + full menu list + shop links + logout
 *     Right flexible main   — stats row, ProCare card, recent orders, account info
 *
 * Auth: Redirects to /login if unauthenticated (via ProtectedRoute + inner check).
 * Data: Points balance + membership status fetched on mount.
 *       Recent orders fetched on mount (up to 5) for the dashboard preview.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  Package,
  MapPin,
  Bell,
  LogOut,
  ShoppingCart,
  User,
  ChevronRight,
  Settings,
  Star,
  Clock,
  CheckCircle,
  Shield,
  Loader,
  Wrench,
  CreditCard,
} from 'lucide-react';

import { useAuthContext }                   from '../auth/AuthContext.js';
import { getUserPoints, pointsToUsd }       from '../api/rewards.js';
import { getMembershipStatus }              from '../api/membership.js';
import { getCustomerOrders }                from '../api/orders.js';
import SEOHead                              from '../components/SEOHead';

// ─── Design tokens ────────────────────────────────────────────────────────────

const HERO_BG = 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)';

const DOT_GRID = {
  position:        'absolute',
  inset:           0,
  backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1px, transparent 0)',
  backgroundSize:  '36px 36px',
  pointerEvents:   'none',
};

const CARD = {
  background:   'white',
  border:       '1px solid rgba(15,23,42,0.08)',
  borderRadius: '14px',
  boxShadow:    '0 2px 16px rgba(15,23,42,0.06)',
};

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

// ─── Menu navigation data ─────────────────────────────────────────────────────

const MAIN_NAV = [
  { icon: Package,  label: 'My Orders',       to: '/orders',           color: '#2563eb', bg: '#eff6ff'  },
  { icon: Star,     label: 'My Rewards',      to: '/rewards',          color: '#d97706', bg: '#fffbeb'  },
  { icon: Shield,   label: 'ProCare Plan',    to: '/pro-membership',   color: '#16a34a', bg: '#f0fdf4'  },
  { icon: MapPin,   label: 'Saved Addresses', to: '/addresses',        color: '#7c3aed', bg: '#faf5ff'  },
  { icon: Bell,     label: 'Notifications',   to: '/notifications',    color: '#0891b2', bg: '#ecfeff'  },
  { icon: Settings, label: 'Account Settings',to: '/account-settings', color: '#64748b', bg: '#f8fafc'  },
];

const SHOP_NAV = [
  { icon: ShoppingCart, label: 'Browse Products', to: '/products', color: '#2563eb', bg: '#eff6ff' },
  { icon: ShoppingCart, label: 'View Cart',        to: '/cart',     color: '#ea580c', bg: '#fff7ed' },
  { icon: Wrench,       label: 'Book a Repair',    to: '/repairs',  color: '#16a34a', bg: '#f0fdf4' },
];

// ─── Order status helpers ─────────────────────────────────────────────────────

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
      padding:       '2px 9px',
      borderRadius:  '999px',
      background:    cfg.bg,
      color:         cfg.color,
      fontSize:      '0.7rem',
      fontWeight:    700,
      letterSpacing: '0.02em',
      whiteSpace:    'nowrap',
    } }>
      { cfg.label }
    </span>
  );
}

// ─── Menu row ─────────────────────────────────────────────────────────────────

function MenuRow( { icon, label, to, color, bg, noBorderBottom } ) {
  const Icon = icon;
  return (
    <Link to={ to } style={ { textDecoration: 'none', display: 'block' } }>
      <div style={ {
        display:      'flex',
        alignItems:   'center',
        gap:          '13px',
        padding:      '13px 20px',
        borderBottom: noBorderBottom ? 'none' : '1px solid rgba(15,23,42,0.055)',
        cursor:       'pointer',
        transition:   'background 0.12s',
      } }
        onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f8fafc'; } }
        onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; } }
      >
        <div style={ {
          width:          '36px',
          height:         '36px',
          borderRadius:   '9px',
          background:     bg,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        } }>
          <Icon size={ 17 } style={ { color } } />
        </div>
        <span style={ { flex: 1, fontSize: '0.9rem', fontWeight: 550, color: '#1e293b' } }>
          { label }
        </span>
        <ChevronRight size={ 15 } style={ { color: 'rgba(15,23,42,0.3)', flexShrink: 0 } } />
      </div>
    </Link>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard( { icon, label, value, color, bg, delay } ) {
  const Icon = icon;
  return (
    <Motion.div custom={ delay } variants={ fadeUp } initial="hidden" animate="visible"
      style={ { ...CARD, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' } }
    >
      <div style={ {
        width:          '42px',
        height:         '42px',
        borderRadius:   '10px',
        background:     bg,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      } }>
        <Icon size={ 19 } style={ { color } } />
      </div>
      <div>
        <p style={ { margin: 0, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(15,23,42,0.45)', fontWeight: 700 } }>
          { label }
        </p>
        <p style={ { margin: '3px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 } }>
          { value }
        </p>
      </div>
    </Motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate                                       = useNavigate();
  const { user, isAuthenticated, isLoading, logout }  = useAuthContext();

  const [ pointsData,    setPointsData    ] = useState( null );
  const [ membershipData,setMembershipData] = useState( null );
  const [ recentOrders,  setRecentOrders  ] = useState( [] );
  const [ ordersLoading, setOrdersLoading ] = useState( true );

  // Auth redirect
  useEffect( () => {
    if ( ! isLoading && ! isAuthenticated ) {
      navigate( '/login', { replace: true } );
    }
  }, [ isLoading, isAuthenticated, navigate ] );

  // Fetch supporting data once user ID is available
  const loadDashboardData = useCallback( () => {
    if ( ! user?.id ) return;

    getUserPoints( user.id )
      .then( setPointsData )
      .catch( () => {} );

    getMembershipStatus( user.id )
      .then( setMembershipData )
      .catch( () => {} );

    setOrdersLoading( true );
    getCustomerOrders( user.id, 1, 5 )
      .then( ( data ) => {
        const fetched = Array.isArray( data ) ? data : ( data?.orders ?? [] );
        setRecentOrders( fetched );
      } )
      .catch( () => {} )
      .finally( () => setOrdersLoading( false ) );
  }, [ user?.id ] );

  useEffect( () => { loadDashboardData(); }, [ loadDashboardData ] );

  const handleLogout = async () => {
    await logout();
    navigate( '/', { replace: true } );
  };

  // ── Loading state ──
  if ( isLoading || ! user ) {
    return (
      <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' } }>
        <div style={ { display: 'flex', gap: '8px' } }>
          { [ 0, 1, 2 ].map( ( i ) => (
            <Motion.span
              key={ i }
              style={ { display: 'block', width: '9px', height: '9px', borderRadius: '50%', background: '#3b82f6' } }
              animate={ { scale: [ 1, 1.5, 1 ], opacity: [ 0.3, 1, 0.3 ] } }
              transition={ { duration: 1.1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' } }
            />
          ) ) }
        </div>
      </div>
    );
  }

  const displayName  = [ user.first_name, user.last_name ].filter( Boolean ).join( ' ' ) || user.email;
  const initials     = ( ( user.first_name?.[0] || '' ) + ( user.last_name?.[0] || user.email?.[0] || '' ) ).toUpperCase();
  const tierName     = membershipData?.tier
    ? membershipData.tier.charAt( 0 ).toUpperCase() + membershipData.tier.slice( 1 )
    : null;

  // ── Sidebar / profile card (shared between mobile card and desktop aside) ──

  const ProfileCard = (
    <>
      {/* Avatar + name + email */}
      <div style={ { padding: '22px 20px 18px', textAlign: 'center', borderBottom: '1px solid rgba(15,23,42,0.07)' } }>
        <div style={ {
          width:          '72px',
          height:         '72px',
          borderRadius:   '50%',
          background:     'linear-gradient(135deg, #dbeafe, #93c5fd)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       '1.4rem',
          fontWeight:     800,
          color:          '#1d4ed8',
          margin:         '0 auto 12px',
          letterSpacing:  '-0.02em',
        } }>
          { initials || <User size={ 30 } /> }
        </div>
        <p style={ { margin: '0 0 3px', fontWeight: 750, fontSize: '0.95rem', color: '#0f172a' } }>
          { displayName }
        </p>
        <p style={ { margin: 0, fontSize: '0.78rem', color: 'rgba(15,23,42,0.45)' } }>
          { user.email }
        </p>
        { tierName && (
          <span style={ {
            display:       'inline-block',
            marginTop:     '8px',
            padding:       '3px 12px',
            borderRadius:  '999px',
            background:    membershipData?.tier === 'fleet' ? '#f0fdf4' : membershipData?.tier === 'professional' ? '#eff6ff' : '#f1f5f9',
            color:         membershipData?.tier === 'fleet' ? '#16a34a' : membershipData?.tier === 'professional' ? '#2563eb' : 'rgba(15,23,42,0.5)',
            fontSize:      '0.7rem',
            fontWeight:    700,
            letterSpacing: '0.03em',
          } }>
            { tierName }
          </span>
        ) }
      </div>

      {/* Main nav */}
      <nav>
        { MAIN_NAV.map( ( item, i ) => (
          <MenuRow key={ item.to } { ...item } noBorderBottom={ i === MAIN_NAV.length - 1 } />
        ) ) }
      </nav>

      {/* Divider */}
      <div style={ { height: '1px', background: 'rgba(15,23,42,0.07)', margin: '4px 0' } } />

      {/* Shop nav */}
      <nav>
        { SHOP_NAV.map( ( item, i ) => (
          <MenuRow key={ item.to } { ...item } noBorderBottom={ i === SHOP_NAV.length - 1 } />
        ) ) }
      </nav>

      {/* Divider */}
      <div style={ { height: '1px', background: 'rgba(15,23,42,0.07)', margin: '4px 0' } } />

      {/* Logout */}
      <button
        type="button"
        onClick={ handleLogout }
        style={ {
          display:        'flex',
          alignItems:     'center',
          gap:            '13px',
          width:          '100%',
          padding:        '13px 20px',
          border:         'none',
          background:     'transparent',
          cursor:         'pointer',
          textAlign:      'left',
          borderRadius:   '0 0 14px 14px',
          transition:     'background 0.12s',
        } }
        onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#fef2f2'; } }
        onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; } }
      >
        <div style={ {
          width: '36px', height: '36px', borderRadius: '9px',
          background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        } }>
          <LogOut size={ 17 } style={ { color: '#dc2626' } } />
        </div>
        <span style={ { flex: 1, fontSize: '0.9rem', fontWeight: 550, color: '#dc2626' } }>Sign out</span>
      </button>
    </>
  );

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f4f6fb' } }>
      <SEOHead noindex title="My Account" />

      {/* ── Hero ── */}
      <div style={ { background: HERO_BG, padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.25rem, 5vw, 3rem)', position: 'relative', overflow: 'hidden' } }>
        <div style={ DOT_GRID } />
        <div style={ { position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' } }>
          <Motion.div
            initial={ { opacity: 0, y: 14 } }
            animate={ { opacity: 1, y: 0  } }
            transition={ { duration: 0.5, ease: [ 0.16, 1, 0.3, 1 ] } }
            style={ { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' } }
          >
            {/* Hero avatar */}
            <div style={ {
              width:          '58px',
              height:         '58px',
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       '1.15rem',
              fontWeight:     800,
              color:          'white',
              border:         '2.5px solid rgba(255,255,255,0.25)',
              flexShrink:     0,
              letterSpacing:  '-0.02em',
            } }>
              { initials || <User size={ 24 } /> }
            </div>

            <div>
              <div style={ {
                display:       'inline-block',
                background:    'rgba(255,255,255,0.12)',
                border:        '1px solid rgba(255,255,255,0.2)',
                borderRadius:  '4px',
                padding:       '3px 10px',
                fontSize:      '0.62rem',
                fontWeight:    700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color:         'rgba(255,255,255,0.75)',
                marginBottom:  '6px',
              } }>
                My Account
              </div>
              <h1 style={ {
                color:         'white',
                fontSize:      'clamp(1.2rem, 3vw, 1.75rem)',
                fontWeight:    800,
                margin:        0,
                letterSpacing: '-0.025em',
              } }>
                Welcome back, { user.first_name || user.email }!
              </h1>
            </div>
          </Motion.div>
        </div>
      </div>

      {/* ── Main layout ── */}
      {/*
        Mobile  (<1024px): single column, profile card → stats → content cards
        Desktop (≥1024px): sidebar + main two-column grid
      */}
      <div style={ {
        maxWidth: '1400px',
        margin:   '0 auto',
        padding:  'clamp(1.5rem, 4vw, 2.5rem) clamp(1.25rem, 4vw, 2rem)',
      } }
        className="dash-layout"
      >

        {/* ── Sidebar / Profile card ── */}
        <Motion.aside
          custom={ 0 }
          variants={ fadeUp }
          initial="hidden"
          animate="visible"
          style={ { ...CARD, overflow: 'hidden', height: 'fit-content' } }
          className="dash-sidebar"
        >
          { ProfileCard }
        </Motion.aside>

        {/* ── Main content ── */}
        <div style={ { display: 'flex', flexDirection: 'column', gap: '20px' } } className="dash-main">

          {/* Stats row */}
          <div style={ {
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap:                 '14px',
          } }>
            <StatCard
              icon={ Package }
              label="Total Orders"
              value={ ordersLoading ? '…' : String( recentOrders.length < 5 ? recentOrders.length : '5+' ) }
              color="#2563eb"
              bg="#eff6ff"
              delay={ 0.05 }
            />
            <StatCard
              icon={ Clock }
              label="Pending"
              value={ ordersLoading ? '…' : String( recentOrders.filter( ( o ) => [ 'pending', 'processing', 'on-hold' ].includes( o.status ) ).length ) }
              color="#d97706"
              bg="#fffbeb"
              delay={ 0.1 }
            />
            <StatCard
              icon={ CheckCircle }
              label="Completed"
              value={ ordersLoading ? '…' : String( recentOrders.filter( ( o ) => o.status === 'completed' ).length ) }
              color="#16a34a"
              bg="#f0fdf4"
              delay={ 0.15 }
            />
            <StatCard
              icon={ Star }
              label="Reward Balance"
              value={ pointsData ? `$${ pointsToUsd( pointsData.points ).toFixed( 2 ) }` : '—' }
              color="#d97706"
              bg="#fffbeb"
              delay={ 0.2 }
            />
          </div>

          {/* ProCare membership card */}
          <Motion.div custom={ 0.22 } variants={ fadeUp } initial="hidden" animate="visible"
            style={ { ...CARD, padding: '20px 22px' } }
          >
            <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' } }>
              <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
                <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                  <Shield size={ 17 } style={ { color: '#16a34a' } } />
                </div>
                <h2 style={ { margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#0f172a' } }>ProCare Membership</h2>
              </div>
              { membershipData?.tier !== 'fleet' && (
                <Link to="/pro-membership" style={ { fontSize: '0.78rem', fontWeight: 650, color: '#2563eb', textDecoration: 'none', padding: '5px 12px', borderRadius: '6px', background: '#eff6ff', transition: 'background 0.15s' } }>
                  { membershipData?.tier === 'essential' ? 'Join ProCare →' : 'Upgrade →' }
                </Link>
              ) }
            </div>

            { membershipData ? (
              <div style={ { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }>
                <span style={ {
                  padding:      '4px 12px',
                  borderRadius: '999px',
                  background:   membershipData.tier === 'fleet' ? '#f0fdf4' : membershipData.tier === 'professional' ? '#eff6ff' : '#f1f5f9',
                  color:        membershipData.tier === 'fleet' ? '#16a34a' : membershipData.tier === 'professional' ? '#2563eb' : 'rgba(15,23,42,0.5)',
                  fontSize:     '0.75rem',
                  fontWeight:   700,
                } }>
                  { tierName }
                </span>
                { membershipData.tier !== 'essential' && (
                  <span style={ { fontSize: '0.78rem', color: 'rgba(15,23,42,0.5)' } }>
                    { membershipData.labor_discount > 0 && `${ ( membershipData.labor_discount * 100 ).toFixed( 0 ) }% labor discount` }
                    { ' · ' }
                    { membershipData.free_diagnostics_remaining } free diagnostic{ membershipData.free_diagnostics_remaining !== 1 ? 's' : '' } remaining
                  </span>
                ) }
              </div>
            ) : (
              <p style={ { margin: 0, fontSize: '0.82rem', color: 'rgba(15,23,42,0.5)' } }>
                <Link to="/pro-membership" style={ { color: '#2563eb', fontWeight: 600 } }>Join ProCare</Link> — get discounts, extended warranty, and free diagnostics.
              </p>
            ) }
          </Motion.div>

          {/* Recent orders card */}
          <Motion.div custom={ 0.3 } variants={ fadeUp } initial="hidden" animate="visible"
            style={ { ...CARD, padding: '20px 22px' } }
          >
            <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' } }>
              <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
                <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                  <Package size={ 17 } style={ { color: '#2563eb' } } />
                </div>
                <h2 style={ { margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#0f172a' } }>Recent Orders</h2>
              </div>
              <Link to="/orders" style={ { fontSize: '0.78rem', fontWeight: 650, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' } }>
                View all <ChevronRight size={ 13 } />
              </Link>
            </div>

            { ordersLoading ? (
              <div style={ { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' } }>
                <Loader size={ 16 } className="animate-spin" style={ { color: '#2563eb' } } />
                <span style={ { fontSize: '0.83rem', color: 'rgba(15,23,42,0.45)' } }>Loading orders…</span>
              </div>
            ) : recentOrders.length === 0 ? (
              <div style={ { textAlign: 'center', padding: '28px 16px', background: '#f8fafc', borderRadius: '8px' } }>
                <Package size={ 28 } style={ { color: 'rgba(15,23,42,0.18)', margin: '0 auto 10px', display: 'block' } } />
                <p style={ { margin: '0 0 14px', fontSize: '0.85rem', color: 'rgba(15,23,42,0.45)' } }>No orders yet — let's change that!</p>
                <Link to="/products" style={ { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 650, color: '#2563eb', textDecoration: 'none', background: '#eff6ff', padding: '7px 14px', borderRadius: '7px' } }>
                  <ShoppingCart size={ 13 } /> Browse Products
                </Link>
              </div>
            ) : (
              <div>
                { recentOrders.map( ( order, i ) => (
                  <Link key={ order.id } to={ `/order/${ order.id }` } style={ { textDecoration: 'none', display: 'block' } }>
                    <div style={ {
                      display:      'flex',
                      alignItems:   'center',
                      gap:          '12px',
                      padding:      '12px 0',
                      borderBottom: i < recentOrders.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none',
                      transition:   'background 0.12s',
                    } }
                      onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderRadius = '6px'; e.currentTarget.style.padding = '12px 8px'; } }
                      onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderRadius = '0'; e.currentTarget.style.padding = '12px 0'; } }
                    >
                      <div style={ { width: '38px', height: '38px', borderRadius: '9px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                        <Package size={ 16 } style={ { color: '#2563eb' } } />
                      </div>
                      <div style={ { flex: 1 } }>
                        <p style={ { margin: 0, fontSize: '0.87rem', fontWeight: 650, color: '#0f172a' } }>Order #{ order.id }</p>
                        <p style={ { margin: '2px 0 0', fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)' } }>
                          { order.date_created ? new Date( order.date_created ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'short', day: 'numeric' } ) : '' }
                          { order.line_items?.length > 0 && ` · ${ order.line_items.length } item${ order.line_items.length !== 1 ? 's' : '' }` }
                        </p>
                      </div>
                      <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
                        <StatusPill status={ order.status } />
                        <span style={ { fontWeight: 750, color: '#0f172a', fontSize: '0.9rem' } }>${ parseFloat( order.total ?? 0 ).toFixed( 2 ) }</span>
                        <ChevronRight size={ 14 } style={ { color: 'rgba(15,23,42,0.25)' } } />
                      </div>
                    </div>
                  </Link>
                ) ) }
              </div>
            ) }
          </Motion.div>

          {/* Account info card */}
          <Motion.div custom={ 0.38 } variants={ fadeUp } initial="hidden" animate="visible"
            style={ { ...CARD, padding: '20px 22px' } }
          >
            <div style={ { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' } }>
              <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                <CreditCard size={ 17 } style={ { color: '#64748b' } } />
              </div>
              <h2 style={ { margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#0f172a' } }>Account Information</h2>
            </div>

            <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '18px' } }>
              { [
                { label: 'Full Name',    value: displayName },
                { label: 'Email',        value: user.email  },
                { label: 'Account Type', value: user.role || '—' },
                { label: 'Member Since', value: user.registered
                    ? new Date( user.registered ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'long' } )
                    : '—' },
              ].map( ( row ) => (
                <div key={ row.label }>
                  <p style={ { margin: '0 0 4px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, color: 'rgba(15,23,42,0.38)' } }>
                    { row.label }
                  </p>
                  <p style={ { margin: 0, fontSize: '0.88rem', color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' } }>
                    { row.value }
                  </p>
                </div>
              ) ) }
            </div>
          </Motion.div>

        </div>
      </div>

      {/* ── Responsive grid styles (injected via a <style> tag) ── */}
      <style>{ `
        .dash-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(1.25rem, 3vw, 1.75rem);
        }
        @media (min-width: 1024px) {
          .dash-layout {
            grid-template-columns: 300px 1fr;
            align-items: start;
          }
        }
      ` }</style>

    </div>
  );
}
