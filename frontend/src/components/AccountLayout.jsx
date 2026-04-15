/**
 * frontend/src/components/AccountLayout.jsx
 *
 * Shared layout wrapper for all authenticated account sub-pages.
 *
 * Renders:
 *   - Gradient hero strip (matching the dashboard aesthetic) with back-link,
 *     page title, and optional subtitle.
 *   - Constrained, padded content area.
 *   - Auth redirect (to /login) if the session is not authenticated.
 *
 * Usage:
 *   <AccountLayout title="My Orders" subtitle="View and track your purchases">
 *     <YourPageContent />
 *   </AccountLayout>
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { ChevronLeft, Loader } from 'lucide-react';
import { useAuthContext } from '../auth/AuthContext.js';

// Dot-grid overlay reused across all account pages
const DOT_GRID = {
  position:        'absolute',
  inset:           0,
  backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1px, transparent 0)',
  backgroundSize:  '36px 36px',
  pointerEvents:   'none',
};

export default function AccountLayout( {
  title,
  subtitle,
  backTo     = '/dashboard',
  backLabel  = 'My Account',
  maxWidth   = '900px',
  children,
} ) {
  const navigate                             = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuthContext();

  useEffect( () => {
    if ( ! isLoading && ! isAuthenticated ) {
      navigate( '/login', { replace: true } );
    }
  }, [ isLoading, isAuthenticated, navigate ] );

  if ( isLoading || ! user ) {
    return (
      <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' } }>
        <Loader className="animate-spin" size={ 32 } style={ { color: '#2563eb' } } />
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f4f6fb' } }>

      {/* ── Hero strip ── */}
      <div style={ {
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding:    'clamp(2rem, 5vw, 3.5rem) clamp(1.25rem, 5vw, 3rem)',
        position:   'relative',
        overflow:   'hidden',
      } }>
        <div style={ DOT_GRID } />

        <div style={ { position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' } }>

          {/* Back link */}
          <Motion.div
            initial={ { opacity: 0, x: -8 } }
            animate={ { opacity: 1, x: 0  } }
            transition={ { duration: 0.35, ease: [ 0.16, 1, 0.3, 1 ] } }
            style={ { marginBottom: '12px' } }
          >
            <Link
              to={ backTo }
              style={ {
                display:        'inline-flex',
                alignItems:     'center',
                gap:            '4px',
                color:          'rgba(255,255,255,0.6)',
                fontSize:       '0.78rem',
                fontWeight:     600,
                textDecoration: 'none',
                letterSpacing:  '0.01em',
                transition:     'color 0.15s',
              } }
              onMouseEnter={ ( e ) => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; } }
              onMouseLeave={ ( e ) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; } }
            >
              <ChevronLeft size={ 14 } />
              { backLabel }
            </Link>
          </Motion.div>

          <Motion.div
            initial={ { opacity: 0, y: 12 } }
            animate={ { opacity: 1, y: 0  } }
            transition={ { duration: 0.45, ease: [ 0.16, 1, 0.3, 1 ], delay: 0.05 } }
          >
            <h1 style={ {
              color:         'white',
              fontSize:      'clamp(1.35rem, 3vw, 1.9rem)',
              fontWeight:    800,
              margin:        0,
              letterSpacing: '-0.02em',
              lineHeight:    1.15,
            } }>
              { title }
            </h1>
            { subtitle && (
              <p style={ { color: 'rgba(255,255,255,0.6)', margin: '6px 0 0', fontSize: '0.88rem' } }>
                { subtitle }
              </p>
            ) }
          </Motion.div>

        </div>
      </div>

      {/* ── Page content ── */}
      <div style={ {
        maxWidth: maxWidth,
        margin:   '0 auto',
        padding:  'clamp(1.5rem, 4vw, 2.5rem) clamp(1.25rem, 4vw, 2rem)',
      } }>
        { children }
      </div>

    </div>
  );
}
