/**
 * frontend/src/api/repairs.js
 *
 * DTB Repair Services API client — wraps the dtb/v1/repairs/* endpoints.
 *
 * Public endpoints (no auth required): submit, status, media upload via token.
 * All calls go through apiClient() except media upload (raw fetch with FormData).
 *
 * Usage:
 *   import { submitRepair, getRepairStatus, REPAIR_STATUS_LABELS } from '@api/repairs';
 */

import { apiClient } from './client.js';
import { getToken } from '../auth/tokenStore.js';

// ─── Status labels (customer-facing) ─────────────────────────────────────────

/** Maps backend status strings to human-readable customer labels. */
export const REPAIR_STATUS_LABELS = {
  submitted:          'Submitted',
  reviewed:           'Under Review',
  awaiting_customer:  'Waiting on Customer',
  approved:           'Approved',
  quoted:             'Quote Sent',
  quote_accepted:     'Quote Accepted',
  quote_declined:     'Quote Declined',
  parts_allocated:    'Parts Allocated',
  in_progress:        'Repair In Progress',
  ready_to_ship:      'Ready to Ship',
  completed:          'Completed',
  closed:             'Closed',
  cancelled:          'Cancelled',
};

/** Maps status → approximate progress percentage for visual progress indicators. */
export const REPAIR_STATUS_PROGRESS = {
  submitted:          8,
  reviewed:           16,
  awaiting_customer:  20,
  approved:           28,
  quoted:             35,
  quote_accepted:     42,
  quote_declined:     100,
  parts_allocated:    55,
  in_progress:        70,
  ready_to_ship:      88,
  completed:          100,
  closed:             100,
  cancelled:          100,
};

/** Statuses after which polling/streaming should stop. */
export const TERMINAL_STATUSES = [
  'completed',
  'closed',
  'cancelled',
  'quote_declined',
];

// ─── Idempotency key helper ───────────────────────────────────────────────────

function generateIdempotencyKey() {
  if ( typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return Array.from( { length: 32 }, () =>
    Math.floor( Math.random() * 16 ).toString( 16 )
  ).join( '' );
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Submit a new repair request.
 * An idempotency key is automatically generated and merged into the payload.
 *
 * @param {Object} payload  Repair submission fields (see spec for full shape)
 * @returns {Promise<{ repair_id: number, public_token: string, status: string, message: string }>}
 */
export async function submitRepair( payload ) {
  return apiClient( '/wp-json/dtb/v1/repairs/submit', {
    method: 'POST',
    body: JSON.stringify( {
      idempotency_key: generateIdempotencyKey(),
      ...payload,
    } ),
  } );
}

/**
 * Fetch a repair's current status snapshot by repair ID + public token.
 *
 * @param {number|string} repairId
 * @param {string}        token     Public token returned at submission time
 * @returns {Promise<Object>}       Status snapshot (see spec for full shape)
 */
export async function getRepairStatus( repairId, token ) {
  const params = token ? `?token=${ encodeURIComponent( token ) }` : '';
  return apiClient( `/wp-json/dtb/v1/repairs/status/${ encodeURIComponent( repairId ) }${ params }` );
}

/**
 * Upload media files for an existing repair.
 * Uses raw fetch (no JSON Content-Type) to send FormData.
 * Attaches a Bearer token — prefers the public repair token; falls back to
 * the in-memory auth token if available.
 *
 * @param {number|string} repairId
 * @param {FormData}      formData   Files under the key "files[]" (or as appended)
 * @param {string}        [token]    Public repair token for unauthenticated uploads
 * @returns {Promise<{ attachment_ids: number[] }>}
 */
export async function uploadRepairMedia( repairId, formData, token ) {
  const bearerToken = token || getToken();
  const headers = {};
  if ( bearerToken ) {
    headers[ 'Authorization' ] = `Bearer ${ bearerToken }`;
  }

  let response;
  try {
    response = await fetch(
      `/wp-json/dtb/v1/repairs/${ encodeURIComponent( repairId ) }/media`,
      { method: 'POST', headers, body: formData, credentials: 'include' }
    );
  } catch {
    throw { code: 'network_error', message: 'Network request failed.', status: 0 };
  }

  if ( ! response.ok ) {
    let envelope = {};
    try { envelope = await response.json(); } catch { /**/ }
    throw {
      code:    envelope.code    || 'upload_error',
      message: envelope.message || `Upload failed with status ${ response.status }.`,
      status:  response.status,
    };
  }

  return response.json();
}

/**
 * Returns the full SSE stream URL for a repair (used directly by EventSource).
 *
 * @param {number|string} repairId
 * @param {string}        token
 * @returns {string}  Absolute URL
 */
export function getRepairEventStreamUrl( repairId, token ) {
  const base = ( process.env.REACT_APP_WP_BASE_URL || '' ).replace( /\/+$/, '' );
  const wpJson = base
    ? ( base.endsWith( '/wp-json' ) ? base : `${ base }/wp-json` )
    : ( typeof window !== 'undefined' ? `${ window.location.origin }/wp-json` : '' );
  const params = token ? `?token=${ encodeURIComponent( token ) }` : '';
  return `${ wpJson }/dtb/v1/repairs/${ encodeURIComponent( repairId ) }/events/stream${ params }`;
}

/**
 * Health check for the repairs service.
 *
 * @returns {Promise<{ status: string }>}
 */
export async function getRepairHealthcheck() {
  return apiClient( '/wp-json/dtb/v1/repairs/health' );
}

/**
 * Respond to a repair quote (accept or decline).
 *
 * @param {number|string} repairId
 * @param {'accept'|'decline'} action
 * @param {string}        token    Public repair token
 * @returns {Promise<{ success: boolean, status: string, message: string }>}
 */
export async function respondToRepairQuote( repairId, action, token ) {
  return apiClient( `/wp-json/dtb/v1/repairs/${ encodeURIComponent( repairId ) }/respond-to-quote`, {
    method: 'POST',
    body: JSON.stringify( { action, token } ),
  } );
}

/**
 * Accept a repair quote (convenience wrapper).
 *
 * @param {number|string} repairId
 * @param {string}        token
 */
export async function acceptRepairQuote( repairId, token ) {
  return respondToRepairQuote( repairId, 'accept', token );
}

/**
 * Decline a repair quote (convenience wrapper).
 *
 * @param {number|string} repairId
 * @param {string}        token
 */
export async function declineRepairQuote( repairId, token ) {
  return respondToRepairQuote( repairId, 'decline', token );
}
