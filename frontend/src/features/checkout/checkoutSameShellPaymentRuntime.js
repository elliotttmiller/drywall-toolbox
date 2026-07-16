/**
 * frontend/src/features/checkout/checkoutSameShellPaymentRuntime.js
 *
 * Runtime adapter gate for future provider-owned same-shell payment execution.
 * This module never renders card fields and never processes payment. It only
 * prevents the legacy order-pay navigation when a verified provider-owned
 * adapter is present and the backend capability envelope says same-shell payment
 * is enabled for the active gateway stack.
 */

import { getCheckoutCapabilities } from '../../api/checkout.js';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout\/?$/;
const PROVIDER_GATEWAY_IDS = new Set([
  'woocommerce_payments',
  'woopayments',
  'stripe',
  'ppcp-gateway',
  'ppec_paypal',
  'paypal',
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
let bypassNextFallbackClick = false;
let paymentInFlight = false;

function isCheckoutRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
  return CHECKOUT_PATH_RE.test(path);
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
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
  if (architecture.contract_version !== '3') return { eligible: false, reason: 'contract_version_mismatch', methods };
  if (architecture.same_shell_supported !== true) return { eligible: false, reason: 'same_shell_not_enabled', methods };
  if (architecture.client_bridge_enabled !== true) return { eligible: false, reason: 'client_bridge_disabled', methods };
  if (architecture.server_blocks_ready !== true) return { eligible: false, reason: 'server_blocks_unavailable', methods };
  if (architecture.server_same_shell_ready !== true) return { eligible: false, reason: 'server_same_shell_unavailable', methods };
  if (!registryReady()) return { eligible: false, reason: 'client_blocks_registry_unavailable', methods };
  if (!methods.length) return { eligible: false, reason: 'provider_blocks_method_unavailable', methods };
  if (!providerAdapter()) return { eligible: false, reason: 'provider_adapter_unavailable', methods };
  return { eligible: true, reason: 'provider_adapter_ready', methods };
}

function applyState(root) {
  if (!(root instanceof HTMLElement)) return;
  root.dataset.dtbSameShellPayment = currentState.eligible ? 'ready' : 'fallback';
  root.dataset.dtbSameShellReason = currentState.reason;
  root.classList.toggle('dtb-checkout--same-shell-ready', currentState.eligible);
  root.classList.toggle('dtb-checkout--same-shell-fallback', !currentState.eligible);
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
  if (!label.includes('open protected payment')) return null;
  return action;
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

function renderStatus(root, status, message, fallbackAction) {
  const panel = ensureStatusPanel(root);
  if (!panel) return;
  panel.dataset.status = status;
  panel.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = status === 'error' ? 'Same-page payment unavailable' : 'Secure same-page payment';
  const copy = document.createElement('p');
  copy.textContent = message;
  panel.append(title, copy);

  if (typeof fallbackAction === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dtb-same-shell-payment-status__fallback';
    button.textContent = 'Open protected fallback payment';
    button.addEventListener('click', fallbackAction);
    panel.appendChild(button);
  }
}

function openFallback(action) {
  if (!(action instanceof HTMLElement)) return;
  bypassNextFallbackClick = true;
  action.click();
  window.setTimeout(() => {
    bypassNextFallbackClick = false;
  }, 0);
}

async function startSameShellPayment(root, action) {
  if (paymentInFlight) return;
  const adapter = providerAdapter();
  if (!adapter) {
    renderStatus(
      root,
      'error',
      'The provider-owned same-page payment adapter is not available. Use the protected fallback payment route.',
      () => openFallback(action),
    );
    return;
  }

  paymentInFlight = true;
  renderStatus(root, 'loading', 'Opening the provider-owned WooPayments controls inside checkout…');
  try {
    await adapter.startPayment({
      root,
      capabilities: currentState.capabilities,
      methods: currentState.methods,
      visualMethod: root.dataset.dtbVisualPaymentMethod || 'card',
    });
    renderStatus(root, 'ready', 'Provider-owned payment controls are active in this checkout step.');
    window.dispatchEvent(new CustomEvent('dtb:checkout-same-shell-payment-started', {
      detail: {
        methods: currentState.methods.map((method) => normalizeId(method?.id)).filter(Boolean),
      },
    }));
  } catch (error) {
    renderStatus(
      root,
      'error',
      error?.message || 'Provider-owned same-page payment could not start. Use the protected fallback payment route.',
      () => openFallback(action),
    );
  } finally {
    paymentInFlight = false;
  }
}

function handlePaymentClick(event) {
  if (!isCheckoutRoute()) return;
  if (bypassNextFallbackClick) return;
  const action = paymentActionFromEvent(event);
  if (!action) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;

  applyState(root);
  if (!currentState.eligible) return;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  void startSameShellPayment(root, action);
}

function scheduleSync() {
  if (!isCheckoutRoute()) return;
  const root = document.querySelector('.dtb-checkout');
  if (!(root instanceof HTMLElement)) return;
  void syncState(root);
}

export function installCheckoutSameShellPaymentRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('click', handlePaymentClick, true);
  window.addEventListener('dtb:checkout-payment-method-selected', () => {
    const root = document.querySelector('.dtb-checkout');
    if (root instanceof HTMLElement) void syncState(root, true);
  });
  window.addEventListener('popstate', () => window.setTimeout(scheduleSync, 0));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  } else {
    scheduleSync();
  }
}
