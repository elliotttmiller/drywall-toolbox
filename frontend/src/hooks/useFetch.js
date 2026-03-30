/**
 * src/hooks/useFetch.js
 *
 * Shared data-fetching hook that standardises loading / error / empty states
 * across all components that consume the WooCommerce REST API.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useFetch(getProducts);
 *   const { data: product } = useFetch(() => getProduct(id), [id]);
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * @param {Function} fetchFn  A function that returns a Promise.
 * @param {Array}    deps     Dependency array — hook re-fires when these change.
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: Function }}
 */
export const useFetch = (fetchFn, deps = []) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const execute = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFn()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Something went wrong'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // `fetchFn` is intentionally omitted from the dependency array.
  // Callers use `deps` to control when the hook re-fires (e.g. when a route
  // param changes).  Including `fetchFn` would cause infinite re-renders for
  // callers that pass inline arrow functions (a new reference on every render).
  // This pattern mirrors the spec and is safe as long as callers list the
  // values that should trigger a re-fetch in their own `deps` array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const cleanup = execute();
    return cleanup;
  }, [execute]);

  return { data, loading, error, refetch: execute };
};

export default useFetch;
