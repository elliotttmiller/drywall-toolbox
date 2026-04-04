/**
 * frontend/src/api/client.js
 *
 * Base fetch wrapper for the drywall/v1 server-side proxy.
 *
 * Exports:
 *   apiClient(endpoint, options)  — fetch wrapper for drywall/v1 routes
 *   API_BASE_URL                  — resolved base URL constant
 *
 * Backward-compat exports (used by services/api.js and services/catalog.js):
 *   wcClient, wpClient, credentialsReady
 *
 * Security contract:
 *   - Authorization token is read from the in-memory tokenStore only.
 *   - Credentials are NEVER read from localStorage or sessionStorage.
 *   - On 401: window event 'auth:expired' is dispatched and token is cleared.
 */

import axios from 'axios';
import { getToken, clearToken } from '../auth/tokenStore.js';

// ─── Base URLs ────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' );

const WP_API_BASE =
  import.meta.env.VITE_WP_API_BASE ||
  ( typeof window !== 'undefined' ? `${ window.location.origin }/wp-json/` : '' );

const WC_API_BASE =
  import.meta.env.VITE_WC_API_BASE ||
  ( typeof window !== 'undefined' ? `${ window.location.origin }/wp-json/wc/v3` : '' );

let WC_AUTH_USER = import.meta.env.VITE_WC_AUTH_USER || '';
let WC_AUTH_PASS = import.meta.env.VITE_WC_AUTH_PASS || '';

// ─── Runtime credential bootstrap (backward compat) ──────────────────────────

let _credentialsReady = ( WC_AUTH_USER && WC_AUTH_PASS )
  ? Promise.resolve()
  : fetch( `${ WP_API_BASE.replace( /\/?$/, '/' ) }dtb/v1/config` )
      .then( ( r ) => r.json() )
      .then( ( data ) => {
        if ( data && data.wc_auth_user && data.wc_auth_pass ) {
          WC_AUTH_USER = data.wc_auth_user;
          WC_AUTH_PASS = data.wc_auth_pass;
          const encoded = btoa( `${ WC_AUTH_USER }:${ WC_AUTH_PASS }` );
          wcClient.defaults.headers.common[ 'Authorization' ] = `Basic ${ encoded }`;
        }
      } )
      .catch( () => {} );

export const credentialsReady = () => _credentialsReady;

// ─── Axios clients (backward compat for services/api.js) ─────────────────────

export const wpClient = axios.create( {
  baseURL: WP_API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
} );

wpClient.interceptors.request.use(
  ( config ) => {
    const token = getToken();
    if ( token ) {
      config.headers[ 'Authorization' ] = `Bearer ${ token }`;
    }
    return config;
  },
  ( error ) => Promise.reject( error ),
);

wpClient.interceptors.response.use(
  ( response ) => response,
  ( error ) => {
    if ( error.response && error.response.status === 401 ) {
      clearToken();
      if ( typeof window !== 'undefined' ) {
        window.dispatchEvent( new Event( 'auth:expired' ) );
      }
    }
    return Promise.reject( error );
  },
);

export const wcClient = axios.create( {
  baseURL: WC_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    ...( WC_AUTH_USER && WC_AUTH_PASS
      ? { Authorization: 'Basic ' + btoa( `${ WC_AUTH_USER }:${ WC_AUTH_PASS }` ) }
      : {} ),
  },
  withCredentials: true,
} );

wcClient.interceptors.response.use(
  ( response ) => response,
  ( error ) => {
    if ( error.response && error.response.data && error.response.data.message ) {
      return Promise.reject( new Error( error.response.data.message ) );
    }
    return Promise.reject( error );
  },
);

// ─── apiClient — fetch wrapper for drywall/v1 proxy routes ───────────────────

/**
 * Fetch wrapper targeting the drywall/v1 server-side proxy.
 *
 * @param {string} endpoint  Path relative to API_BASE_URL (e.g. '/wp-json/drywall/v1/products')
 * @param {Object} [options] fetch options override
 * @returns {Promise<any>}   Parsed JSON body on success
 * @throws {{ code: string, message: string, status: number, retryAfter?: number }}
 */
export async function apiClient( endpoint, options = {} ) {
  const url = `${ API_BASE_URL }${ endpoint }`;

  const method = ( options.method || 'GET' ).toUpperCase();
  const headers = { ...( options.headers || {} ) };

  // Auto-attach Content-Type on mutating requests.
  if ( [ 'POST', 'PUT', 'PATCH' ].includes( method ) && ! headers[ 'Content-Type' ] ) {
    headers[ 'Content-Type' ] = 'application/json';
  }

  // Auto-attach Authorization from in-memory token store only.
  const token = getToken();
  if ( token ) {
    headers[ 'Authorization' ] = `Bearer ${ token }`;
  }

  let response;
  try {
    response = await fetch( url, { ...options, method, headers, credentials: 'include' } );
  } catch ( networkError ) {
    throw { code: 'network_error', message: 'Network request failed.', status: 0 };
  }

  // Handle 401 — dispatch auth:expired, clear token.
  if ( response.status === 401 ) {
    clearToken();
    if ( typeof window !== 'undefined' ) {
      window.dispatchEvent( new Event( 'auth:expired' ) );
    }
    let envelope = {};
    try { envelope = await response.json(); } catch { /**/ }
    throw {
      code:    envelope.code    || 'unauthorized',
      message: envelope.message || 'Authentication required.',
      status:  401,
    };
  }

  // Handle 429 — include Retry-After in ms.
  if ( response.status === 429 ) {
    let envelope = {};
    try { envelope = await response.json(); } catch { /**/ }
    const retryAfterSec = parseInt( response.headers.get( 'Retry-After' ) || '60', 10 );
    throw {
      code:       envelope.code    || 'rate_limited',
      message:    envelope.message || 'Too many requests.',
      status:     429,
      retryAfter: retryAfterSec * 1000,
    };
  }

  // Handle non-2xx — parse error envelope from section 1.6.
  if ( ! response.ok ) {
    let envelope = {};
    try { envelope = await response.json(); } catch { /**/ }
    throw {
      code:    envelope.code    || 'api_error',
      message: envelope.message || `Request failed with status ${ response.status }.`,
      status:  response.status,
    };
  }

  // 204 No Content.
  if ( response.status === 204 ) return null;

  return response.json();
}

