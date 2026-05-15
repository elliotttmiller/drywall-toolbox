/**
 * frontend/src/utils/featureFlags.js
 *
 * Centralized feature flag helpers for safe rollout of new capabilities.
 *
 * Flags are read from environment variables (baked in at build time by
 * webpack DefinePlugin / dotenv) and can be overridden at runtime via
 * localStorage for development and QA purposes.
 *
 * Usage:
 *   import { isCatalogPlatformEnabled } from '../utils/featureFlags.js';
 *   if (isCatalogPlatformEnabled()) { ... }
 *
 * To enable locally without a build:
 *   localStorage.setItem('dtb_flag_catalog_platform', '1');
 *   location.reload();
 */

/**
 * Read a feature flag value.
 *
 * Priority:
 *   1. localStorage override  (dtb_flag_{key})  — dev/QA only
 *   2. process.env.REACT_APP_{UPPERCASE_KEY}    — build-time env var
 *   3. defaultValue
 *
 * @param {string}  key           Flag key (snake_case), e.g. 'catalog_platform'
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
export function getFeatureFlag( key, defaultValue = false ) {
  // localStorage override (non-production only).
  if ( process.env.REACT_APP_ENV !== 'production' ) {
    const stored = localStorage.getItem( `dtb_flag_${ key }` );
    if ( stored !== null ) {
      return stored === '1' || stored === 'true';
    }
  }

  // Build-time env var.
  const envKey = `REACT_APP_${ key.toUpperCase() }`;
  const envVal = process.env[ envKey ];
  if ( envVal !== undefined ) {
    return envVal === '1' || envVal === 'true';
  }

  return defaultValue;
}

/**
 * Whether the new DTB Catalog Platform endpoints and hooks are active.
 *
 * Controls:
 *   - Products.jsx  → useCatalogProducts / useCatalogFacets vs legacy getProducts()
 *   - ToolsetBuilder → useToolsetBuilder vs SET_TEMPLATES keyword matching
 *
 * Enable:
 *   REACT_APP_DTB_CATALOG_PLATFORM=1  (env var)
 *   localStorage.setItem('dtb_flag_dtb_catalog_platform', '1')  (dev override)
 *
 * @returns {boolean}
 */
export function isCatalogPlatformEnabled() {
  return getFeatureFlag( 'dtb_catalog_platform', false );
}
