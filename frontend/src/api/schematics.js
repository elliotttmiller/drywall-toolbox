/**
 * frontend/src/api/schematics.js
 *
 * Fetches the schematic image manifest from the WordPress REST API.
 * The manifest maps each schematic ID to its WebP diagram page URLs and
 * preview image URL, as uploaded to the WP Media Library.
 *
 * Endpoint: GET /wp-json/dtb/v1/schematics/media
 *
 * Response shape:
 * {
 *   "columbia-matrix": {
 *     "pages": {
 *       "1": { "url": "https://…", "width": 1200, "height": 896 },
 *       "2": { … }
 *     },
 *     "preview": "https://…"
 *   },
 *   …
 * }
 */

const WP_API_BASE = import.meta.env.VITE_WP_API_BASE
  // Strip /wp/v2 suffix if present — we want the namespace root
  ?.replace(/\/wp\/v2\/?$/, '')
  // Fall back to production URL so static builds always have a default
  ?? 'https://drywalltoolbox.com/wp/wp-json';

/** Full URL of the schematics manifest endpoint. */
export const SCHEMATICS_MEDIA_URL = `${WP_API_BASE}/dtb/v1/schematics/media`;

/**
 * Fetch the full schematic image manifest from WP.
 *
 * Throws on non-2xx responses so callers can handle errors explicitly.
 *
 * @returns {Promise<Record<string, { pages: Record<string, { url: string, width: number|null, height: number|null }>, preview: string|null }>>}
 */
export async function fetchSchematicMediaManifest() {
  const response = await fetch(SCHEMATICS_MEDIA_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // Schematics manifest is public & changes rarely — cache aggressively.
    cache: 'default',
  });

  if (!response.ok) {
    throw new Error(
      `Schematics media manifest fetch failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
