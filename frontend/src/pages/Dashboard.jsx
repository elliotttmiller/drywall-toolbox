/**
 * frontend/src/pages/Dashboard.jsx
 *
 * Authenticated user dashboard — mobile-first layout.
 *
 * Layout (desktop ≥ lg):
 *   Left sidebar  — avatar, user info, navigation links
 *   Right main    — stats row, orders table placeholder, account info card
 *
 * Layout (mobile):
 *   Full-width stacked cards: header → stats → orders → account → logout
 *
 * Animations:
 *   - Page-level entry via PageTransition (framer-motion, 0.25 s ease).
 *   - Sidebar and each main card staggered via Framer Motion cardVariants.
 *   - Stat counters animate in with opacity+y on mount.
 *
 * Auth:
 *   Reads user profile from useAuthContext().  If the user is not
 *   authenticated (and the session check has completed), redirects to /login.
 *
 * Guest checkout / store browsing:
 *   Dashboard is only accessible while logged in; every other route including
 *   /products, /cart, and /checkout is fully public — no auth required.
 */

import { useEffect, useState } from 'react';
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
} from 'lucide-react';

import { useAuthContext } from '../auth/AuthContext.js';
import { getUserPoints, pointsToUsd } from '../api/rewards.js';
import { getMembershipStatus } from '../api/membership.js';

// ─── Animation variants ───────────────────────────────────────────────────────

const cardVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: ( delay ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [ 0.16, 1, 0.3, 1 ], delay: delay ?? 0 },
  } ),
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard( { icon, label, value, color, delay } ) {
  const Icon = icon;
  return (
    <Motion.div
      custom={ delay }
      variants={ cardVariants }
      initial="hidden"
      animate="visible"
      style={ {
        background:   'white',
        border:       '1px solid rgba(15,23,42,0.08)',
        borderRadius: '8px',
        padding:      '20px 24px',
        display:      'flex',
        alignItems:   'center',
        gap:          '16px',
        boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
      } }
    >
      <div style={ {
        width:           '44px',
        height:          '44px',
        borderRadius:    '10px',
        background:      color.bg,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
      } }>
        <Icon size={ 20 } style={ { color: color.icon } } />
      </div>
      <div>
        <p style={ { margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.45)', fontWeight: 700 } }>
          { label }
        </p>
        <p style={ { margin: '3px 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 } }>
          { value }
        </p>
      </div>
    </Motion.div>
  );
}

// ─── Nav link ─────────────────────────────────────────────────────────────────

function SideNavLink( { icon, label, to, external } ) {
  const Icon = icon;
  const inner = (
    <div style={ {
      display:        'flex',
      alignItems:     'center',
      gap:            '12px',
      padding:        '11px 16px',
      borderRadius:   '6px',
      cursor:         'pointer',
      color:          'rgba(15,23,42,0.65)',
      fontSize:       '0.875rem',
      fontWeight:     500,
      textDecoration: 'none',
      transition:     'background 0.15s, color 0.15s',
    } }
      onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; } }
      onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(15,23,42,0.65)'; } }
    >
      <Icon size={ 16 } style={ { flexShrink: 0 } } />
      { label }
      <ChevronRight size={ 14 } style={ { marginLeft: 'auto', opacity: 0.4 } } />
    </div>
  );

  if ( external ) {
    return <a href={ to } style={ { textDecoration: 'none', display: 'block' } }>{ inner }</a>;
  }
  return <Link to={ to } style={ { textDecoration: 'none', display: 'block' } }>{ inner }</Link>;
}

// ─── OrderRow placeholder ─────────────────────────────────────────────────────

function OrderRowPlaceholder( { delay } ) {
  return (
    <Motion.div
      custom={ delay }
      variants={ cardVariants }
      initial="hidden"
      animate="visible"
      style={ {
        display:      'flex',
        alignItems:   'center',
        gap:          '16px',
        padding:      '14px 0',
        borderBottom: '1px solid rgba(15,23,42,0.06)',
      } }
    >
      <div style={ {
        width: '36px', height: '36px', borderRadius: '8px',
        background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
        flexShrink: 0,
      } } />
      <div style={ { flex: 1 } }>
        <div style={ { height: '12px', width: '60%', background: '#f1f5f9', borderRadius: '4px', marginBottom: '6px' } } />
        <div style={ { height: '10px', width: '35%', background: '#f8fafc', borderRadius: '4px' } } />
      </div>
      <div style={ { height: '22px', width: '60px', background: '#f1f5f9', borderRadius: '999px' } } />
    </Motion.div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate                          = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();

  const [pointsData,      setPointsData     ] = useState( null );
  const [membershipData,  setMembershipData  ] = useState( null );

  // Redirect to login if session check done and user is not authenticated.
  useEffect( () => {
    if ( ! isLoading && ! isAuthenticated ) {
      navigate( '/login', { replace: true } );
    }
  }, [ isLoading, isAuthenticated, navigate ] );

  // Fetch points + membership once we have a user ID.
  useEffect( () => {
    if ( user?.id ) {
      getUserPoints( user.id ).then( setPointsData ).catch( ( err ) => {
        console.warn( '[Dashboard] Points fetch failed:', err?.message );
      } );
      getMembershipStatus( user.id ).then( setMembershipData ).catch( ( err ) => {
        console.warn( '[Dashboard] Membership fetch failed:', err?.message );
      } );
    }
  }, [ user?.id ] );

  const handleLogout = async () => {
    await logout();
    navigate( '/', { replace: true } );
  };

  // Show minimal loading state while the initial session validate runs.
  if ( isLoading || ! user ) {
    return (
      <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' } }>
        <div style={ { display: 'flex', gap: '8px' } }>
          { [ 0, 1, 2 ].map( ( i ) => (
            <Motion.span
              key={ i }
              style={ { display: 'block', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' } }
              animate={ { scale: [ 1, 1.45, 1 ], opacity: [ 0.35, 1, 0.35 ] } }
              transition={ { duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' } }
            />
          ) ) }
        </div>
      </div>
    );
  }

  const displayName = [ user.first_name, user.last_name ].filter( Boolean ).join( ' ' ) || user.email;
  const initials    = ( user.first_name?.[0] || '' ) + ( user.last_name?.[0] || user.email?.[0] || '' );

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f8fafc' } }>

      {/* ── Page hero strip ── */}
      <div style={ {
        background:   'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding:      'clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem) clamp(2rem, 5vw, 3.5rem)',
        position:     'relative',
        overflow:     'hidden',
      } }>
        <div style={ {
          position:        'absolute',
          inset:           0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize:  '40px 40px',
          pointerEvents:   'none',
        } } />
        <div style={ { position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' } }>
          <Motion.div
            initial={ { opacity: 0, y: 14 } }
            animate={ { opacity: 1, y: 0  } }
            transition={ { duration: 0.5, ease: [ 0.16, 1, 0.3, 1 ] } }
            style={ { display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' } }
          >
            {/* Avatar */}
            <div style={ {
              width:           '56px',
              height:          '56px',
              borderRadius:    '50%',
              background:      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        '1.1rem',
              fontWeight:      800,
              color:           'white',
              border:          '2px solid rgba(255,255,255,0.25)',
              flexShrink:      0,
              textTransform:   'uppercase',
            } }>
              { initials || <User size={ 24 } /> }
            </div>

            <div>
              <div style={ {
                display:       'inline-block',
                background:    'rgba(255,255,255,0.1)',
                border:        '1px solid rgba(255,255,255,0.2)',
                borderRadius:  '3px',
                padding:       '3px 10px',
                fontSize:      '0.65rem',
                fontWeight:    700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         'rgba(255,255,255,0.7)',
                marginBottom:  '6px',
              } }>
                My Account
              </div>
              <h1 style={ {
                color:         'white',
                fontSize:      'clamp(1.25rem, 3vw, 1.75rem)',
                fontWeight:    800,
                margin:        0,
                letterSpacing: '-0.02em',
              } }>
                Welcome back, { user.first_name || displayName }!
              </h1>
            </div>
          </Motion.div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={ {
        maxWidth: '1400px',
        margin:   '0 auto',
        padding:  'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 2.5rem)',
        display:  'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap:      'clamp(1.5rem, 3vw, 2.5rem)',
      } }
        className="lg:grid-cols-[280px_1fr]"
      >

        {/* ── Sidebar ── */}
        <Motion.aside
          custom={ 0 }
          variants={ cardVariants }
          initial="hidden"
          animate="visible"
          style={ {
            background:   'white',
            border:       '1px solid rgba(15,23,42,0.08)',
            borderRadius: '8px',
            padding:      '24px',
            boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
            height:       'fit-content',
          } }
        >
          {/* Sidebar user summary */}
          <div style={ { textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid rgba(15,23,42,0.06)', marginBottom: '16px' } }>
            <div style={ {
              width:           '64px',
              height:          '64px',
              borderRadius:    '50%',
              background:      'linear-gradient(135deg, #dbeafe, #bfdbfe)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        '1.25rem',
              fontWeight:      800,
              color:           '#1d4ed8',
              margin:          '0 auto 12px',
              textTransform:   'uppercase',
            } }>
              { initials || <User size={ 28 } /> }
            </div>
            <p style={ { margin: '0 0 4px', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' } }>
              { displayName }
            </p>
            <p style={ { margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)' } }>
              { user.email }
            </p>
            { user.role && (
              <div style={ {
                display:       'inline-block',
                marginTop:     '8px',
                background:    '#eff6ff',
                border:        '1px solid #bfdbfe',
                borderRadius:  '999px',
                padding:       '3px 10px',
                fontSize:      '0.7rem',
                fontWeight:    600,
                color:         '#1d4ed8',
                textTransform: 'capitalize',
              } }>
                { user.role }
              </div>
            ) }
          </div>

          {/* Nav links */}
          <nav style={ { display: 'flex', flexDirection: 'column', gap: '2px' } }>
            <SideNavLink icon={ Package }     label="My Orders"        to="/orders"          />
            <SideNavLink icon={ Star }        label="My Rewards"       to="/rewards"         />
            <SideNavLink icon={ Shield }      label="ProCare Plan"     to="/pro-membership"  />
            <SideNavLink icon={ MapPin }      label="Saved Addresses"  to="/addresses"       />
            <SideNavLink icon={ Bell }        label="Notifications"    to="/notifications"   />
            <SideNavLink icon={ Settings }    label="Account Settings" to="/account-settings" />
          </nav>

          <div style={ { margin: '16px 0', height: '1px', background: 'rgba(15,23,42,0.06)' } } />

          {/* Shop links */}
          <nav style={ { display: 'flex', flexDirection: 'column', gap: '2px' } }>
            <SideNavLink icon={ ShoppingCart } label="Browse Products" to="/products"  />
            <SideNavLink icon={ ShoppingCart } label="Go to Cart"      to="/cart"      />
          </nav>

          <div style={ { margin: '16px 0', height: '1px', background: 'rgba(15,23,42,0.06)' } } />

          {/* Logout */}
          <button
            onClick={ handleLogout }
            style={ {
              display:       'flex',
              alignItems:    'center',
              gap:           '10px',
              width:         '100%',
              padding:       '11px 16px',
              borderRadius:  '6px',
              border:        'none',
              background:    'transparent',
              cursor:        'pointer',
              color:         '#dc2626',
              fontSize:      '0.875rem',
              fontWeight:    500,
              textAlign:     'left',
              transition:    'background 0.15s',
            } }
            onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#fef2f2'; } }
            onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; } }
          >
            <LogOut size={ 16 } style={ { flexShrink: 0 } } />
            Sign out
          </button>
        </Motion.aside>

        {/* ── Main content area ── */}
        <div style={ { display: 'flex', flexDirection: 'column', gap: 'clamp(1.25rem, 3vw, 2rem)' } }>

          {/* Stats row */}
          <div style={ {
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap:                 '16px',
          } }>
            <StatCard
              icon={ Package }
              label="Total Orders"
              value="—"
              color={ { bg: '#eff6ff', icon: '#2563eb' } }
              delay={ 0.05 }
            />
            <StatCard
              icon={ Clock }
              label="Pending"
              value="—"
              color={ { bg: '#fff7ed', icon: '#ea580c' } }
              delay={ 0.12 }
            />
            <StatCard
              icon={ CheckCircle }
              label="Completed"
              value="—"
              color={ { bg: '#f0fdf4', icon: '#16a34a' } }
              delay={ 0.19 }
            />
            <StatCard
              icon={ Star }
              label="Points Balance"
              value={ pointsData ? `$${ pointsToUsd( pointsData.points ).toFixed( 2 ) }` : '—' }
              color={ { bg: '#f0fdf4', icon: '#16a34a' } }
              delay={ 0.26 }
            />
          </div>

          {/* ProCare membership status card */}
          <Motion.div
            custom={ 0.28 }
            variants={ cardVariants }
            initial="hidden"
            animate="visible"
            style={ {
              background:   'white',
              border:       '1px solid rgba(15,23,42,0.08)',
              borderRadius: '8px',
              padding:      'clamp(1.25rem, 3vw, 1.75rem)',
              boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
            } }
          >
            <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' } }>
              <h2 style={ { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' } }>
                ProCare Membership
              </h2>
              { membershipData?.tier !== 'fleet' && (
                <Link to="/pro-membership" style={ { fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' } }>
                  { membershipData?.tier === 'essential' ? 'Join ProCare' : 'Upgrade' }
                </Link>
              ) }
            </div>

            { membershipData ? (
              <div style={ { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }>
                <div style={ {
                  padding:      '4px 12px',
                  borderRadius: '999px',
                  background:   membershipData.tier === 'essential'    ? '#f1f5f9'
                              : membershipData.tier === 'professional' ? '#eff6ff'
                              : '#f0fdf4',
                  color:        membershipData.tier === 'essential'    ? 'rgba(15,23,42,0.55)'
                              : membershipData.tier === 'professional' ? '#2563eb'
                              : '#16a34a',
                  fontSize:     '0.75rem',
                  fontWeight:   700,
                } }>
                  { membershipData.tier.charAt( 0 ).toUpperCase() + membershipData.tier.slice( 1 ) }
                </div>
                { membershipData.tier !== 'essential' && (
                  <span style={ { fontSize: '0.78rem', color: 'rgba(15,23,42,0.5)' } }>
                    { membershipData.labor_discount > 0 && `${ ( membershipData.labor_discount * 100 ).toFixed( 0 ) }% labor discount` }
                    { ' · ' }
                    { membershipData.free_diagnostics_remaining } free diagnostic{ membershipData.free_diagnostics_remaining !== 1 ? 's' : '' } remaining
                  </span>
                ) }
              </div>
            ) : (
              <p style={ { fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)', margin: 0 } }>
                <Link to="/pro-membership" style={ { color: '#2563eb' } }>Join ProCare</Link> — starting free.
              </p>
            ) }
          </Motion.div>

          {/* Recent orders card */}
          <Motion.div
            custom={ 0.28 }
            variants={ cardVariants }
            initial="hidden"
            animate="visible"
            style={ {
              background:   'white',
              border:       '1px solid rgba(15,23,42,0.08)',
              borderRadius: '8px',
              padding:      'clamp(1.5rem, 3vw, 2rem)',
              boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
            } }
          >
            <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' } }>
              <h2 style={ { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' } }>
                Recent Orders
              </h2>
              <Link
                to="/orders"
                style={ {
                  fontSize:       '0.78rem',
                  fontWeight:     600,
                  color:          '#2563eb',
                  textDecoration: 'none',
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '4px',
                } }
              >
                View all <ChevronRight size={ 14 } />
              </Link>
            </div>

            {/* Placeholder skeleton rows */}
            <div>
              { [ 0.35, 0.43, 0.51 ].map( ( d, i ) => (
                <OrderRowPlaceholder key={ i } delay={ d } />
              ) ) }
            </div>

            <div style={ {
              marginTop:    '20px',
              padding:      '16px',
              background:   '#f8fafc',
              borderRadius: '6px',
              textAlign:    'center',
            } }>
              <Package size={ 24 } style={ { color: 'rgba(15,23,42,0.2)', marginBottom: '8px' } } />
              <p style={ { margin: 0, fontSize: '0.85rem', color: 'rgba(15,23,42,0.45)' } }>
                Order history will appear here once you place your first order.
              </p>
              <Link
                to="/products"
                style={ {
                  display:       'inline-flex',
                  alignItems:    'center',
                  gap:           '6px',
                  marginTop:     '12px',
                  fontSize:      '0.78rem',
                  fontWeight:    600,
                  color:         '#2563eb',
                  textDecoration: 'none',
                } }
              >
                <ShoppingCart size={ 14 } />
                Start shopping
              </Link>
            </div>
          </Motion.div>

          {/* Account info card */}
          <Motion.div
            custom={ 0.38 }
            variants={ cardVariants }
            initial="hidden"
            animate="visible"
            style={ {
              background:   'white',
              border:       '1px solid rgba(15,23,42,0.08)',
              borderRadius: '8px',
              padding:      'clamp(1.5rem, 3vw, 2rem)',
              boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
            } }
          >
            <h2 style={ { margin: '0 0 20px', fontSize: '1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' } }>
              Account Information
            </h2>

            <div style={ {
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap:                 '20px',
            } }>
              { [
                { label: 'Full Name',  value: displayName },
                { label: 'Email',      value: user.email },
                { label: 'Role',       value: user.role  || '—' },
                { label: 'Member Since', value: user.registered ? new Date( user.registered ).toLocaleDateString( 'en-US', { year: 'numeric', month: 'long' } ) : '—' },
              ].map( ( row ) => (
                <div key={ row.label }>
                  <p style={ { margin: '0 0 4px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'rgba(15,23,42,0.4)' } }>
                    { row.label }
                  </p>
                  <p style={ { margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' } }>
                    { row.value }
                  </p>
                </div>
              ) ) }
            </div>
          </Motion.div>

          {/* Quick actions card */}
          <Motion.div
            custom={ 0.46 }
            variants={ cardVariants }
            initial="hidden"
            animate="visible"
            style={ {
              background:   'white',
              border:       '1px solid rgba(15,23,42,0.08)',
              borderRadius: '8px',
              padding:      'clamp(1.5rem, 3vw, 2rem)',
              boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
            } }
          >
            <h2 style={ { margin: '0 0 20px', fontSize: '1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' } }>
              Quick Actions
            </h2>

            <div style={ {
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap:                 '12px',
            } }>
              { [
                { icon: ShoppingCart, label: 'Shop Products', to: '/products',  color: { bg: '#eff6ff', icon: '#2563eb' } },
                { icon: ShoppingCart, label: 'View Cart',     to: '/cart',      color: { bg: '#fff7ed', icon: '#ea580c' } },
                { icon: Package,      label: 'My Orders',     to: '/orders',    color: { bg: '#f0fdf4', icon: '#16a34a' } },
                { icon: Settings,     label: 'Settings',      to: '/account-settings', color: { bg: '#faf5ff', icon: '#7c3aed' } },
              ].map( ( action ) => (
                <Link
                  key={ action.label }
                  to={ action.to }
                  style={ { textDecoration: 'none' } }
                >
                  <div
                    style={ {
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      justifyContent: 'center',
                      gap:            '10px',
                      padding:        '20px 16px',
                      border:         '1px solid rgba(15,23,42,0.07)',
                      borderRadius:   '8px',
                      textAlign:      'center',
                      transition:     'border-color 0.18s, box-shadow 0.18s, transform 0.15s',
                      cursor:         'pointer',
                    } }
                    onMouseEnter={ ( e ) => {
                      e.currentTarget.style.borderColor = action.color.icon;
                      e.currentTarget.style.boxShadow   = `0 4px 16px ${ action.color.icon }22`;
                      e.currentTarget.style.transform   = 'translateY(-2px)';
                    } }
                    onMouseLeave={ ( e ) => {
                      e.currentTarget.style.borderColor = 'rgba(15,23,42,0.07)';
                      e.currentTarget.style.boxShadow   = 'none';
                      e.currentTarget.style.transform   = 'translateY(0)';
                    } }
                  >
                    <div style={ {
                      width:          '40px',
                      height:         '40px',
                      borderRadius:   '10px',
                      background:     action.color.bg,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                    } }>
                      <action.icon size={ 18 } style={ { color: action.color.icon } } />
                    </div>
                    <span style={ { fontSize: '0.78rem', fontWeight: 600, color: '#374151' } }>
                      { action.label }
                    </span>
                  </div>
                </Link>
              ) ) }
            </div>
          </Motion.div>

        </div>
      </div>
    </div>
  );
}
