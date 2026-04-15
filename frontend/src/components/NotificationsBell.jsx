/**
 * frontend/src/components/NotificationsBell.jsx
 *
 * Notifications bell icon with animated dropdown — rendered in the Header.
 *
 * Behaviour:
 *   - Only renders when the user is authenticated.
 *   - Badge shows unread count (hidden when 0).
 *   - Clicking the bell toggles the dropdown.
 *   - Clicking outside or pressing Escape closes the dropdown.
 *   - Route changes close the dropdown.
 *   - "Mark all read" clears the badge.
 *
 * Data:
 *   Currently uses stub notifications — ready to swap for a real API call.
 *   To wire up: replace the STUB_NOTIFICATIONS constant with a useEffect that
 *   calls GET /wp-json/dtb/v1/notifications?user_id={id}.
 *
 * Props:
 *   None (reads auth from useAuthContext internally).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Package, Star, Shield, Tag, CheckCheck, ChevronRight } from 'lucide-react';
import { useAuthContext } from '../auth/AuthContext.js';

// ─── Notification type config ─────────────────────────────────────────────────

const TYPE_CFG = {
  order:  { Icon: Package, color: '#2563eb', bg: '#eff6ff' },
  reward: { Icon: Star,    color: '#d97706', bg: '#fffbeb' },
  promo:  { Icon: Tag,     color: '#7c3aed', bg: '#faf5ff' },
  system: { Icon: Shield,  color: '#16a34a', bg: '#f0fdf4' },
};

// ─── Stub notifications ───────────────────────────────────────────────────────
// Replace with API data when the backend endpoint is ready.

const STUB_NOTIFICATIONS = [];

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime( iso ) {
  const diff = ( Date.now() - new Date( iso ).getTime() ) / 1000;
  if ( diff < 60     ) return 'Just now';
  if ( diff < 3600   ) return `${ Math.floor( diff / 60 ) }m ago`;
  if ( diff < 86400  ) return `${ Math.floor( diff / 3600 ) }h ago`;
  if ( diff < 604800 ) return `${ Math.floor( diff / 86400 ) }d ago`;
  return new Date( iso ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
}

// ─── NotificationsBell ────────────────────────────────────────────────────────

export default function NotificationsBell() {
  const { isAuthenticated, user }     = useAuthContext();
  const location                      = useLocation();
  const navigate                      = useNavigate();
  const [ open,          setOpen    ] = useState( false );
  const [ notifications, setNotifs  ] = useState( STUB_NOTIFICATIONS );
  const containerRef                  = useRef( null );

  const unreadCount = notifications.filter( ( n ) => ! n.read ).length;

  // Close on outside click
  useEffect( () => {
    if ( ! open ) return;
    const handler = ( e ) => {
      if ( containerRef.current && ! containerRef.current.contains( e.target ) ) {
        setOpen( false );
      }
    };
    document.addEventListener( 'mousedown', handler );
    return () => document.removeEventListener( 'mousedown', handler );
  }, [ open ] );

  // Close on Escape
  useEffect( () => {
    if ( ! open ) return;
    const handler = ( e ) => { if ( e.key === 'Escape' ) setOpen( false ); };
    document.addEventListener( 'keydown', handler );
    return () => document.removeEventListener( 'keydown', handler );
  }, [ open ] );

  // Close on route change
  const prevPath = useRef( location.pathname );
  useEffect( () => {
    if ( prevPath.current !== location.pathname ) {
      prevPath.current = location.pathname;
      const t = setTimeout( () => setOpen( false ), 0 );
      return () => clearTimeout( t );
    }
  }, [ location.pathname ] );

  const markAllRead = useCallback( () => {
    setNotifs( ( prev ) => prev.map( ( n ) => ( { ...n, read: true } ) ) );
  }, [] );

  const handleNotifClick = useCallback( ( notif ) => {
    setNotifs( ( prev ) => prev.map( ( n ) => n.id === notif.id ? { ...n, read: true } : n ) );
    setOpen( false );
    if ( notif.link ) navigate( notif.link );
  }, [ navigate ] );

  if ( ! isAuthenticated || ! user ) return null;

  return (
    <div ref={ containerRef } style={ { position: 'relative', display: 'flex', alignItems: 'center' } }>

      {/* Bell button */}
      <button
        type="button"
        aria-label={ `Notifications${ unreadCount > 0 ? ` (${ unreadCount } unread)` : '' }` }
        aria-expanded={ open }
        onClick={ () => setOpen( ( o ) => ! o ) }
        style={ {
          position:   'relative',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width:      '36px',
          height:     '36px',
          borderRadius: '8px',
          border:     'none',
          background: open ? '#f1f5f9' : 'transparent',
          cursor:     'pointer',
          padding:    0,
          flexShrink: 0,
          transition: 'background 0.15s',
          color:      open ? '#0f172a' : '#475569',
        } }
        onMouseEnter={ ( e ) => { if ( ! open ) e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; } }
        onMouseLeave={ ( e ) => { if ( ! open ) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = open ? '#0f172a' : '#475569'; } }
      >
        <Bell size={ 18 } />

        {/* Unread badge */}
        { unreadCount > 0 && (
          <span style={ {
            position:       'absolute',
            top:            '4px',
            right:          '4px',
            minWidth:       '16px',
            height:         '16px',
            borderRadius:   '999px',
            background:     '#ef4444',
            color:          'white',
            fontSize:       '0.6rem',
            fontWeight:     800,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '0 4px',
            lineHeight:     1,
            border:         '1.5px solid white',
            pointerEvents:  'none',
          } }>
            { unreadCount > 9 ? '9+' : unreadCount }
          </span>
        ) }
      </button>

      {/* Dropdown */}
      <div
        style={ {
          position:        'absolute',
          top:             'calc(100% + 10px)',
          right:           '-8px',
          width:           'min(360px, calc(100vw - 32px))',
          background:      'white',
          border:          '1px solid rgba(15,23,42,0.09)',
          borderRadius:    '14px',
          boxShadow:       '0 12px 40px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)',
          zIndex:          10002,
          overflow:        'hidden',
          opacity:         open ? 1 : 0,
          visibility:      open ? 'visible' : 'hidden',
          pointerEvents:   open ? 'auto' : 'none',
          transform:       open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
          transformOrigin: 'top right',
          transition:      'opacity 180ms ease-out, transform 180ms ease-out, visibility 180ms',
        } }
      >
        {/* Dropdown header */}
        <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid rgba(15,23,42,0.07)' } }>
          <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
            <Bell size={ 15 } style={ { color: '#0f172a' } } />
            <span style={ { fontWeight: 750, fontSize: '0.88rem', color: '#0f172a' } }>Notifications</span>
            { unreadCount > 0 && (
              <span style={ { background: '#eff6ff', color: '#2563eb', borderRadius: '999px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: 800 } }>
                { unreadCount } new
              </span>
            ) }
          </div>
          { unreadCount > 0 && (
            <button
              type="button"
              onClick={ markAllRead }
              style={ { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 650, color: '#2563eb', padding: '2px 6px', borderRadius: '5px', transition: 'background 0.12s' } }
              onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#eff6ff'; } }
              onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'none'; } }
            >
              <CheckCheck size={ 12 } /> Mark all read
            </button>
          ) }
        </div>

        {/* Notification list */}
        <div style={ { maxHeight: '360px', overflowY: 'auto', overscrollBehavior: 'contain' } }>
          { notifications.length === 0 ? (
            <div style={ { padding: '32px 20px', textAlign: 'center' } }>
              <Bell size={ 28 } style={ { color: 'rgba(15,23,42,0.15)', display: 'block', margin: '0 auto 10px' } } />
              <p style={ { margin: '0 0 4px', fontWeight: 650, fontSize: '0.86rem', color: '#0f172a' } }>You're all caught up!</p>
              <p style={ { margin: 0, fontSize: '0.76rem', color: 'rgba(15,23,42,0.42)' } }>No new notifications right now.</p>
            </div>
          ) : (
            notifications.map( ( notif, i ) => {
              const cfg  = TYPE_CFG[ notif.type ] || TYPE_CFG.system;
              return (
                <button
                  key={ notif.id }
                  type="button"
                  onClick={ () => handleNotifClick( notif ) }
                  style={ {
                    display:         'flex',
                    alignItems:      'flex-start',
                    gap:             '11px',
                    width:           '100%',
                    padding:         '12px 14px',
                    background:      notif.read ? 'transparent' : 'rgba(37,99,235,0.03)',
                    borderBottom:    i < notifications.length - 1 ? '1px solid rgba(15,23,42,0.055)' : 'none',
                    border:          'none',
                    cursor:          notif.link ? 'pointer' : 'default',
                    textAlign:       'left',
                    transition:      'background 0.12s',
                  } }
                  onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f8fafc'; } }
                  onMouseLeave={ ( e ) => { e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(37,99,235,0.03)'; } }
                >
                  <div style={ { width: '32px', height: '32px', borderRadius: '8px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' } }>
                    <cfg.Icon size={ 14 } style={ { color: cfg.color } } />
                  </div>
                  <div style={ { flex: 1, minWidth: 0 } }>
                    <p style={ { margin: '0 0 2px', fontSize: '0.82rem', fontWeight: notif.read ? 500 : 700, color: '#0f172a', lineHeight: 1.3 } }>
                      { notif.title }
                    </p>
                    { notif.body && (
                      <p style={ { margin: '0 0 4px', fontSize: '0.74rem', color: 'rgba(15,23,42,0.5)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } }>
                        { notif.body }
                      </p>
                    ) }
                    <p style={ { margin: 0, fontSize: '0.68rem', color: 'rgba(15,23,42,0.35)', fontWeight: 500 } }>
                      { relativeTime( notif.createdAt ) }
                    </p>
                  </div>
                  { ! notif.read && (
                    <span style={ { width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: '6px' } } />
                  ) }
                  { notif.link && (
                    <ChevronRight size={ 13 } style={ { color: 'rgba(15,23,42,0.25)', flexShrink: 0, marginTop: '6px' } } />
                  ) }
                </button>
              );
            } )
          ) }
        </div>

        {/* Footer */}
        <div style={ { padding: '10px 14px', borderTop: '1px solid rgba(15,23,42,0.07)', textAlign: 'center' } }>
          <button
            type="button"
            onClick={ () => { setOpen( false ); navigate( '/dashboard?tab=settings' ); } }
            style={ { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 650, color: 'rgba(15,23,42,0.45)', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'color 0.12s' } }
            onMouseEnter={ ( e ) => { e.currentTarget.style.color = '#2563eb'; } }
            onMouseLeave={ ( e ) => { e.currentTarget.style.color = 'rgba(15,23,42,0.45)'; } }
          >
            Manage notification preferences <ChevronRight size={ 11 } />
          </button>
        </div>
      </div>
    </div>
  );
}
