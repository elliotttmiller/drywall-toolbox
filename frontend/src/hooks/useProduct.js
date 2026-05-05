/**
 * frontend/src/hooks/useProduct.js
 *
 * Fetches a single product by id or slug.
 *   - Numeric id  → fetchProduct(id)
 *   - String slug → fetchProductBySlug(slug)
 *
 * Returns { product, isLoading, error }.
 */

import { useState, useEffect } from 'react';
import { fetchProduct, fetchProductBySlug } from '../api/products.js';
import { normalizeProduct } from '../services/api.js';

export function useProduct( idOrSlug ) {
  const [ product,   setProduct   ] = useState( null );
  // Initialise loading only when there is something to fetch.  Loading is set
  // to true synchronously from within the effect (line below) when a fetch
  // actually starts, and set to false in the finally() callback.
  const [ isLoading, setIsLoading ] = useState( () => !! idOrSlug );
  const [ error,     setError     ] = useState( null );

  useEffect( () => {
    if ( ! idOrSlug ) {
      return;
    }

    let cancelled = false;
    // Starting a new async fetch — set loading state before the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading( true );
    setError( null );

    const isNumeric = /^\d+$/.test( String( idOrSlug ) );
    const fetcher   = isNumeric
      ? () => fetchProduct( idOrSlug )
      : () => fetchProductBySlug( idOrSlug );

    fetcher()
      .then( ( data ) => {
        if ( cancelled ) return;
        // fetchProductBySlug returns an array (WC ?slug= query); unwrap it.
        const raw = Array.isArray( data ) ? ( data[ 0 ] ?? null ) : data;
        // Normalize raw WooCommerce product so images, category, brand, etc.
        // are in the consistent internal shape used by all UI components.
        setProduct( raw ? normalizeProduct( raw ) : null );
      } )
      .catch( ( err ) => {
        if ( cancelled ) return;
        setError( err.message || 'Failed to load product.' );
      } )
      .finally( () => {
        if ( ! cancelled ) setIsLoading( false );
      } );

    return () => { cancelled = true; };
  }, [ idOrSlug ] );

  return { product, isLoading, error };
}

export default useProduct;
