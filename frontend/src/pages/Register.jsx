/**
 * frontend/src/pages/Register.jsx
 *
 * Modern, mobile-first account creation page.
 *
 * Design:
 *   - Mirrored two-column layout (hero right, card left on ≥lg).
 *   - Framer Motion staggered field entrance animations.
 *   - Real-time password strength meter (Weak / Fair / Strong / Very Strong).
 *   - Confirm-password inline validation.
 *   - AnimatePresence error banner.
 *   - Breathing dot loader during submit.
 *   - Guest checkout notice so users know login is never required for shopping.
 *
 * Auth:
 *   Calls useAuthContext().register() which POSTs to /dtb/v1/auth/register.
 *   The backend endpoint is planned; until it exists the call will return an
 *   error and the UI will surface it gracefully via the error banner.
 *
 * Routing:
 *   - On success → /dashboard
 *   - Link back to /login for existing users.
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, ShoppingCart } from 'lucide-react';

import { useAuthContext } from '../auth/AuthContext.js';

// ─── Password strength scoring ────────────────────────────────────────────────

function scorePassword( pw ) {
  if ( ! pw ) return 0;
  let score = 0;
  if ( pw.length >= 8  ) score++;
  if ( pw.length >= 12 ) score++;
  if ( /[A-Z]/.test( pw ) ) score++;
  if ( /[0-9]/.test( pw ) ) score++;
  if ( /[^A-Za-z0-9]/.test( pw ) ) score++;
  return Math.min( score, 4 );
}

const STRENGTH_META = [
  { label: 'Too short', color: '#dc2626', bg: '#fef2f2' },
  { label: 'Weak',      color: '#ea580c', bg: '#fff7ed' },
  { label: 'Fair',      color: '#ca8a04', bg: '#fefce8' },
  { label: 'Strong',    color: '#16a34a', bg: '#f0fdf4' },
  { label: 'Very Strong', color: '#15803d', bg: '#dcfce7' },
];

// ─── Animation variants ───────────────────────────────────────────────────────

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
    transition: { duration: 0.35, ease: [ 0.16, 1, 0.3, 1 ], delay: 0.1 + i * 0.075 },
  } ),
};

const errorVariants = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0,  height: 'auto', transition: { duration: 0.28, ease: [ 0.16, 1, 0.3, 1 ] } },
  exit:    { opacity: 0, y: -4, height: 0,      transition: { duration: 0.18, ease: 'easeIn' } },
};

// ─── BreathingLoader ──────────────────────────────────────────────────────────

function BreathingLoader( { label = 'Creating account…' } ) {
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

// ─── PasswordStrengthBar ──────────────────────────────────────────────────────

function PasswordStrengthBar( { password } ) {
  const score = useMemo( () => scorePassword( password ), [ password ] );
  if ( ! password ) return null;
  const meta = STRENGTH_META[ score ];

  return (
    <Motion.div
      initial={ { opacity: 0, height: 0 } }
      animate={ { opacity: 1, height: 'auto' } }
      exit={ { opacity: 0, height: 0 } }
      transition={ { duration: 0.22 } }
      style={ { overflow: 'hidden', marginTop: '8px' } }
    >
      {/* bar track */}
      <div style={ { display: 'flex', gap: '4px', marginBottom: '6px' } }>
        { [ 1, 2, 3, 4 ].map( ( seg ) => (
          <Motion.div
            key={ seg }
            style={ {
              flex:         1,
              height:       '3px',
              borderRadius: '2px',
              background:   score >= seg ? meta.color : 'rgba(15,23,42,0.08)',
            } }
            animate={ { background: score >= seg ? meta.color : 'rgba(15,23,42,0.08)' } }
            transition={ { duration: 0.25 } }
          />
        ) ) }
      </div>
      <p style={ { margin: 0, fontSize: '0.72rem', color: meta.color, fontWeight: 600 } }>
        { meta.label }
      </p>
    </Motion.div>
  );
}

// ─── Register page ────────────────────────────────────────────────────────────

export default function Register() {
  const navigate               = useNavigate();
  const { register, isLoading } = useAuthContext();

  const [ firstName,   setFirstName   ] = useState( '' );
  const [ lastName,    setLastName    ] = useState( '' );
  const [ email,       setEmail       ] = useState( '' );
  const [ password,    setPassword    ] = useState( '' );
  const [ confirm,     setConfirm     ] = useState( '' );
  const [ showPw,      setShowPw      ] = useState( false );
  const [ showConfirm, setShowConfirm ] = useState( false );
  const [ referralCode, setReferralCode ] = useState( '' );
  const [ submitError, setSubmitError ] = useState( null );
  const [ submitting,  setSubmitting  ] = useState( false );

  const pwScore         = useMemo( () => scorePassword( password ), [ password ] );
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const confirmMatch    = confirm.length > 0 && confirm === password;

  const handleSubmit = async ( e ) => {
    e.preventDefault();
    setSubmitError( null );

    if ( password !== confirm ) {
      setSubmitError( 'Passwords do not match.' );
      return;
    }
    if ( pwScore < 2 ) {
      setSubmitError( 'Please choose a stronger password (at least 8 characters with uppercase letters, numbers, or special characters — Fair strength or better required).' );
      return;
    }

    setSubmitting( true );
    try {
      await register( { firstName, lastName, email, password, referralCode: referralCode.trim() || undefined } );
      navigate( '/dashboard', { replace: true } );
    } catch ( err ) {
      setSubmitError( err.message || 'Registration failed. Please try again.' );
    } finally {
      setSubmitting( false );
    }
  };

  const busy = submitting || isLoading;

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh' } }>
      {/* ── Two-column wrapper — card left, hero right ── */}
      <div style={ {
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        minHeight:           '100vh',
      } }>

        {/* ── Left: registration card ── */}
        <div style={ {
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         'clamp(2rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
          background:      '#f8fafc',
          order:           0,
        } }>
          <Motion.div
            variants={ cardVariants }
            initial="hidden"
            animate="visible"
            style={ {
              background:   'white',
              border:       '1px solid rgba(15,23,42,0.08)',
              borderRadius: '8px',
              padding:      'clamp(2rem, 5vw, 2.75rem)',
              width:        '100%',
              maxWidth:     '440px',
              boxShadow:    '0 8px 32px rgba(15,23,42,0.07)',
            } }
          >
            {/* Card header */}
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
                <UserPlus size={ 20 } style={ { color: '#2563eb' } } />
              </div>
              <h2 style={ {
                fontSize:      '1.4rem',
                fontWeight:    800,
                color:         '#0f172a',
                margin:        '0 0 6px',
                letterSpacing: '-0.02em',
              } }>
                Create account
              </h2>
              <p style={ { fontSize: '0.875rem', color: 'rgba(15,23,42,0.5)', margin: 0 } }>
                Already have one?{ ' ' }
                <Link to="/login" style={ { color: '#2563eb', fontWeight: 600, textDecoration: 'none' } }>
                  Sign in
                </Link>
              </p>
            </div>

            {/* Error banner */}
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

            {/* Form */}
            <form onSubmit={ handleSubmit } noValidate>

              {/* Name row */}
              <div style={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }>
                <Motion.div className="form-group" custom={ 0 } variants={ fieldVariants } initial="hidden" animate="visible">
                  <label className="machined-label text-blue-600" htmlFor="reg-first">First Name</label>
                  <input
                    id="reg-first"
                    type="text"
                    className="machined-input text-black"
                    placeholder="Jane"
                    value={ firstName }
                    onChange={ ( e ) => setFirstName( e.target.value ) }
                    required
                    autoComplete="given-name"
                    disabled={ busy }
                  />
                </Motion.div>

                <Motion.div className="form-group" custom={ 1 } variants={ fieldVariants } initial="hidden" animate="visible">
                  <label className="machined-label text-blue-600" htmlFor="reg-last">Last Name</label>
                  <input
                    id="reg-last"
                    type="text"
                    className="machined-input text-black"
                    placeholder="Doe"
                    value={ lastName }
                    onChange={ ( e ) => setLastName( e.target.value ) }
                    required
                    autoComplete="family-name"
                    disabled={ busy }
                  />
                </Motion.div>
              </div>

              <Motion.div className="form-group" custom={ 2 } variants={ fieldVariants } initial="hidden" animate="visible">
                <label className="machined-label text-blue-600" htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
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

              <Motion.div className="form-group" custom={ 3 } variants={ fieldVariants } initial="hidden" animate="visible">
                <label className="machined-label text-blue-600" htmlFor="reg-password">Password</label>
                <div style={ { position: 'relative' } }>
                  <input
                    id="reg-password"
                    type={ showPw ? 'text' : 'password' }
                    className="machined-input text-black"
                    placeholder="Create a strong password"
                    value={ password }
                    onChange={ ( e ) => setPassword( e.target.value ) }
                    required
                    autoComplete="new-password"
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
                      lineHeight: 1,
                    } }
                    aria-label={ showPw ? 'Hide password' : 'Show password' }
                  >
                    { showPw ? <EyeOff size={ 16 } /> : <Eye size={ 16 } /> }
                  </button>
                </div>
                <AnimatePresence>
                  { password && <PasswordStrengthBar password={ password } /> }
                </AnimatePresence>
              </Motion.div>

              <Motion.div className="form-group" custom={ 4 } variants={ fieldVariants } initial="hidden" animate="visible">
                <label className="machined-label text-blue-600" htmlFor="reg-confirm">Confirm Password</label>
                <div style={ { position: 'relative' } }>
                  <input
                    id="reg-confirm"
                    type={ showConfirm ? 'text' : 'password' }
                    className={ `machined-input text-black${ confirmMismatch ? ' border-red-400' : '' }` }
                    placeholder="Repeat your password"
                    value={ confirm }
                    onChange={ ( e ) => setConfirm( e.target.value ) }
                    required
                    autoComplete="new-password"
                    disabled={ busy }
                    style={ {
                      paddingRight:  '48px',
                      borderColor:   confirmMismatch ? '#f87171' : undefined,
                    } }
                  />
                  {/* eye toggle */}
                  <button
                    type="button"
                    onClick={ () => setShowConfirm( ( v ) => ! v ) }
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
                      lineHeight: 1,
                    } }
                    aria-label={ showConfirm ? 'Hide confirm password' : 'Show confirm password' }
                  >
                    { showConfirm ? <EyeOff size={ 16 } /> : <Eye size={ 16 } /> }
                  </button>
                  {/* match indicator */}
                  { confirmMatch && (
                    <CheckCircle
                      size={ 16 }
                      style={ {
                        position:  'absolute',
                        right:     '42px',
                        top:       '50%',
                        transform: 'translateY(-50%)',
                        color:     '#16a34a',
                      } }
                    />
                  ) }
                </div>
                <AnimatePresence>
                  { confirmMismatch && (
                    <Motion.p
                      initial={ { opacity: 0, height: 0 } }
                      animate={ { opacity: 1, height: 'auto' } }
                      exit={ { opacity: 0, height: 0 } }
                      transition={ { duration: 0.2 } }
                      style={ {
                        margin:   '6px 0 0',
                        fontSize: '0.75rem',
                        color:    '#dc2626',
                        overflow: 'hidden',
                      } }
                    >
                      Passwords don&apos;t match
                    </Motion.p>
                  ) }
                </AnimatePresence>
              </Motion.div>

              <Motion.div className="form-group" custom={ 5 } variants={ fieldVariants } initial="hidden" animate="visible">
                <label className="machined-label text-blue-600" htmlFor="reg-referral">
                  Referral Code
                  <span style={ {
                    marginLeft:    '6px',
                    fontSize:      '0.68rem',
                    fontWeight:    500,
                    color:         'rgba(15,23,42,0.38)',
                    letterSpacing: '0.02em',
                    textTransform: 'none',
                  } }>
                    (optional)
                  </span>
                </label>
                <input
                  id="reg-referral"
                  type="text"
                  className="machined-input text-black"
                  placeholder="Enter referral code"
                  value={ referralCode }
                  onChange={ ( e ) => setReferralCode( e.target.value ) }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={ false }
                  disabled={ busy }
                />
              </Motion.div>

              <Motion.div
                custom={ 6 }
                variants={ fieldVariants }
                initial="hidden"
                animate="visible"
                style={ { marginTop: '8px' } }
              >
                <button
                  type="submit"
                  className="alloy-button w-full justify-center"
                  disabled={ busy }
                  style={ { opacity: busy ? 0.75 : 1, transition: 'opacity 0.2s' } }
                >
                  { busy ? <BreathingLoader /> : 'Create Account' }
                </button>
              </Motion.div>

              <p style={ {
                fontSize:  '0.72rem',
                color:     'rgba(15,23,42,0.4)',
                textAlign: 'center',
                margin:    '16px 0 0',
                lineHeight: 1.55,
              } }>
                By creating an account you agree to our terms of service and privacy policy.
              </p>
            </form>
          </Motion.div>
        </div>

        {/* ── Right: branded hero panel ── */}
        <div style={ {
          background:     'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 50%, #0f172a 100%)',
          padding:        'clamp(3rem, 8vw, 5rem) clamp(2rem, 6vw, 4rem)',
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'center',
          position:       'relative',
          overflow:       'hidden',
          minHeight:      'clamp(200px, 40vw, 100%)',
          order:          1,
        } }>
          {/* dot grid texture */}
          <div style={ {
            position:        'absolute',
            inset:           0,
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1px, transparent 0)',
            backgroundSize:  '40px 40px',
            pointerEvents:   'none',
          } } />

          <Motion.div
            initial={ { opacity: 0, y: 20 } }
            animate={ { opacity: 1, y: 0  } }
            transition={ { duration: 0.6, ease: [ 0.16, 1, 0.3, 1 ] } }
            style={ { position: 'relative', zIndex: 1, maxWidth: '460px' } }
          >
            <div style={ {
              display:       'inline-block',
              background:    'rgba(255,255,255,0.1)',
              border:        '1px solid rgba(255,255,255,0.2)',
              borderRadius:  '3px',
              padding:       '4px 12px',
              fontSize:      '0.68rem',
              fontWeight:    700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color:         'rgba(255,255,255,0.75)',
              marginBottom:  '20px',
            } }>
              New Account
            </div>

            <h1 style={ {
              color:         'white',
              fontSize:      'clamp(2rem, 5vw, 3.2rem)',
              fontWeight:    800,
              margin:        0,
              lineHeight:    1.05,
              letterSpacing: '-0.03em',
            } }>
              JOIN THE<br />TOOLBOX.
            </h1>

            <p style={ {
              color:      'rgba(255,255,255,0.6)',
              fontSize:   'clamp(0.875rem, 1.8vw, 1rem)',
              margin:     '16px 0 0',
              lineHeight: 1.65,
              maxWidth:   '380px',
            } }>
              Track your orders, save your favorites, and get exclusive access to restock alerts and bulk pricing.
            </p>

            {/* Feature list */}
            <div style={ { marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '12px' } }>
              { [
                'Order history & tracking',
                'Saved addresses for fast checkout',
                'Restock & deal alerts',
              ].map( ( item ) => (
                <div key={ item } style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
                  <CheckCircle size={ 16 } style={ { color: 'rgba(134,239,172,0.9)', flexShrink: 0 } } />
                  <span style={ { fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' } }>{ item }</span>
                </div>
              ) ) }
            </div>

            {/* Guest checkout notice */}
            <div style={ {
              marginTop:    '28px',
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
                Account not required.{ ' ' }
                <Link to="/checkout" style={ { color: 'rgba(147,197,253,0.9)', textDecoration: 'underline' } }>
                  Checkout as a guest
                </Link>{ ' ' }
                any time.
              </p>
            </div>
          </Motion.div>
        </div>
      </div>
    </div>
  );
}
