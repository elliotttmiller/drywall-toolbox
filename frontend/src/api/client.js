/**
 * Canonical same-origin API client for the Drywall Toolbox storefront.
 *
 * Security invariants:
 * - Browser code never receives WooCommerce application passwords, consumer
 *   keys, consumer secrets, or integration API keys.
 * - Authentication uses the HttpOnly DTB cookie and an optional in-memory
 *   bearer token only.
 * - WooCommerce administrative REST calls are performed by server-side DTB
 *   proxy/controllers, never directly from the browser.
 */

import axios from 'axios';
import { getToken, clearToken } from '../auth/tokenStore.js';
import { emitGlobalLoadingEnd, emitGlobalLoadingStart } from '../utils/globalLoadingEvents.js';

const inflightGetRequests = new Map();
const getCooldowns = new Map();
let authExpiryCheckPromise = null;

const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : '';
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const envApiBase = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

export const API_BASE_URL =
  envApiBase || (/github\.io$/i.test(runtimeHost) ? 'https://drywalltoolbox.com' : runtimeOrigin);

const configuredWpBase = (process.env.REACT_APP_WP_BASE_URL || '').replace(/\/+$/, '');
const WP_API_BASE = configuredWpBase
  ? (configuredWpBase.endsWith('/wp-json') ? configuredWpBase : `${configuredWpBase}/wp-json`)
  : `${API_BASE_URL}/wp-json`;

const DTB_AUTH_VALIDATE_URL = `${API_BASE_URL}/wp-json/dtb/v1/auth/validate`;

function normalizeBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function uniqueUrls(urls) {
  return Array.from(new Set(urls.filter(Boolean)));
}

function buildApiRequestUrls(endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return [endpoint];

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!normalizedEndpoint.startsWith('/wp-json/')) {
    return [`${API_BASE_URL}${normalizedEndpoint}`];
  }

  const restPath = normalizedEndpoint.replace(/^\/wp-json/, '');
  const bases = uniqueUrls([
    normalizeBaseUrl(API_BASE_URL),
    runtimeOrigin ? normalizeBaseUrl(runtimeOrigin) : '',
  ]);
  const urls = [];

  for (const base of bases) {
    urls.push(`${base}${normalizedEndpoint}`);
    urls.push(`${base}/wp/wp-json${restPath}`);
  }

  if (WP_API_BASE) urls.push(`${normalizeBaseUrl(WP_API_BASE)}${restPath}`);
  return uniqueUrls(urls);
}

function looksLikeJson(text = '') {
  const trimmed = String(text || '').trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

async function readJsonEnvelope(response) {
  const text = await response.text();
  if (!text || !looksLikeJson(text)) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function nonJsonResponseError(response, url, bodyText = '') {
  const preview = String(bodyText || '').trim().slice(0, 80);
  const html = /^<!doctype\s+html|^<html|^</i.test(preview);
  return {
    code: 'non_json_response',
    message: html
      ? 'API endpoint returned HTML instead of JSON. The route may be missing or rewritten to the application shell.'
      : 'API endpoint returned a non-JSON response.',
    status: response.status,
    url,
  };
}

async function parseSuccessfulJsonResponse(response, url) {
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  const text = await response.text();
  if (!text) return null;
  if (!contentType.includes('json') && !looksLikeJson(text)) {
    throw nonJsonResponseError(response, url, text);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw {
      code: 'invalid_json_response',
      message: 'API endpoint returned malformed JSON.',
      status: response.status,
      url,
    };
  }
}

async function shouldDispatchAuthExpired() {
  if (getToken()) return true;
  if (!DTB_AUTH_VALIDATE_URL) return false;
  if (authExpiryCheckPromise) return authExpiryCheckPromise;

  authExpiryCheckPromise = (async () => {
    try {
      const response = await fetch(DTB_AUTH_VALIDATE_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return true;
      const data = await response.json().catch(() => ({}));
      return !data?.user;
    } catch {
      return false;
    } finally {
      authExpiryCheckPromise = null;
    }
  })();

  return authExpiryCheckPromise;
}

async function handleUnauthorized() {
  clearToken();
  const shouldExpire = await shouldDispatchAuthExpired();
  if (shouldExpire && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:expired'));
  }
}

function attachSafeAxiosInterceptors(client) {
  client.interceptors.request.use(
    (config) => {
      emitGlobalLoadingStart();
      config.__dtbGlobalLoadingTracked = true;
      const token = getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error),
  );

  client.interceptors.response.use(
    (response) => {
      if (response?.config?.__dtbGlobalLoadingTracked) {
        emitGlobalLoadingEnd();
        response.config.__dtbGlobalLoadingTracked = false;
      }
      return response;
    },
    async (error) => {
      if (error?.config?.__dtbGlobalLoadingTracked) {
        emitGlobalLoadingEnd();
        error.config.__dtbGlobalLoadingTracked = false;
      }
      if (error?.response?.status === 401) await handleUnauthorized();
      return Promise.reject(error);
    },
  );

  return client;
}

export const wpClient = attachSafeAxiosInterceptors(axios.create({
  baseURL: WP_API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
}));

/**
 * Deprecated compatibility client. It targets the server-side `drywall/v1`
 * proxy and intentionally has no WooCommerce Basic Authorization header.
 */
export const wcClient = attachSafeAxiosInterceptors(axios.create({
  baseURL: `${API_BASE_URL}/wp-json/drywall/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
}));

/**
 * Deprecated compatibility hook retained for old callers. There are no browser
 * credentials to bootstrap; the server-side proxy owns WooCommerce auth.
 */
export const credentialsReady = () => Promise.resolve();

/**
 * Fetch wrapper for DTB, WooCommerce Store API, and read-only proxy routes.
 */
export async function apiClient(endpoint, options = {}) {
  const requestUrls = buildApiRequestUrls(endpoint);
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (['POST', 'PUT', 'PATCH'].includes(method) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const requestKey = `${method} ${requestUrls[0]} ${headers.Authorization || ''}`;
  const now = Date.now();

  if (method === 'GET') {
    const cooldownUntil = getCooldowns.get(requestKey) || 0;
    if (cooldownUntil > now) {
      throw {
        code: 'rate_limited',
        message: 'Request is cooling down after a 429 response.',
        status: 429,
        retryAfter: cooldownUntil - now,
      };
    }
    if (inflightGetRequests.has(requestKey)) return inflightGetRequests.get(requestKey);
  }

  emitGlobalLoadingStart();

  const execute = async () => {
    let lastError = null;

    for (const url of requestUrls) {
      let response;
      try {
        response = await fetch(url, {
          ...options,
          method,
          headers,
          credentials: 'include',
        });
      } catch {
        lastError = { code: 'network_error', message: 'Network request failed.', status: 0, url };
        continue;
      }

      if (response.status === 401) {
        await handleUnauthorized();
        const envelope = await readJsonEnvelope(response) || {};
        throw {
          code: envelope.code || 'unauthorized',
          message: envelope.message || 'Authentication required.',
          status: 401,
        };
      }

      if (response.status === 429) {
        const envelope = await readJsonEnvelope(response) || {};
        const retryAfterSeconds = Math.max(1, parseInt(response.headers.get('Retry-After') || '60', 10));
        const retryAfter = retryAfterSeconds * 1000;
        if (method === 'GET') getCooldowns.set(requestKey, Date.now() + retryAfter);
        throw {
          code: envelope.code || 'rate_limited',
          message: envelope.message || 'Too many requests.',
          status: 429,
          retryAfter,
        };
      }

      if (!response.ok) {
        const envelope = await readJsonEnvelope(response) || {};
        lastError = {
          code: envelope.code || 'api_error',
          message: envelope.message || `Request failed with status ${response.status}.`,
          status: response.status,
          url,
        };
        if (method === 'GET' && [404, 405, 500, 502, 503, 504].includes(response.status)) continue;
        throw lastError;
      }

      if (response.status === 204) return null;

      try {
        return await parseSuccessfulJsonResponse(response, url);
      } catch (error) {
        lastError = error;
        if (method === 'GET' && ['non_json_response', 'invalid_json_response'].includes(error?.code)) continue;
        throw error;
      }
    }

    throw lastError || { code: 'network_error', message: 'Network request failed.', status: 0 };
  };

  if (method !== 'GET') {
    return execute().finally(() => emitGlobalLoadingEnd());
  }

  const promise = execute().finally(() => {
    inflightGetRequests.delete(requestKey);
    emitGlobalLoadingEnd();
  });
  inflightGetRequests.set(requestKey, promise);
  return promise;
}
