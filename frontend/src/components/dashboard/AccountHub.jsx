/**
 * frontend/src/components/dashboard/AccountHub.jsx
 *
 * Account dashboard hub — mirrors the CalculatorHub pattern.
 *
 * Layout:
 *   Gradient hero strip  →  floating pill tab nav  →  animated tab panel
 *
 * Tabs: Overview · Orders · Rewards · ProCare · Addresses · Settings
 *
 * Features:
 *   - Deep-linkable via ?tab= query param (overview | orders | rewards | procare | addresses | settings)
 *   - Tab persisted to localStorage
 *   - AnimatePresence tab transitions (opacity + scale, 0.22 s)
 *   - Touch swipe support for mobile
 *   - Shared data (points, membership, recent orders) fetched once and passed to tabs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Star, Shield, MapPin, Settings, LogOut, User,
} from 'lucide-react';

import { useAuthContext }             from '../../auth/AuthContext.js';
import { getUserPoints }              from '../../api/rewards.js';
import { getMembershipStatus }        from '../../api/membership.js';
import { getCustomerOrders }          from '../../api/orders.js';

import OverviewTab   from './OverviewTab.jsx';
import OrdersTab     from './OrdersTab.jsx';
import RewardsTab    from './RewardsTab.jsx';
import ProCareTab    from './ProCareTab.jsx';
import AddressesTab  from './AddressesTab.jsx';
import SettingsTab   from './SettingsTab.jsx';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',   shortLabel: 'Overview',  Icon: LayoutDashboard },
  { id: 'orders',     label: 'Orders',     shortLabel: 'Orders',    Icon: Package         },
  { id: 'rewards',    label: 'Rewards',    shortLabel: 'Rewards',   Icon: Star            },
  { id: 'procare',    label: 'ProCare',    shortLabel: 'ProCare',   Icon: Shield          },
  { id: 'addresses',  label: 'Addresses',  shortLabel: 'Addresses', Icon: MapPin          },
  { id: 'settings',   label: 'Settings',   shortLabel: 'Settings',  Icon: Settings        },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const tabTransition = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1,      transition: { duration: 0.22, ease: [ 0.4, 0, 0.2, 1 ] } },
  exit:    { opacity: 0, scale: 0.985,  transition: { duration: 0.16, ease: [ 0.4, 0, 1,   1 ] } },
};

// Dot-grid hero overlay
const DOT_GRID = {
  position:        'absolute',
  inset:           0,
  backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1px, transparent 0)',
  backgroundSize:  '36px 36px',
  pointerEvents:   'none',
};

// ─── Hub component ────────────────────────────────────────────────────────────

export default function AccountHub() {
  const navigate                                      = useNavigate();
  const { user, isAuthenticated, isLoading, logout }  = useAuthContext();
  const [ searchParams, setSearchParams ]             = useSearchParams();

  // Resolve initial tab from URL param → localStorage → 0.
  // This runs once at mount; searchParams is read directly from the initial
  // URLSearchParams snapshot so no stale-closure risk here.
  const resolveInitialTab = () => {
    const urlTab = new URLSearchParams( window.location.search ).get( 'tab' );
    if ( urlTab ) {
      const idx = TABS.findIndex( ( t ) => t.id === urlTab );
      if ( idx >= 0 ) return idx;
    }
    try {
      const cached = JSON.parse( localStorage.getItem( 'dtb_dashboard_tab' ) || '0' );
      return typeof cached === 'number' && cached >= 0 && cached < TABS.length ? cached : 0;
    } catch { return 0; }
  };

  const [ activeTab,      setActiveTab      ] = useState( resolveInitialTab );
  const [ pointsData,     setPointsData     ] = useState( null );
  const [ membershipData, setMembershipData ] = useState( null );
  const [ recentOrders,   setRecentOrders   ] = useState( [] );
  const [ ordersLoading,  setOrdersLoading  ] = useState( true );

  // Touch swipe
  const touchStartX = useRef( null );
  const touchEndX   = useRef( null );

  // Auth redirect
  useEffect( () => {
    if ( ! isLoading && ! isAuthenticated ) {
      navigate( '/login', { replace: true } );
    }
  }, [ isLoading, isAuthenticated, navigate ] );

  // Sync URL param when tab changes
  useEffect( () => {
    const tabId = TABS[ activeTab ]?.id ?? 'overview';
    setSearchParams( ( prev ) => {
      const next = new URLSearchParams( prev );
      if ( tabId === 'overview' ) {
        next.delete( 'tab' );
      } else {
        next.set( 'tab', tabId );
      }
      return next;
    }, { replace: true } );
    try { localStorage.setItem( 'dtb_dashboard_tab', JSON.stringify( activeTab ) ); } catch { /* noop */ }
  }, [ activeTab, setSearchParams ] );

  // Fetch shared data once we have a user ID
  const loadSharedData = useCallback( () => {
    if ( ! user?.id ) return;

    getUserPoints( user.id ).then( setPointsData ).catch( () => {} );
    getMembershipStatus( user.id ).then( setMembershipData ).catch( () => {} );

    setOrdersLoading( true );
    getCustomerOrders( user.id, 1, 5 )
      .then( ( data ) => setRecentOrders( Array.isArray( data ) ? data : ( data?.orders ?? [] ) ) )
      .catch( () => {} )
      .finally( () => setOrdersLoading( false ) );
  }, [ user?.id ] );

  useEffect( () => { loadSharedData(); }, [ loadSharedData ] );

  function changeTab( idx ) {
    if ( idx === activeTab ) return;
    setActiveTab( idx );
  }

  function handleTouchStart( e ) {
    if ( e.targetTouches && e.targetTouches.length > 0 ) {
      touchStartX.current = e.targetTouches[0].clientX;
    }
  }
  function handleTouchMove( e ) {
    if ( e.targetTouches && e.targetTouches.length > 0 ) {
      touchEndX.current = e.targetTouches[0].clientX;
    }
  }
  function handleTouchEnd() {
    if ( touchStartX.current === null || touchEndX.current === null ) return;
    const dist = touchStartX.current - touchEndX.current;
    if ( dist >  70 && activeTab < TABS.length - 1 ) changeTab( activeTab + 1 );
    if ( dist < -70 && activeTab > 0               ) changeTab( activeTab - 1 );
    touchStartX.current = null;
    touchEndX.current   = null;
  }

  async function handleLogout() {
    await logout();
    navigate( '/', { replace: true } );
  }

  // Loading / auth guard
  if ( isLoading || ! user ) {
    return (
      <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' } }>
        <div style={ { display: 'flex', gap: '7px' } }>
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

  const displayName = [ user.first_name, user.last_name ].filter( Boolean ).join( ' ' ) || user.email;
  const initials    = ( ( user.first_name?.[0] || '' ) + ( user.last_name?.[0] || user.email?.[0] || '' ) ).toUpperCase();

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f4f6fb' } }>

      {/* ── Hero ── */}
      <div style={ {
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding:    'clamp(1.75rem, 4.5vw, 3rem) clamp(1.25rem, 5vw, 3rem)',
        position:   'relative',
        overflow:   'hidden',
      } }>
        <div style={ DOT_GRID } />
        <div style={ { position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto' } }>
          <Motion.div
            initial={ { opacity: 0, y: 12 } }
            animate={ { opacity: 1, y: 0  } }
            transition={ { duration: 0.45, ease: [ 0.16, 1, 0.3, 1 ] } }
          >
            <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' } }>
              <div style={ { display: 'flex', alignItems: 'center', gap: '14px' } }>
                {/* Avatar */}
                <div style={ {
                  width:          '52px',
                  height:         '52px',
                  borderRadius:   '50%',
                  background:     'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '1.05rem',
                  fontWeight:     800,
                  color:          'white',
                  border:         '2.5px solid rgba(255,255,255,0.22)',
                  flexShrink:     0,
                  letterSpacing:  '-0.02em',
                } }>
                  { initials || <User size={ 22 } /> }
                </div>

                <div>
                  <div style={ { display: 'inline-block', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '2px 9px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)', marginBottom: '5px' } }>
                    My Account
                  </div>
                  <h1 style={ { color: 'white', fontSize: 'clamp(1.1rem, 2.8vw, 1.6rem)', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' } }>
                    Welcome back, { user.first_name || displayName }!
                  </h1>
                </div>
              </div>

              {/* Logout — desktop only (hidden on mobile via CSS) */}
              <button
                type="button"
                onClick={ handleLogout }
                className="dash-logout-btn"
                style={ {
                  display:     'flex',
                  alignItems:  'center',
                  gap:         '6px',
                  padding:     '7px 14px',
                  borderRadius:'8px',
                  border:      '1px solid rgba(255,255,255,0.18)',
                  background:  'rgba(255,255,255,0.1)',
                  color:       'rgba(255,255,255,0.75)',
                  fontSize:    '0.78rem',
                  fontWeight:  650,
                  cursor:      'pointer',
                  transition:  'background 0.15s, color 0.15s',
                } }
                onMouseEnter={ ( e ) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'white'; } }
                onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; } }
              >
                <LogOut size={ 13 } /> Sign out
              </button>
            </div>
          </Motion.div>
        </div>
      </div>

      {/* ── Floating pill tab nav ── */}
      <div style={ { width: '100%', padding: 'clamp(1rem, 2.5vw, 1.5rem) clamp(1.25rem, 5vw, 3rem) clamp(0.5rem, 1vw, 0.75rem)' } }>
        <div style={ { maxWidth: '1200px', margin: '0 auto' } }>
          <div style={ { background: 'white', borderRadius: '14px', boxShadow: '0 2px 12px rgba(15,23,42,0.07)', border: '1px solid rgba(15,23,42,0.07)', padding: '6px' } }>
            <div
              style={ { display: 'flex', overflowX: 'auto', gap: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } }
              className="scrollbar-none"
            >
              { TABS.map( ( tab, index ) => {
                const isActive = activeTab === index;
                return (
                  <Motion.button
                    key={ tab.id }
                    type="button"
                    onClick={ () => changeTab( index ) }
                    whileTap={ { scale: 0.93 } }
                    style={ {
                      display:       'flex',
                      alignItems:    'center',
                      gap:           '6px',
                      padding:       '8px 14px',
                      borderRadius:  '10px',
                      border:        'none',
                      fontSize:      '0.83rem',
                      fontWeight:    isActive ? 700 : 500,
                      whiteSpace:    'nowrap',
                      flexShrink:    0,
                      cursor:        'pointer',
                      transition:    'background 0.15s, color 0.15s',
                      background:    isActive ? '#1d4ed8' : 'transparent',
                      color:         isActive ? 'white' : 'rgba(15,23,42,0.55)',
                      boxShadow:     isActive ? '0 2px 8px rgba(29,78,216,0.35)' : 'none',
                    } }
                  >
                    <tab.Icon size={ 14 } />
                    <span className="dash-tab-label">{ tab.label }</span>
                  </Motion.button>
                );
              } ) }
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab content panel ── */}
      <div
        style={ { width: '100%', padding: 'clamp(0.25rem, 1vw, 0.5rem) clamp(1.25rem, 5vw, 3rem) clamp(2rem, 4vw, 3rem)' } }
        onTouchStart={ handleTouchStart }
        onTouchMove={ handleTouchMove }
        onTouchEnd={ handleTouchEnd }
      >
        <div style={ { maxWidth: '1200px', margin: '0 auto' } }>
          <AnimatePresence mode="wait">
            <Motion.div
              key={ activeTab }
              variants={ tabTransition }
              initial="initial"
              animate="animate"
              exit="exit"
              style={ {
                background:   'transparent',
              } }
            >
              {/* Thin accent rule */}
              <div style={ { height: '3px', width: '32px', borderRadius: '999px', background: '#1d4ed8', marginBottom: '18px', opacity: 0.7 } } />

              { activeTab === 0 && (
                <OverviewTab
                  user={ user }
                  pointsData={ pointsData }
                  membershipData={ membershipData }
                  orders={ recentOrders }
                  ordersLoading={ ordersLoading }
                  onTabChange={ changeTab }
                />
              ) }
              { activeTab === 1 && <OrdersTab userId={ user.id } /> }
              { activeTab === 2 && <RewardsTab userId={ user.id } /> }
              { activeTab === 3 && (
                <ProCareTab
                  userId={ user.id }
                  membershipData={ membershipData }
                  onMembershipUpdate={ setMembershipData }
                />
              ) }
              { activeTab === 4 && <AddressesTab user={ user } /> }
              { activeTab === 5 && <SettingsTab /> }
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile logout button (bottom of page) ── */}
      <div style={ { padding: '0 clamp(1.25rem, 5vw, 3rem) clamp(2rem, 4vw, 3rem)', maxWidth: '1200px', margin: '0 auto' } }>
        <button
          type="button"
          onClick={ handleLogout }
          className="dash-logout-mobile"
          style={ {
            display:        'flex',
            alignItems:     'center',
            gap:            '8px',
            padding:        '12px 16px',
            borderRadius:   '10px',
            border:         '1px solid rgba(220,38,38,0.2)',
            background:     '#fef2f2',
            color:          '#dc2626',
            fontSize:       '0.875rem',
            fontWeight:     650,
            cursor:         'pointer',
            width:          '100%',
            justifyContent: 'center',
            transition:     'background 0.15s',
          } }
          onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#fee2e2'; } }
          onMouseLeave={ ( e ) => { e.currentTarget.style.background = '#fef2f2'; } }
        >
          <LogOut size={ 15 } /> Sign out
        </button>
      </div>

      {/* ── Responsive CSS ── */}
      <style>{ `
        /* Hide the desktop logout in the hero on mobile — the bottom button handles it */
        .dash-logout-btn { display: none; }
        @media (min-width: 640px) {
          .dash-logout-btn    { display: flex !important; }
          .dash-logout-mobile { display: none !important; }
        }

        /* Show shorter labels on very small screens */
        @media (max-width: 430px) {
          .dash-tab-label { font-size: 0.76rem; }
        }

        /* Hide scrollbar on tab strip */
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      ` }</style>
    </div>
  );
}
