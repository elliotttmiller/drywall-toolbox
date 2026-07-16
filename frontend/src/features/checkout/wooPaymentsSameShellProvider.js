/**
 * frontend/src/features/checkout/wooPaymentsSameShellProvider.js
 *
 * WooPayments same-shell provider/data adapter for DTB checkout. This module does
 * not render raw card fields, wallet sheets, provider iframes, or payment
 * callbacks. It synchronizes the DTB-created pending order context with the
 * WooCommerce Blocks data stores when those official stores are present, reads
 * provider-owned payment data from WooCommerce Blocks, and submits only that
 * provider-owned payment data through the existing same-order Store API callback.
 */

const WOOPAYMENTS_GATEWAY_IDS = new Set(['woocommerce_payments', 'woopayments']);
const WOOPAYMENTS_COMPATIBLE_GATEWAY_IDS = new Set(['woocommerce_payments', 'woopayments', 'stripe']);
const WALLET_METHODS = new Set(['apple-pay', 'google-pay']);
const STORE_WAIT_TIMEOUT_MS = 6500;
const STORE_WAIT_INTERVAL_MS = 80;

let installed = false;
let unsubscribePaymentStore = null;
let lastSnapshotKey = '';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function keyedStore(key) {
  const wpData = window.wp?.data;
  const storeKey = window.wc?.wcBlocksData?.[key];
  if (!wpData || !storeKey || typeof wpData.select !== 'function') return null;
  try {
    return wpData.select(storeKey);
  } catch {
    return null;
  }
}

function keyedDispatch(key) {
  const wpData = window.wp?.data;
  const storeKey = window.wc?.wcBlocksData?.[key];
  if (!wpData || !storeKey || typeof wpData.dispatch !== 'function') return null;
  try {
    return wpData.dispatch(storeKey);
  } catch {
    return null;
  }
}

function checkoutBlocksPaymentStore() {
  return keyedStore('paymentStore');
}

function checkoutBlocksCheckoutStore() {
  return keyedStore('checkoutStore');
}

function checkoutBlocksCartStore() {
  return keyedStore('cartStore');
}

function safeCall(target, methodName, ...args) {
  if (!target || typeof target[methodName] !== 'function') return undefined;
  try {
    return target[methodName](...args);
  } catch {
    return undefined;
  }
}

function objectKeys(value) {
  return value && typeof value === 'object' ? Object.keys(value) : [];
}

function normalizeStoreAddress(address = {}) {
  return {
    first_name: address.first_name || address.firstName || '',
    last_name: address.last_name || address.lastName || '',
    company: address.company || '',
    address_1: address.address_1 || address.address || '',
    address_2: address.address_2 || '',
    city: address.city || '',
    state: address.state || '',
    postcode: address.postcode || address.zip || '',
    country: address.country || 'US',
    email: address.email || '',
    phone: address.phone || '',
  };
}

function paymentStoreSnapshot() {
  const store = checkoutBlocksPaymentStore();
  if (!store) {
    throw Object.assign(new Error('WooCommerce Blocks payment store is not available on this checkout page.'), {
      code: 'dtb_woopayments_store_missing',
    });
  }

  const state = safeCall(store, 'getState') || {};
  const activePaymentMethod = normalizeId(
    safeCall(store, 'getActivePaymentMethod')
      || state.activePaymentMethod
      || state.activePaymentMethodName,
  );
  const paymentMethodData = safeCall(store, 'getPaymentMethodData')
    || state.paymentMethodData
    || state.paymentData
    || {};
  const availablePaymentMethods = safeCall(store, 'getAvailablePaymentMethods')
    || state.availablePaymentMethods
    || state.paymentMethods
    || {};
  const availableExpressPaymentMethods = safeCall(store, 'getAvailableExpressPaymentMethods')
    || state.availableExpressPaymentMethods
    || state.expressPaymentMethods
    || {};
  const paymentMethodsInitialized = safeCall(store, 'paymentMethodsInitialized');
  const expressPaymentMethodsInitialized = safeCall(store, 'expressPaymentMethodsInitialized');
  const isPaymentReady = safeCall(store, 'isPaymentReady');
  const isProcessing = safeCall(store, 'isProcessing');
  const paymentStatus = safeCall(store, 'getPaymentStatus') || state.paymentStatus || '';

  return {
    activePaymentMethod,
    paymentMethodData,
    availablePaymentMethods,
    availableExpressPaymentMethods,
    paymentMethodsInitialized: paymentMethodsInitialized === undefined ? state.paymentMethodsInitialized === true : Boolean(paymentMethodsInitialized),
    expressPaymentMethodsInitialized: expressPaymentMethodsInitialized === undefined ? state.expressPaymentMethodsInitialized === true : Boolean(expressPaymentMethodsInitialized),
    isPaymentReady: isPaymentReady === undefined ? state.isPaymentReady === true : Boolean(isPaymentReady),
    isProcessing: isProcessing === undefined ? state.isProcessing === true : Boolean(isProcessing),
    paymentStatus,
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
  const available = objectKeys(snapshot.availablePaymentMethods).map(normalizeId);
  if (preferredGateway && available.includes(preferredGateway)) return preferredGateway;
  return available.find((id) => WOOPAYMENTS_GATEWAY_IDS.has(id))
    || available.find((id) => WOOPAYMENTS_COMPATIBLE_GATEWAY_IDS.has(id))
    || preferredGateway
    || snapshot.activePaymentMethod
    || '';
}

function paymentDataCandidateForGateway(paymentMethodData, gatewayId) {
  if (!paymentMethodData || typeof paymentMethodData !== 'object') return paymentMethodData;
  if (Array.isArray(paymentMethodData)) return paymentMethodData;

  const direct = paymentMethodData[gatewayId]
    || paymentMethodData[normalizeId(gatewayId)]
    || paymentMethodData.payment_data
    || paymentMethodData.paymentData
    || paymentMethodData.data;

  if (direct && typeof direct === 'object') return direct;
  return paymentMethodData;
}

function normalizePaymentData(paymentMethodData = {}, gatewayId = '') {
  const candidate = paymentDataCandidateForGateway(paymentMethodData, gatewayId);
  if (Array.isArray(candidate)) return candidate;
  if (!candidate || typeof candidate !== 'object') return [];
  return Object.entries(candidate)
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
      || normalizedKey.includes('intent')
      || normalizedKey.includes('nonce')
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
  if (!objectKeys(snapshot.availableExpressPaymentMethods).length) {
    throw Object.assign(new Error('WooPayments did not expose an eligible wallet method for this browser/device.'), {
      code: 'dtb_woopayments_wallet_unavailable',
    });
  }
}

function syncCheckoutAddresses(order = {}) {
  const checkoutDispatch = keyedDispatch('checkoutStore');
  const cartDispatch = keyedDispatch('cartStore');
  const billingAddress = normalizeStoreAddress(order.billingAddress || order.billing_address || {});
  const shippingAddress = normalizeStoreAddress(order.shippingAddress || order.shipping_address || billingAddress);

  // WooCommerce Blocks action names have changed across versions. Use feature
  // detection and no-op safely rather than assuming one exact public action.
  safeCall(checkoutDispatch, 'setBillingAddress', billingAddress);
  safeCall(checkoutDispatch, 'setShippingAddress', shippingAddress);
  safeCall(checkoutDispatch, 'setCustomerData', { billingAddress, shippingAddress });
  safeCall(cartDispatch, 'setBillingAddress', billingAddress);
  safeCall(cartDispatch, 'setShippingAddress', shippingAddress);

  return { billingAddress, shippingAddress };
}

function syncActivePaymentMethod(paymentMethod) {
  const paymentDispatch = keyedDispatch('paymentStore');
  if (!paymentDispatch || !paymentMethod) return;
  safeCall(paymentDispatch, 'setActivePaymentMethod', paymentMethod);
  safeCall(paymentDispatch, 'setPaymentMethod', paymentMethod);
}

function providerSnapshot() {
  const snapshot = paymentStoreSnapshot();
  const checkoutStore = checkoutBlocksCheckoutStore();
  const cartStore = checkoutBlocksCartStore();
  return {
    ...snapshot,
    checkoutStoreReady: Boolean(checkoutStore),
    cartStoreReady: Boolean(cartStore),
  };
}

function sameShellReady() {
  const registry = window.wc?.wcBlocksRegistry;
  if (!registry || typeof registry.registerPaymentMethod !== 'function') return false;
  if (!registry || typeof registry.registerExpressPaymentMethod !== 'function') return false;
  try {
    const snapshot = providerSnapshot();
    return Boolean(snapshot.paymentMethodsInitialized && objectKeys(snapshot.availablePaymentMethods).length);
  } catch {
    return false;
  }
}

function waitForProviderStore(timeoutMs = STORE_WAIT_TIMEOUT_MS) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (sameShellReady()) {
          resolve(providerSnapshot());
          return;
        }
      } catch {
        // Continue until timeout; the Blocks stores may appear after checkout assets hydrate.
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(Object.assign(new Error('WooPayments Blocks payment data did not initialize in time.'), {
          code: 'dtb_woopayments_provider_timeout',
        }));
        return;
      }
      window.setTimeout(tick, STORE_WAIT_INTERVAL_MS);
    };
    tick();
  });
}

function publishSnapshot(snapshot, extra = {}) {
  const key = JSON.stringify({
    activePaymentMethod: snapshot.activePaymentMethod,
    available: objectKeys(snapshot.availablePaymentMethods).sort(),
    express: objectKeys(snapshot.availableExpressPaymentMethods).sort(),
    ready: snapshot.isPaymentReady,
    status: snapshot.paymentStatus,
    ...extra,
  });
  if (key === lastSnapshotKey) return;
  lastSnapshotKey = key;
  window.dispatchEvent(new CustomEvent('dtb:checkout-woopayments-provider-sync', {
    detail: {
      provider: 'woocommerce_payments',
      activePaymentMethod: snapshot.activePaymentMethod,
      availablePaymentMethods: objectKeys(snapshot.availablePaymentMethods),
      availableExpressPaymentMethods: objectKeys(snapshot.availableExpressPaymentMethods),
      paymentMethodsInitialized: snapshot.paymentMethodsInitialized,
      expressPaymentMethodsInitialized: snapshot.expressPaymentMethodsInitialized,
      isPaymentReady: snapshot.isPaymentReady,
      paymentStatus: snapshot.paymentStatus,
      ...extra,
    },
  }));
}

function startProviderSubscription() {
  const wpData = window.wp?.data;
  if (!wpData || typeof wpData.subscribe !== 'function' || unsubscribePaymentStore) return;
  unsubscribePaymentStore = wpData.subscribe(() => {
    try {
      publishSnapshot(providerSnapshot());
    } catch {
      // The stores may not exist on non-checkout routes or before Woo blocks hydrate.
    }
  });
}

async function startPayment({ methods = [], order = {}, visualMethod = 'card', processPayment } = {}) {
  if (typeof processPayment !== 'function') {
    throw Object.assign(new Error('DTB same-shell payment processor is unavailable.'), {
      code: 'dtb_same_shell_processor_missing',
    });
  }

  const syncedAddresses = syncCheckoutAddresses(order);
  const initialSnapshot = await waitForProviderStore();
  const preferredGateway = normalizeId(order.paymentMethod) || activeGatewayFromCapabilities(methods);
  const paymentMethod = availableGateway(initialSnapshot, preferredGateway);

  if (!WOOPAYMENTS_COMPATIBLE_GATEWAY_IDS.has(paymentMethod)) {
    throw Object.assign(new Error(`WooPayments-compatible gateway is not active for same-shell checkout (${paymentMethod || 'none'}).`), {
      code: 'dtb_woopayments_gateway_unavailable',
    });
  }

  syncActivePaymentMethod(paymentMethod);
  const snapshot = await waitForProviderStore();
  assertWalletReadiness(visualMethod, snapshot);

  if (snapshot.isProcessing) {
    throw Object.assign(new Error('WooPayments is already processing this checkout payment.'), {
      code: 'dtb_woopayments_processing',
    });
  }

  const paymentData = normalizePaymentData(snapshot.paymentMethodData, paymentMethod);
  if (!paymentData.length || !hasProviderTokenData(paymentData)) {
    publishSnapshot(snapshot, { paymentDataReady: false, paymentMethod });
    throw Object.assign(new Error('Provider-owned WooPayments controls have not produced payment data yet. The payment step must render active WooPayments controls before submission.'), {
      code: 'dtb_woopayments_payment_data_missing',
    });
  }

  publishSnapshot(snapshot, { paymentDataReady: true, paymentMethod });
  return processPayment({
    paymentMethod,
    paymentData,
    billingEmail: order.billingEmail || order.billing_email || syncedAddresses.billingAddress.email || '',
    billingAddress: syncedAddresses.billingAddress,
    shippingAddress: syncedAddresses.shippingAddress,
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
    snapshot: providerSnapshot,
    startPayment,
  };

  startProviderSubscription();

  window.dispatchEvent(new CustomEvent('dtb:checkout-same-shell-provider-installed', {
    detail: { provider: 'woocommerce_payments' },
  }));
}