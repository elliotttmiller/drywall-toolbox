/**
 * frontend/src/api/rewards.js
 *
 * Points & Rewards API client — wraps the dtb/v1/rewards/* endpoints.
 *
 * All calls go through apiClient() which automatically includes the
 * HttpOnly auth cookie (credentials: 'include') and handles 401s.
 *
 * Usage:
 *   import { getUserPoints, getPointsHistory, redeemPoints,
 *             pointsToUsd, calculatePointsEarned,
 *             POINTS_EARN_RATE, POINTS_MIN_REDEEM } from '@api/rewards';
 */

import { apiClient } from './client.js';

// ─── Points program constants ─────────────────────────────────────────────────
// These values MUST match dtb-rewards.php exactly.
// Source of truth: DTB_Strategy_Overview.md §Loyalty Points

/** Points earned per $1 spent on eligible subtotal (1 pt per $2 = 0.5 pts/$1). */
export const POINTS_EARN_RATE     = 0.5;

/** USD value of one point at redemption ($5.00 per 100 pts). */
export const POINTS_REDEEM_VALUE  = 0.05;

/** Minimum points to redeem in a single transaction (100 pts = $5.00). */
export const POINTS_MIN_REDEEM    = 100;

/** Maximum points redeemable in a single order (5,000 pts = $250.00). */
export const POINTS_MAX_REDEEM    = 5000;

/** Redemption step size — must match backend % 100 validation. */
export const POINTS_REDEEM_STEP   = 100;

/** Months until points expire from last activity. */
export const POINTS_EXPIRY_MONTHS = 24;

/** Months added to expiry on any account activity. */
export const POINTS_EXTEND_MONTHS = 6;

/**
 * Calculate USD value for a given number of points.
 * Always display this as the primary value; raw point count is parenthetical.
 *
 * @param {number} pts
 * @returns {number} Dollar value (e.g. 500 pts → $25.00)
 */
export function pointsToUsd( pts ) {
  return Math.round( pts * POINTS_REDEEM_VALUE * 100 ) / 100;
}

/**
 * Calculate points earned on a given order subtotal.
 * @param {number} subtotalUsd  Pre-tax, pre-shipping subtotal
 * @returns {number} Points earned (floor, 1pt per $2)
 */
export function calculatePointsEarned( subtotalUsd ) {
  return Math.floor( subtotalUsd * POINTS_EARN_RATE );
}

/**
 * Get the authenticated user's current point balance.
 *
 * @param {number} userId  WooCommerce / WordPress user ID
 * @returns {Promise<{
 *   user_id: number,
 *   points: number,
 *   points_earned: number,
 *   points_redeemed: number,
 *   points_value_usd: number
 * }>}
 */
export async function getUserPoints( userId ) {
  return apiClient( `/wp-json/dtb/v1/rewards/balance/${ encodeURIComponent( userId ) }` );
}

/**
 * Get paginated transaction history for a user.
 *
 * @param {number} userId
 * @param {number} [limit=20]   Max events to return (1–100)
 * @param {number} [offset=0]   Pagination offset
 * @returns {Promise<{
 *   user_id: number,
 *   events: Array<{ event: string, points: number, note: string, date: string }>,
 *   total: number,
 *   limit: number,
 *   offset: number
 * }>}
 */
export async function getPointsHistory( userId, limit = 20, offset = 0 ) {
  const params = new URLSearchParams( { limit, offset } ).toString();
  return apiClient( `/wp-json/dtb/v1/rewards/history/${ encodeURIComponent( userId ) }?${ params }` );
}

/**
 * Redeem points for a WooCommerce discount coupon.
 *
 * Rate:  100 pts = $5.00  (POINTS_REDEEM_VALUE = 0.05 USD/pt)
 * Min:   100 pts ($5.00)  — POINTS_MIN_REDEEM
 * Max:   5,000 pts ($250.00) — POINTS_MAX_REDEEM
 * Step:  100 pts  — must be a multiple of 100
 *
 * @param {number} userId
 * @param {number} pointsToRedeem  Must be ≥100, ≤5000, multiple of 100
 * @returns {Promise<{
 *   success: boolean,
 *   coupon_code: string,
 *   discount_amount: number,
 *   new_balance: number
 * }>}
 */
export async function redeemPoints( userId, pointsToRedeem ) {
  return apiClient( '/wp-json/dtb/v1/rewards/redeem', {
    method: 'POST',
    body: JSON.stringify( {
      user_id: userId,
      points_to_redeem: pointsToRedeem,
    } ),
  } );
}

/**
 * Admin only: manually adjust a user's point balance.
 *
 * @param {number} userId
 * @param {number} pointsDelta   Positive = award, negative = deduct
 * @param {string} reason        Recorded in WPLoyalty activity ledger
 * @returns {Promise<{
 *   success: boolean,
 *   adjusted: number,
 *   new_balance: number,
 *   reason: string
 * }>}
 */
export async function adminAdjustPoints( userId, pointsDelta, reason ) {
  return apiClient( '/wp-json/dtb/v1/rewards/admin/adjust', {
    method: 'POST',
    body: JSON.stringify( {
      user_id: userId,
      points_delta: pointsDelta,
      reason,
    } ),
  } );
}
