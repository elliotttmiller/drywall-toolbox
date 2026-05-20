/**
 * frontend/src/hooks/useOrderEventStream.js
 *
 * Hook for real-time order status updates via Server-Sent Events (SSE),
 * with automatic polling fallback when EventSource is unavailable.
 *
 * Returns: { events, streaming, error }
 *
 * Behaviour:
 *  - Opens an EventSource to /dtb/v1/orders/{id}/events/stream
 *  - Falls back to polling via useOrderStatus when EventSource is unsupported
 *  - Reconnects on error with exponential backoff (max 3 attempts, 2s/4s/8s)
 *  - Deduplicates incoming events by type + occurred_at
 *  - Stops automatically on terminal status or component unmount
 *  - orderId may be null/undefined (no-op until provided)
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { getOrderEventStreamUrl, ORDER_TERMINAL_STATUSES } from '../api/orders.js';
import useOrderStatus from './useOrderStatus.js';

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_BACKOFF_MS        = 2_000;

/**
 * @param {number|string|null} orderId
 * @param {string}             [orderKey]  WooCommerce order_key for guest access
 * @returns {{ events: Array, streaming: boolean, error: string|null }}
 */
export function useOrderEventStream( orderId, orderKey = '' ) {
  const [ events,      setEvents      ] = useState( [] );
  const [ streaming,   setStreaming    ] = useState( false );
  const [ error,       setError        ] = useState( null );
  const [ useFallback, setUseFallback  ] = useState(
    () => typeof EventSource === 'undefined'
  );

  const esRef             = useRef( null );
  const attemptsRef       = useRef( 0 );
  const reconnectTimerRef = useRef( null );
  const cancelledRef      = useRef( false );

  // Polling fallback — only active when useFallback is true.
  const { data: pollData } = useOrderStatus(
    useFallback ? orderId   : null,
    useFallback ? orderKey  : ''
  );

  // Merge polled timeline events when in fallback mode.
  useEffect( () => {
    if ( ! useFallback || ! pollData?.timeline ) return;
    mergeEvents( setEvents, pollData.timeline );
  }, [ useFallback, pollData ] );

  const clearReconnectTimer = () => {
    if ( reconnectTimerRef.current ) {
      clearTimeout( reconnectTimerRef.current );
      reconnectTimerRef.current = null;
    }
  };

  const teardownEventSource = useCallback( () => {
    if ( esRef.current ) {
      esRef.current.close();
      esRef.current = null;
    }
    clearReconnectTimer();
  }, [] );

  const closeStream = useCallback( () => {
    teardownEventSource();
    setStreaming( false );
  }, [ teardownEventSource ] );

  const openStreamRef = useRef( null );

  const openStream = useCallback( () => {
    if ( ! orderId || typeof EventSource === 'undefined' ) return;

    teardownEventSource();

    const url = getOrderEventStreamUrl( orderId, orderKey );
    const es  = new EventSource( url );
    esRef.current = es;

    es.addEventListener( 'open', () => {
      if ( ! cancelledRef.current ) {
        setStreaming( true );
        setError( null );
      }
    } );

    es.addEventListener( 'message', ( e ) => {
      if ( cancelledRef.current ) return;
      try {
        const event = JSON.parse( e.data );
        mergeEvents( setEvents, [ event ] );
        if ( event.is_terminal || ( event.status && ORDER_TERMINAL_STATUSES.includes( event.status ) ) ) {
          closeStream();
        }
      } catch { /**/ }
    } );

    [ 'order.status_changed', 'order.terminal' ].forEach( ( type ) => {
      es.addEventListener( type, ( e ) => {
        if ( cancelledRef.current ) return;
        try {
          const event = JSON.parse( e.data );
          mergeEvents( setEvents, [ event ] );
          if ( type === 'order.terminal' || event.is_terminal ) closeStream();
        } catch { /**/ }
      } );
    } );

    es.onerror = () => {
      if ( cancelledRef.current ) return;
      closeStream();

      attemptsRef.current += 1;
      if ( attemptsRef.current > MAX_RECONNECT_ATTEMPTS ) {
        setUseFallback( true );
        return;
      }

      const delay = BASE_BACKOFF_MS * Math.pow( 2, attemptsRef.current - 1 );
      reconnectTimerRef.current = setTimeout( () => {
        if ( ! cancelledRef.current ) openStreamRef.current?.();
      }, delay );
    };
  }, [ orderId, orderKey, teardownEventSource, closeStream ] );

  useLayoutEffect( () => {
    openStreamRef.current = openStream;
  }, [ openStream ] );

  useEffect( () => {
    cancelledRef.current = false;

    if ( orderId && ! useFallback ) {
      openStream();
    }

    return () => {
      cancelledRef.current = true;
      teardownEventSource();
    };
  }, [ orderId, orderKey, useFallback, openStream, teardownEventSource ] );

  return { events, streaming, error };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge incoming events into state, deduplicating by type + occurred_at.
 */
function mergeEvents( setEvents, incoming ) {
  if ( ! Array.isArray( incoming ) || incoming.length === 0 ) return;

  setEvents( ( prev ) => {
    const seen = new Set( prev.map( ( e ) => eventKey( e ) ) );
    const next = incoming.filter( ( e ) => ! seen.has( eventKey( e ) ) );
    if ( next.length === 0 ) return prev;
    return [ ...prev, ...next ].sort(
      ( a, b ) => new Date( a.occurred_at ) - new Date( b.occurred_at )
    );
  } );
}

function eventKey( event ) {
  return `${ event.type }|${ event.occurred_at }`;
}

export default useOrderEventStream;
