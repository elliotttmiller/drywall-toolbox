/**
 * frontend/src/api/auth.js
 *
 * JWT authentication helpers for the WordPress REST API.
 * Token endpoint: REACT_APP_JWT_AUTH_ENDPOINT (e.g. /wp-json/simple-jwt-login/v1/auth)
 *
 * Tokens are stored ONLY in memory via tokenStore — never in localStorage or
 * sessionStorage — to prevent persistent XSS token theft.
 *
 * For React component auth state use src/auth/useAuth.js + AuthContext instead.
 * This module provides low-level helpers for programmatic / non-React usage.
 */

import axios from 'axios';
import {
  setToken  as storeSetToken,
  getToken  as storeGetToken,
  clearToken as storeClearToken,
} from '../auth/tokenStore.js';

const _base = ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' );
const _path = process.env.REACT_APP_JWT_AUTH_ENDPOINT || '/wp-json/simple-jwt-login/v1/auth';
const JWT_ENDPOINT = _base ? _base + _path : _path;

// ─── In-memory user profile ───────────────────────────────────────────────────
// Stored as a module-level variable; cleared on logout or page close.

let _user = null;

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Log in with WordPress username / email and password.
 * Stores the returned JWT in the in-memory token store.
 *
 * @param {string} username  WordPress username or email address.
 * @param {string} password
 * @returns {Promise<object>}  Raw JWT plugin response.
 */
export async function login( username, password ) {
  const response = await axios.post( JWT_ENDPOINT, { email: username, password } );
  const data = response.data;

  // simple-jwt-login wraps the payload under data.data
  const jwt      = data?.data?.jwt  || data?.token  || null;
  const userData = data?.data?.user || null;

  storeSetToken( jwt );
  _user = userData
    ? {
        email:       userData.user_email    || '',
        nicename:    userData.user_nicename || userData.user_login || '',
        displayName: userData.display_name  || '',
      }
    : null;

  return data;
}

/**
 * Log out the current user — clears the in-memory token and user profile.
 */
export function logout() {
  storeClearToken();
  _user = null;
}

/**
 * Validate the current in-memory token against the /validate endpoint.
 * Returns the token string on success, or null on failure/expiry.
 *
 * @returns {Promise<string|null>}
 */
export async function refreshToken() {
  const token = storeGetToken();
  if ( ! token ) return null;
  try {
    await axios.post(
      `${ JWT_ENDPOINT }/validate`,
      {},
      { headers: { Authorization: `Bearer ${ token }` } },
    );
    return token;
  } catch {
    storeClearToken();
    _user = null;
    return null;
  }
}

/**
 * Return the current in-memory user profile, or null if not logged in.
 *
 * @returns {{ email: string, nicename: string, displayName: string } | null}
 */
export function getCurrentUser() {
  return _user;
}

/**
 * Return the current in-memory JWT token, or null if not logged in.
 *
 * @returns {string|null}
 */
export function getToken() {
  return storeGetToken();
}

/**
 * Return true if a JWT token is present in memory.
 *
 * @returns {boolean}
 */
export function isAuthenticated() {
  return Boolean( storeGetToken() );
}
