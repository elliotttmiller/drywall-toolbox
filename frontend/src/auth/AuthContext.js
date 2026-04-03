/**
 * frontend/src/auth/AuthContext.js
 *
 * React Context + Provider wrapping useAuth.
 *
 * Usage:
 *   // In main.jsx or App.jsx:
 *   import { AuthProvider } from './auth/AuthContext.js';
 *   <AuthProvider><App /></AuthProvider>
 *
 *   // In any component:
 *   import { useAuthContext } from './auth/AuthContext.js';
 *   const { user, login, logout, isAuthenticated } = useAuthContext();
 */

import { createContext, useContext } from 'react';
import { useAuth } from './useAuth.js';

const AuthContext = createContext( null );

export function AuthProvider( { children } ) {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={ auth }>
      { children }
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext( AuthContext );
  if ( ! ctx ) {
    throw new Error( 'useAuthContext must be used inside <AuthProvider>.' );
  }
  return ctx;
}
