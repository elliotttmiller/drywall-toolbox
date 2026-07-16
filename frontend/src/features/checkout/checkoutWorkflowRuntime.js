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
  ['payment', 'Secure Payment'],
]);
const STEP_EYEBROWS = new Map([
  ['contact', 'Checkout'],
  ['delivery', 'Shipping'],
  ['review', 'Payment Method'],
  ['payment', 'Payment'],
]);
const PAYMENT_VISUAL_METHODS = [
  { id: 'card', label: 'Credit Card', logos: ['visa', 'mastercard', 'amex'] },
  { id: 'paypal', label: 'PayPal', logos: ['paypal'] },
  { id: 'apple-pay', label: 'Apple Pay', logos: ['apple-pay'] },
  { id: 'google-pay', label: 'Google Pay', logos: ['google-pay'] },
];

let installed = false;
const boundStepButtons = new WeakSet();
const boundFields = new WeakSet();
let observer = null;
let updateQueued = false;
let manualStep = '';
let visualPaymentMethod = 'card';

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
  if (section?.classList?.contains('dtb-mobile-payment-method-panel')) return 'review';
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
  const contactComplete = Boolean(valueFor('firstName') && valueFor('lastName') && isEmail(valueFor('email')));
  const deliveryFieldsComplete = Boolean(valueFor('address') && valueFor('city') && valueFor('state') && valueFor('zip'));
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

function logoFor(root, key) {
  const source = root.querySelector(`.dtb-checkout-payment-logo--${key}`);
  if (!(source instanceof HTMLImageElement)) return null;
  const img = document.createElement('img');
  img.src = source.currentSrc || source.src;
  img.alt = source.alt || key;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.dataset.logo = key;
  return img;
}

function updateVisualPaymentRows(panel) {
  panel.querySelectorAll('.dtb-mobile-payment-method-row').forEach((row) => {
    const selected = row instanceof HTMLElement && row.dataset.method === visualPaymentMethod;
    row.classList.toggle('is-selected', selected);
    row.setAttribute('aria-checked', selected ? 'true' : 'false');
  });
}

function makePaymentMethodRow(root, method) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'dtb-mobile-payment-method-row';
  row.dataset.method = method.id;
  row.setAttribute('role', 'radio');
  row.setAttribute('aria-label', `${method.label}. Provider-owned payment controls verify final availability.`);

  const label = document.createElement('span');
  label.className = 'dtb-mobile-payment-method-row__label';

  const mark = document.createElement('span');
  mark.className = 'dtb-mobile-payment-method-row__mark';
  mark.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = method.label;

  label.append(mark, text);

  const logos = document.createElement('span');
  logos.className = 'dtb-mobile-payment-method-row__logos';
  method.logos.forEach((logoKey) => {
    const logo = logoFor(root, logoKey);
    if (logo) logos.appendChild(logo);
  });

  row.append(label, logos);
  row.addEventListener('click', () => {
    visualPaymentMethod = method.id;
    const panel = row.closest('.dtb-mobile-payment-method-panel');
    if (panel) updateVisualPaymentRows(panel);
  });
  return row;
}

function ensurePaymentMethodPanel(root, state) {
  const formInner = root.querySelector('.dtb-co-formpane__inner');
  if (!(formInner instanceof HTMLElement)) return;

  let panel = formInner.querySelector('.dtb-mobile-payment-method-panel');
  if (!state.reviewReady) {
    panel?.remove();
    return;
  }

  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'dtb-co-section dtb-mobile-payment-method-panel';
    panel.setAttribute('aria-label', 'Payment method');

    const title = document.createElement('h2');
    title.className = 'dtb-mobile-payment-method-panel__title';
    title.textContent = 'Payment method';

    const copy = document.createElement('p');
    copy.className = 'dtb-mobile-payment-method-panel__copy';
    copy.textContent = 'Choose how you want to continue. Final wallet, card, tokenization, and verification controls remain provider-owned.';

    const list = document.createElement('div');
    list.className = 'dtb-mobile-payment-method-list';
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Available protected payment methods');

    PAYMENT_VISUAL_METHODS.forEach((method) => list.appendChild(makePaymentMethodRow(root, method)));

    const note = document.createElement('p');
    note.className = 'dtb-mobile-payment-method-note';
    note.textContent = 'DTB prepares the order; WooCommerce and the selected payment provider complete the payment step.';

    panel.append(title, copy, list, note);

    const review = Array.from(formInner.querySelectorAll('.dtb-co-section')).find((section) => getSectionTitle(section) === 'review');
    if (review instanceof HTMLElement) {
      formInner.insertBefore(panel, review);
    } else {
      const payment = formInner.querySelector('#checkout-payment-step');
      formInner.insertBefore(panel, payment || null);
    }
  }

  updateVisualPaymentRows(panel);
}

function previousAllowedStep(activeStep, state) {
  const current = STEP_ORDER.indexOf(activeStep);
  for (let i = current - 1; i >= 0; i -= 1) {
    const step = STEP_ORDER[i];
    if (state.allowedSteps.has(step)) return step;
  }
  return '';
}

function goBackFrom(root, activeStep, state) {
  const previous = previousAllowedStep(activeStep, state);
  if (previous) {
    manualStep = previous;
    scheduleUpdate();
    return;
  }

  const cartLink = root.querySelector('.dtb-co-back-link[href]');
  if (cartLink instanceof HTMLAnchorElement) {
    cartLink.click();
    return;
  }

  window.location.assign('/cart');
}

function ensureMobileStepShell(root, activeStep, state) {
  let shell = root.querySelector('.dtb-checkout-mobile-step-shell');
  if (!shell) {
    shell = document.createElement('div');
    shell.className = 'dtb-checkout-mobile-step-shell';
    root.insertBefore(shell, root.querySelector('.dtb-co-grid'));
  }

  const stateKey = `${activeStep}:${STEP_ORDER.map((step) => (state.allowedSteps.has(step) ? '1' : '0')).join('')}`;
  if (shell.dataset.stepbarState === stateKey) return;
  shell.dataset.stepbarState = stateKey;
  shell.replaceChildren();

  const bar = document.createElement('div');
  bar.className = 'dtb-mobile-stepbar';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'dtb-mobile-stepbar__back';
  back.setAttribute('aria-label', activeStep === 'contact' ? 'Back to cart' : 'Back to previous checkout step');
  back.textContent = '‹';
  back.addEventListener('click', () => goBackFrom(root, activeStep, state));

  const title = document.createElement('div');
  title.className = 'dtb-mobile-stepbar__title';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'dtb-mobile-stepbar__eyebrow';
  eyebrow.textContent = STEP_EYEBROWS.get(activeStep) || 'Checkout';

  const heading = document.createElement('strong');
  heading.className = 'dtb-mobile-stepbar__heading';
  heading.textContent = STEP_LABELS.get(activeStep) || 'Checkout';

  title.append(eyebrow, heading);

  const dots = document.createElement('div');
  dots.className = 'dtb-mobile-stepbar__dots';
  dots.setAttribute('aria-label', 'Checkout progress');

  const activeIndex = STEP_ORDER.indexOf(activeStep);
  STEP_ORDER.forEach((step, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dtb-mobile-stepbar__dot';
    dot.classList.toggle('is-done', index < activeIndex);
    dot.classList.toggle('is-current', index === activeIndex);
    dot.disabled = !state.allowedSteps.has(step);
    dot.setAttribute('aria-label', `${STEP_LABELS.get(step) || step}${dot.disabled ? ' locked' : ''}`);
    if (!dot.disabled) {
      dot.addEventListener('click', () => {
        manualStep = step;
        scheduleUpdate();
      });
    }
    dots.appendChild(dot);
  });

  bar.append(back, title, dots);
  shell.appendChild(bar);
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
  ensurePaymentMethodPanel(root, state);

  root.dataset.dtbFlowStep = activeStep;
  root.dataset.dtbVisualPaymentMethod = visualPaymentMethod;
  root.classList.add('dtb-checkout--step-runtime');
  root.classList.add('dtb-checkout--linear-stepper');
  root.classList.add('dtb-checkout--mobile-screen-flow');
  root.classList.toggle('dtb-checkout--contact-complete', state.contactComplete);
  root.classList.toggle('dtb-checkout--delivery-complete', state.shippingComplete);
  root.classList.toggle('dtb-checkout--payment-ready', state.paymentReady);
  root.classList.toggle('dtb-checkout--review-ready', state.reviewReady);

  ensureMobileStepShell(root, activeStep, state);
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
