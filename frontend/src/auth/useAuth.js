/**
 * frontend/src/auth/useAuth.js
 *
 * Custom hook encapsulating JWT authentication state.
 *
 * JWT endpoint paths below (REACT_APP_JWT_AUTH_ENDPOINT) MUST match the
 * active JWT plugin installed on the WordPress site.  Two common options:
 *   simple-jwt-login:                 /wp-json/simple-jwt-login/v1/auth
 *   jwt-authentication-for-wp-rest-api: /wp-json/jwt-auth/v1/token
 * Update REACT_APP_JWT_AUTH_ENDPOINT in .env.* to switch plugins.
 *
 * Exposes: { user, token, isAuthenticated, isLoading, login, logout, error }
 */

import { useState, useEffect, useCallback } from 'react';
import { setToken, getToken, clearToken } from './tokenStore.js';

// ─── JWT endpoint (injected at build time via DefinePlugin) ───────────────────

// IMPORTANT: This path must match the active JWT plugin on the WP installation.
// See REACT_APP_JWT_AUTH_ENDPOINT in .env.* files.
const JWT_AUTH_ENDPOINT =
  process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL.replace( /\/+$/, '' ) +
      ( process.env.REACT_APP_JWT_AUTH_ENDPOINT || '/wp-json/simple-jwt-login/v1/auth' )
    : process.env.REACT_APP_JWT_AUTH_ENDPOINT || '/wp-json/simple-jwt-login/v1/auth';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [ user,    setUser    ] = useState( null );
  const [ token,   setTokenState ] = useState( null );
  const [ isLoading, setIsLoading ] = useState( true );
  const [ error,   setError   ] = useState( null );

  // ── Validate existing session on mount ──────────────────────────────────────
  useEffect( () => {
    let cancelled = false;

    async function validateSession() {
      setIsLoading( true );
      try {
        // IMPORTANT: validate endpoint path must match the active JWT plugin.
        // simple-jwt-login validate: POST /wp-json/simple-jwt-login/v1/auth/validate
        const validateUrl = JWT_AUTH_ENDPOINT + '/validate';
        const res = await fetch( validateUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        } );

        if ( res.ok ) {
          const data = await res.json();
          // simple-jwt-login returns { data: { user: {...} } } on success.
          const userData = data?.data?.user || data?.user || null;
          const existingToken = data?.data?.jwt || data?.jwt || getToken() || null;
          if ( ! cancelled ) {
            if ( existingToken ) setToken( existingToken );
            setTokenState( existingToken );
            setUser( userData );
          }
        }
        // Non-OK response on validate is expected when not logged in.
        // Do NOT dispatch auth:expired here — this is an initial check, not a
        // protected resource request that the user expected to succeed.
      } catch {
        // Network error or JSON parse failure — remain logged out.
      } finally {
        if ( ! cancelled ) setIsLoading( false );
      }
    }

    validateSession();
    return () => { cancelled = true; };
  }, [] );

  // ── Auth:expired listener ────────────────────────────────────────────────────
  useEffect( () => {
    const handler = () => logout();
    window.addEventListener( 'auth:expired', handler );
    return () => window.removeEventListener( 'auth:expired', handler );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [] );

  // ── login ────────────────────────────────────────────────────────────────────
  const login = useCallback( async ( email, password ) => {
    setError( null );
    setIsLoading( true );
    try {
      // IMPORTANT: auth endpoint path must match the active JWT plugin.
      const res = await fetch( JWT_AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { email, password } ),
      } );

      const data = await res.json();

      if ( ! res.ok ) {
        const msg = data?.message || 'Login failed.';
        setError( msg );
        throw new Error( msg );
      }

      // simple-jwt-login returns { data: { jwt, user: {...} } }.
      const jwt      = data?.data?.jwt || data?.token || null;
      const userData = data?.data?.user || data?.user_display_name
        ? { displayName: data.user_display_name, email: data.user_email }
        : null;

      if ( jwt ) setToken( jwt );
      setTokenState( jwt );
      setUser( userData );
      return data;
    } catch ( err ) {
      setError( err.message || 'Login failed.' );
      throw err;
    } finally {
      setIsLoading( false );
    }
  }, [] );

  // ── logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback( async () => {
    clearToken();
    setTokenState( null );
    setUser( null );
    setError( null );

    // IMPORTANT: logout endpoint path must match the active JWT plugin.
    // Attempt graceful server-side token revocation; ignore errors.
    try {
      await fetch( JWT_AUTH_ENDPOINT + '/revoke', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      } );
    } catch { /**/ }
  }, [] );

  return {
    user,
    token,
    isAuthenticated: Boolean( token ),
    isLoading,
    login,
    logout,
    error,
  };
}

export default useAuth;
