/**
 * frontend/src/pages/ProMembership.jsx
 *
 * ProCare Membership page — /pro-membership
 *
 * Public page: shows the three tiers (Essential, Professional, Fleet)
 * with benefits, pricing, and a CTA to enroll.
 * Auth-gated CTA: if not logged in, CTA routes to /register.
 * If already subscribed, shows current tier instead of enroll button.
 *
 * Founding Member promo banner: shown while isFoundingMemberWindowOpen() is true.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { useAuthContext } from '../auth/AuthContext.js';
import {
  MEMBERSHIP_TIERS,
  FOUNDING_MEMBER_PROMO,
  getMembershipStatus,
  enrollMembership,
  isFoundingMemberWindowOpen,
} from '../api/membership.js';
import PricingTable from '../components/ui/PricingTable.jsx';

// Tier feature lists (display-only)
const TIER_FEATURES = {
  essential: [
    '0.5 pts per $1 spent on every order',
    'Full product catalog access',
    '15-day workmanship warranty',
    'Community support',
  ],
  professional: [
    'Everything in Essential',
    '10% off all repair labor',
    '1 free diagnostic per year (saves $50–$75)',
    'Free return shipping on orders ≥ $150',
    '30-day workmanship warranty',
    '200 bonus points on enrollment',
    'Priority service scheduling',
  ],
  fleet: [
    'Everything in Professional',
    '15% off labor AND parts',
    '2 free diagnostics per year',
    'Free return shipping on all orders',
    '60-day workmanship warranty',
    '200 bonus points on enrollment',
    'Dedicated account manager',
    'Fleet billing & net-30 terms (request)',
  ],
};

const TIER_ORDER = [ 'essential', 'professional', 'fleet' ];

const cardVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: ( delay ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [ 0.16, 1, 0.3, 1 ], delay: delay ?? 0 },
  } ),
};

export default function ProMembership() {
  const navigate                          = useNavigate();
  const { user, isAuthenticated }         = useAuthContext();

  const [membershipStatus, setMembershipStatus] = useState( null );
  const [enrolling,        setEnrolling        ] = useState( null );   // tier id being enrolled
  const [enrollError,      setEnrollError      ] = useState( '' );
  const [enrollSuccess,    setEnrollSuccess    ] = useState( '' );

  const founding = isFoundingMemberWindowOpen();

  useEffect( () => {
    if ( isAuthenticated && user?.id ) {
      getMembershipStatus( user.id ).then( setMembershipStatus ).catch( () => {} );
    }
  }, [ isAuthenticated, user?.id ] );

  async function handleEnroll( tierId ) {
    if ( ! isAuthenticated ) {
      navigate( '/register?next=/pro-membership' );
      return;
    }
    setEnrollError( '' );
    setEnrollSuccess( '' );
    setEnrolling( tierId );
    try {
      const result = await enrollMembership( user.id, tierId, founding );
      setEnrollSuccess( `You're now on the ${ MEMBERSHIP_TIERS[ tierId ].name } plan! Expires ${ new Date( result.expires_at ).toLocaleDateString() }.` );
      const updated = await getMembershipStatus( user.id );
      setMembershipStatus( updated );
    } catch ( err ) {
      setEnrollError( err.message || 'Enrollment failed. Please try again.' );
    } finally {
      setEnrolling( null );
    }
  }

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f8fafc' } }>
      <SEOHead
        title="ProCare Membership — Drywall Toolbox"
        description="ProCare Pro and Fleet memberships: labor discounts, free diagnostics, longer warranty, and bonus points for professional drywall finishers."
        canonical="https://drywalltoolbox.com/pro-membership"
      />

      {/* Hero */}
      <div style={ {
        background:   'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding:      'clamp(3rem, 8vw, 6rem) clamp(1.5rem, 5vw, 3rem)',
        position:     'relative',
        overflow:     'hidden',
        textAlign:    'center',
      } }>
        <div style={ { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)', backgroundSize: '40px 40px', pointerEvents: 'none' } } />
        <Motion.div initial={ { opacity: 0, y: 14 } } animate={ { opacity: 1, y: 0 } } transition={ { duration: 0.5, ease: [ 0.16, 1, 0.3, 1 ] } }
          style={ { position: 'relative', zIndex: 1, maxWidth: '700px', margin: '0 auto' } }
        >
          <div style={ { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', padding: '4px 12px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: '16px' } }>
            <Shield size={ 12 } /> ProCare Membership
          </div>
          <h1 style={ { color: 'white', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.1, letterSpacing: '-0.03em' } }>
            Every Pro Deserves<br />
            <span style={ { color: '#93c5fd' } }>Better Terms.</span>
          </h1>
          <p style={ { color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', margin: 0, lineHeight: 1.6 } }>
            Labor discounts, free diagnostics, extended warranties, and bonus points.
            Built for production crews and growing finishing operations.
          </p>
        </Motion.div>
      </div>

      {/* Founding member promo banner */}
      { founding && (
        <div style={ { background: '#fefce8', borderBottom: '1px solid #fde047', padding: '12px 24px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#713f12' } }>
          🎉 <strong>Founding Member offer:</strong> { FOUNDING_MEMBER_PROMO.label } — ${ FOUNDING_MEMBER_PROMO.discountedPrice }/yr
        </div>
      ) }

      {/* Tier cards */}
      <div style={ { maxWidth: '1100px', margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)' } }>

        { enrollError && (
          <div style={ { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '0.875rem', color: '#dc2626' } }>
            { enrollError }
          </div>
        ) }
        { enrollSuccess && (
          <div style={ { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '0.875rem', color: '#15803d' } }>
            ✓ { enrollSuccess }
          </div>
        ) }

        <PricingTable
          tiers={ Object.entries( MEMBERSHIP_TIERS ).map( ( [ id, t ] ) => ( { id, ...t } ) ) }
          tierFeatures={ TIER_FEATURES }
          currentTier={ membershipStatus?.tier || null }
          enrolling={ enrolling }
          onEnroll={ handleEnroll }
          founding={ founding }
          foundingPromo={ FOUNDING_MEMBER_PROMO }
          isAuthenticated={ isAuthenticated }
          tierOrder={ TIER_ORDER }
        />

        {/* Repair warranty comparison */}
        <Motion.div custom={ 0.3 } variants={ cardVariants } initial="hidden" animate="visible"
          style={ { marginTop: '3rem', background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '12px', padding: '28px 24px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' } }
        >
          <h2 style={ { margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' } }>
            Repair Warranty Comparison
          </h2>
          <div style={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' } }>
            { [
              { tier: 'Essential',     days: 15, color: 'gray' },
              { tier: 'Professional',  days: 30, color: 'blue' },
              { tier: 'Fleet',         days: 60, color: 'green' },
            ].map( ( row ) => (
              <div key={ row.tier } style={ { textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '8px' } }>
                <p style={ { margin: '0 0 8px', fontSize: '2rem', fontWeight: 800, color: row.color === 'green' ? '#16a34a' : row.color === 'blue' ? '#2563eb' : 'rgba(15,23,42,0.4)' } }>
                  { row.days }-day
                </p>
                <p style={ { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'rgba(15,23,42,0.6)' } }>
                  { row.tier }
                </p>
              </div>
            ) ) }
          </div>
        </Motion.div>

        <div style={ { marginTop: '2rem' } }>
          <Link to="/dashboard" style={ { fontSize: '0.85rem', fontWeight: 600, color: 'rgba(15,23,42,0.5)', textDecoration: 'none' } }>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
