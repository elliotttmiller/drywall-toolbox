/*
 * frontend/src/features/checkout/checkoutResponsiveLayoutRuntime.js
 *
 * Responsive checkout presentation guard.
 *
 * The checkout workflow runtime intentionally provides a guided mobile wizard.
 * Desktop checkout must remain a single-page layout, so this guard removes
 * mobile-only hidden attributes on desktop and keeps injected mobile-only panels
 * from becoming desktop checkout content. It does not submit checkout, create
 * orders, select gateways, mount payment fields, or change DTB/Woo authority.
 */

const CHECKOUT_PATH_RE = /(?:^|\/)checkout\/?$/;
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
const ROOT_SELECTOR = '.dtb-checkout';

let installed = false;
let observer = null;
let mediaQuery = null;
let updateQueued = false;

function isCheckoutRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname
    .replace(/^\/staging\/\d+(?=\/|$)/, '')
    .replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
  return CHECKOUT_PATH_RE.test(path);
}

function isDesktopViewport() {
  if (typeof window === 'undefined') return false;
  if (!mediaQuery) mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  return mediaQuery.matches;
}

function setVisible(node) {
  if (!(node instanceof HTMLElement)) return;
  if (node.hidden) node.hidden = false;
  if (node.getAttribute('aria-hidden') === 'true') node.removeAttribute('aria-hidden');
  node.classList.remove('is-dtb-flow-hidden');
  node.classList.add('is-dtb-flow-visible');
}

function setMobileOnlyHidden(node) {
  if (!(node instanceof HTMLElement)) return;
  if (!node.hidden) node.hidden = true;
  node.setAttribute('aria-hidden', 'true');
  node.classList.add('is-dtb-flow-hidden');
  node.classList.remove('is-dtb-flow-visible');
}

function restoreDesktopSinglePage(root) {
  root.classList.add('dtb-checkout--desktop-single-page');
  root.classList.remove('dtb-checkout--mobile-payment-sheet-open');

  const mobileShell = root.querySelector('.dtb-checkout-mobile-step-shell');
  if (mobileShell instanceof HTMLElement) {
    setMobileOnlyHidden(mobileShell);
  }

  root.querySelectorAll('.dtb-co-formpane__inner > .dtb-co-section, .dtb-co-auth-choice').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.classList.contains('dtb-mobile-payment-method-panel')) {
      setMobileOnlyHidden(node);
      return;
    }
    setVisible(node);
  });
}

function restoreMobileFlow(root) {
  root.classList.remove('dtb-checkout--desktop-single-page');

  const mobileShell = root.querySelector('.dtb-checkout-mobile-step-shell');
  if (mobileShell instanceof HTMLElement && mobileShell.hidden) {
    mobileShell.hidden = false;
    mobileShell.removeAttribute('aria-hidden');
    mobileShell.classList.remove('is-dtb-flow-hidden');
  }
}

function update() {
  updateQueued = false;
  if (!isCheckoutRoute()) return;

  const root = document.querySelector(ROOT_SELECTOR);
  if (!(root instanceof HTMLElement)) return;

  if (isDesktopViewport()) {
    restoreDesktopSinglePage(root);
  } else {
    restoreMobileFlow(root);
  }
}

function scheduleUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  window.requestAnimationFrame(update);
}

function startObserver() {
  if (observer) observer.disconnect();
  const root = document.getElementById('root') || document.body;
  observer = new MutationObserver(scheduleUpdate);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'aria-hidden', 'class', 'data-dtb-flow-step'],
  });
}

export function installCheckoutResponsiveLayoutRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;
  mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

  const start = () => {
    if (!isCheckoutRoute()) return;
    scheduleUpdate();
    startObserver();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  mediaQuery.addEventListener?.('change', scheduleUpdate);
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('orientationchange', scheduleUpdate, { passive: true });
  window.addEventListener('popstate', () => window.setTimeout(start, 0));
}
