/**
 * ui/PricingTable.jsx — IndoUI Classic Pricing Table
 *
 * Props:
 *   tiers        [{ id, name, price, billingCycle, highlight, description? }]
 *   tierFeatures { [tierId]: string[] }
 *   currentTier  string  (current user's tier id, or null)
 *   enrolling    string | null
 *   onEnroll     (tierId) => void
 *   founding     boolean
 *   foundingPromo { tier, label, discountedPrice }
 *   isAuthenticated boolean
 *   tierOrder    string[]
 *
 * Business logic stays in ProMembership.jsx — only the visual shell is here.
 */

import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { CheckCircle, Loader, ArrowRight, Zap } from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

export default function PricingTable({
  tiers = [],
  tierFeatures = {},
  currentTier = null,
  enrolling = null,
  onEnroll,
  founding = false,
  foundingPromo = null,
  isAuthenticated = false,
  tierOrder = [],
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        alignItems: 'stretch',
      }}
    >
      {tierOrder.map((tierId, i) => {
        const tier = tiers.find((t) => t.id === tierId);
        if (!tier) return null;
        const features = tierFeatures[tierId] || [];
        const isCurrent = currentTier === tierId;
        const tierIdx = tierOrder.indexOf(tierId);
        const currentIdx = tierOrder.indexOf(currentTier);
        const isHigher = currentTier && tierIdx > currentIdx;
        const canEnroll = tierId !== 'essential' && (!currentTier || currentTier === 'essential' || isHigher);
        const isLoadingEnroll = enrolling === tierId;
        const isFree = tier.price === 0;
        const showFoundingPrice = founding && foundingPromo && tierId === foundingPromo.tier;
        const displayPrice = showFoundingPrice ? foundingPromo.discountedPrice : tier.price;

        return (
          <Motion.div
            key={tierId}
            custom={i * 0.08}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            style={{
              background: 'white',
              border: `2px solid ${tier.highlight ? 'var(--primary-600)' : 'rgba(15,23,42,0.09)'}`,
              borderRadius: '16px',
              padding: '28px 24px',
              boxShadow: tier.highlight
                ? '0 8px 36px rgba(37,99,235,0.13)'
                : '0 2px 10px rgba(15,23,42,0.04)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              transition: 'box-shadow 0.2s',
            }}
          >
            {/* "Most Popular" badge */}
            {tier.highlight && (
              <div style={{
                position: 'absolute', top: -13, left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                color: 'white', borderRadius: '999px',
                padding: '3px 14px',
                fontSize: '0.66rem', fontWeight: 700,
                letterSpacing: '0.09em', textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(37,99,235,0.30)',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <Zap size={10} fill="currentColor" />
                Most Popular
              </div>
            )}

            {/* "Current Plan" badge */}
            {isCurrent && (
              <div style={{
                position: 'absolute', top: 16, right: 16,
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: '999px', padding: '2px 10px',
                fontSize: '0.66rem', fontWeight: 700, color: '#16a34a',
              }}>
                ✓ Current
              </div>
            )}

            {/* Tier name + price */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{
                fontSize: '1.25rem', fontWeight: 800, color: '#0f172a',
                margin: '0 0 8px',
              }}>
                {tier.name}
              </h2>
              {tier.description && (
                <p style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  {tier.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{
                  fontSize: isFree ? '1.5rem' : '2.5rem',
                  fontWeight: 900,
                  color: 'var(--primary-600)',
                  letterSpacing: '-0.03em',
                }}>
                  {isFree ? 'Free' : `$${displayPrice}`}
                </span>
                {tier.billingCycle && !isFree && (
                  <span style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.45)' }}>
                    {showFoundingPrice ? `/yr (was $${tier.price})` : '/yr'}
                  </span>
                )}
              </div>
            </div>

            {/* Feature list */}
            <ul style={{
              listStyle: 'none', padding: 0,
              margin: '0 0 24px',
              display: 'flex', flexDirection: 'column', gap: '9px',
              flexGrow: 1,
            }}>
              {features.map((feat) => (
                <li
                  key={feat}
                  style={{
                    display: 'flex', gap: '9px',
                    fontSize: '0.845rem',
                    color: 'rgba(15,23,42,0.72)',
                    lineHeight: 1.5,
                  }}
                >
                  <CheckCircle
                    size={15}
                    style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }}
                  />
                  {feat}
                </li>
              ))}
            </ul>

            {/* CTA */}
            {isCurrent ? (
              <div style={{
                textAlign: 'center', padding: '11px',
                background: '#f8fafc', borderRadius: '8px',
                fontSize: '0.82rem', color: 'rgba(15,23,42,0.45)',
              }}>
                Active plan
              </div>
            ) : canEnroll ? (
              <button
                type="button"
                onClick={() => onEnroll(tierId)}
                disabled={!!enrolling}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '9px', border: 'none',
                  background: tier.highlight
                    ? 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)'
                    : '#0f172a',
                  color: 'white',
                  fontSize: '0.875rem', fontWeight: 700,
                  cursor: enrolling ? 'not-allowed' : 'pointer',
                  opacity: enrolling && enrolling !== tierId ? 0.5 : 1,
                  transition: 'opacity 0.15s, transform 0.15s',
                  boxShadow: tier.highlight ? '0 4px 14px rgba(37,99,235,0.30)' : 'none',
                }}
                onMouseEnter={(e) => { if (!enrolling) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {isLoadingEnroll ? (
                  <><Loader size={14} className="animate-spin" /> Enrolling…</>
                ) : (
                  <>
                    {isAuthenticated ? `Join ${tier.name}` : 'Get Started Free'}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            ) : tierId === 'essential' ? (
              <Link
                to="/register"
                style={{
                  display: 'block', textAlign: 'center',
                  padding: '12px', borderRadius: '9px',
                  border: '1.5px solid rgba(15,23,42,0.2)',
                  color: 'rgba(15,23,42,0.6)',
                  fontSize: '0.875rem', fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Sign Up Free
              </Link>
            ) : null}
          </Motion.div>
        );
      })}
    </div>
  );
}
