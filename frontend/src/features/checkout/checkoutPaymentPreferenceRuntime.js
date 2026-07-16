/**
 * frontend/src/features/checkout/checkoutPaymentPreferenceRuntime.js
 *
 * Bridges customer-facing checkout payment-method selections into the session
 * payload resolver. This does not execute payment or select gateway controls;
 * it records a gateway preference that is resolved against checkout capabilities
 * when the DTB checkout session is created.
 */

import { setCheckoutPaymentPreference } from './paymentGatewaySelection.js';

const EVENT_NAME = 'dtb:checkout-payment-method-selected';
let installed = false;

export function installCheckoutPaymentPreferenceRuntime() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener(EVENT_NAME, (event) => {
    const method = event?.detail?.visualMethod;
    setCheckoutPaymentPreference(method);
  });
}
