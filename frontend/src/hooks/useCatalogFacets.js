/**
 * frontend/src/hooks/useCatalogFacets.js
 *
 * Fetches catalog facets from GET /wp-json/dtb/v1/catalog/facets.
 *
 * Returns { brands, categories, displayCategoriesByBrand } for the
 * Products page filter UI.  Uses a module-level cache with a 5-minute TTL
 * so the facets are fetched once per session rather than on every render.
 *
 * Returns:
 *   {
 *     facets: { brands, categories, displayCategoriesByBrand } | null,
 *     loading: boolean,
 *     error:   Error | null,
 *   }
 */

import { useState, useEffect } from 'react';
import { apiClient }           from '../api/client.js';

// Module-level cache (shared across all hook instances).
let _cache    = null;
let _cacheAt  = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-flight promise shared across simultaneous callers.
let _inflight = null;

function isCacheFresh() {
  return _cache !== null && ( Date.now() - _cacheAt ) < CACHE_TTL;
}

export function useCatalogFacets() {
  // Initialize synchronously from cache when fresh — avoids an extra render.
  const [ facets,  setFacets  ] = useState( () => isCacheFresh() ? _cache : null );
  const [ loading, setLoading ] = useState( () => ! isCacheFresh() );
  const [ error,   setError   ] = useState( null );

  useEffect( () => {
    // Cache was already valid at mount — nothing to do.
    if ( isCacheFresh() ) {
      return;
    }

    let mounted = true;

    if ( ! _inflight ) {
      _inflight = apiClient( '/wp-json/dtb/v1/catalog/facets' )
        .then( data => {
          _cache   = data;
          _cacheAt = Date.now();
          _inflight = null;
          return data;
        } )
        .catch( err => {
          _inflight = null;
          throw err;
        } );
    }

    _inflight
      .then( data => {
        if ( ! mounted ) return;
        setFacets( data );
        setLoading( false );
      } )
      .catch( err => {
        if ( ! mounted ) return;
        setError( err );
        setLoading( false );
      } );

    return () => { mounted = false; };
  }, [] );

  return { facets, loading, error };
}

/** Invalidate the module-level facets cache (e.g. after an admin action). */
export function invalidateCatalogFacetsCache() {
  _cache   = null;
  _cacheAt = 0;
}

export default useCatalogFacets;
