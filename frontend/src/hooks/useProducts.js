/**
 * frontend/src/hooks/useProducts.js
 *
 * Fetches products on mount and on param change (debounced 300 ms).
 * Returns { products, total, totalPages, isLoading, error, refetch }.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchProducts } from '../api/products.js';
import { normalizeProduct } from '../services/api.js';

export function useProducts( params = {} ) {
  const [ products,   setProducts   ] = useState( [] );
  const [ total,      setTotal      ] = useState( 0 );
  const [ totalPages, setTotalPages ] = useState( 0 );
  const [ isLoading,  setIsLoading  ] = useState( true );
  const [ error,      setError      ] = useState( null );

  // Stable reference to params so the effect dependency compares correctly.
  const paramsRef = useRef( params );
  paramsRef.current = params;

  const fetch_ = useCallback( async ( signal ) => {
    setIsLoading( true );
    setError( null );
    try {
      const data = await fetchProducts( paramsRef.current );
      if ( signal && signal.aborted ) return;

      // fetchProducts returns raw WooCommerce objects from the proxy.
      // Normalize each product so that images, category, brand, etc. are in
      // the consistent internal shape used by all UI components.
      const normalize = ( list ) => list.map( ( p ) => normalizeProduct( p ) ).filter( Boolean );

      // fetchProducts may return an array directly or a { products, total, totalPages } shape.
      if ( Array.isArray( data ) ) {
        setProducts( normalize( data ) );
        setTotal( data.length );
        setTotalPages( 1 );
      } else if ( data && typeof data === 'object' ) {
        const raw = data.products || [];
        setProducts( normalize( raw ) );
        setTotal( data.total ?? raw.length );
        setTotalPages( data.totalPages ?? data.total_pages ?? 1 );
      }
    } catch ( err ) {
      if ( signal && signal.aborted ) return;
      setError( err.message || 'Failed to load products.' );
    } finally {
      if ( ! signal || ! signal.aborted ) setIsLoading( false );
    }
  }, [] );

  // Serialize params so the debounce timer resets when they change.
  const paramsKey = JSON.stringify( params );

  useEffect( () => {
    const controller = new AbortController();
    let timer = setTimeout( () => fetch_( controller.signal ), 300 );
    return () => {
      clearTimeout( timer );
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ paramsKey ] );

  const refetch = useCallback( () => fetch_( null ), [ fetch_ ] );

  return { products, total, totalPages, isLoading, error, refetch };
}

export default useProducts;
