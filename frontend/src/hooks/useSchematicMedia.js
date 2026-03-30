/**
 * frontend/src/hooks/useSchematicMedia.js
 *
 * React hook that fetches and caches the WordPress schematic image manifest.
 * The manifest is stored in module-level memory so it is fetched at most once
 * per page session regardless of how many components call this hook.
 *
 * Usage:
 *   const { manifest, loading, error } = useSchematicMedia();
 *
 *   // Get a diagram page URL (falls back to undefined if not in WP yet):
 *   const diagramSrc = manifest?.['columbia-matrix']?.pages?.['1']?.url;
 *
 *   // Get a preview URL:
 *   const previewSrc = manifest?.['columbia-matrix']?.preview;
 *
 * The calling component (Parts.jsx) provides its own static-path fallbacks,
 * so the UI works correctly before the WP Media Library is populated.
 */

import { useState, useEffect } from 'react';
import { fetchSchematicMediaManifest } from '../api/schematics.js';

// ─── Module-level cache ───────────────────────────────────────────────────────
// Shared across all hook instances so only one fetch is issued per session.
/** @type {Record<string, any> | null} */
let _cachedManifest = null;

/** @type {Promise<Record<string, any>> | null} */
let _pendingFetch = null;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SchematicPageEntry
 * @property {string} url
 * @property {number|null} width
 * @property {number|null} height
 */

/**
 * @typedef {Object} SchematicMediaEntry
 * @property {Record<string, SchematicPageEntry>} pages  — keyed by page number string
 * @property {string|null} preview
 */

/**
 * @typedef {Object} UseSchematicMediaResult
 * @property {Record<string, SchematicMediaEntry> | null} manifest  — null while loading or on error
 * @property {boolean} loading
 * @property {string | null} error
 */

/**
 * Fetch the schematic image manifest from WP once and cache it for the session.
 *
 * @returns {UseSchematicMediaResult}
 */
export function useSchematicMedia() {
  // Lazy initializer: if the manifest is already cached from a previous mount,
  // use it as the initial state so we never need to call setState() in an effect.
  const [manifest, setManifest] = useState(() => _cachedManifest);
  const [loading, setLoading]   = useState(() => _cachedManifest === null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    // Already cached via lazy initializer — nothing to do.
    if (_cachedManifest !== null) {
      return;
    }

    // A fetch is already in-flight from another hook instance — attach to it.
    if (_pendingFetch !== null) {
      _pendingFetch
        .then((data) => {
          setManifest(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message ?? 'Failed to load schematic images');
          setLoading(false);
        });
      return;
    }

    // First call — start the fetch and store the promise so other instances
    // can attach to it rather than issuing duplicate requests.
    _pendingFetch = fetchSchematicMediaManifest()
      .then((data) => {
        _cachedManifest = data;
        _pendingFetch   = null;
        return data;
      })
      .catch((err) => {
        _pendingFetch = null;
        throw err;
      });

    _pendingFetch
      .then((data) => {
        setManifest(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? 'Failed to load schematic images');
        setLoading(false);
      });
  }, []);

  return { manifest, loading, error };
}
