/**
 * frontend/src/auth/useAuth.js
 *
 * Custom hook encapsulating JWT authentication state.
 *
 * Authentication flow (cookie-based):
 *   Login  → POST /dtb/v1/auth/login   — sets HttpOnly SameSite=Strict cookie,
 *                                         returns user profile (no raw JWT in body)
 *   Logout → DELETE /dtb/v1/auth/logout — clears the auth cookie server-side
 *   Restore → POST /dtb/v1/auth/validate — reads the cookie, validates JWT,
 *                                           returns user profile on success
 *
 * The raw JWT is never stored in JS memory, localStorage, or sessionStorage.
 * The browser sends it automatically via the HttpOnly cookie on every request
 * to the same origin when `credentials: 'include'` is set (see api/client.js).
 *
 * Exposes: { user, isAuthenticated, isLoading, login, logout, error }
 */

import { useState, useEffect, useCallback } from 'react';

// ─── DTB auth endpoint base ───────────────────────────────────────────────────

const _base = ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' );
const DTB_AUTH_BASE = _base + '/wp-json/dtb/v1/auth';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [ user,      setUser      ] = useState( null );
  const [ isLoading, setIsLoading ] = useState( true );
  const [ error,     setError     ] = useState( null );

  // ── Restore session on mount ─────────────────────────────────────────────────
  // If the browser has a valid dtb_auth HttpOnly cookie, the validate endpoint
  // will confirm it and return the user profile without requiring a re-login.
  useEffect( () => {
    let cancelled = false;

    async function validateSession() {
      setIsLoading( true );
      try {
        const res = await fetch( `${ DTB_AUTH_BASE }/validate`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
        } );

        if ( res.ok ) {
          const data = await res.json();
          if ( ! cancelled && data?.user ) {
            setUser( data.user );
          }
        }
        // Non-OK means no active session — remain logged out silently.
      } catch {
        // Network error — remain logged out.
      } finally {
        if ( ! cancelled ) setIsLoading( false );
      }
    }

    validateSession();
    return () => { cancelled = true; };
  }, [] );

  // ── auth:expired listener ────────────────────────────────────────────────────
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
      const res = await fetch( `${ DTB_AUTH_BASE }/login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify( { email, password } ),
      } );

      const data = await res.json();

      if ( ! res.ok ) {
        const msg = data?.message || 'Login failed.';
        setError( msg );
        throw new Error( msg );
      }

      // The JWT is now in the HttpOnly cookie — only store the user profile.
      setUser( data.user || null );
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
    setUser( null );
    setError( null );

    // Clear the HttpOnly cookie server-side.
    try {
      await fetch( `${ DTB_AUTH_BASE }/logout`, {
        method:      'DELETE',
        credentials: 'include',
      } );
    } catch { /**/ }
  }, [] );

  return {
    user,
    isAuthenticated: Boolean( user ),
    isLoading,
    login,
    logout,
    error,
  };
}

export default useAuth;
