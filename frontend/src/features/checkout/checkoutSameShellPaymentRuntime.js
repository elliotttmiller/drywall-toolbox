/**
 * frontend/src/features/checkout/checkoutSameShellPaymentRuntime.js
 *
 * Same-page Stripe payment surface runtime.
 *
 * React owns checkout presentation and decides when payment is ready. This
 * runtime only mounts the same-origin WordPress/WooCommerce payment document
 * that contains the official WooCommerce Checkout Block and Payment Plugins
 * Stripe Blocks integration. It never renders, clones, or confirms Stripe
 * Elements directly.
 */

import { getCheckoutCapabilities, requestCheckoutPaymentSurface } from '../../api/checkout.js';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout\/?$/;
const LEGACY_ORDER_PAY_RE = /(?:^|\/)checkout\/order-pay\//;
const PAYMENT_SURFACE_QUERY = 'dtb_checkout_payment_surface';
const SYNC_INTERVAL_MS = 30000;
const SURFACE_CLASS = 'dtb-payment-surface-frame';
const STATUS_CLASS = 'dtb-same-shell-payment-status';
const ROOT_SELECTOR = '.dtb-checkout';

let installed = false;
let syncPromise = null;
let lastSyncAt = 0;
let currentState = { eligible: false, reason: 'not_checked', capabilities: null };
let preparedPaymentObserver = null;
let observedCheckoutRoot = null;
let currentSurfaceKey = '';
let surfaceInFlight = false;
let surfaceRequestSeq = 0;
let originalPushState = null;
let originalReplaceState = null;

function isCheckoutRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname
    .replace(/^\/staging\/\d+(?=\/|$)/, '')
    .replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
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
    return url.searchParams.has(PAYMENT_SURFACE_QUERY);
  } catch {
    return href.includes(`${PAYMENT_SURFACE_QUERY}=`);
  }
}

function decodeDatasetJson(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function checkoutRootFromEvent(event) {
  const detailRoot = event?.detail?.rootSelector ? document.querySelector(event.detail.rootSelector) : null;
  if (detailRoot instanceof HTMLElement) return detailRoot;
  return document.querySelector(ROOT_SELECTOR);
}

function paymentStepFromRoot(root) {
  return root instanceof HTMLElement ? root.querySelector('#checkout-payment-step') : null;
}

function paymentActionFromRoot(root) {
  const paymentStep = paymentStepFromRoot(root);
  if (!(paymentStep instanceof HTMLElement)) return null;

  const contextualAction = paymentStep.querySelector('button[data-dtb-order-id][data-dtb-order-key], a[data-dtb-order-id][data-dtb-order-key]');
  if (contextualAction instanceof HTMLElement) return contextualAction;

  return Array.from(paymentStep.querySelectorAll('button, a')).find((node) => {
    const label = String(node.textContent || node.getAttribute('aria-label') || '').trim().toLowerCase();
    const href = node instanceof HTMLAnchorElement ? node.href : node.getAttribute('href');
    return label.includes('open protected payment')
      || label.includes('load secure payment')
      || label.includes('resume payment')
      || isLegacyOrderPayUrl(href)
      || isPaymentSurfaceUrl(href);
  }) || paymentStep;
}

function paymentActionFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  const action = target?.closest?.('button, a');
  if (!(action instanceof HTMLElement)) return null;
  const label = String(action.textContent || action.getAttribute('aria-label') || '').trim().toLowerCase();
  const href = action instanceof HTMLAnchorElement ? action.href : action.getAttribute('href');
  if (label.includes('open protected payment') || label.includes('load secure payment') || label.includes('resume payment')) return action;
  if (isLegacyOrderPayUrl(href) || isPaymentSurfaceUrl(href)) return action;
  return null;
}

function paymentContextFromDataset(root, action) {
  const paymentStep = paymentStepFromRoot(root);
  const source = action instanceof HTMLElement ? action : paymentStep;
  const billingAddress = decodeDatasetJson(paymentStep?.dataset?.dtbBillingAddress || '') || {};
  const shippingAddress = decodeDatasetJson(paymentStep?.dataset?.dtbShippingAddress || '') || billingAddress;

  return {
    orderId: Number(source?.dataset?.dtbOrderId || paymentStep?.dataset?.dtbOrderId || 0),
    orderKey: String(source?.dataset?.dtbOrderKey || paymentStep?.dataset?.dtbOrderKey || ''),
    paymentUrl: String(source?.dataset?.dtbPaymentUrl || paymentStep?.dataset?.dtbPaymentUrl || ''),
    paymentMethod: String(source?.dataset?.dtbPaymentMethod || paymentStep?.dataset?.dtbPaymentMethod || ''),
    billingEmail: String(source?.dataset?.dtbBillingEmail || paymentStep?.dataset?.dtbBillingEmail || ''),
    billingAddress,
    shippingAddress,
  };
}

function paymentContextFromDetail(detail = {}) {
  const orderId = Number(detail.orderId || detail.order_id || 0);
  const orderKey = String(detail.orderKey || detail.order_key || '');
  if (!orderId || !orderKey) return null;
  return {
    orderId,
    orderKey,
    paymentUrl: String(detail.paymentUrl || detail.payment_url || ''),
    paymentMethod: String(detail.paymentMethod || detail.payment_method || ''),
    billingEmail: String(detail.billingEmail || detail.billing_email || ''),
    billingAddress: detail.billingAddress && typeof detail.billingAddress === 'object' ? detail.billingAddress : {},
    shippingAddress: detail.shippingAddress && typeof detail.shippingAddress === 'object' ? detail.shippingAddress : {},
  };
}

function evaluate(capabilities) {
  const architecture = capabilities?.payment_architecture || {};
  if (String(architecture.contract_version || '') !== '4') {
    return { eligible: false, reason: 'contract_version_mismatch' };
  }
  if (architecture.payment_surface_supported !== true) {
    return { eligible: false, reason: 'native_payment_surface_unavailable' };
  }
  if (architecture.same_shell_supported !== true) {
    return { eligible: false, reason: 'provider_blocks_not_ready' };
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

function ensureStatusPanel(root) {
  const paymentStep = paymentStepFromRoot(root);
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
  title.textContent = status === 'error' ? 'Secure Stripe payment unavailable' : 'Secure Stripe payment';
  const copy = document.createElement('p');
  copy.textContent = message;
  panel.append(title, copy);
}

function ensureFrame(root) {
  const paymentStep = paymentStepFromRoot(root);
  if (!(paymentStep instanceof HTMLElement)) return null;
  let frame = paymentStep.querySelector(`iframe.${SURFACE_CLASS}`);
  if (!(frame instanceof HTMLIFrameElement)) {
    frame = document.createElement('iframe');
    frame.className = SURFACE_CLASS;
    frame.title = 'Secure Stripe checkout';
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

async function mountPaymentSurface(root, rawContext, { force = false } = {}) {
  if (!(root instanceof HTMLElement) || !document.contains(root)) return;
  if (surfaceInFlight && !force) return;

  const context = rawContext || paymentContextFromDataset(root, paymentActionFromRoot(root));
  if (!context?.orderId || !context?.orderKey) return;

  const key = `${context.orderId}:${context.orderKey}`;
  if (!force && key === currentSurfaceKey) return;

  const requestId = ++surfaceRequestSeq;
  surfaceInFlight = true;
  renderStatus(root, 'loading', 'Loading the provider-owned Stripe payment surface…');

  try {
    const state = await syncState(root, true);
    if (requestId !== surfaceRequestSeq || !document.contains(root)) return;
    if (!state.eligible) {
      renderStatus(root, 'error', `Stripe payment is not ready in WooCommerce Blocks (${normalizeId(state.reason)}).`);
      return;
    }

    const url = await resolveSurfaceUrl(context);
    if (requestId !== surfaceRequestSeq || !document.contains(root)) return;
    if (!url) throw new Error('The Stripe payment surface URL could not be created.');

    const frame = ensureFrame(root);
    if (!frame) throw new Error('The Stripe payment surface could not be mounted.');

    frame.dataset.dtbOrderId = String(context.orderId);
    if (frame.src !== url) frame.src = url;
    currentSurfaceKey = key;
    renderStatus(root, 'loading', 'Stripe is loading securely inside checkout…');
    window.dispatchEvent(new CustomEvent('dtb:checkout-payment-surface-mounted', { detail: { orderId: context.orderId } }));
  } catch (error) {
    if (requestId === surfaceRequestSeq && document.contains(root)) {
      renderStatus(root, 'error', error?.message || 'The secure Stripe payment surface could not be loaded.');
    }
  } finally {
    if (requestId === surfaceRequestSeq) surfaceInFlight = false;
  }
}

function handlePaymentRequest(event) {
  if (!isCheckoutRoute()) return;
  const root = checkoutRootFromEvent(event);
  if (!(root instanceof HTMLElement)) return;
  const context = paymentContextFromDetail(event.detail) || paymentContextFromDataset(root, paymentActionFromRoot(root));
  void mountPaymentSurface(root, context, { force: true });
}

function handlePaymentClick(event) {
  if (!isCheckoutRoute()) return;
  const action = paymentActionFromEvent(event);
  if (!action) return;
  const root = document.querySelector(ROOT_SELECTOR);
  if (!(root instanceof HTMLElement)) return;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

  void mountPaymentSurface(root, paymentContextFromDataset(root, action), { force: true });
}

function handleSurfaceMessage(event) {
  if (event.origin !== window.location.origin) return;
  const root = document.querySelector(ROOT_SELECTOR);
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
    renderStatus(root, 'ready', 'Stripe is available in the secure checkout payment surface.');
  }
  if (detail.type === 'dtb:payment-surface:error') {
    renderStatus(root, 'error', String(detail.message || 'Stripe reported a recoverable payment error.'));
  }
  if (detail.type === 'dtb:payment-surface:success') {
    renderStatus(root, 'ready', 'Payment was completed securely. You can now view the order status.');
    window.dispatchEvent(new CustomEvent('dtb:checkout-payment-surface-complete', { detail: { orderId: detail.orderId } }));
  }
}

function resetObserver() {
  if (preparedPaymentObserver) preparedPaymentObserver.disconnect();
  preparedPaymentObserver = null;
  observedCheckoutRoot = null;
}

function observePreparedPayment() {
  if (typeof MutationObserver === 'undefined') return;
  const root = document.querySelector(ROOT_SELECTOR);
  if (!isCheckoutRoute() || !(root instanceof HTMLElement)) {
    resetObserver();
    return;
  }
  if (preparedPaymentObserver && observedCheckoutRoot === root) return;

  resetObserver();
  observedCheckoutRoot = root;

  const syncPreparedPayment = () => {
    if (observedCheckoutRoot !== root || !document.contains(root)) return;
    const context = paymentContextFromDataset(root, paymentActionFromRoot(root));
    if (!context.orderId || !context.orderKey) return;
    void mountPaymentSurface(root, context);
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
      'data-dtb-billing-address',
      'data-dtb-shipping-address',
    ],
  });
  syncPreparedPayment();
}

function scheduleSync() {
  if (!isCheckoutRoute()) {
    resetObserver();
    return;
  }
  const root = document.querySelector(ROOT_SELECTOR);
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

  patchNavigationEvents();
  document.addEventListener('click', handlePaymentClick, true);
  window.addEventListener('message', handleSurfaceMessage);
  window.addEventListener('dtb:checkout-same-shell-payment-requested', handlePaymentRequest);
  window.addEventListener('dtb:checkout-payment-method-selected', scheduleSync);
  window.addEventListener('popstate', () => window.setTimeout(scheduleSync, 0));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  } else {
    scheduleSync();
  }
}
