/**
 * frontend/src/features/checkout/wooPaymentsSameShellProvider.js
 *
 * WooPayments same-shell provider adapter for DTB checkout. This module does not
 * render raw card fields, wallet sheets, or provider iframes. It only consumes
 * provider-owned payment data already exposed by WooCommerce Blocks' payment
 * store and submits it against the DTB-created WooCommerce pending order through
 * the existing same-shell processPayment callback.
 */

const WOOPAYMENTS_GATEWAY_IDS = new Set(['woocommerce_payments', 'woopayments']);
const WOOPAYMENTS_COMPATIBLE_GATEWAY_IDS = new Set(['woocommerce_payments', 'woopayments', 'stripe']);
const WALLET_METHODS = new Set(['apple-pay', 'google-pay']);

let installed = false;

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function checkoutBlocksPaymentStore() {
  const wpData = window.wp?.data;
  const paymentStore = window.wc?.wcBlocksData?.paymentStore;
  if (!wpData || !paymentStore || typeof wpData.select !== 'function') return null;
  try {
    return wpData.select(paymentStore);
  } catch {
    return null;
  }
}

function paymentStoreSnapshot() {
  const store = checkoutBlocksPaymentStore();
  if (!store) {
    throw Object.assign(new Error('WooCommerce Blocks payment store is not available on this checkout page.'), {
      code: 'dtb_woopayments_store_missing',
    });
  }

  const state = typeof store.getState === 'function' ? store.getState() : {};
  const activePaymentMethod = normalizeId(
    typeof store.getActivePaymentMethod === 'function'
      ? store.getActivePaymentMethod()
      : state.activePaymentMethod,
  );
  const paymentMethodData = typeof store.getPaymentMethodData === 'function'
    ? store.getPaymentMethodData()
    : state.paymentMethodData || {};
  const availablePaymentMethods = typeof store.getAvailablePaymentMethods === 'function'
    ? store.getAvailablePaymentMethods()
    : state.availablePaymentMethods || {};
  const availableExpressPaymentMethods = typeof store.getAvailableExpressPaymentMethods === 'function'
    ? store.getAvailableExpressPaymentMethods()
    : state.availableExpressPaymentMethods || {};
  const paymentMethodsInitialized = typeof store.paymentMethodsInitialized === 'function'
    ? store.paymentMethodsInitialized()
    : state.paymentMethodsInitialized === true;
  const expressPaymentMethodsInitialized = typeof store.expressPaymentMethodsInitialized === 'function'
    ? store.expressPaymentMethodsInitialized()
    : state.expressPaymentMethodsInitialized === true;

  return {
    activePaymentMethod,
    paymentMethodData,
    availablePaymentMethods,
    availableExpressPaymentMethods,
    paymentMethodsInitialized,
    expressPaymentMethodsInitialized,
  };
}

function activeGatewayFromCapabilities(methods = []) {
  const normalized = (Array.isArray(methods) ? methods : [])
    .map((method) => normalizeId(method?.id || method?.name))
    .filter(Boolean);

  return normalized.find((id) => id === 'woocommerce_payments')
    || normalized.find((id) => id === 'woopayments')
    || normalized.find((id) => id === 'stripe')
    || '';
}

function availableGateway(snapshot, preferredGateway) {
  const available = Object.keys(snapshot.availablePaymentMethods || {}).map(normalizeId);
  if (preferredGateway && available.includes(preferredGateway)) return preferredGateway;
  return available.find((id) => WOOPAYMENTS_GATEWAY_IDS.has(id))
    || available.find((id) => WOOPAYMENTS_COMPATIBLE_GATEWAY_IDS.has(id))
    || preferredGateway
    || snapshot.activePaymentMethod
    || '';
}

function normalizePaymentData(paymentMethodData = {}) {
  if (Array.isArray(paymentMethodData)) return paymentMethodData;
  if (!paymentMethodData || typeof paymentMethodData !== 'object') return [];
  return Object.entries(paymentMethodData)
    .filter(([key]) => key)
    .map(([key, value]) => ({ key, value }));
}

function hasProviderTokenData(paymentData = []) {
  return paymentData.some(({ key, value }) => {
    const normalizedKey = normalizeId(key);
    if (!normalizedKey) return false;
    if (value === null || typeof value === 'undefined' || value === '') return false;
    return normalizedKey.includes('payment')
      || normalizedKey.includes('token')
      || normalizedKey.includes('source')
      || normalizedKey.includes('wcpay')
      || normalizedKey.includes('stripe');
  });
}

function assertWalletReadiness(visualMethod, snapshot) {
  if (!WALLET_METHODS.has(normalizeId(visualMethod))) return;
  if (!snapshot.expressPaymentMethodsInitialized) {
    throw Object.assign(new Error('WooPayments wallet methods are not initialized yet.'), {
      code: 'dtb_woopayments_wallets_not_ready',
    });
  }
  if (!Object.keys(snapshot.availableExpressPaymentMethods || {}).length) {
    throw Object.assign(new Error('WooPayments did not expose an eligible wallet method for this browser/device.'), {
      code: 'dtb_woopayments_wallet_unavailable',
    });
  }
}

function sameShellReady() {
  const registry = window.wc?.wcBlocksRegistry;
  if (!registry || typeof registry.registerPaymentMethod !== 'function') return false;
  if (!registry || typeof registry.registerExpressPaymentMethod !== 'function') return false;
  return Boolean(checkoutBlocksPaymentStore());
}

async function startPayment({ methods = [], order = {}, visualMethod = 'card', processPayment } = {}) {
  if (typeof processPayment !== 'function') {
    throw Object.assign(new Error('DTB same-shell payment processor is unavailable.'), {
      code: 'dtb_same_shell_processor_missing',
    });
  }

  const snapshot = paymentStoreSnapshot();
  if (!snapshot.paymentMethodsInitialized) {
    throw Object.assign(new Error('WooPayments payment methods are not initialized yet.'), {
      code: 'dtb_woopayments_methods_not_ready',
    });
  }

  assertWalletReadiness(visualMethod, snapshot);

  const preferredGateway = normalizeId(order.paymentMethod) || activeGatewayFromCapabilities(methods);
  const paymentMethod = availableGateway(snapshot, preferredGateway);
  if (!WOOPAYMENTS_COMPATIBLE_GATEWAY_IDS.has(paymentMethod)) {
    throw Object.assign(new Error(`WooPayments-compatible gateway is not active for same-shell checkout (${paymentMethod || 'none'}).`), {
      code: 'dtb_woopayments_gateway_unavailable',
    });
  }

  const paymentData = normalizePaymentData(snapshot.paymentMethodData);
  if (!paymentData.length || !hasProviderTokenData(paymentData)) {
    throw Object.assign(new Error('Provider-owned WooPayments controls have not produced payment data yet. Do not submit raw card fields from DTB React.'), {
      code: 'dtb_woopayments_payment_data_missing',
    });
  }

  return processPayment({
    paymentMethod,
    paymentData,
    billingEmail: order.billingEmail || order.billing_email || '',
    billingAddress: order.billingAddress || {},
    shippingAddress: order.shippingAddress || order.billingAddress || {},
    extensions: {},
    customerNote: '',
  });
}

export function installWooPaymentsSameShellProvider() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.dtbCheckoutSameShellProvider = {
    id: 'woocommerce_payments',
    gatewayIds: Array.from(WOOPAYMENTS_GATEWAY_IDS),
    sameShellReady,
    startPayment,
  };

  window.dispatchEvent(new CustomEvent('dtb:checkout-same-shell-provider-installed', {
    detail: { provider: 'woocommerce_payments' },
  }));
}
