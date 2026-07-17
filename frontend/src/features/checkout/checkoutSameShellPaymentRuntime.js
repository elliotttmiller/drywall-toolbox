/**
 * frontend/src/features/checkout/checkoutSameShellPaymentRuntime.js
 *
 * Same-page payment surface runtime. This module does not render, clone, or
 * dispatch into WooPayments Blocks controls. It embeds a same-origin WordPress
 * document where the native WooCommerce Checkout Block/WooPayments runtime owns
 * card fields, wallets, tokenization, and payment processing.
 */

import { getCheckoutCapabilities, requestCheckoutPaymentSurface } from '../../api/checkout.js';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout\/?$/;
const LEGACY_ORDER_PAY_RE = /(?:^|\/)checkout\/order-pay\//;
const SYNC_INTERVAL_MS = 30000;
const SURFACE_CLASS = 'dtb-payment-surface-frame';
const STATUS_CLASS = 'dtb-same-shell-payment-status';

let installed = false;
let syncPromise = null;
let lastSyncAt = 0;
let currentState = { eligible: false, reason: 'not_checked', capabilities: null };
let originalSetTimeout = null;
let originalPushState = null;
let originalReplaceState = null;
let preparedPaymentObserver = null;
let observedCheckoutRoot = null;
let currentSurfaceKey = '';
let surfaceInFlight = false;
let surfaceRequestSeq = 0;

function isCheckoutRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
  return CHECKOUT_PATH_RE.test(path);
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function isLegacyOrderPayUrl(value) {
  const href = String(value || '');
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    return LEGACY_ORDER_PAY_RE.test(url.pathname);
  } catch {
    return LEGACY_ORDER_PAY_RE.test(href);
  }
}

function isPaymentSurfaceUrl(value) {
  const href = String(value || '');
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.searchParams.has('dtb_checkout_payment_surface');
  } catch {
    return href.includes('dtb_checkout_payment_surface=');
  }
}

function decodeDatasetJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function paymentContext(root, action) {
  const paymentStep = root.querySelector('#checkout-payment-step');
  const source = action instanceof HTMLElement ? action : paymentStep;
  const orderId = Number(source?.dataset?.dtbOrderId || paymentStep?.dataset?.dtbOrderId || 0);
  const orderKey = String(source?.dataset?.dtbOrderKey || paymentStep?.dataset?.dtbOrderKey || '');
  const billingEmail = String(source?.dataset?.dtbBillingEmail || paymentStep?.dataset?.dtbBillingEmail || '');
  const paymentUrl = String(source?.dataset?.dtbPaymentUrl || paymentStep?.dataset?.dtbPaymentUrl || '');
  const paymentMethod = String(source?.dataset?.dtbPaymentMethod || paymentStep?.dataset?.dtbPaymentMethod || '');
  const billingAddress = decodeDatasetJson(paymentStep?.dataset?.dtbBillingAddress || '') || {};
  const shippingAddress = decodeDatasetJson(paymentStep?.dataset?.dtbShippingAddress || '') || billingAddress;
  return { orderId, orderKey, billingEmail, paymentUrl, paymentMethod, billingAddress, shippingAddress };
}

function evaluate(capabilities) {
  const architecture = capabilities?.payment_architecture || {};
  if (architecture.contract_version !== '4') {
    return { eligible: false, reason: 'contract_version_mismatch' };
  }
  if (architecture.same_shell_supported !== true) {
    return { eligible: false, reason: 'payment_surface_not_enabled' };
  }
  if (architecture.payment_surface_supported !== true) {
    return { eligible: false, reason: 'native_payment_surface_unavailable' };
  }
  return { eligible: true, reason: 'native_payment_surface_ready' };
}

function applyState(root) {
  if (!(root instanceof HTMLElement)) return;
  root.dataset.dtbSameShellPayment = currentState.eligible ? 'ready' : 'blocked';
  root.dataset.dtbSameShellReason = currentState.reason;
  root.classList.toggle('dtb-checkout--same-shell-ready', currentState.eligible);
  root.classList.toggle('dtb-checkout--same-shell-blocked', !currentState.eligible);
}

async function syncState(root, force = false) {
  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) {
    applyState(root);
    return currentState;
  }
  if (syncPromise) return syncPromise;

  syncPromise = getCheckoutCapabilities()
    .then((capabilities) => {
      currentState = { ...evaluate(capabilities), capabilities };
      lastSyncAt = Date.now();
      applyState(root);
      return currentState;
    })
    .catch(() => {
      currentState = { eligible: false, reason: 'capability_fetch_failed', capabilities: null };
      lastSyncAt = Date.now();
      applyState(root);
      return currentState;
    })
    .finally(() => {
      syncPromise = null;
    });

  return syncPromise;
}

function paymentActionFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  const action = target?.closest?.('button, a');
  if (!(action instanceof HTMLElement)) return null;
  const label = String(action.textContent || action.getAttribute('aria-label') || '').trim().toLowerCase();
  const href = action instanceof HTMLAnchorElement ? action.href : action.getAttribute('href');
  if (label.includes('open protected payment') || label.includes('resume payment') || label.includes('resume secure payment')) return action;
  if (isLegacyOrderPayUrl(href) || isPaymentSurfaceUrl(href)) return action;
  return null;
}

function paymentActionFromRoot(root) {
  const paymentStep = root.querySelector('#checkout-payment-step');
  if (!(paymentStep instanceof HTMLElement)) return null;
  const actionWithContext = paymentStep.querySelector('button[data-dtb-order-id][data-dtb-order-key]');
  if (actionWithContext instanceof HTMLElement) return actionWithContext;
  const openPaymentAction = Array.from(paymentStep.querySelectorAll('button, a')).find((node) => {
    const label = String(node.textContent || node.getAttribute('aria-label') || '').trim().toLowerCase();
    const href = node instanceof HTMLAnchorElement ? node.href : node.getAttribute('href');
    return label.includes('open protected payment') || isLegacyOrderPayUrl(href) || isPaymentSurfaceUrl(href);
  });
  return openPaymentAction instanceof HTMLElement ? openPaymentAction : paymentStep;
}

function ensureStatusPanel(root) {
  const paymentStep = root.querySelector('#checkout-payment-step');
  if (!(paymentStep instanceof HTMLElement)) return null;
  let panel = paymentStep.querySelector(`.${STATUS_CLASS}`);
  if (!(panel instanceof HTMLElement)) {
    panel = document.createElement('div');
    panel.className = STATUS_CLASS;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    paymentStep.appendChild(panel);
  }
  return panel;
}

function renderStatus(root, status, message) {
  const panel = ensureStatusPanel(root);
  if (!panel) return;
  panel.dataset.status = status;
  panel.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = status === 'error' ? 'In-checkout payment unavailable' : 'Secure in-checkout payment';
  const copy = document.createElement('p');
  copy.textContent = message;
  panel.append(title, copy);
}

function ensureFrame(root) {
  const paymentStep = root.querySelector('#checkout-payment-step');
  if (!(paymentStep instanceof HTMLElement)) return null;
  let frame = paymentStep.querySelector(`iframe.${SURFACE_CLASS}`);
  if (!(frame instanceof HTMLIFrameElement)) {
    frame = document.createElement('iframe');
    frame.className = SURFACE_CLASS;
    frame.title = 'Secure WooPayments checkout';
    frame.setAttribute('loading', 'eager');
    frame.setAttribute('allow', 'payment *; publickey-credentials-get *');
    frame.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    frame.style.width = '100%';
    frame.style.minHeight = '520px';
    frame.style.border = '0';
    const status = paymentStep.querySelector(`.${STATUS_CLASS}`);
    if (status instanceof HTMLElement) {
      status.before(frame);
    } else {
      paymentStep.appendChild(frame);
    }
  }
  return frame;
}

async function resolveSurfaceUrl(context) {
  if (isPaymentSurfaceUrl(context.paymentUrl)) return context.paymentUrl;
  const response = await requestCheckoutPaymentSurface({
    order_id: context.orderId,
    order_key: context.orderKey,
  });
  return String(response?.url || response?.payment_surface_url || '');
}

async function mountPaymentSurface(root, action, { force = false } = {}) {
  if (!(root instanceof HTMLElement) || !document.contains(root)) return;
  if (surfaceInFlight && !force) return;
  const paymentAction = action instanceof HTMLElement ? action : paymentActionFromRoot(root);
  const context = paymentContext(root, paymentAction);
  if (!context.orderId || !context.orderKey) return;
  const key = `${context.orderId}:${context.orderKey}`;
  if (!force && key === currentSurfaceKey) return;

  const requestId = ++surfaceRequestSeq;
  surfaceInFlight = true;
  renderStatus(root, 'loading', 'Loading the native WooPayments checkout surface inside checkout…');
  try {
    const state = await syncState(root, true);
    if (requestId !== surfaceRequestSeq || !document.contains(root)) return;
    if (!state.eligible) {
      renderStatus(root, 'error', `Same-page WooPayments checkout is not active (${normalizeId(state.reason)}).`);
      return;
    }
    const url = await resolveSurfaceUrl(context);
    if (requestId !== surfaceRequestSeq || !document.contains(root)) return;
    const latestAction = paymentActionFromRoot(root);
    const latestContext = paymentContext(root, latestAction);
    if (`${latestContext.orderId}:${latestContext.orderKey}` !== key) return;
    if (!url) throw new Error('The checkout payment surface URL could not be created.');
    const frame = ensureFrame(root);
    if (!frame) throw new Error('The checkout payment surface could not be mounted.');
    if (requestId !== surfaceRequestSeq || !document.contains(root)) return;
    frame.dataset.dtbOrderId = String(context.orderId);
    frame.src = url;
    currentSurfaceKey = key;
    renderStatus(root, 'loading', 'WooPayments is loading securely inside checkout…');
    window.dispatchEvent(new CustomEvent('dtb:checkout-payment-surface-mounted', { detail: { orderId: context.orderId } }));
  } catch (error) {
    if (requestId === surfaceRequestSeq && document.contains(root)) {
      renderStatus(root, 'error', error?.message || 'The native WooPayments checkout surface could not be loaded.');
    }
  } finally {
    if (requestId === surfaceRequestSeq) surfaceInFlight = false;
  }
}

async function handlePaymentClick(event) {
  if (!isCheckoutRoute()) return;
  const action = paymentActionFromEvent(event);
  if (!action) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

  void mountPaymentSurface(root, action, { force: true });
}

function handleSurfaceMessage(event) {
  if (event.origin !== window.location.origin) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;
  const frame = root.querySelector(`iframe.${SURFACE_CLASS}`);
  if (!(frame instanceof HTMLIFrameElement) || event.source !== frame.contentWindow) return;
  const detail = event.data || {};
  if (!detail || detail.source !== 'dtb-payment-surface') return;
  if (String(detail.orderId || '') !== String(frame.dataset.dtbOrderId || '')) return;

  if (detail.type === 'dtb:payment-surface:resize') {
    const height = Number(detail.height || 0);
    if (Number.isFinite(height) && height > 240) frame.style.height = `${Math.min(Math.ceil(height), 2400)}px`;
  }
  if (detail.type === 'dtb:payment-surface:ready') {
    renderStatus(root, 'ready', 'WooPayments is available in the secure checkout payment surface.');
  }
  if (detail.type === 'dtb:payment-surface:error') {
    renderStatus(root, 'error', String(detail.message || 'WooPayments reported a recoverable payment-surface error.'));
  }
  if (detail.type === 'dtb:payment-surface:success') {
    renderStatus(root, 'ready', 'Payment was completed securely. Updating checkout status…');
  }
}

function callbackLooksLikeLegacyPaymentRedirect(callback) {
  if (typeof callback !== 'function') return false;
  let source = '';
  try {
    source = Function.prototype.toString.call(callback);
  } catch {
    return false;
  }
  return source.includes('location.assign') || source.includes('.assign(') || source.includes('order-pay');
}

function suppressLegacyOrderPayTimeout(callback, delay, args) {
  return originalSetTimeout(() => {
    if (!isCheckoutRoute()) {
      callback(...args);
      return;
    }
    const root = document.querySelector('.dtb-checkout');
    if (!(root instanceof HTMLElement)) return;
    void mountPaymentSurface(root, paymentActionFromRoot(root), { force: true });
  }, delay, ...args);
}

function patchLegacyOrderPayTimeout() {
  if (originalSetTimeout || typeof window === 'undefined' || typeof window.setTimeout !== 'function') return;
  originalSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay = 0, ...args) => {
    if (isCheckoutRoute() && callbackLooksLikeLegacyPaymentRedirect(callback)) {
      return suppressLegacyOrderPayTimeout(callback, delay, args);
    }
    return originalSetTimeout(callback, delay, ...args);
  };
}

function resetObserver() {
  if (preparedPaymentObserver) preparedPaymentObserver.disconnect();
  preparedPaymentObserver = null;
  observedCheckoutRoot = null;
}

function observePreparedPayment() {
  if (typeof MutationObserver === 'undefined') return;
  const root = document.querySelector('.dtb-checkout');
  if (!isCheckoutRoute() || !(root instanceof HTMLElement)) {
    resetObserver();
    return;
  }
  if (preparedPaymentObserver && observedCheckoutRoot === root) return;
  resetObserver();
  observedCheckoutRoot = root;

  const syncPreparedPayment = () => {
    if (observedCheckoutRoot !== root || !document.contains(root)) return;
    const action = paymentActionFromRoot(root);
    const context = paymentContext(root, action);
    if (!context.orderId || !context.orderKey) return;
    void mountPaymentSurface(root, action);
  };

  preparedPaymentObserver = new MutationObserver(() => syncPreparedPayment());
  preparedPaymentObserver.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-dtb-order-id',
      'data-dtb-order-key',
      'data-dtb-payment-url',
      'data-dtb-payment-method',
      'data-dtb-billing-email',
    ],
  });
  syncPreparedPayment();
}

function scheduleSync() {
  if (!isCheckoutRoute()) {
    resetObserver();
    return;
  }
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) {
    resetObserver();
    return;
  }
  void syncState(root);
  observePreparedPayment();
}

function patchNavigationEvents() {
  if (originalPushState || typeof window === 'undefined' || !window.history) return;
  originalPushState = window.history.pushState.bind(window.history);
  originalReplaceState = window.history.replaceState.bind(window.history);
  const schedule = () => window.setTimeout(scheduleSync, 0);
  window.history.pushState = (...args) => {
    const result = originalPushState(...args);
    schedule();
    return result;
  };
  window.history.replaceState = (...args) => {
    const result = originalReplaceState(...args);
    schedule();
    return result;
  };
}

export function installCheckoutSameShellPaymentRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  patchLegacyOrderPayTimeout();
  patchNavigationEvents();
  document.addEventListener('click', handlePaymentClick, true);
  window.addEventListener('message', handleSurfaceMessage);
  window.addEventListener('dtb:checkout-same-shell-payment-requested', () => {
    const root = document.querySelector('.dtb-checkout');
    if (root instanceof HTMLElement) void mountPaymentSurface(root, paymentActionFromRoot(root), { force: true });
  });
  window.addEventListener('dtb:checkout-payment-method-selected', scheduleSync);
  window.addEventListener('popstate', () => window.setTimeout(scheduleSync, 0));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  } else {
    scheduleSync();
  }
}
