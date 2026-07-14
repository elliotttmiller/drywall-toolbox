/**
 * frontend/src/utils/checkoutIdentityChoiceRuntime.js
 *
 * Progressive checkout presentation enhancement for the dedicated checkout route.
 * React still owns checkout state, quote state, validation, and submission; this
 * utility only mounts idempotent presentation controls into the existing checkout
 * DOM so guests have a clear path and the mobile payment sheet remains compact.
 */

const INSTALL_KEY = '__dtbCheckoutIdentityChoiceInstalled';
const MOUNT_ATTR = 'data-dtb-checkout-identity-choice';
const AUTH_REPLACED_CLASS = 'dtb-co-section__subheader--auth-choice-replaced';
const SHEET_EXPANDED_CLASS = 'dtb-co-mobile-cta--expanded';
const CHECKOUT_SHEET_EXPANDED_CLASS = 'dtb-co-mobile-cta-expanded';

function q(root, selector) {
  return root?.querySelector?.(selector) || null;
}

function qa(root, selector) {
  return Array.from(root?.querySelectorAll?.(selector) || []);
}

function text(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function isCheckoutRoute() {
  return window.location.pathname.replace(/^\/drywall-toolbox(?=\/|$)/, '') === '/checkout';
}

function findContactSection(checkout) {
  return qa(checkout, '.dtb-co-section').find((section) => {
    const title = text(q(section, '.dtb-co-section__title')).toLowerCase();
    return title === 'contact';
  }) || null;
}

function isGuestCheckout(checkout) {
  const contact = findContactSection(checkout);
  return Boolean(contact && q(contact, '.dtb-co-section__subheader a[href*="/login"]'));
}

function continueAsGuest() {
  const firstName = document.getElementById('field-firstName');
  const contact = findContactSection(document.querySelector('.dtb-checkout'));
  const target = firstName || contact;

  if (target?.scrollIntoView) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (firstName?.focus) {
    window.setTimeout(() => firstName.focus({ preventScroll: true }), 180);
  }
}

function makeOption({ kind, title, copy, action, href }) {
  const element = href ? document.createElement('a') : document.createElement('button');
  element.className = `dtb-co-auth-choice__option dtb-co-auth-choice__option--${kind}`;

  if (href) {
    element.href = href;
    element.addEventListener('click', () => {
      try {
        window.sessionStorage.setItem('dtb:checkout:return-after-auth', '/checkout');
      } catch {
        // Non-critical; auth routes remain directly usable.
      }
    });
  } else {
    element.type = 'button';
    element.addEventListener('click', action);
  }

  const heading = document.createElement('span');
  heading.className = 'dtb-co-auth-choice__option-title';
  heading.textContent = title;

  const body = document.createElement('span');
  body.className = 'dtb-co-auth-choice__option-copy';
  body.textContent = copy;

  element.append(heading, body);
  return element;
}

function buildChoiceCard() {
  const card = document.createElement('section');
  card.className = 'dtb-co-auth-choice';
  card.setAttribute(MOUNT_ATTR, '1');
  card.setAttribute('aria-labelledby', 'dtb-co-auth-choice-title');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'dtb-co-auth-choice__eyebrow';
  eyebrow.textContent = 'Checkout options';

  const title = document.createElement('h2');
  title.id = 'dtb-co-auth-choice-title';
  title.className = 'dtb-co-auth-choice__title';
  title.textContent = 'How would you like to check out?';

  const copy = document.createElement('p');
  copy.className = 'dtb-co-auth-choice__copy';
  copy.textContent = 'Continue as a guest, or sign in to use saved account details and order tracking.';

  const actions = document.createElement('div');
  actions.className = 'dtb-co-auth-choice__actions';
  actions.append(
    makeOption({
      kind: 'guest',
      title: 'Checkout as guest',
      copy: 'Fastest option. No account required.',
      action: continueAsGuest,
    }),
function appHref(path) {
  const base = window.location.pathname.startsWith('/drywall-toolbox/')
    ? '/drywall-toolbox'
    : '';
  return `${base}${path}`;
}

    makeOption({
      kind: 'login',
      title: 'Log in',
      copy: 'Use saved account details.',
      href: appHref('/login'),
    }),
    makeOption({
      kind: 'register',
      title: 'Create account',
      copy: 'Track orders and speed up next time.',
      href: appHref('/register'),
    }),
  );

  const footnote = document.createElement('p');
  footnote.className = 'dtb-co-auth-choice__footnote';
  footnote.textContent = 'You can create or connect an account after purchase if you continue as a guest.';

  card.append(eyebrow, title, copy, actions, footnote);
  return card;
}

function ensureIdentityChoice(checkout) {
  const contact = findContactSection(checkout);
  const existing = q(checkout, `[${MOUNT_ATTR}]`);

  if (!contact || !isGuestCheckout(checkout)) {
    existing?.remove();
    qa(checkout, `.${AUTH_REPLACED_CLASS}`).forEach((node) => node.classList.remove(AUTH_REPLACED_CLASS));
    return;
  }

  const subheader = q(contact, '.dtb-co-section__subheader');
  subheader?.classList.add(AUTH_REPLACED_CLASS);

  if (existing) return;

  const card = buildChoiceCard();
  contact.parentNode?.insertBefore(card, contact);
}

function ensureSubmitTitles(checkout) {
  const mobileInner = q(checkout, '.dtb-co-mobile-cta__inner');
  const mobileTotals = q(mobileInner, '.dtb-co-mobile-cta__totals');
  if (mobileInner && !q(mobileInner, '.dtb-co-mobile-cta__stage')) {
    const stage = document.createElement('div');
    stage.className = 'dtb-co-mobile-cta__stage';
    stage.innerHTML = '<span>Secure checkout</span><strong>Review total, then continue to payment</strong>';
    mobileInner.insertBefore(stage, mobileTotals || mobileInner.firstChild);
  }

  const desktopCta = q(checkout, '.dtb-co-sidebar-cta');
  if (desktopCta && !q(desktopCta, '.dtb-co-sidebar-cta__stage')) {
    const stage = document.createElement('div');
    stage.className = 'dtb-co-sidebar-cta__stage';
    stage.innerHTML = '<span>Secure checkout</span><strong>Continue to payment</strong>';
    desktopCta.insertBefore(stage, desktopCta.firstChild);
  }
}

function findMobileTotal(inner) {
  const finalTotal = text(q(inner, '.dtb-co-mobile-cta__total-line--final span:last-child'));
  if (finalTotal) return finalTotal;

  const amount = text(q(inner, '.dtb-co-mobile-cta__total-amount'));
  if (amount) return amount;

  const buttonText = text(q(inner, '.dtb-co-btn-primary'));
  const match = buttonText.match(/\$\s?[\d,]+(?:\.\d{2})?/);
  return match ? match[0].replace(/\$\s+/, '$') : '';
}

function setSheetExpanded(checkout, cta, expanded) {
  cta.classList.toggle(SHEET_EXPANDED_CLASS, expanded);
  checkout.classList.toggle(CHECKOUT_SHEET_EXPANDED_CLASS, expanded);

  const toggle = q(cta, '.dtb-co-mobile-cta__summary-toggle');
  const totals = q(cta, '.dtb-co-mobile-cta__totals');
  if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (totals) totals.setAttribute('aria-hidden', expanded ? 'false' : 'true');
}

function ensureMobileCtaSheet(checkout) {
  const cta = q(checkout, '.dtb-co-mobile-cta');
  const inner = q(cta, '.dtb-co-mobile-cta__inner');
  const primaryButton = q(inner, '.dtb-co-btn-primary');
  if (!cta || !inner || !primaryButton) return;

  cta.classList.add('dtb-co-mobile-cta--collapsible');

  const totals = q(inner, '.dtb-co-mobile-cta__totals');
  if (totals && !totals.id) totals.id = 'dtb-co-mobile-cta-totals';

  let toggle = q(inner, '.dtb-co-mobile-cta__summary-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dtb-co-mobile-cta__summary-toggle';
    toggle.setAttribute('aria-controls', totals?.id || 'dtb-co-mobile-cta-totals');
    toggle.innerHTML = '<span class="dtb-co-mobile-cta__summary-label">Estimated total</span><strong class="dtb-co-mobile-cta__summary-amount"></strong><span class="dtb-co-mobile-cta__summary-chevron" aria-hidden="true">⌃</span>';
    toggle.addEventListener('click', () => {
      setSheetExpanded(checkout, cta, !cta.classList.contains(SHEET_EXPANDED_CLASS));
    });
    inner.insertBefore(toggle, inner.firstChild);
    setSheetExpanded(checkout, cta, false);
  }

  const amountNode = q(toggle, '.dtb-co-mobile-cta__summary-amount');
  const total = findMobileTotal(inner);
  if (amountNode && total) amountNode.textContent = total;

  setSheetExpanded(checkout, cta, cta.classList.contains(SHEET_EXPANDED_CLASS));
}

function syncCheckoutIdentityChoice() {
  if (!isCheckoutRoute()) return;
  const checkout = document.querySelector('.dtb-checkout');
  if (!checkout) return;

  ensureIdentityChoice(checkout);
  ensureSubmitTitles(checkout);
  ensureMobileCtaSheet(checkout);
}

export function installCheckoutIdentityChoiceRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      syncCheckoutIdentityChoice();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('popstate', schedule, { passive: true });
  schedule();
}
