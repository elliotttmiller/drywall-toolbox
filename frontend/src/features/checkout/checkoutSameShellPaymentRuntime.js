/**
 * frontend/src/features/checkout/checkoutSameShellPaymentRuntime.js
 *
 * Runtime adapter gate for provider-owned same-shell payment execution.
 * This module never renders card fields and never processes payment directly.
 * It blocks legacy order-pay navigation and starts payment only when an eligible
 * provider-owned same-shell adapter is present, ready, and synchronized.
 */

import { getCheckoutCapabilities, processExistingOrderPayment } from '../../api/checkout.js';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout\/?$/;
const LEGACY_ORDER_PAY_RE = /(?:^|\/)checkout\/order-pay\//;
const PROVIDER_GATEWAY_IDS = new Set([
  'woocommerce_payments',
  'woopayments',
  'stripe',
]);
const SYNC_INTERVAL_MS = 30000;

let installed = false;
let syncPromise = null;
let lastSyncAt = 0;
let currentState = {
  eligible: false,
  reason: 'not_checked',
  capabilities: null,
  methods: [],
};
let paymentInFlight = false;
let lastAutoStartKey = '';
let originalSetTimeout = null;
let preparedPaymentObserver = null;

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
    return url.origin === window.location.origin
      && LEGACY_ORDER_PAY_RE.test(url.pathname);
  } catch {
    return LEGACY_ORDER_PAY_RE.test(href);
  }
}

function registryReady() {
  const registry = window.wc?.wcBlocksRegistry;
  return Boolean(
    registry
    && typeof registry.registerPaymentMethod === 'function'
    && typeof registry.registerExpressPaymentMethod === 'function',
  );
}

function providerAdapter() {
  const adapter = window.dtbCheckoutSameShellProvider;
  if (!adapter || typeof adapter !== 'object') return null;
  return typeof adapter.startPayment === 'function' ? adapter : null;
}

function providerAdapterReady(adapter) {
  if (!adapter) return false;
  if (typeof adapter.sameShellReady !== 'function') return true;
  try {
    return adapter.sameShellReady() === true;
  } catch {
    return false;
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
  const fallbackUrl = String(source?.dataset?.dtbPaymentUrl || paymentStep?.dataset?.dtbPaymentUrl || '');
  const paymentMethod = String(source?.dataset?.dtbPaymentMethod || paymentStep?.dataset?.dtbPaymentMethod || '');
  const billingAddress = decodeDatasetJson(paymentStep?.dataset?.dtbBillingAddress || '') || {};
  const shippingAddress = decodeDatasetJson(paymentStep?.dataset?.dtbShippingAddress || '') || billingAddress;
  return {
    orderId,
    orderKey,
    billingEmail,
    fallbackUrl,
    paymentMethod,
    billingAddress,
    shippingAddress,
  };
}

function paymentResultRedirectUrl(result) {
  return String(
    result?.payment_result?.redirect_url
    || result?.payment_result?.redirectUrl
    || result?.redirect_url
    || result?.redirectUrl
    || '',
  );
}

function paymentResultSuccess(result) {
  const status = String(result?.payment_result?.payment_status || result?.payment_status || '').toLowerCase();
  return result?.payment_result?.payment_status === 'success'
    || result?.payment_result?.status === 'success'
    || result?.status === 'success'
    || ['success', 'completed', 'processing'].includes(status);
}

function activeProviderMethods(capabilities) {
  const architecture = capabilities?.payment_architecture || {};
  const methods = Array.isArray(architecture.methods) ? architecture.methods : [];
  return methods.filter((method) => {
    const id = normalizeId(method?.id);
    if (!PROVIDER_GATEWAY_IDS.has(id)) return false;
    if (method?.is_manual === true) return false;
    return method?.blocks_registered === true && method?.blocks_active === true;
  });
}

function evaluate(capabilities) {
  const architecture = capabilities?.payment_architecture || {};
  const methods = activeProviderMethods(capabilities);
  const adapter = providerAdapter();
  if (architecture.contract_version !== '3') return { eligible: false, reason: 'contract_version_mismatch', methods };
  if (architecture.same_shell_supported !== true) return { eligible: false, reason: 'same_shell_not_enabled', methods };
  if (architecture.client_bridge_enabled !== true) return { eligible: false, reason: 'client_bridge_disabled', methods };
  if (architecture.server_blocks_ready !== true) return { eligible: false, reason: 'server_blocks_unavailable', methods };
  if (architecture.server_same_shell_ready !== true) return { eligible: false, reason: 'server_same_shell_unavailable', methods };
  if (!registryReady()) return { eligible: false, reason: 'client_blocks_registry_unavailable', methods };
  if (!methods.length) return { eligible: false, reason: 'provider_blocks_method_unavailable', methods };
  if (!adapter) return { eligible: false, reason: 'provider_adapter_unavailable', methods };
  if (!providerAdapterReady(adapter)) return { eligible: false, reason: 'provider_adapter_not_ready', methods };
  return { eligible: true, reason: 'provider_adapter_ready', methods };
}

function applyState(root) {
  if (!(root instanceof HTMLElement)) return;
  root.dataset.dtbSameShellPayment = currentState.eligible ? 'ready' : 'blocked';
  root.dataset.dtbSameShellReason = currentState.reason;
  root.classList.toggle('dtb-checkout--same-shell-ready', currentState.eligible);
  root.classList.toggle('dtb-checkout--same-shell-fallback', false);
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
      const result = evaluate(capabilities);
      currentState = {
        ...result,
        capabilities,
      };
      lastSyncAt = Date.now();
      applyState(root);
      return currentState;
    })
    .catch(() => {
      currentState = {
        eligible: false,
        reason: 'capability_fetch_failed',
        capabilities: null,
        methods: [],
      };
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
  if (isLegacyOrderPayUrl(href)) return action;
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
    return label.includes('open protected payment') || isLegacyOrderPayUrl(href);
  });
  return openPaymentAction instanceof HTMLElement ? openPaymentAction : paymentStep;
}

function ensureStatusPanel(root) {
  const paymentStep = root.querySelector('#checkout-payment-step');
  if (!(paymentStep instanceof HTMLElement)) return null;
  let panel = paymentStep.querySelector('.dtb-same-shell-payment-status');
  if (!(panel instanceof HTMLElement)) {
    panel = document.createElement('div');
    panel.className = 'dtb-same-shell-payment-status';
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

function sameShellBlockedMessage(reason) {
  const normalized = normalizeId(reason);
  const reasonLabel = normalized ? ` (${normalized})` : '';
  return `Same-page WooPayments checkout is not active${reasonLabel}. Payment redirects are disabled in this checkout shell until the provider-owned same-shell adapter is available and synchronized.`;
}

async function startSameShellPayment(root, action) {
  if (paymentInFlight) return;
  const adapter = providerAdapter();
  if (!adapter) {
    renderStatus(root, 'error', sameShellBlockedMessage('provider_adapter_unavailable'));
    return;
  }

  const context = paymentContext(root, action);
  if (!context.orderId || !context.orderKey) {
    renderStatus(root, 'error', 'The prepared WooCommerce order is missing the payment context required for in-checkout payment. No payment redirect was opened.');
    return;
  }

  paymentInFlight = true;
  renderStatus(root, 'loading', 'Synchronizing WooPayments-owned payment data inside checkout…');
  try {
    const result = await adapter.startPayment({
      root,
      capabilities: currentState.capabilities,
      methods: currentState.methods,
      order: context,
      visualMethod: root.dataset.dtbVisualPaymentMethod || 'card',
      processPayment: (request = {}) => processExistingOrderPayment({
        orderId: context.orderId,
        orderKey: context.orderKey,
        billingEmail: request.billingEmail || context.billingEmail,
        billingAddress: request.billingAddress || context.billingAddress,
        shippingAddress: request.shippingAddress || context.shippingAddress,
        paymentMethod: request.paymentMethod || context.paymentMethod,
        paymentData: request.paymentData || [],
        extensions: request.extensions || {},
        customerNote: request.customerNote || '',
      }),
    });

    const processed = result?.paymentData || result?.payment_data || result?.paymentMethod || result?.payment_method
      ? await processExistingOrderPayment({
        orderId: context.orderId,
        orderKey: context.orderKey,
        billingEmail: result.billingEmail || context.billingEmail,
        billingAddress: result.billingAddress || context.billingAddress,
        shippingAddress: result.shippingAddress || context.shippingAddress,
        paymentMethod: result.paymentMethod || result.payment_method || context.paymentMethod,
        paymentData: result.paymentData || result.payment_data || [],
        extensions: result.extensions || {},
        customerNote: result.customerNote || '',
      })
      : result;

    const redirectUrl = paymentResultRedirectUrl(processed);
    if (redirectUrl) {
      renderStatus(root, 'error', 'The payment provider returned a redirect requirement. This checkout shell will not leave the page automatically; complete same-shell provider handling before enabling this flow.');
      return;
    }

    if (processed && !paymentResultSuccess(processed) && processed.requires_action !== true && processed.completed !== true) {
      throw new Error(processed?.message || processed?.payment_result?.message || 'Provider-owned payment did not complete.');
    }

    renderStatus(root, 'ready', 'WooPayments-owned payment data was accepted for this checkout order.');
    window.dispatchEvent(new CustomEvent('dtb:checkout-same-shell-payment-started', {
      detail: {
        methods: currentState.methods.map((method) => normalizeId(method?.id)).filter(Boolean),
        orderId: context.orderId,
      },
    }));
  } catch (error) {
    renderStatus(root, 'error', error?.message || 'Provider-owned in-checkout payment could not start. No payment redirect was opened.');
  } finally {
    paymentInFlight = false;
  }
}

async function requestSameShellPayment(root, action, { force = false } = {}) {
  if (!(root instanceof HTMLElement)) return;
  const paymentAction = action instanceof HTMLElement ? action : paymentActionFromRoot(root);
  const context = paymentContext(root, paymentAction);
  if (!context.orderId || !context.orderKey) return;

  const key = `${context.orderId}:${context.orderKey}`;
  if (!force && key === lastAutoStartKey) return;

  const state = await syncState(root, true);
  if (!state.eligible) {
    renderStatus(root, 'error', sameShellBlockedMessage(state.reason));
    window.dispatchEvent(new CustomEvent('dtb:checkout-same-shell-payment-blocked', {
      detail: { reason: state.reason, orderId: context.orderId },
    }));
    return;
  }

  lastAutoStartKey = key;
  void startSameShellPayment(root, paymentAction);
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

  void requestSameShellPayment(root, action, { force: true });
}

function handleSameShellPaymentRequest(event) {
  if (!isCheckoutRoute()) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;
  void requestSameShellPayment(root, paymentActionFromRoot(root), { force: event?.detail?.force === true });
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
    renderStatus(root, 'loading', 'Keeping payment inside checkout. Opening the same-shell WooPayments provider…');
    void requestSameShellPayment(root, paymentActionFromRoot(root), { force: true });
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

function observePreparedPayment() {
  if (preparedPaymentObserver || typeof MutationObserver === 'undefined') return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;

  const syncPreparedPayment = () => {
    const action = paymentActionFromRoot(root);
    const context = paymentContext(root, action);
    if (!context.orderId || !context.orderKey) return;
    void requestSameShellPayment(root, action);
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
  if (!isCheckoutRoute()) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;
  void syncState(root);
}

function schedulePreparedPaymentSync() {
  if (!isCheckoutRoute()) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;
  void syncState(root, true).finally(() => {
    void requestSameShellPayment(root, paymentActionFromRoot(root));
  });
}

export function installCheckoutSameShellPaymentRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  patchLegacyOrderPayTimeout();
  document.addEventListener('click', handlePaymentClick, true);
  window.addEventListener('dtb:checkout-same-shell-payment-requested', handleSameShellPaymentRequest);
  window.addEventListener('dtb:checkout-payment-method-selected', () => {
    const root = document.querySelector('.dtb-checkout');
    if (root instanceof HTMLElement) void syncState(root, true);
  });
  window.addEventListener('dtb:checkout-same-shell-provider-installed', schedulePreparedPaymentSync);
  window.addEventListener('dtb:checkout-woopayments-provider-sync', schedulePreparedPaymentSync);
  window.addEventListener('popstate', () => window.setTimeout(scheduleSync, 0));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleSync();
      observePreparedPayment();
    }, { once: true });
  } else {
    scheduleSync();
    observePreparedPayment();
  }
}
