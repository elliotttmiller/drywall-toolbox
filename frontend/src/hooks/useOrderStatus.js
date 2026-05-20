/**
 * frontend/src/hooks/useOrderStatus.js
 *
 * Hook for fetching and polling an order's tracking/status snapshot.
 *
 * Returns: { data, loading, error, refresh }
 *
 * Behaviour:
 *  - Fetches the /dtb/v1/orders/{id}/tracking snapshot on mount
 *  - Polls every 20 seconds while the order is in a non-terminal state
 *  - Stops polling automatically on terminal statuses
 *  - Handles auth:expired events dispatched by apiClient
 *  - Exposes refresh() to trigger an immediate manual re-fetch
 *  - orderId may be null/undefined (hook is a no-op until provided)
 *  - orderKey provides guest access without a JWT
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrderTracking, ORDER_TERMINAL_STATUSES } from '../api/orders.js';

const POLL_INTERVAL_MS = 20_000;

/**
 * @param {number|string|null} orderId
 * @param {string}             [orderKey]  WooCommerce order_key for guest access
 * @returns {{ data: Object|null, loading: boolean, error: string|null, refresh: Function }}
 */
export function useOrderStatus( orderId, orderKey = '' ) {
  const [ data,    setData    ] = useState( null );
  const [ loading, setLoading ] = useState( false );
  const [ error,   setError   ] = useState( null );

  const timerRef     = useRef( null );
  const cancelledRef = useRef( false );
  const dataRef      = useRef( null );

  const clearTimer = () => {
    if ( timerRef.current ) {
      clearTimeout( timerRef.current );
      timerRef.current = null;
    }
  };

  const isTerminal = useCallback( ( statusData ) => {
    return statusData && ORDER_TERMINAL_STATUSES.includes( statusData.status );
  }, [] );

  const fetchStatus = useCallback( async ( isManualRefresh = false ) => {
    if ( ! orderId ) return;

    if ( isManualRefresh ) {
      clearTimer();
    }

    if ( ! isManualRefresh ) {
      setLoading( ( prev ) => ( dataRef.current === null ? true : prev ) );
    } else {
      setLoading( true );
    }

    setError( null );

    try {
      const result = await getOrderTracking( orderId, orderKey );

      if ( cancelledRef.current ) return;

      dataRef.current = result;
      setData( result );
      setLoading( false );

      if ( ! isTerminal( result ) ) {
        clearTimer();
        timerRef.current = setTimeout( () => {
          if ( ! cancelledRef.current ) fetchStatus( false );
        }, POLL_INTERVAL_MS );
      }
    } catch ( err ) {
      if ( cancelledRef.current ) return;
      setError( err.message || 'Failed to load order status.' );
      setLoading( false );

      if ( ! isTerminal( dataRef.current ) ) {
        clearTimer();
        timerRef.current = setTimeout( () => {
          if ( ! cancelledRef.current ) fetchStatus( false );
        }, POLL_INTERVAL_MS );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ orderId, orderKey ] );

  useEffect( () => {
    cancelledRef.current = false;

    if ( orderId ) {
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
  }, [ fetchStatus, orderId ] );

  const refresh = useCallback( () => {
    fetchStatus( true );
  }, [ fetchStatus ] );

  return { data, loading, error, refresh };
}

export default useOrderStatus;
