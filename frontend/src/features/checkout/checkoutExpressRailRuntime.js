/**
 * frontend/src/features/checkout/checkoutExpressRailRuntime.js
 *
 * Progressive interaction layer for the checkout express-payment rail and final
 * payment step presentation.
 *
 * This does not render provider card fields, clone WooCommerce gateway markup,
 * or bypass DTB/WooCommerce payment lifecycle ownership. The rail remains a
 * launch affordance that routes through the existing guarded checkout primary
 * action: prepare the DTB checkout session/order first, then open the protected
 * provider-owned payment step when it is ready.
 */

const PROVIDER_LABELS = {
  paypal: 'PayPal',
  'apple-pay': 'Apple Pay',
  'google-pay': 'Google Pay',
  visa: 'card',
  mastercard: 'card',
  amex: 'card',
};

function resolveProviderFromLogo(logo) {
  if (!logo || !logo.classList) return 'payment method';
  const className = Array.from(logo.classList).find((token) => token.startsWith('dtb-checkout-payment-logo--'));
  const key = className ? className.replace('dtb-checkout-payment-logo--', '') : '';
  return PROVIDER_LABELS[key] || logo.getAttribute('alt') || 'payment method';
}

function findPrimaryCheckoutAction(root) {
  if (!root) return null;
  const candidates = Array.from(root.querySelectorAll('.dtb-co-sidebar-cta .dtb-co-btn-primary, .dtb-co-mobile-cta .dtb-co-btn-primary'));
  return candidates.find((button) => button instanceof HTMLButtonElement && !button.disabled && button.offsetParent !== null)
    || candidates.find((button) => button instanceof HTMLButtonElement && !button.disabled)
    || null;
}

function focusNextRequiredField(root) {
  const field = root?.querySelector?.('input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], input[required]:placeholder-shown');
  if (field instanceof HTMLElement) {
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => field.focus({ preventScroll: true }), 120);
    return true;
  }
  return false;
}

function activateLogo(logo) {
  if (!(logo instanceof HTMLElement) || logo.dataset.dtbExpressRailBound === 'true') return;

  const provider = resolveProviderFromLogo(logo);
  logo.dataset.dtbExpressRailBound = 'true';
  logo.setAttribute('role', 'button');
  logo.setAttribute('tabindex', '0');
  logo.setAttribute('aria-label', `Continue with ${provider}. Checkout details stay protected and payment is provider-owned.`);
  logo.setAttribute('title', `Continue with ${provider}`);

  const handleActivation = (event) => {
    event.preventDefault();
    const root = logo.closest('.dtb-checkout');
    const primaryAction = findPrimaryCheckoutAction(root);

    if (primaryAction) {
      primaryAction.click();
      return;
    }

    if (!focusNextRequiredField(root)) {
      root?.querySelector?.('.dtb-co-sidebar-cta, #checkout-payment-step, .dtb-co-section')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  };

  logo.addEventListener('click', handleActivation);
  logo.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleActivation(event);
    }
  });
}

function syncPaymentWorkflowState() {
  const paymentStep = document.querySelector('.dtb-checkout .dtb-co-payment-workflow');
  if (!(paymentStep instanceof HTMLElement)) return;

  const action = paymentStep.querySelector('.dtb-co-btn-primary');
  const ready = action instanceof HTMLButtonElement && !action.disabled;
  paymentStep.classList.toggle('is-payment-ready', ready);
  paymentStep.setAttribute('aria-hidden', ready ? 'false' : 'true');
}

function bindExpressRail() {
  document.querySelectorAll('.dtb-checkout .dtb-checkout-payment-logo').forEach(activateLogo);
}

function bindCheckoutFastFlow() {
  bindExpressRail();
  syncPaymentWorkflowState();
}

export function installCheckoutExpressRailRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const schedule = () => window.requestAnimationFrame(bindCheckoutFastFlow);
  schedule();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class', 'aria-disabled'] });

  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
}
