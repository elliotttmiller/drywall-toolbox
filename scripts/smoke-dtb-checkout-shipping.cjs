'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required checkout shipping source: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function assertContains(source, needle, message) {
  if (!normalizeWhitespace(source).includes(normalizeWhitespace(needle))) {
    throw new Error(message);
  }
}

function assertNotContains(source, needle, message) {
  if (normalizeWhitespace(source).includes(normalizeWhitespace(needle))) {
    throw new Error(message);
  }
}

const shippingMethod = read('drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Shipping/DTBShippingMethod.php');
const validator = read('drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Validation/CheckoutValidator.php');
const reducer = read('frontend/src/features/checkout/state/checkoutReducer.js');
const quoteHook = read('frontend/src/features/checkout/hooks/useCheckoutQuote.js');
const controller = read('frontend/src/features/checkout/hooks/useCheckoutController.js');

assertContains(
  shippingMethod,
  "add_filter( 'woocommerce_package_rates'",
  'Checkout shipping must provide an in-memory policy-rate fallback for the active package.',
);
assertContains(
  shippingMethod,
  'get_rates_for_package',
  'Checkout shipping fallback must reuse the canonical WooCommerce shipping method calculation.',
);
assertContains(
  shippingMethod,
  "'shipping_for_package_'",
  'Checkout shipping must invalidate WooCommerce package-rate cache after an address change.',
);
assertContains(
  shippingMethod,
  'DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION',
  'Checkout shipping zone bootstrap must remain versioned and repairable.',
);
assertContains(
  shippingMethod,
  "get_shipping_methods( false, 'admin' )",
  'Shipping-zone migration must detect disabled DTB instances instead of creating duplicates.',
);
assertNotContains(
  validator,
  'dtb_commerce_ensure_shipping_method_for_packages',
  'Public checkout quote evaluation must not mutate WooCommerce shipping-zone configuration.',
);
assertContains(
  validator,
  "'price' => $cost",
  'Shipping rate price must remain pre-tax so order tax calculation does not double-count shipping tax.',
);
assertContains(
  validator,
  "'tax' => (float) $taxes",
  'Shipping rate tax must remain a separate server-authoritative field.',
);
assertContains(
  validator,
  'dtb_checkout_shipping_rate_changed',
  'Checkout must reject a stale or unavailable selected shipping rate instead of silently changing it.',
);
assertContains(
  reducer,
  "case 'QUOTE_START':",
  'Checkout quote reducer must handle a quote refresh transition.',
);
assertContains(
  reducer,
  'quote: null, rates: []',
  'Checkout quote refresh must invalidate stale quote and rate state before submission.',
);
assertContains(
  quoteHook,
  "error?.code === 'dtb_checkout_shipping_rate_changed'",
  'Checkout quoting must recognize the authoritative stale-rate conflict.',
);
assertContains(
  quoteHook,
  "createCheckoutQuote( { ...payload, shipping_rate_id: '' } )",
  'Checkout quoting must recover from a stale selection with one unselected authoritative retry.',
);
assertContains(
  controller,
  'quoteRateId !== requestedRateId',
  'Checkout submission must verify that the visible selected rate matches the authoritative quote.',
);
assertContains(
  controller,
  'shipping_rate_id: requestedRateId',
  'Checkout session creation must submit the selected authoritative shipping rate.',
);

console.log('DTB checkout shipping contract smoke checks passed.');
