/**
 * frontend/src/hooks/useRepairStatus.js
 *
 * Hook for fetching and polling a repair's status snapshot.
 *
 * Returns: { data, loading, error, refresh }
 *
 * Behaviour:
 *  - Fetches on mount (and whenever repairId / token change)
 *  - Polls every 20 seconds while the repair is in a non-terminal state
 *  - Stops polling automatically on terminal statuses
 *  - Handles auth:expired events dispatched by apiClient
 *  - Exposes refresh() to trigger an immediate manual re-fetch
 *  - repairId and token may be null/undefined (hook is a no-op until provided)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRepairStatus, TERMINAL_STATUSES } from '../api/repairs.js';

const POLL_INTERVAL_MS = 20_000;

/**
 * @param {number|string|null} repairId
 * @param {string|null}        token     Public repair token
 * @returns {{ data: Object|null, loading: boolean, error: string|null, refresh: Function }}
 */
export function useRepairStatus( repairId, token ) {
  const [ data,    setData    ] = useState( null );
  const [ loading, setLoading ] = useState( false );
  const [ error,   setError   ] = useState( null );

  const timerRef     = useRef( null );
  const cancelledRef = useRef( false );
  // Track latest data in a ref to avoid stale closures inside fetchStatus
  const dataRef      = useRef( null );

  const clearTimer = () => {
    if ( timerRef.current ) {
      clearTimeout( timerRef.current );
      timerRef.current = null;
    }
  };

  const isTerminal = useCallback( ( statusData ) => {
    return statusData && TERMINAL_STATUSES.includes( statusData.status );
  }, [] );

  const fetchStatus = useCallback( async ( isManualRefresh = false ) => {
    if ( ! repairId ) return;

    if ( isManualRefresh ) {
      clearTimer();
    }

    if ( ! isManualRefresh ) {
      // Only show the initial loading spinner — not on background polls
      setLoading( ( prev ) => ( dataRef.current === null ? true : prev ) );
    } else {
      setLoading( true );
    }

    setError( null );

    try {
      const result = await getRepairStatus( repairId, token );

      if ( cancelledRef.current ) return;

      dataRef.current = result;
      setData( result );
      setLoading( false );

      // Schedule next poll unless we've hit a terminal state
      if ( ! isTerminal( result ) ) {
        clearTimer();
        timerRef.current = setTimeout( () => {
          if ( ! cancelledRef.current ) fetchStatus( false );
        }, POLL_INTERVAL_MS );
      }
    } catch ( err ) {
      if ( cancelledRef.current ) return;
      setError( err.message || 'Failed to load repair status.' );
      setLoading( false );

      // Retry polling even on errors (network hiccup), unless already terminal
      if ( ! isTerminal( dataRef.current ) ) {
        clearTimer();
        timerRef.current = setTimeout( () => {
          if ( ! cancelledRef.current ) fetchStatus( false );
        }, POLL_INTERVAL_MS );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ repairId, token ] );

  useEffect( () => {
    cancelledRef.current = false;

    if ( repairId ) {
      fetchStatus( false );
    }

    const handleAuthExpired = () => {
      clearTimer();
      setError( 'Your session has expired. Please log in again.' );
    };

    window.addEventListener( 'auth:expired', handleAuthExpired );

    return () => {
      cancelledRef.current = true;
      clearTimer();
      window.removeEventListener( 'auth:expired', handleAuthExpired );
    };
  }, [ fetchStatus, repairId ] );

  const refresh = useCallback( () => {
    fetchStatus( true );
  }, [ fetchStatus ] );

  return { data, loading, error, refresh };
}

export default useRepairStatus;
