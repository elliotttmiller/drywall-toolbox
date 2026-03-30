/**
 * frontend/src/api/client.js
 *
 * Axios base clients for the headless WordPress + WooCommerce architecture.
 *
 * Exports:
 *   wpClient  – WordPress REST API (JWT-authenticated)
 *   wcClient  – WooCommerce REST API (Application Password authenticated)
 *
 * All base URLs and credentials are read from VITE_* environment variables
 * injected at build time.  Zero hardcoded URLs or credentials.
 */

import axios from 'axios';

// ─── Base URLs ────────────────────────────────────────────────────────────────

const WP_API_BASE   = import.meta.env.VITE_WP_API_BASE   || '';
const WC_API_BASE   = import.meta.env.VITE_WC_API_BASE   || '';
const WC_AUTH_USER  = import.meta.env.VITE_WC_AUTH_USER  || '';
const WC_AUTH_PASS  = import.meta.env.VITE_WC_AUTH_PASS  || '';

// ─── WordPress REST API client (JWT) ─────────────────────────────────────────

export const wpClient = axios.create({
  baseURL: WP_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: attach JWT from localStorage if present
wpClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dtb_jwt_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: clear token and redirect on 401
wpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('dtb_jwt_token');
      localStorage.removeItem('dtb_jwt_user');
      // Only redirect if not already on a login/public page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── WooCommerce REST API client (Application Password) ──────────────────────

export const wcClient = axios.create({
  baseURL: WC_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    // Application Password Basic Auth — credentials come from env vars only
    ...(WC_AUTH_USER && WC_AUTH_PASS
      ? { Authorization: 'Basic ' + btoa(`${WC_AUTH_USER}:${WC_AUTH_PASS}`) }
      : {}),
  },
  withCredentials: true,
});

// Response interceptor: normalise WooCommerce errors
wcClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.data && error.response.data.message) {
      return Promise.reject(new Error(error.response.data.message));
    }
    return Promise.reject(error);
  },
);
