/**
 * frontend/src/api/membership.js
 *
 * ProCare Membership API client — wraps dtb/v1/membership/* endpoints.
 *
 * Tiers (from DTB_Strategy_Overview.md §ProCare Membership):
 *   essential     — Free.  No discount.         15-day warranty. 0 free Dx.  0 bonus pts.
 *   professional  — $99/yr. 10% labor discount. 30-day warranty. 1 free Dx. +200 bonus pts.
 *   fleet         — $299/yr. 15% labor+parts.   60-day warranty. 2 free Dx. +200 bonus pts.
 *
 * Founding Member promo (first 90 days post-launch, email list only):
 *   50% off Year 1 Professional → $49.50
 *
 * Security rules:
 *   - Discounts are NEVER shown publicly. Only auth-gated views render tier details.
 *   - Pricing is display-only on the client; all actual discounts are applied server-side.
 *   - Token from in-memory tokenStore only (no localStorage) via apiClient.
 */

import { apiClient } from './client.js';

// ─── Membership tier constants ────────────────────────────────────────────────
// These MUST match DTB_MEMBERSHIP_TIERS in dtb-membership.php.

export const MEMBERSHIP_TIERS = {
  essential: {
    id:                'essential',
    name:              'Essential',
    price:             0,
    billingCycle:      null,
    laborDiscount:     0,
    partsDiscount:     0,
    freeShipThreshold: null,
    warrantyDays:      15,
    freeDiagnostics:   0,
    bonusPoints:       0,
    highlight:         false,
  },
  professional: {
    id:                'professional',
    name:              'Professional',
    price:             99,
    billingCycle:      'annual',
    laborDiscount:     0.10,
    partsDiscount:     0,
    freeShipThreshold: 150,
    warrantyDays:      30,
    freeDiagnostics:   1,
    bonusPoints:       200,
    highlight:         true,  // "Most Popular" badge
  },
  fleet: {
    id:                'fleet',
    name:              'Fleet',
    price:             299,
    billingCycle:      'annual',
    laborDiscount:     0.15,
    partsDiscount:     0.15,
    freeShipThreshold: 0,    // Always free
    warrantyDays:      60,
    freeDiagnostics:   2,
    bonusPoints:       200,
    highlight:         false,
  },
};

export const FOUNDING_MEMBER_PROMO = {
  tier:              'professional',
  discountPct:       0.50,
  discountedPrice:   49.50,
  validDays:         90,
  label:             'Founding Member — 50% off Year 1',
  requiresEmailList: true,
};

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Get the current membership status for an authenticated user.
 *
 * @param {number} userId
 * @returns {Promise<{
 *   user_id: number,
 *   tier: 'essential'|'professional'|'fleet',
 *   active: boolean,
 *   expires_at: string|null,
 *   free_diagnostics_remaining: number,
 *   founding_member: boolean,
 *   labor_discount: number,
 *   parts_discount: number,
 *   warranty_days: number,
 *   ship_threshold: number|null,
 * }>}
 */
export async function getMembershipStatus( userId ) {
  return apiClient( `/wp-json/dtb/v1/membership/status/${ encodeURIComponent( userId ) }` );
}

/**
 * Get the public tier configuration (no auth required).
 *
 * @returns {Promise<Record<string, { price: number, labor_discount: number, ... }>>}
 */
export async function getMembershipTiers() {
  return apiClient( '/wp-json/dtb/v1/membership/tiers' );
}

/**
 * Enroll in or upgrade a ProCare membership tier.
 *
 * @param {number}  userId
 * @param {'professional'|'fleet'} tier
 * @param {boolean} [foundingMember=false]
 * @returns {Promise<{ success: boolean, tier: string, expires_at: string }>}
 */
export async function enrollMembership( userId, tier, foundingMember = false ) {
  return apiClient( '/wp-json/dtb/v1/membership/enroll', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, tier, founding_member: foundingMember }),
  } );
}

// ─── Client-side utilities ────────────────────────────────────────────────────

/**
 * Calculate the display preview of member savings for a repair quote.
 *
 * IMPORTANT: This is for UI display only. Actual discounts are applied
 * server-side. Never use this value as an authoritative price.
 *
 * @param {number} laborAmount  Labor portion of the estimate
 * @param {number} partsAmount  Parts portion of the estimate
 * @param {'essential'|'professional'|'fleet'} tier
 * @returns {{ laborAfterDiscount: number, partsAfterDiscount: number, totalSaved: number }}
 */
export function calculateMemberDiscount( laborAmount, partsAmount, tier ) {
  const config = MEMBERSHIP_TIERS[tier] ?? MEMBERSHIP_TIERS.essential;
  const laborAfterDiscount = laborAmount * ( 1 - config.laborDiscount );
  const partsAfterDiscount = partsAmount * ( 1 - config.partsDiscount );
  const totalSaved = ( laborAmount - laborAfterDiscount ) + ( partsAmount - partsAfterDiscount );
  return {
    laborAfterDiscount: Math.round( laborAfterDiscount * 100 ) / 100,
    partsAfterDiscount: Math.round( partsAfterDiscount * 100 ) / 100,
    totalSaved:         Math.round( totalSaved * 100 ) / 100,
  };
}

/**
 * Return true if the Founding Member promotional window is still open.
 * Requires REACT_APP_STORE_LAUNCH_DATE (ISO-8601) to be set at build time.
 *
 * @returns {boolean}
 */
export function isFoundingMemberWindowOpen() {
  const launchDate = process.env.REACT_APP_STORE_LAUNCH_DATE;
  if ( !launchDate ) return false;
  const launchMs  = new Date( launchDate ).getTime();
  if ( isNaN( launchMs ) ) return false;
  const deadline  = launchMs + FOUNDING_MEMBER_PROMO.validDays * 24 * 60 * 60 * 1000;
  return Date.now() < deadline;
}
