/*
 * frontend/src/features/checkout/checkoutWorkflowRuntime.js
 *
 * Progressive checkout stepper runtime with CoreUI CStepper-style linear wizard
 * semantics. This file does not create orders, select payment gateways, submit
 * payment, inject card fields, or alter DTB/WooCommerce authority. It only
 * keeps the existing React checkout sections visually synchronized to a guided
 * linear checkout workflow while the canonical checkout controller remains the
 * source of truth for quote/session/finalize/payment readiness.
 */

const CHECKOUT_PATH_RE = /(?:^|\/)checkout\/?$/;
const STEP_ORDER = ['contact', 'delivery', 'review', 'payment'];
const STEP_LABELS = new Map([
  ['contact', 'Contact'],
  ['delivery', 'Delivery'],
  ['review', 'Review'],
  ['payment', 'Payment'],
]);

let installed = false;
const boundStepButtons = new WeakSet();
const boundFields = new WeakSet();
let observer = null;
let updateQueued = false;
let manualStep = '';

function isCheckoutRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
  return CHECKOUT_PATH_RE.test(path);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getField(id) {
  return document.getElementById(`field-${id}`);
}

function valueFor(id) {
  return String(getField(id)?.value || '').trim();
}

function isEmail(value) {
  return /\S+@\S+\.\S+/.test(String(value || '').trim());
}

function getSectionTitle(section) {
  return normalizeText(section?.querySelector('.dtb-co-section__title, h2, h3')?.textContent || '');
}

function classifySection(section) {
  const title = getSectionTitle(section);
  if (title === 'contact') return 'contact';
  if (title === 'delivery' || title === 'shipping method') return 'delivery';
  if (title === 'review') return 'review';
  if (title === 'payment') return 'payment';
  if (section?.querySelector?.('#field-customerNote-wrap, #dtb-co-mobile-coupon')) return 'delivery';
  return '';
}

function hasSelectedShippingRate(root) {
  return Boolean(root.querySelector('.dtb-co-rate-option--selected input[name="shippingRate"]'));
}

function getPaymentReady(root) {
  const payment = root.querySelector('#checkout-payment-step');
  if (!payment) return false;
  if (payment.classList.contains('is-payment-ready')) return true;
  return Boolean(payment.querySelector('.dtb-co-btn-primary:not(:disabled)'));
}

function getState(root) {
  const contactComplete = Boolean(
    valueFor('firstName') &&
    valueFor('lastName') &&
    isEmail(valueFor('email')),
  );
  const deliveryFieldsComplete = Boolean(
    valueFor('address') &&
    valueFor('city') &&
    valueFor('state') &&
    valueFor('zip'),
  );
  const shippingComplete = deliveryFieldsComplete && hasSelectedShippingRate(root);
  const paymentReady = getPaymentReady(root);
  const reviewReady = contactComplete && shippingComplete;

  return {
    contactComplete,
    deliveryFieldsComplete,
    shippingComplete,
    reviewReady,
    paymentReady,
    allowedSteps: new Set([
      'contact',
      ...(contactComplete ? ['delivery'] : []),
      ...(reviewReady ? ['review'] : []),
      ...(paymentReady ? ['payment'] : []),
    ]),
  };
}

function defaultStep(state) {
  if (state.paymentReady) return 'payment';
  if (state.reviewReady) return 'review';
  if (state.contactComplete) return 'delivery';
  return 'contact';
}

function resolveStep(state) {
  if (manualStep && state.allowedSteps.has(manualStep)) return manualStep;
  manualStep = '';
  return defaultStep(state);
}

function updatePanelVisibility(root, activeStep) {
  const sections = Array.from(root.querySelectorAll('.dtb-co-formpane__inner > .dtb-co-section'));
  sections.forEach((section) => {
    const step = classifySection(section);
    if (!step) return;
    section.classList.add('dtb-co-flow-panel', `dtb-co-flow-panel--${step}`);
    const visible = step === activeStep;
    section.classList.toggle('is-dtb-flow-visible', visible);
    section.classList.toggle('is-dtb-flow-hidden', !visible);
    section.toggleAttribute('hidden', !visible);
    if (visible) section.removeAttribute('aria-hidden');
    else section.setAttribute('aria-hidden', 'true');
  });

  const authChoice = root.querySelector('.dtb-co-auth-choice');
  if (authChoice) {
    const showAuth = activeStep === 'contact';
    authChoice.classList.toggle('is-dtb-flow-hidden', !showAuth);
    authChoice.toggleAttribute('hidden', !showAuth);
    if (showAuth) authChoice.removeAttribute('aria-hidden');
    else authChoice.setAttribute('aria-hidden', 'true');
  }
}

function updateStepProgress(root, activeStep, state) {
  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const progress = root.querySelector('.dtb-co-steps');
  if (progress) {
    progress.dataset.linear = 'true';
    progress.dataset.activeStep = activeStep;
    progress.setAttribute('aria-label', 'Checkout progress, linear');
  }

  const steps = Array.from(root.querySelectorAll('.dtb-co-step'));
  steps.forEach((node, index) => {
    const step = STEP_ORDER[index];
    if (!step) return;
    const enabled = state.allowedSteps.has(step);
    const done = index < activeIndex;
    node.dataset.dtbStep = step;
    node.classList.toggle('dtb-co-step--done', done);
    node.classList.toggle('dtb-co-step--current', step === activeStep);
    node.classList.toggle('dtb-co-step--locked', !enabled);
    node.classList.toggle('dtb-co-step--enabled', enabled);
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', enabled ? '0' : '-1');
    node.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    node.setAttribute('aria-current', step === activeStep ? 'step' : 'false');
    node.setAttribute('aria-label', `${STEP_LABELS.get(step) || step} checkout step${enabled ? '' : ', locked'}`);

    if (!boundStepButtons.has(node)) {
      boundStepButtons.add(node);
      const activate = () => {
        const selected = node.dataset.dtbStep;
        if (!selected) return;
        const nextState = getState(root);
        if (!nextState.allowedSteps.has(selected)) return;
        manualStep = selected;
        scheduleUpdate();
      };
      node.addEventListener('click', activate);
      node.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate();
      });
    }
  });
}

function bindFields(root) {
  const fields = root.querySelectorAll('input, select, textarea');
  fields.forEach((field) => {
    if (boundFields.has(field)) return;
    boundFields.add(field);
    field.addEventListener('input', () => {
      manualStep = '';
      scheduleUpdate();
    }, { passive: true });
    field.addEventListener('change', () => {
      manualStep = '';
      scheduleUpdate();
    }, { passive: true });
  });
}

function update() {
  updateQueued = false;
  if (!isCheckoutRoute()) return;
  const root = document.querySelector('.dtb-checkout');
  if (!root) return;

  bindFields(root);
  const state = getState(root);
  const activeStep = resolveStep(state);
  root.dataset.dtbFlowStep = activeStep;
  root.classList.add('dtb-checkout--step-runtime');
  root.classList.add('dtb-checkout--linear-stepper');
  root.classList.toggle('dtb-checkout--contact-complete', state.contactComplete);
  root.classList.toggle('dtb-checkout--delivery-complete', state.shippingComplete);
  root.classList.toggle('dtb-checkout--payment-ready', state.paymentReady);
  root.classList.toggle('dtb-checkout--review-ready', state.reviewReady);

  updatePanelVisibility(root, activeStep);
  updateStepProgress(root, activeStep, state);
}

function scheduleUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  window.requestAnimationFrame(update);
}

export function installCheckoutWorkflowRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  const start = () => {
    if (!isCheckoutRoute()) return;
    scheduleUpdate();
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleUpdate);
    const root = document.getElementById('root') || document.body;
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'class', 'aria-expanded', 'hidden', 'checked'],
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.addEventListener('popstate', () => {
    manualStep = '';
    window.setTimeout(start, 0);
  });
}
