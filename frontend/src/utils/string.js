/**
 * frontend/src/utils/string.js
 *
 * Shared string utilities.
 */

/**
 * Decode common HTML entities that WooCommerce and WordPress embed in API
 * responses (product names, category names, etc.).
 *
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
