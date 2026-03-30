/**
 * frontend/src/api/auth.js
 *
 * JWT authentication helpers for the WordPress REST API.
 * Token endpoint: VITE_JWT_ENDPOINT (e.g. /wp/wp-json/jwt-auth/v1/token)
 *
 * Requires: jwt-authentication-for-wp-rest-api WordPress plugin.
 */

import axios from 'axios';

const JWT_ENDPOINT = import.meta.env.VITE_JWT_ENDPOINT || '';

/** localStorage keys */
const TOKEN_KEY = 'dtb_jwt_token';
const USER_KEY  = 'dtb_jwt_user';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Log in with WordPress username and password.
 * Stores the returned JWT in localStorage.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ token: string, user_email: string, user_nicename: string, user_display_name: string }>}
 */
export async function login(username, password) {
  const response = await axios.post(JWT_ENDPOINT, { username, password });
  const data = response.data;
  saveToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify({
    email:       data.user_email,
    nicename:    data.user_nicename,
    displayName: data.user_display_name,
  }));
  return data;
}

/**
 * Log out the current user — clears stored token and user data.
 */
export function logout() {
  clearToken();
}

/**
 * Validate the stored token against the /token/validate endpoint.
 * Returns the validated token string on success, or null on failure.
 *
 * @returns {Promise<string|null>}
 */
export async function refreshToken() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    await axios.post(
      `${JWT_ENDPOINT}/validate`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return token;
  } catch {
    clearToken();
    return null;
  }
}

/**
 * Return the current user's stored profile (from localStorage) or null.
 *
 * @returns {{ email: string, nicename: string, displayName: string } | null}
 */
export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Return the stored JWT token, or null if not logged in.
 *
 * @returns {string|null}
 */
export function getToken() {
  return getStoredToken();
}

/**
 * Return true if a JWT token is present in localStorage.
 *
 * @returns {boolean}
 */
export function isAuthenticated() {
  return Boolean(getStoredToken());
}
