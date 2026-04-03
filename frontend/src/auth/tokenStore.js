/**
 * src/auth/tokenStore.js
 *
 * In-memory JWT token store — module-level variable only.
 * Intentionally NOT backed by localStorage or sessionStorage so that
 * tokens are never persisted to disk and are cleared on page close.
 */

let _token = null;

export function setToken( token ) {
  _token = token || null;
}

export function getToken() {
  return _token;
}

export function clearToken() {
  _token = null;
}
