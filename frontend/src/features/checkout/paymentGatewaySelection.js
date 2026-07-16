/**
 * frontend/src/features/checkout/paymentGatewaySelection.js
 *
 * Client-side payment preference resolver for the DTB checkout shell. This module
 * maps customer-facing payment choices to available WooCommerce gateway IDs before
 * the checkout session is created. It does not process payments, create orders, or
 * render provider controls; WooCommerce and the selected gateway remain authoritative.
 */

const STORAGE_KEY = 'dtb_checkout_visual_payment_method_v1';
const DEFAULT_VISUAL_METHOD = 'card';

const VISUAL_METHODS = new Set(['card', 'paypal', 'apple-pay', 'google-pay']);

const GATEWAY_PRIORITY = Object.freeze({
  card: ['woocommerce_payments', 'stripe', 'woo_native'],
  paypal: ['ppcp-gateway', 'paypal'],
  'apple-pay': ['woocommerce_payments', 'stripe'],
  'google-pay': ['woocommerce_payments', 'stripe'],
});

const WALLET_ALIASES = Object.freeze({
  'apple-pay': ['apple-pay', 'apple_pay', 'applepay', 'apple'],
  'google-pay': ['google-pay', 'google_pay', 'googlepay', 'google'],
});

let cachedCapabilities = null;
let selectedVisualMethod = '';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function readStoredVisualMethod() {
  if (!isBrowser()) return DEFAULT_VISUAL_METHOD;
  try {
    const stored = normalizeId(window.sessionStorage?.getItem(STORAGE_KEY));
    return VISUAL_METHODS.has(stored) ? stored : DEFAULT_VISUAL_METHOD;
  } catch {
    return DEFAULT_VISUAL_METHOD;
  }
}

function writeStoredVisualMethod(visualMethod) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage?.setItem(STORAGE_KEY, visualMethod);
  } catch {
    // Preference storage is non-critical; the in-memory value remains authoritative for this page session.
  }
}

function availableMethodsFromCapabilities(capabilities) {
  const gateways = Array.isArray(capabilities?.gateways) ? capabilities.gateways : [];
  const nativeGateway = gateways.find((gateway) => normalizeId(gateway?.id) === 'woo_native') || null;
  const methods = Array.isArray(nativeGateway?.payment_methods)
    ? nativeGateway.payment_methods
    : gateways.filter((gateway) => gateway?.id && normalizeId(gateway.id) !== 'woo_native');

  return methods
    .filter((method) => method && method.enabled !== false && method.id)
    .map((method) => ({ ...method, id: normalizeId(method.id) }));
}

function valueList(value) {
  if (Array.isArray(value)) return value.map(normalizeId).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => enabled === true || enabled === 'yes' || enabled === '1' || enabled === 1)
      .map(([key]) => normalizeId(key));
  }
  if (typeof value === 'string') return value.split(/[\s,|]+/).map(normalizeId).filter(Boolean);
  return [];
}

function methodHasWalletCapability(method, visualMethod) {
  if (visualMethod !== 'apple-pay' && visualMethod !== 'google-pay') return true;

  const aliases = WALLET_ALIASES[visualMethod] || [];
  const supports = [
    ...valueList(method.wallets),
    ...valueList(method.supports_wallets),
    ...valueList(method.supported_wallets),
    ...valueList(method.express_wallets),
    ...valueList(method.express_payment_methods),
  ];

  const explicitSupport = aliases.some((alias) => supports.includes(alias));
  if (explicitSupport) return true;

  const id = normalizeId(method.id);
  // WooPayments/Stripe own wallet eligibility checks. Selecting these gateways is
  // safe because actual Apple Pay / Google Pay availability is still provider-owned.
  return id === 'woocommerce_payments' || id === 'stripe';
}

export function rememberCheckoutCapabilities(capabilities) {
  cachedCapabilities = capabilities || null;
}

export function setCheckoutPaymentPreference(visualMethod) {
  const normalized = normalizeId(visualMethod);
  if (!VISUAL_METHODS.has(normalized)) return getCheckoutPaymentPreference();
  selectedVisualMethod = normalized;
  writeStoredVisualMethod(selectedVisualMethod);
  return selectedVisualMethod;
}

export function getCheckoutPaymentPreference() {
  if (!VISUAL_METHODS.has(selectedVisualMethod)) {
    selectedVisualMethod = readStoredVisualMethod();
  }
  return selectedVisualMethod;
}

export function resolveGatewayForVisualPaymentMethod(visualMethod, capabilities = cachedCapabilities, fallbackGateway = '') {
  const methodKey = VISUAL_METHODS.has(normalizeId(visualMethod)) ? normalizeId(visualMethod) : DEFAULT_VISUAL_METHOD;
  const methods = availableMethodsFromCapabilities(capabilities);
  const fallback = normalizeId(fallbackGateway);
  const priority = GATEWAY_PRIORITY[methodKey] || GATEWAY_PRIORITY.card;

  const preferred = priority
    .map((id) => methods.find((method) => method.id === id && methodHasWalletCapability(method, methodKey)))
    .find(Boolean);

  if (preferred) {
    return {
      visualMethod: methodKey,
      gatewayId: preferred.id,
      source: 'preferred_gateway',
    };
  }

  const fallbackMethod = fallback
    ? methods.find((method) => method.id === fallback)
    : null;

  if (fallbackMethod) {
    return {
      visualMethod: methodKey,
      gatewayId: fallbackMethod.id,
      source: 'fallback_current_gateway',
    };
  }

  const firstOnline = methods.find((method) => !['cod', 'bacs', 'cheque'].includes(method.id));
  return {
    visualMethod: methodKey,
    gatewayId: firstOnline?.id || fallback,
    source: firstOnline ? 'fallback_first_available' : 'unresolved',
  };
}

export function applyCheckoutPaymentPreference(payload = {}, capabilities = cachedCapabilities) {
  const visualMethod = getCheckoutPaymentPreference();
  const resolved = resolveGatewayForVisualPaymentMethod(visualMethod, capabilities, payload.payment_method);
  if (!resolved.gatewayId) return payload;

  return {
    ...payload,
    payment_method: resolved.gatewayId,
  };
}
