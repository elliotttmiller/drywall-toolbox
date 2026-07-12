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

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

const shippingMethod = read('drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Shipping/DTBShippingMethod.php');
const validator = read('drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Validation/CheckoutValidator.php');
const reducer = read('frontend/src/features/checkout/state/checkoutReducer.js');
const controller = read('frontend/src/features/checkout/hooks/useCheckoutController.js');

assertContains(
  shippingMethod,
  'dtb_commerce_ensure_shipping_method_for_packages',
  'Checkout shipping must repair the exact WooCommerce zone matching the active package.',
);
assertContains(
  shippingMethod,
  'WC_Shipping_Zones::get_zone_matching_package',
  'Checkout shipping must resolve the active WooCommerce zone from the current package.',
);
assertContains(
  shippingMethod,
  "'shipping_for_package_'",
  'Checkout shipping must invalidate WooCommerce package-rate cache after zone repair.',
);
assertContains(
  shippingMethod,
  'DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION',
  'Checkout shipping zone bootstrap must remain versioned and repairable.',
);
assertContains(
  validator,
  'dtb_commerce_ensure_shipping_method_for_packages',
  'Checkout quote evaluation must reconcile the active shipping zone before calculating rates.',
);
assertContains(
  validator,
  "'price'       => $cost",
  'Shipping rate price must remain pre-tax so order tax calculation does not double-count shipping tax.',
);
assertContains(
  validator,
  "'tax'         => (float) $taxes",
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
  'quote: null',
  'Checkout quote refresh must invalidate the stale quote before submission.',
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
