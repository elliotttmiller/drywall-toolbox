/**
 * Public WordPress and WooCommerce read helpers.
 *
 * WordPress posts/pages are read from public WP REST endpoints. Product reads
 * use the server-side `drywall/v1` proxy so no WooCommerce credential is ever
 * present in browser source, storage, environment configuration, or requests.
 */

import { apiClient, API_BASE_URL } from './client.js';

const configuredWpBase = (process.env.REACT_APP_WP_BASE_URL || '').replace(/\/+$/, '');
const wpOrigin = configuredWpBase || API_BASE_URL;

async function publicJsonFetch(url) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || `API request failed with status ${response.status}.`);
  }

  return response.json();
}

export async function getPosts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return publicJsonFetch(`${wpOrigin}/wp-json/wp/v2/posts${query ? `?${query}` : ''}`);
}

export async function getPages(params = {}) {
  const query = new URLSearchParams(params).toString();
  return publicJsonFetch(`${wpOrigin}/wp-json/wp/v2/pages${query ? `?${query}` : ''}`);
}

export async function getProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`/wp-json/drywall/v1/products${query ? `?${query}` : ''}`);
}

export async function getProduct(id) {
  return apiClient(`/wp-json/drywall/v1/products/${encodeURIComponent(id)}`);
}
