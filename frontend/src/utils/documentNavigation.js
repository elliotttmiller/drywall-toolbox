const DOCUMENT_FADE_MS = 180;

let navigationPending = false;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resetDocumentTransition() {
  navigationPending = false;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('dtb-document-transition-active');
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', resetDocumentTransition);
}

/**
 * Navigates outside the React router after fading the current document.
 * Use only for intentional full-document transfers such as React -> WooCommerce.
 */
export function navigateDocument(url, { replace = false } = {}) {
  if (typeof window === 'undefined' || navigationPending) return;

  navigationPending = true;

  const commitNavigation = () => {
    if (replace) {
      window.location.replace(url);
    } else {
      window.location.assign(url);
    }
  };

  if (prefersReducedMotion()) {
    commitNavigation();
    return;
  }

  document.documentElement.classList.add('dtb-document-transition-active');
  window.setTimeout(commitNavigation, DOCUMENT_FADE_MS);
}
