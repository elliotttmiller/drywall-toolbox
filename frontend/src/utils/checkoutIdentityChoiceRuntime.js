/**
 * frontend/src/utils/checkoutIdentityChoiceRuntime.js
 *
 * Progressive checkout presentation enhancement for the dedicated checkout route.
 * React still owns checkout state and submission; this utility only mounts a
 * static, idempotent choice component into the existing checkout DOM so guests
 * have a clear path before entering contact details.
 */

const INSTALL_KEY = '__dtbCheckoutIdentityChoiceInstalled';
const MOUNT_ATTR = 'data-dtb-checkout-identity-choice';
const AUTH_REPLACED_CLASS = 'dtb-co-section__subheader--auth-choice-replaced';

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

function routeTo(path) {
  window.location.assign(path);
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
    makeOption({
      kind: 'login',
      title: 'Log in',
      copy: 'Use saved account details.',
      href: '/login',
    }),
    makeOption({
      kind: 'register',
      title: 'Create account',
      copy: 'Track orders and speed up next time.',
      href: '/register',
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

function syncCheckoutIdentityChoice() {
  if (!isCheckoutRoute()) return;
  const checkout = document.querySelector('.dtb-checkout');
  if (!checkout) return;

  ensureIdentityChoice(checkout);
  ensureSubmitTitles(checkout);
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
