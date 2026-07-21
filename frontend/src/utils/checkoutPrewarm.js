import { API_BASE_URL } from '../api/client.js';

let prewarmPromise = null;
let scheduled = false;

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function apiCandidates() {
  if (typeof window === 'undefined') return [];
  const bases = unique([
    String(API_BASE_URL || '').replace(/\/+$/, ''),
    window.location.origin.replace(/\/+$/, ''),
  ]);
  return unique(bases.flatMap((base) => [
    `${base}/wp-json/dtb/v1/checkout/capabilities`,
    `${base}/wp/wp-json/dtb/v1/checkout/capabilities`,
  ]));
}

function hasHint(signature) {
  if (typeof document === 'undefined') return false;
  return Array.from(document.head.querySelectorAll('link[data-dtb-checkout-prewarm]'))
    .some((link) => link.dataset.dtbCheckoutPrewarm === signature);
}

function appendHint({ rel, href, as = '', crossOrigin = false }) {
  if (typeof document === 'undefined' || !href) return;
  const signature = `${rel}|${as}|${href}`;
  if (hasHint(signature)) return;

  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (as) link.as = as;
  if (crossOrigin) link.crossOrigin = 'anonymous';
  link.dataset.dtbCheckoutPrewarm = signature;
  document.head.appendChild(link);
}

function allowedAssetUrl(value) {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(String(value || ''), window.location.origin);
    const backendOrigin = new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;
    if (url.origin !== window.location.origin && url.origin !== backendOrigin) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function allowedPreconnect(value) {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase();
    if (host === 'js.stripe.com' || host === 'm.stripe.network') return url.origin;
  } catch {
    return '';
  }
  return '';
}

async function fetchManifest() {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 4500) : 0;
  try {
    for (const url of apiCandidates()) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller?.signal,
        });
        if (!response.ok) continue;
        const data = await response.json();
        if (data?.performance?.asset_prewarm) return data.performance.asset_prewarm;
      } catch (error) {
        if (controller?.signal.aborted) break;
      }
    }
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
  return null;
}

async function prewarmCheckoutAssets() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const backendOrigin = new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;
    if (backendOrigin !== window.location.origin) {
      appendHint({ rel: 'preconnect', href: backendOrigin, crossOrigin: true });
    }
  } catch {
    // Same-origin runtime remains functional without a preconnect hint.
  }

  ['https://js.stripe.com', 'https://m.stripe.network'].forEach((href) => {
    appendHint({ rel: 'preconnect', href, crossOrigin: true });
  });

  const manifest = await fetchManifest();
  if (!manifest) return;

  (Array.isArray(manifest.preconnect) ? manifest.preconnect : []).forEach((value) => {
    const href = allowedPreconnect(value);
    if (href) appendHint({ rel: 'preconnect', href, crossOrigin: true });
  });

  (Array.isArray(manifest.styles) ? manifest.styles : []).forEach((value) => {
    const href = allowedAssetUrl(value);
    if (href) appendHint({ rel: 'preload', href, as: 'style' });
  });

  (Array.isArray(manifest.scripts) ? manifest.scripts : []).forEach((value) => {
    const href = allowedAssetUrl(value);
    if (href) appendHint({ rel: 'prefetch', href, as: 'script' });
  });
}

export function scheduleCheckoutPrewarm() {
  if (scheduled || typeof window === 'undefined') return;
  scheduled = true;

  const run = () => {
    if (!prewarmPromise) {
      prewarmPromise = prewarmCheckoutAssets().catch(() => undefined);
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 400);
  }
}
