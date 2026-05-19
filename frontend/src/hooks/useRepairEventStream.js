/**
 * frontend/src/hooks/useRepairEventStream.js
 *
 * Hook for real-time repair updates via Server-Sent Events (SSE),
 * with automatic polling fallback when EventSource is unavailable.
 *
 * Returns: { events, streaming, error }
 *
 * Behaviour:
 *  - Opens an EventSource to the SSE endpoint when repairId + token are present
 *  - Falls back to polling via useRepairStatus when EventSource is unsupported
 *  - Reconnects on error with exponential backoff (max 3 attempts, 2s/4s/8s)
 *  - Deduplicates incoming events by type + occurred_at
 *  - Stops automatically on terminal status or component unmount
 *  - repairId and token may be null/undefined (no-op until both provided)
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { getRepairEventStreamUrl, TERMINAL_STATUSES } from '../api/repairs.js';
import useRepairStatus from './useRepairStatus.js';

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_BACKOFF_MS        = 2_000;

/**
 * @param {number|string|null} repairId
 * @param {string|null}        token     Public repair token
 * @returns {{ events: Array, streaming: boolean, error: string|null }}
 */
export function useRepairEventStream( repairId, token ) {
  const [ events,    setEvents    ] = useState( [] );
  const [ streaming, setStreaming ] = useState( false );
  const [ error,     setError     ] = useState( null );
  const [ useFallback, setUseFallback ] = useState(
    () => typeof EventSource === 'undefined'
  );

  const esRef            = useRef( null );
  const attemptsRef      = useRef( 0 );
  const reconnectTimerRef = useRef( null );
  const cancelledRef     = useRef( false );

  // Polling fallback — only active when useFallback is true
  const { data: pollData } = useRepairStatus(
    useFallback ? repairId : null,
    useFallback ? token    : null
  );

  // Merge polled timeline events into events array when in fallback mode
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

  // Tears down the EventSource without touching React state.
  // Safe to call synchronously (e.g. from an effect body or inside openStream).
  const teardownEventSource = useCallback( () => {
    if ( esRef.current ) {
      esRef.current.close();
      esRef.current = null;
    }
    clearReconnectTimer();
  }, [] );

  // Public close — tears down AND updates streaming state.
  // Only call from callbacks (event handlers, timers), not from effect bodies.
  const closeStream = useCallback( () => {
    teardownEventSource();
    setStreaming( false );
  }, [ teardownEventSource ] );

  // Ref holds the latest openStream so the onerror retry can call it without
  // creating a circular useCallback dependency.
  const openStreamRef = useRef( null );

  const openStream = useCallback( () => {
    if ( ! repairId || ! token || typeof EventSource === 'undefined' ) return;

    // Tear down any existing EventSource without touching state —
    // avoids triggering the react-hooks/set-state-in-effect rule.
    teardownEventSource();

    const url = getRepairEventStreamUrl( repairId, token );
    const es  = new EventSource( url );
    esRef.current = es;

    // Update streaming state from the EventSource 'open' callback to comply
    // with the react-hooks/set-state-in-effect rule (no synchronous setState
    // in effect bodies — only in subscription callbacks).
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

        // Stop streaming when terminal
        if ( event.type && TERMINAL_STATUSES.some( ( s ) => event.type.includes( s ) ) ) {
          closeStream();
        }
      } catch { /**/ }
    } );

    // Named event types the backend may send
    [ 'repair.update', 'repair.terminal' ].forEach( ( type ) => {
      es.addEventListener( type, ( e ) => {
        if ( cancelledRef.current ) return;
        try {
          const event = JSON.parse( e.data );
          mergeEvents( setEvents, [ event ] );
          if ( type === 'repair.terminal' ) closeStream();
        } catch { /**/ }
      } );
    } );

    es.onerror = () => {
      if ( cancelledRef.current ) return;
      closeStream();

      attemptsRef.current += 1;
      if ( attemptsRef.current > MAX_RECONNECT_ATTEMPTS ) {
        // Give up on SSE — fall back to polling
        setUseFallback( true );
        return;
      }

      const delay = BASE_BACKOFF_MS * Math.pow( 2, attemptsRef.current - 1 );
      reconnectTimerRef.current = setTimeout( () => {
        if ( ! cancelledRef.current ) openStreamRef.current?.();
      }, delay );
    };
  }, [ repairId, token, teardownEventSource, closeStream ] );

  // Keep ref in sync with the latest callback instance (layout effect fires
  // synchronously before paint, so the ref is always current before any timer fires).
  useLayoutEffect( () => {
    openStreamRef.current = openStream;
  }, [ openStream ] );

  useEffect( () => {
    cancelledRef.current = false;

    if ( repairId && token && ! useFallback ) {
      openStream();
    }

    return () => {
      cancelledRef.current = true;
      // Use teardownEventSource (no setState) in cleanup — the component may be
      // unmounting; calling setState on an unmounted component is a no-op but
      // teardown is safer and satisfies the react-hooks/set-state-in-effect rule.
      teardownEventSource();
    };
  }, [ repairId, token, useFallback, openStream, teardownEventSource ] );

  return { events, streaming, error };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

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

export default useRepairEventStream;
