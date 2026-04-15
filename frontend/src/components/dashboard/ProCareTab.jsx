/**
 * frontend/src/components/dashboard/ProCareTab.jsx
 *
 * Dashboard ProCare tab — current tier, tier comparison, enroll / upgrade CTA.
 */

import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CheckCircle, Shield, Loader } from 'lucide-react';
import {
  MEMBERSHIP_TIERS, FOUNDING_MEMBER_PROMO,
  enrollMembership, isFoundingMemberWindowOpen,
} from '../../api/membership.js';

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.36, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const TIER_FEATURES = {
  essential: [
    '0.5 pts per $1 spent',
    'Full product catalog access',
    '15-day workmanship warranty',
    'Community support',
  ],
  professional: [
    'Everything in Essential',
    '10% off all repair labor',
    '1 free diagnostic / year',
    'Free return shipping ≥ $150',
    '30-day warranty',
    '200 bonus points on enrollment',
    'Priority scheduling',
  ],
  fleet: [
    'Everything in Professional',
    '15% off labor AND parts',
    '2 free diagnostics / year',
    'Free return shipping always',
    '60-day warranty',
    '200 bonus points on enrollment',
    'Dedicated account manager',
    'Fleet billing & net-30 available',
  ],
};

const TIER_COLORS = {
  essential:    { color: 'rgba(15,23,42,0.5)', bg: '#f1f5f9', border: 'rgba(15,23,42,0.1)', badge: '' },
  professional: { color: '#2563eb',             bg: '#eff6ff', border: '#bfdbfe',            badge: 'Most Popular' },
  fleet:        { color: '#16a34a',             bg: '#f0fdf4', border: '#86efac',            badge: 'Best Value' },
};

const TIER_ORDER = [ 'essential', 'professional', 'fleet' ];

export default function ProCareTab( { userId, membershipData, onMembershipUpdate } ) {
  const [ enrolling,     setEnrolling     ] = useState( null );
  const [ enrollError,   setEnrollError   ] = useState( '' );
  const [ enrollSuccess, setEnrollSuccess ] = useState( '' );

  const founding   = isFoundingMemberWindowOpen();
  const currentTier = membershipData?.tier ?? 'essential';

  async function handleEnroll( tier ) {
    setEnrolling( tier );
    setEnrollError( '' );
    setEnrollSuccess( '' );
    try {
      const res = await enrollMembership( userId, tier, founding && tier === 'professional' );
      setEnrollSuccess( `You're now on the ${ res.tier.charAt( 0 ).toUpperCase() + res.tier.slice( 1 ) } plan! ${ res.expires_at ? `Renews ${ new Date( res.expires_at ).toLocaleDateString() }.` : '' }` );
      if ( onMembershipUpdate ) onMembershipUpdate( res );
    } catch ( err ) {
      setEnrollError( err.message || 'Enrollment failed. Please try again.' );
    } finally {
      setEnrolling( null );
    }
  }

  return (
    <div style={ { display: 'flex', flexDirection: 'column', gap: '16px' } }>

      {/* Founding member promo banner */}
      { founding && currentTier === 'essential' && (
        <Motion.div custom={ 0 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ { background: 'linear-gradient(135deg, #0f172a, #1e3a8a)', borderRadius: '12px', padding: '16px 20px', color: 'white' } }
        >
          <p style={ { margin: '0 0 4px', fontWeight: 800, fontSize: '0.9rem' } }>
            🎉 Founding Member — { FOUNDING_MEMBER_PROMO.discountPct * 100 }% off Year 1
          </p>
          <p style={ { margin: 0, fontSize: '0.77rem', color: 'rgba(255,255,255,0.7)' } }>
            Professional plan for ${ FOUNDING_MEMBER_PROMO.discountedPrice }/yr (reg. ${ MEMBERSHIP_TIERS.professional.price }). Limited-time for early members.
          </p>
        </Motion.div>
      ) }

      {/* Current tier status */}
      { membershipData?.tier && membershipData.tier !== 'essential' && (
        <Motion.div custom={ 0.03 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' } }
        >
          <Shield size={ 18 } style={ { color: '#16a34a', flexShrink: 0 } } />
          <div>
            <p style={ { margin: 0, fontWeight: 700, color: '#15803d', fontSize: '0.88rem' } }>
              { membershipData.tier.charAt( 0 ).toUpperCase() + membershipData.tier.slice( 1 ) } Member
            </p>
            <p style={ { margin: '2px 0 0', fontSize: '0.73rem', color: '#16a34a' } }>
              { membershipData.labor_discount > 0 && `${ ( membershipData.labor_discount * 100 ).toFixed( 0 ) }% labor discount · ` }
              { membershipData.free_diagnostics_remaining } free diagnostic{ membershipData.free_diagnostics_remaining !== 1 ? 's' : '' } remaining
              { membershipData.expires_at && ` · Renews ${ new Date( membershipData.expires_at ).toLocaleDateString() }` }
            </p>
          </div>
        </Motion.div>
      ) }

      { enrollError && (
        <div style={ { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.83rem' } }>
          { enrollError }
        </div>
      ) }
      { enrollSuccess && (
        <div style={ { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 16px', color: '#15803d', fontSize: '0.83rem', fontWeight: 600 } }>
          ✓ { enrollSuccess }
        </div>
      ) }

      {/* Tier cards */}
      <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' } }>
        { TIER_ORDER.map( ( tierId, i ) => {
          const tier      = MEMBERSHIP_TIERS[ tierId ];
          const tcfg      = TIER_COLORS[ tierId ];
          const isActive  = currentTier === tierId;
          const canEnroll = ! isActive && (
            tierId === 'professional' ||
            ( tierId === 'fleet' && currentTier !== 'fleet' )
          );

          return (
            <Motion.div
              key={ tierId }
              custom={ 0.06 + i * 0.06 }
              variants={ fadeUp }
              initial="hidden"
              animate="visible"
              style={ {
                background:   'white',
                border:       isActive ? `2px solid ${ tcfg.color }` : '1px solid rgba(15,23,42,0.09)',
                borderRadius: '12px',
                padding:      '18px 18px 16px',
                boxShadow:    isActive ? `0 0 0 4px ${ tcfg.color }18` : '0 2px 10px rgba(15,23,42,0.04)',
                position:     'relative',
                overflow:     'hidden',
                display:      'flex',
                flexDirection:'column',
              } }
            >
              { tcfg.badge && (
                <span style={ { position: 'absolute', top: '12px', right: '12px', background: tcfg.bg, color: tcfg.color, border: `1px solid ${ tcfg.border }`, borderRadius: '999px', padding: '2px 8px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em' } }>
                  { tcfg.badge }
                </span>
              ) }

              <p style={ { margin: '0 0 4px', fontWeight: 800, fontSize: '0.95rem', color: isActive ? tcfg.color : '#0f172a' } }>{ tier.name }</p>
              <p style={ { margin: '0 0 14px', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 } }>
                { tier.price === 0 ? 'Free' : `$${ tier.price }` }
                { tier.billingCycle && <span style={ { fontSize: '0.7rem', fontWeight: 600, color: 'rgba(15,23,42,0.45)' } }>/yr</span> }
              </p>

              <ul style={ { margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 } }>
                { TIER_FEATURES[ tierId ].map( ( feat ) => (
                  <li key={ feat } style={ { display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '0.77rem', color: '#334155' } }>
                    <CheckCircle size={ 13 } style={ { color: tcfg.color, flexShrink: 0, marginTop: '1px' } } />
                    { feat }
                  </li>
                ) ) }
              </ul>

              { isActive ? (
                <div style={ { padding: '8px 12px', borderRadius: '7px', background: tcfg.bg, textAlign: 'center', fontSize: '0.77rem', fontWeight: 700, color: tcfg.color } }>
                  Current Plan
                </div>
              ) : canEnroll ? (
                <button
                  type="button"
                  onClick={ () => handleEnroll( tierId ) }
                  disabled={ enrolling === tierId }
                  style={ {
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px 14px', borderRadius: '8px', border: 'none',
                    background: tcfg.color, color: 'white',
                    fontSize: '0.8rem', fontWeight: 700, cursor: enrolling === tierId ? 'not-allowed' : 'pointer',
                    opacity: enrolling === tierId ? 0.65 : 1, transition: 'opacity 0.15s',
                  } }
                >
                  { enrolling === tierId
                    ? <><Loader size={ 12 } className="animate-spin" /> Processing…</>
                    : ( founding && tierId === 'professional'
                        ? `Join for $${ FOUNDING_MEMBER_PROMO.discountedPrice }/yr`
                        : `${ currentTier !== 'essential' ? 'Upgrade to' : 'Join' } ${ tier.name }` ) }
                </button>
              ) : (
                <div style={ { padding: '8px 12px', borderRadius: '7px', background: '#f1f5f9', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(15,23,42,0.4)', fontWeight: 600 } }>
                  —
                </div>
              ) }
            </Motion.div>
          );
        } ) }
      </div>

    </div>
  );
}
