/**
 * frontend/src/pages/Login.jsx
 *
 * Modern, mobile-first login page.
 *
 * Design:
 *   - Full-viewport layout: dark branded hero on left (≥lg) / decorative strip
 *     on top (mobile) with centered card below / beside.
 *   - Framer Motion card entrance + staggered field animations.
 *   - Breathing dot loader during submit.
 *   - AnimatePresence error banner with slide-down entrance.
 *   - Password visibility toggle.
 *   - Guest checkout notice — reinforces no login required for shopping.
 *
 * Auth:
 *   Calls useAuthContext().login() which posts to POST /dtb/v1/auth/login.
 *   On success the HttpOnly dtb_auth cookie is set by the server; the raw JWT
 *   never enters JS memory.
 *
 * Routing:
 *   - Redirect to the requested return target on successful login.
 *   - Link to /register for new users.
 *   - Links to /checkout and /products for guest users.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, LogIn, AlertCircle, ShoppingCart } from 'lucide-react';

import { useAuthContext } from '../auth/AuthContext.js';
import '../styles/auth-frosted-glass.css';

const cardVariants = {
  hidden:  { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.45, ease: [ 0.16, 1, 0.3, 1 ] },
  },
};

const fieldVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: ( i ) => ( {
    opacity: 1, x: 0,
    transition: { duration: 0.35, ease: [ 0.16, 1, 0.3, 1 ], delay: 0.1 + i * 0.08 },
  } ),
};

const errorVariants = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0,  height: 'auto', transition: { duration: 0.28, ease: [ 0.16, 1, 0.3, 1 ] } },
  exit:    { opacity: 0, y: -4, height: 0,      transition: { duration: 0.18, ease: 'easeIn' } },
};

function safeReturnTarget(location) {
  const from = location.state?.from;
  const fromPath = from?.pathname ? `${from.pathname || ''}${from.search || ''}${from.hash || ''}` : '';
  const stateReturn = typeof location.state?.returnTo === 'string' ? location.state.returnTo : '';
  const params = new URLSearchParams(location.search || '');
  const queryReturn = params.get('returnTo') || params.get('return_to') || '';
  const candidate = fromPath || stateReturn || queryReturn || '/dashboard';

  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/dashboard';
  if (candidate.startsWith('/login') || candidate.startsWith('/register')) return '/dashboard';
  return candidate;
}

function BreathingLoader( { label = 'Signing in…' } ) {
  return (
    <span className="flex items-center gap-2 justify-center">
      { [ 0, 1, 2 ].map( ( i ) => (
        <Motion.span
          key={ i }
          className="block w-1.5 h-1.5 rounded-full bg-white"
          animate={ { scale: [ 1, 1.5, 1 ], opacity: [ 0.4, 1, 0.4 ] } }
          transition={ { duration: 1.1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' } }
        />
      ) ) }
      <span className="text-xs tracking-widest uppercase ml-1">{ label }</span>
    </span>
  );
}

export default function Login() {
  const navigate             = useNavigate();
  const location             = useLocation();
  const { login, isLoading } = useAuthContext();

  const [ email,       setEmail       ] = useState( '' );
  const [ password,    setPassword    ] = useState( '' );
  const [ showPw,      setShowPw      ] = useState( false );
  const [ submitError, setSubmitError ] = useState( null );
  const [ submitting,  setSubmitting  ] = useState( false );

  const from = useMemo(() => safeReturnTarget(location), [location]);

  const handleSubmit = async ( e ) => {
    e.preventDefault();
    setSubmitError( null );
    setSubmitting( true );
    try {
      await login( email, password );
      navigate( from, { replace: true } );
    } catch ( err ) {
      setSubmitError( err.message || 'Login failed. Please try again.' );
    } finally {
      setSubmitting( false );
    }
  };

  const busy = submitting || isLoading;

  return (
    <div className="page-wrapper dtb-auth" style={ { minHeight: '100vh' } }>
      <div className="dtb-auth__layout" style={ {
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        minHeight:           '100vh',
      } }>
        <div
          className="hidden md:flex"
          style={ {
          background:     'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
          padding:        'clamp(3rem, 8vw, 5rem) clamp(2rem, 6vw, 4rem)',
          flexDirection:  'column',
          justifyContent: 'center',
          position:       'relative',
          overflow:       'hidden',
          minHeight:      'clamp(220px, 40vw, 100%)',
        } }>
          <div style={ {
            position:            'absolute',
            inset:               0,
            backgroundImage:     'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1px, transparent 0)',
            backgroundSize:      '40px 40px',
            pointerEvents:       'none',
          } } />

          <Motion.div
            initial={ { opacity: 0, y: 20 } }
            animate={ { opacity: 1, y: 0  } }
            transition={ { duration: 0.6, ease: [ 0.16, 1, 0.3, 1 ] } }
            style={ { position: 'relative', zIndex: 1, maxWidth: '460px' } }
          >
            <div style={ {
              display:         'inline-block',
              background:      'rgba(255,255,255,0.1)',
              border:          '1px solid rgba(255,255,255,0.2)',
              borderRadius:    '3px',
              padding:         '4px 12px',
              fontSize:        '0.68rem',
              fontWeight:      700,
              letterSpacing:   '0.14em',
              textTransform:   'uppercase',
              color:           'rgba(255,255,255,0.75)',
              marginBottom:    '20px',
            } }>
              Member Portal
            </div>

            <h1 style={ {
              color:         'white',
              fontSize:      'clamp(2rem, 5vw, 3.2rem)',
              fontWeight:    800,
              margin:        0,
              lineHeight:    1.05,
              letterSpacing: '-0.03em',
            } }>
              WELCOME<br />BACK.
            </h1>

            <p style={ {
              color:      'rgba(255,255,255,0.6)',
              fontSize:   'clamp(0.875rem, 1.8vw, 1rem)',
              margin:     '16px 0 0',
              lineHeight: 1.65,
              maxWidth:   '380px',
            } }>
              Sign in to manage your orders, track shipments, and access exclusive account features.
            </p>

            <div style={ {
              marginTop:    '32px',
              padding:      '14px 18px',
              background:   'rgba(255,255,255,0.07)',
              border:       '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              display:      'flex',
              alignItems:   'flex-start',
              gap:          '12px',
            } }>
              <ShoppingCart size={ 16 } style={ { color: 'rgba(255,255,255,0.65)', marginTop: '2px', flexShrink: 0 } } />
              <p style={ { margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 } }>
                No account needed to shop.{ ' ' }
                <Link to="/products" style={ { color: 'rgba(147,197,253,0.9)', textDecoration: 'underline' } }>
                  Browse as a guest
                </Link>
                { ' ' }or{ ' ' }
                <Link to="/checkout" style={ { color: 'rgba(147,197,253,0.9)', textDecoration: 'underline' } }>
                  check out
                </Link>
                { ' ' }anytime.
              </p>
            </div>
          </Motion.div>
        </div>

        <div className="dtb-auth__form-panel" style={ {
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         'clamp(2rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        } }>
          <Motion.div
            className="dtb-auth__card"
            variants={ cardVariants }
            initial="hidden"
            animate="visible"
            style={ {
              padding:      'clamp(2rem, 5vw, 2.75rem)',
              width:        '100%',
              maxWidth:     '420px',
            } }
          >
            <div style={ { marginBottom: '28px' } }>
              <div style={ {
                width:           '44px',
                height:          '44px',
                background:      'linear-gradient(135deg, #eff6ff, #dbeafe)',
                borderRadius:    '10px',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                marginBottom:    '16px',
              } }>
                <LogIn size={ 20 } style={ { color: '#2563eb' } } />
              </div>
              <h2 style={ {
                fontSize:      '1.4rem',
                fontWeight:    800,
                color:         '#0f172a',
                margin:        '0 0 6px',
                letterSpacing: '-0.02em',
              } }>
                Sign in
              </h2>
              <p style={ { fontSize: '0.875rem', color: 'rgba(15,23,42,0.5)', margin: 0 } }>
                Don&apos;t have an account?{ ' ' }
                <Link to="/register" state={ { returnTo: from } } style={ { color: '#2563eb', fontWeight: 600, textDecoration: 'none' } }>
                  Create one
                </Link>
              </p>
            </div>

            <AnimatePresence>
              { submitError && (
                <Motion.div
                  variants={ errorVariants }
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={ {
                    display:      'flex',
                    alignItems:   'flex-start',
                    gap:          '10px',
                    padding:      '12px 14px',
                    background:   '#fef2f2',
                    border:       '1px solid #fecaca',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    overflow:     'hidden',
                  } }
                >
                  <AlertCircle size={ 16 } style={ { color: '#dc2626', flexShrink: 0, marginTop: '1px' } } />
                  <p style={ { margin: 0, fontSize: '0.825rem', color: '#991b1b', lineHeight: 1.5 } }>
                    { submitError }
                  </p>
                </Motion.div>
              ) }
            </AnimatePresence>

            <form onSubmit={ handleSubmit } noValidate>
              <Motion.div className="form-group" custom={ 0 } variants={ fieldVariants } initial="hidden" animate="visible">
                <label className="machined-label text-blue-600" htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  className="machined-input text-black"
                  placeholder="you@example.com"
                  value={ email }
                  onChange={ ( e ) => setEmail( e.target.value ) }
                  required
                  autoComplete="email"
                  disabled={ busy }
                />
              </Motion.div>

              <Motion.div className="form-group" custom={ 1 } variants={ fieldVariants } initial="hidden" animate="visible" style={ { position: 'relative' } }>
                <label className="machined-label text-blue-600" htmlFor="login-password">Password</label>
                <div style={ { position: 'relative' } }>
                  <input
                    id="login-password"
                    type={ showPw ? 'text' : 'password' }
                    className="machined-input text-black"
                    placeholder="••••••••"
                    value={ password }
                    onChange={ ( e ) => setPassword( e.target.value ) }
                    required
                    autoComplete="current-password"
                    disabled={ busy }
                    style={ { paddingRight: '48px' } }
                  />
                  <button
                    type="button"
                    onClick={ () => setShowPw( ( v ) => ! v ) }
                    style={ {
                      position:   'absolute',
                      right:      '14px',
                      top:        '50%',
                      transform:  'translateY(-50%)',
                      background: 'none',
                      border:     'none',
                      cursor:     'pointer',
                      color:      'rgba(15,23,42,0.4)',
                      padding:    '4px',
                      display:    'flex',
                      lineHeight:  1,
                    } }
                    aria-label={ showPw ? 'Hide password' : 'Show password' }
                  >
                    { showPw ? <EyeOff size={ 16 } /> : <Eye size={ 16 } /> }
                  </button>
                </div>
              </Motion.div>

              <Motion.div custom={ 2 } variants={ fieldVariants } initial="hidden" animate="visible" style={ { marginTop: '8px' } }>
                <button type="submit" className="alloy-button dtb-auth__submit w-full justify-center" disabled={ busy } style={ { opacity: busy ? 0.75 : 1, transition: 'opacity 0.2s' } }>
                  { busy ? <BreathingLoader /> : 'Sign In' }
                </button>
              </Motion.div>

              <Motion.div custom={ 3 } variants={ fieldVariants } initial="hidden" animate="visible" style={ { textAlign: 'center', marginTop: '14px' } }>
                <Link
                  to="/forgot-password"
                  style={ { fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)', textDecoration: 'none' } }
                  onMouseEnter={ ( e ) => { e.currentTarget.style.color = '#2563eb'; } }
                  onMouseLeave={ ( e ) => { e.currentTarget.style.color = 'rgba(15,23,42,0.5)'; } }
                >
                  Forgot your password?
                </Link>
              </Motion.div>
            </form>

            <div style={ { display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' } }>
              <div style={ { flex: 1, height: '1px', background: 'rgba(15,23,42,0.08)' } } />
              <span style={ { fontSize: '0.75rem', color: 'rgba(15,23,42,0.35)', whiteSpace: 'nowrap' } }>or continue as guest</span>
              <div style={ { flex: 1, height: '1px', background: 'rgba(15,23,42,0.08)' } } />
            </div>

            <Link
              to="/products"
              style={ {
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             '8px',
                padding:         '13px 24px',
                border:          '1px solid rgba(15,23,42,0.12)',
                borderRadius:    '4px',
                fontSize:        '0.8rem',
                fontWeight:      600,
                textTransform:   'uppercase',
                letterSpacing:   '0.08em',
                color:           'rgba(15,23,42,0.65)',
                textDecoration:  'none',
                transition:      'border-color 0.2s, color 0.2s',
              } }
              onMouseEnter={ ( e ) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; } }
              onMouseLeave={ ( e ) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = 'rgba(15,23,42,0.65)'; } }
            >
              <ShoppingCart size={ 14 } />
              Browse the Store
            </Link>
          </Motion.div>
        </div>
      </div>
    </div>
  );
}
