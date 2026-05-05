/**
 * frontend/src/hooks/useCategories.js
 *
 * Fetches product categories once per session via a useRef guard.
 * Returns { categories, isLoading, error }.
 */

import { useState, useEffect, useRef } from 'react';
import { fetchCategories } from '../api/products.js';

export function useCategories() {
  const [ categories, setCategories ] = useState( [] );
  const [ isLoading,  setIsLoading  ] = useState( true );
  const [ error,      setError      ] = useState( null );

  // Guard: only fetch once per session (ref persists across re-renders).
  const fetchedRef = useRef( false );

  useEffect( () => {
    if ( fetchedRef.current ) return;
    fetchedRef.current = true;

    fetchCategories()
      .then( ( data ) => setCategories( Array.isArray( data ) ? data : [] ) )
      .catch( ( err ) => setError( err.message || 'Failed to load categories.' ) )
      .finally( () => setIsLoading( false ) );
  }, [] );

  return { categories, isLoading, error };
}

export default useCategories;
