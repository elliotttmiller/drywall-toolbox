import { useEffect, useMemo, useRef, useState } from 'react';
import { searchProducts } from '../services/catalog';

const RECENT_KEY = 'dtb:storefront:recent-searches';

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(Boolean).slice(0, 6);
  } catch {
    return [];
  }
}

function saveRecentSearch(query) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const next = [trimmed, ...getRecentSearches().filter((item) => item !== trimmed)].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function useStorefrontSearch({ popularBrands = [], popularCategories = [] } = {}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchProducts(trimmed);
        if (requestIdRef.current === requestId) {
          setSuggestions(Array.isArray(found) ? found.slice(0, 8) : []);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setSuggestions([]);
        }
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const popular = useMemo(() => ({
    brands: popularBrands.slice(0, 5),
    categories: popularCategories.slice(0, 5),
  }), [popularBrands, popularCategories]);

  return {
    query,
    setQuery,
    loading,
    suggestions,
    recentSearches,
    rememberSearch: (value) => {
      saveRecentSearch(value);
      setRecentSearches(getRecentSearches());
    },
    popularBrands: popular.brands,
    popularCategories: popular.categories,
  };
}
