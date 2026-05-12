/**
 * frontend/src/components/dashboard/RewardsTab.jsx
 *
 * Dashboard Rewards tab — points balance, earn guide, redemption, history.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Star, ArrowRight, ChevronRight, Loader } from 'lucide-react';
import {
  getUserPoints, getPointsHistory, redeemPoints, pointsToUsd,
  POINTS_MIN_REDEEM, POINTS_MAX_REDEEM, POINTS_REDEEM_STEP,
  POINTS_EARN_RATE, POINTS_EXPIRY_MONTHS,
} from '../../api/rewards.js';

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.36, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const CARD = {
  background:   'white',
  border:       '1px solid rgba(15,23,42,0.08)',
  borderRadius: '12px',
  boxShadow:    '0 2px 12px rgba(15,23,42,0.05)',
  padding:      '20px',
};

const EVENT_LABELS = {
  purchase: 'Purchase', redeem: 'Redemption', refund: 'Refund',
  admin: 'Manual Adjustment', referral: 'Referral Bonus',
};

export default function RewardsTab( { userId } ) {
  const [ balance,        setBalance        ] = useState( null );
  const [ history,        setHistory        ] = useState( null );
  const [ historyOffset,  setHistoryOffset  ] = useState( 0 );
  const [ loadingBalance, setLoadingBalance ] = useState( true );
  const [ loadingHistory, setLoadingHistory ] = useState( true );
  const [ redeeming,      setRedeeming      ] = useState( false );
  const [ redeemPts,      setRedeemPts      ] = useState( POINTS_MIN_REDEEM );
  const [ redeemResult,   setRedeemResult   ] = useState( null );
  const [ redeemError,    setRedeemError    ] = useState( '' );
  const [ copied,         setCopied         ] = useState( false );

  const loadBalance = useCallback( () => {
    if ( ! userId ) return;
    setLoadingBalance( true );
    getUserPoints( userId ).then( setBalance ).catch( () => {} ).finally( () => setLoadingBalance( false ) );
  }, [ userId ] );

  const loadHistory = useCallback( ( offset = 0 ) => {
    if ( ! userId ) return;
    setLoadingHistory( true );
    getPointsHistory( userId, 10, offset )
      .then( ( data ) => {
        if ( offset === 0 ) {
          setHistory( data );
        } else {
          setHistory( ( prev ) => ( { ...data, events: [ ...( prev?.events ?? [] ), ...data.events ] } ) );
        }
        setHistoryOffset( offset );
      } )
      .catch( () => {} )
      .finally( () => setLoadingHistory( false ) );
  }, [ userId ] );

  useEffect( () => { loadBalance(); loadHistory( 0 ); }, [ loadBalance, loadHistory ] );

  const availablePts   = balance?.points ?? 0;
  const clampedMax     = Math.min( POINTS_MAX_REDEEM, availablePts );
  const roundedMax     = Math.floor( clampedMax / POINTS_REDEEM_STEP ) * POINTS_REDEEM_STEP;
  const redeemDisabled = availablePts < POINTS_MIN_REDEEM;
  const redeemUsd      = pointsToUsd( redeemPts );

  async function handleRedeem() {
    setRedeemError( '' );
    setRedeemResult( null );
    setRedeeming( true );
    try {
      const result = await redeemPoints( userId, redeemPts );
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
    <div style={ { display: 'flex', flexDirection: 'column', gap: '16px' } }>

      {/* Balance card */}
      <Motion.div custom={ 0 } variants={ fadeUp } initial="hidden" animate="visible" style={ CARD }>
        { loadingBalance ? (
          <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
            <Loader size={ 16 } className="animate-spin" style={ { color: '#2563eb' } } />
            <span style={ { fontSize: '0.83rem', color: 'rgba(15,23,42,0.45)' } }>Loading balance…</span>
          </div>
        ) : (
          <div style={ { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' } }>
            <div style={ { display: 'flex', alignItems: 'center', gap: '12px' } }>
              <div style={ { width: '46px', height: '46px', borderRadius: '11px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                <Star size={ 20 } style={ { color: '#d97706' } } />
              </div>
              <div>
                <p style={ { margin: 0, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(15,23,42,0.42)' } }>Current Balance</p>
                <p style={ { margin: '2px 0 0', fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 } }>
                  ${ pointsToUsd( availablePts ).toFixed( 2 ) }
                </p>
                <p style={ { margin: '3px 0 0', fontSize: '0.75rem', color: 'rgba(15,23,42,0.38)' } }>({ availablePts } pts)</p>
              </div>
            </div>
            { balance && (
              <div style={ { display: 'flex', gap: '18px', flexWrap: 'wrap', paddingLeft: '20px', borderLeft: '1px solid rgba(15,23,42,0.08)' } }>
                <div>
                  <p style={ { margin: 0, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.38)' } }>Earned</p>
                  <p style={ { margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' } }>{ balance.points_earned } pts</p>
                </div>
                <div>
                  <p style={ { margin: 0, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.38)' } }>Redeemed</p>
                  <p style={ { margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' } }>{ balance.points_redeemed } pts</p>
                </div>
              </div>
            ) }
          </div>
        ) }
        <p style={ { margin: '12px 0 0', fontSize: '0.72rem', color: 'rgba(15,23,42,0.4)' } }>
          1 pt per ${ ( 1 / POINTS_EARN_RATE ).toFixed( 0 ) } spent · $5 per 100 pts · Expire after { POINTS_EXPIRY_MONTHS } months inactivity
        </p>
      </Motion.div>

      {/* How you earn */}
      <Motion.div custom={ 0.07 } variants={ fadeUp } initial="hidden" animate="visible" style={ CARD }>
        <h3 style={ { margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 750, color: '#0f172a' } }>How You Earn</h3>
        <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' } }>
          { [
            { label: 'Every order',    desc: `1 pt per $2 spent (${ POINTS_EARN_RATE } pts/$1)` },
            { label: 'Referral bonus', desc: 'Earn bonus points for successful referrals' },
            { label: 'First purchase', desc: 'Double pts on your first order (promo)' },
          ].map( ( item ) => (
            <div key={ item.label } style={ { background: '#f8fafc', borderRadius: '8px', padding: '10px 12px' } }>
              <p style={ { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' } }>{ item.label }</p>
              <p style={ { margin: '3px 0 0', fontSize: '0.72rem', color: 'rgba(15,23,42,0.5)' } }>{ item.desc }</p>
            </div>
          ) ) }
        </div>
      </Motion.div>

      {/* Redeem */}
      <Motion.div custom={ 0.12 } variants={ fadeUp } initial="hidden" animate="visible" style={ CARD }>
        <h3 style={ { margin: '0 0 5px', fontSize: '0.88rem', fontWeight: 750, color: '#0f172a' } }>Redeem Points</h3>
        <p style={ { margin: '0 0 16px', fontSize: '0.75rem', color: 'rgba(15,23,42,0.45)' } }>
          Min 100 pts ($5) · Max 5,000 pts ($250) · Multiples of 100 · Valid 7 days
        </p>

        { redeemDisabled ? (
          <p style={ { fontSize: '0.83rem', color: 'rgba(15,23,42,0.5)', margin: 0 } }>
            You need at least { POINTS_MIN_REDEEM } pts (${ pointsToUsd( POINTS_MIN_REDEEM ).toFixed( 2 ) }) to redeem.
            <Link to="/products" style={ { marginLeft: '6px', color: '#2563eb', fontWeight: 600 } }>Shop now</Link>
          </p>
        ) : redeemResult ? (
          <div style={ { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px' } }>
            <p style={ { margin: '0 0 10px', fontWeight: 700, color: '#15803d', fontSize: '0.92rem' } }>
              🎉 ${  redeemResult.discount_amount.toFixed( 2 ) } off coupon generated!
            </p>
            <div style={ { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }>
              <code style={ { background: 'white', border: '1px solid #86efac', borderRadius: '6px', padding: '6px 14px', fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em', color: '#0f172a' } }>
                { redeemResult.coupon_code }
              </code>
              <button type="button" onClick={ copyCoupon }
                style={ { padding: '6px 14px', borderRadius: '6px', border: '1px solid #86efac', background: copied ? '#16a34a' : 'white', color: copied ? 'white' : '#15803d', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.18s, color 0.18s' } }
              >
                { copied ? '✓ Copied' : 'Copy' }
              </button>
            </div>
            <p style={ { margin: '10px 0 0', fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)' } }>
              New balance: { redeemResult.new_balance } pts · Apply at checkout · Expires in 7 days
            </p>
            <button type="button" onClick={ () => { setRedeemResult( null ); loadBalance(); } }
              style={ { marginTop: '8px', fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 650, padding: 0 } }
            >
              Redeem more →
            </button>
          </div>
        ) : (
          <>
            <label style={ { fontSize: '0.78rem', fontWeight: 700, color: 'rgba(15,23,42,0.65)', display: 'block', marginBottom: '10px' } }>
              Redeem <span style={ { color: '#0f172a', fontWeight: 800 } }>{ redeemPts } pts</span>{ ' ' }
              = <span style={ { color: '#16a34a', fontWeight: 800 } }>${ redeemUsd.toFixed( 2 ) } off</span>
            </label>
            <input type="range" min={ POINTS_MIN_REDEEM } max={ roundedMax || POINTS_MIN_REDEEM }
              step={ POINTS_REDEEM_STEP } value={ redeemPts }
              onChange={ ( e ) => setRedeemPts( Number( e.target.value ) ) }
              style={ { width: '100%', accentColor: '#2563eb', marginBottom: '6px' } }
            />
            <div style={ { display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'rgba(15,23,42,0.38)', marginBottom: '14px' } }>
              <span>{ POINTS_MIN_REDEEM } pts (${ pointsToUsd( POINTS_MIN_REDEEM ).toFixed( 2 ) })</span>
              <span>{ roundedMax } pts (${ pointsToUsd( roundedMax ).toFixed( 2 ) })</span>
            </div>
            { redeemError && <p style={ { fontSize: '0.8rem', color: '#ef4444', marginBottom: '12px' } }>{ redeemError }</p> }
            <button type="button" onClick={ handleRedeem }
              disabled={ redeeming || redeemPts < POINTS_MIN_REDEEM }
              className="alloy-button"
              style={ { display: 'inline-flex', alignItems: 'center', gap: '7px', opacity: redeeming ? 0.65 : 1 } }
            >
              { redeeming
                ? <><Loader size={ 13 } className="animate-spin" /> Generating…</>
                : <>Redeem ${ redeemUsd.toFixed( 2 ) } Off <ArrowRight size={ 13 } /></> }
            </button>
          </>
        ) }
      </Motion.div>

      {/* History */}
      <Motion.div custom={ 0.18 } variants={ fadeUp } initial="hidden" animate="visible" style={ CARD }>
        <h3 style={ { margin: '0 0 14px', fontSize: '0.88rem', fontWeight: 750, color: '#0f172a' } }>Activity History</h3>

        { loadingHistory && ! history ? (
          <div style={ { display: 'flex', alignItems: 'center', gap: '8px' } }>
            <Loader size={ 15 } className="animate-spin" style={ { color: '#2563eb' } } />
            <span style={ { fontSize: '0.82rem', color: 'rgba(15,23,42,0.45)' } }>Loading history…</span>
          </div>
        ) : history?.events?.length === 0 ? (
          <p style={ { fontSize: '0.83rem', color: 'rgba(15,23,42,0.42)', margin: 0 } }>
            No activity yet. <Link to="/products" style={ { color: '#2563eb' } }>Shop now</Link> to start earning.
          </p>
        ) : (
          <>
            { ( history?.events ?? [] ).map( ( evt, i ) => {
              const isEarn = evt.points > 0;
              return (
                <div key={ i } style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(15,23,42,0.055)' } }>
                  <div style={ { display: 'flex', alignItems: 'center', gap: '9px' } }>
                    <div style={ { width: '30px', height: '30px', borderRadius: '7px', background: isEarn ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
                      <Star size={ 13 } style={ { color: isEarn ? '#16a34a' : '#dc2626' } } />
                    </div>
                    <div>
                      <p style={ { margin: 0, fontSize: '0.83rem', fontWeight: 600, color: '#0f172a' } }>{ EVENT_LABELS[ evt.event ] ?? 'Activity' }</p>
                      { evt.note && <p style={ { margin: '1px 0 0', fontSize: '0.7rem', color: 'rgba(15,23,42,0.42)' } }>{ evt.note }</p> }
                    </div>
                  </div>
                  <div style={ { textAlign: 'right' } }>
                    <p style={ { margin: 0, fontWeight: 800, fontSize: '0.87rem', color: isEarn ? '#16a34a' : '#dc2626' } }>{ isEarn ? '+' : '' }{ evt.points } pts</p>
                    { evt.date && <p style={ { margin: '1px 0 0', fontSize: '0.67rem', color: 'rgba(15,23,42,0.32)' } }>{ new Date( evt.date ).toLocaleDateString() }</p> }
                  </div>
                </div>
              );
            } ) }
            { history && history.events.length < history.total && (
              <button type="button" onClick={ () => loadHistory( historyOffset + 10 ) } disabled={ loadingHistory }
                style={ { marginTop: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 650, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 } }
              >
                { loadingHistory ? <Loader size={ 12 } className="animate-spin" /> : <ChevronRight size={ 12 } /> }
                { loadingHistory ? 'Loading…' : 'Load more' }
              </button>
            ) }
          </>
        ) }
      </Motion.div>

    </div>
  );
}
