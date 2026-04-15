/**
 * frontend/src/pages/Rewards.jsx
 *
 * Authenticated user rewards page — /rewards
 *
 * Shows current point balance, USD value, transaction history,
 * and a redemption flow (slider → redeem → copy coupon code).
 *
 * Auth: Redirects to /login if unauthenticated.
 * Data: getUserPoints, getPointsHistory, redeemPoints from api/rewards.js
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Star, ArrowRight, ChevronRight, Loader } from 'lucide-react';
import { useAuthContext } from '../auth/AuthContext.js';
import AccountLayout from '../components/AccountLayout.jsx';
import SEOHead from '../components/SEOHead';
import {
  getUserPoints,
  getPointsHistory,
  redeemPoints,
  pointsToUsd,
  POINTS_MIN_REDEEM,
  POINTS_MAX_REDEEM,
  POINTS_REDEEM_STEP,
  POINTS_EARN_RATE,
  POINTS_EXPIRY_MONTHS,
} from '../api/rewards.js';

// ─── Animation variants ───────────────────────────────────────────────────────

const cardVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: ( delay ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [ 0.16, 1, 0.3, 1 ], delay: delay ?? 0 },
  } ),
};

// ─── Event type display helpers ───────────────────────────────────────────────

const EVENT_LABELS = {
  purchase:   'Purchase',
  redeem:     'Redemption',
  refund:     'Refund (reversed)',
  membership: 'Membership Bonus',
  admin:      'Manual Adjustment',
  referral:   'Referral Bonus',
  unknown:    'Activity',
};

function eventLabel( type ) {
  return EVENT_LABELS[ type ] ?? EVENT_LABELS.unknown;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Rewards() {
  const { user } = useAuthContext();

  const [balance,          setBalance         ] = useState( null );
  const [history,          setHistory         ] = useState( null );
  const [historyOffset,    setHistoryOffset   ] = useState( 0 );
  const [loadingBalance,   setLoadingBalance  ] = useState( true );
  const [loadingHistory,   setLoadingHistory  ] = useState( true );

  // Redemption state
  const [redeeming,        setRedeeming       ] = useState( false );
  const [redeemPts,        setRedeemPts       ] = useState( POINTS_MIN_REDEEM );
  const [redeemResult,     setRedeemResult    ] = useState( null );
  const [redeemError,      setRedeemError     ] = useState( '' );
  const [copied,           setCopied          ] = useState( false );

  const loadBalance = useCallback( () => {
    if ( ! user?.id ) return;
    setLoadingBalance( true );
    getUserPoints( user.id )
      .then( setBalance )
      .catch( () => {} )
      .finally( () => setLoadingBalance( false ) );
  }, [ user?.id ] );

  const loadHistory = useCallback( ( offset = 0 ) => {
    if ( ! user?.id ) return;
    setLoadingHistory( true );
    getPointsHistory( user.id, 10, offset )
      .then( ( data ) => {
        if ( offset === 0 ) {
          setHistory( data );
        } else {
          setHistory( ( prev ) => ( {
            ...data,
            events: [ ...( prev?.events ?? [] ), ...data.events ],
          } ) );
        }
        setHistoryOffset( offset );
      } )
      .catch( () => {} )
      .finally( () => setLoadingHistory( false ) );
  }, [ user?.id ] );

  useEffect( () => {
    loadBalance();
    loadHistory( 0 );
  }, [ loadBalance, loadHistory ] );

  if ( ! user ) return null;

  const availablePts    = balance?.points ?? 0;
  const clampedMax      = Math.min( POINTS_MAX_REDEEM, availablePts );
  const roundedMax      = Math.floor( clampedMax / POINTS_REDEEM_STEP ) * POINTS_REDEEM_STEP;
  const redeemDisabled  = availablePts < POINTS_MIN_REDEEM;
  const redeemUsd       = pointsToUsd( redeemPts );

  async function handleRedeem() {
    setRedeemError( '' );
    setRedeemResult( null );
    setRedeeming( true );
    try {
      const result = await redeemPoints( user.id, redeemPts );
      setRedeemResult( result );
      setBalance( ( prev ) => prev ? { ...prev, points: result.new_balance } : prev );
    } catch ( err ) {
      setRedeemError( err.message || 'Redemption failed. Please try again.' );
    } finally {
      setRedeeming( false );
    }
  }

  function copyCoupon() {
    if ( ! redeemResult?.coupon_code ) return;
    navigator.clipboard?.writeText( redeemResult.coupon_code ).then( () => {
      setCopied( true );
      setTimeout( () => setCopied( false ), 2500 );
    } );
  }

  return (
    <AccountLayout title="My Rewards" subtitle={ `Earn 1 pt per $2 spent · $5 per 100 pts · Expire after ${ POINTS_EXPIRY_MONTHS } months` }>
      <SEOHead noindex title="My Rewards" />

        {/* Balance card */}
        <Motion.div custom={ 0 } variants={ cardVariants } initial="hidden" animate="visible"
          style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' } }
        >
          { loadingBalance ? (
            <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
              <Loader size={ 18 } className="animate-spin text-primary-600" />
              <span style={ { fontSize: '0.875rem', color: 'rgba(15,23,42,0.5)' } }>Loading balance…</span>
            </div>
          ) : (
            <div style={ { display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' } }>
              <div style={ { display: 'flex', alignItems: 'center', gap: '12px' } }>
                <div style={ { width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                  <Star size={ 22 } style={ { color: '#16a34a' } } />
                </div>
                <div>
                  <p style={ { margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.45)' } }>Current Balance</p>
                  <p style={ { margin: '2px 0 0', fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 } }>
                    ${ pointsToUsd( availablePts ).toFixed( 2 ) }
                  </p>
                  <p style={ { margin: '3px 0 0', fontSize: '0.8rem', color: 'rgba(15,23,42,0.4)' } }>({ availablePts } pts)</p>
                </div>
              </div>

              { balance && (
                <div style={ { display: 'flex', gap: '20px', flexWrap: 'wrap', paddingLeft: '24px', borderLeft: '1px solid rgba(15,23,42,0.08)' } }>
                  <div>
                    <p style={ { margin: 0, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.4)' } }>Earned</p>
                    <p style={ { margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' } }>{ balance.points_earned } pts</p>
                  </div>
                  <div>
                    <p style={ { margin: 0, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.4)' } }>Redeemed</p>
                    <p style={ { margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' } }>{ balance.points_redeemed } pts</p>
                  </div>
                </div>
              ) }
            </div>
          ) }
        </Motion.div>

        {/* Earn guide */}
        <Motion.div custom={ 0.08 } variants={ cardVariants } initial="hidden" animate="visible"
          style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '20px 24px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' } }
        >
          <h2 style={ { margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' } }>How You Earn</h2>
          <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' } }>
            { [
              { label: 'Every order',      desc: `1 pt per $2 spent (${ POINTS_EARN_RATE } pts/$1)` },
              { label: 'ProCare enroll',   desc: 'Up to 200 bonus pts on tier upgrade' },
              { label: 'First purchase',   desc: 'Double pts on your first order (promo)' },
            ].map( ( item ) => (
              <div key={ item.label } style={ { background: '#f8fafc', borderRadius: '6px', padding: '12px 14px' } }>
                <p style={ { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' } }>{ item.label }</p>
                <p style={ { margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(15,23,42,0.55)' } }>{ item.desc }</p>
              </div>
            ) ) }
          </div>
        </Motion.div>

        {/* Redeem */}
        <Motion.div custom={ 0.14 } variants={ cardVariants } initial="hidden" animate="visible"
          style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' } }
        >
          <h2 style={ { margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' } }>Redeem Points</h2>
          <p style={ { margin: '0 0 20px', fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)' } }>
            Minimum 100 pts ($5.00) · Maximum 5,000 pts ($250.00) · Multiples of 100 only · Coupon valid 7 days
          </p>

          { redeemDisabled ? (
            <p style={ { fontSize: '0.85rem', color: 'rgba(15,23,42,0.5)', margin: 0 } }>
              You need at least { POINTS_MIN_REDEEM } points (${ pointsToUsd( POINTS_MIN_REDEEM ).toFixed( 2 ) }) to redeem.
              <Link to="/products" style={ { marginLeft: '8px', color: '#2563eb', fontWeight: 600 } }>Shop now</Link>
            </p>
          ) : redeemResult ? (
            <div style={ { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '16px 20px' } }>
              <p style={ { margin: '0 0 8px', fontWeight: 700, color: '#15803d', fontSize: '0.95rem' } }>
                🎉 Coupon generated — ${ redeemResult.discount_amount.toFixed( 2 ) } off
              </p>
              <div style={ { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }>
                <code style={ { background: 'white', border: '1px solid #86efac', borderRadius: '4px', padding: '6px 14px', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.08em', color: '#0f172a' } }>
                  { redeemResult.coupon_code }
                </code>
                <button
                  type="button"
                  onClick={ copyCoupon }
                  style={ { padding: '6px 14px', borderRadius: '4px', border: '1px solid #86efac', background: copied ? '#16a34a' : 'white', color: copied ? 'white' : '#15803d', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s, color 0.2s' } }
                >
                  { copied ? '✓ Copied' : 'Copy Code' }
                </button>
              </div>
              <p style={ { margin: '10px 0 0', fontSize: '0.75rem', color: 'rgba(15,23,42,0.5)' } }>
                New balance: { redeemResult.new_balance } pts (
                ${ pointsToUsd( redeemResult.new_balance ).toFixed( 2 ) })
                · Apply at checkout · Expires in 7 days
              </p>
              <button type="button" onClick={ () => { setRedeemResult( null ); loadBalance(); } }
                style={ { marginTop: '10px', fontSize: '0.78rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 } }
              >
                Redeem more points
              </button>
            </div>
          ) : (
            <>
              <div style={ { marginBottom: '16px' } }>
                <label style={ { fontSize: '0.8rem', fontWeight: 700, color: 'rgba(15,23,42,0.7)', display: 'block', marginBottom: '10px' } }>
                  Redeem&nbsp;
                  <span style={ { color: '#0f172a', fontWeight: 800 } }>{ redeemPts } pts</span>
                  &nbsp;=&nbsp;
                  <span style={ { color: '#16a34a', fontWeight: 800 } }>${ redeemUsd.toFixed( 2 ) } off</span>
                </label>
                <input
                  type="range"
                  min={ POINTS_MIN_REDEEM }
                  max={ roundedMax || POINTS_MIN_REDEEM }
                  step={ POINTS_REDEEM_STEP }
                  value={ redeemPts }
                  onChange={ ( e ) => setRedeemPts( Number( e.target.value ) ) }
                  style={ { width: '100%', accentColor: 'var(--primary-600)' } }
                />
                <div style={ { display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(15,23,42,0.4)', marginTop: '4px' } }>
                  <span>{ POINTS_MIN_REDEEM } pts (${ pointsToUsd( POINTS_MIN_REDEEM ).toFixed( 2 ) })</span>
                  <span>{ roundedMax } pts (${ pointsToUsd( roundedMax ).toFixed( 2 ) })</span>
                </div>
              </div>

              { redeemError && (
                <p style={ { fontSize: '0.82rem', color: '#ef4444', marginBottom: '12px' } }>{ redeemError }</p>
              ) }

              <button
                type="button"
                onClick={ handleRedeem }
                disabled={ redeeming || redeemPts < POINTS_MIN_REDEEM }
                className="alloy-button"
                style={ { display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: redeeming ? 0.6 : 1 } }
              >
                { redeeming ? <><Loader size={ 14 } className="animate-spin" /> Generating…</> : <>Redeem ${ redeemUsd.toFixed( 2 ) } Off <ArrowRight size={ 14 } /></> }
              </button>
            </>
          ) }
        </Motion.div>

        {/* Transaction history */}
        <Motion.div custom={ 0.2 } variants={ cardVariants } initial="hidden" animate="visible"
          style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' } }
        >
          <h2 style={ { margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' } }>Activity History</h2>

          { loadingHistory && ! history ? (
            <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
              <Loader size={ 16 } className="animate-spin text-primary-600" />
              <span style={ { fontSize: '0.85rem', color: 'rgba(15,23,42,0.5)' } }>Loading history…</span>
            </div>
          ) : history?.events?.length === 0 ? (
            <p style={ { fontSize: '0.85rem', color: 'rgba(15,23,42,0.45)', margin: 0 } }>
              No activity yet. <Link to="/products" style={ { color: '#2563eb' } }>Shop now</Link> to start earning.
            </p>
          ) : (
            <>
              <div>
                { ( history?.events ?? [] ).map( ( evt, i ) => {
                  const isEarn = evt.points > 0;
                  return (
                    <div key={ i } style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' } }>
                      <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
                        <div style={ { width: '32px', height: '32px', borderRadius: '8px', background: isEarn ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                          <Star size={ 14 } style={ { color: isEarn ? '#16a34a' : '#dc2626' } } />
                        </div>
                        <div>
                          <p style={ { margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' } }>{ eventLabel( evt.event ) }</p>
                          { evt.note && <p style={ { margin: '2px 0 0', fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)' } }>{ evt.note }</p> }
                        </div>
                      </div>
                      <div style={ { textAlign: 'right' } }>
                        <p style={ { margin: 0, fontWeight: 800, fontSize: '0.9rem', color: isEarn ? '#16a34a' : '#dc2626' } }>
                          { isEarn ? '+' : '' }{ evt.points } pts
                        </p>
                        { evt.date && (
                          <p style={ { margin: '2px 0 0', fontSize: '0.7rem', color: 'rgba(15,23,42,0.35)' } }>
                            { new Date( evt.date ).toLocaleDateString() }
                          </p>
                        ) }
                      </div>
                    </div>
                  );
                } ) }
              </div>

              { history && history.events.length < history.total && (
                <button
                  type="button"
                  onClick={ () => loadHistory( historyOffset + 10 ) }
                  disabled={ loadingHistory }
                  style={ { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 } }
                >
                  { loadingHistory ? <Loader size={ 13 } className="animate-spin" /> : <ChevronRight size={ 13 } /> }
                  { loadingHistory ? 'Loading…' : 'Load more' }
                </button>
              ) }
            </>
          ) }
        </Motion.div>

        {/* Back to dashboard */}
        <div>
          <Link to="/dashboard" style={ { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(15,23,42,0.5)', textDecoration: 'none' } }>
            ← Back to Dashboard
          </Link>
        </div>

    </AccountLayout>
  );
}
