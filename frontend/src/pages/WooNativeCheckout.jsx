import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import SEOHead from '../components/shared/SEOHead.jsx';
import { navigateDocument } from '../utils/documentNavigation.js';
import { getWooCheckoutFallbackUrl, getWooCheckoutUrl } from '../utils/checkoutUrl.js';

const HANDOFF_MARKER = 'dtb:native-checkout-handoff:v1';
const HANDOFF_LOOP_WINDOW_MS = 15000;

/**
 * Compatibility route only.
 *
 * Cart CTAs use a full-document link to native WooCommerce checkout. If React
 * Router reaches `/checkout` through client navigation, force document
 * navigation so WordPress/WooCommerce owns the runtime. A one-shot direct
 * WordPress fallback prevents an infinite reload loop if the root rewrite is
 * accidentally serving the SPA at `/checkout/`.
 */
export default function WooNativeCheckout() {
  useEffect(() => {
    let previousHandoff = 0;
    try {
      previousHandoff = Number(window.sessionStorage.getItem(HANDOFF_MARKER) || 0);
    } catch {
      previousHandoff = 0;
    }

    const now = Date.now();
    const likelyRoutingLoop = previousHandoff > 0 && (now - previousHandoff) < HANDOFF_LOOP_WINDOW_MS;

    if (likelyRoutingLoop) {
      try {
        window.sessionStorage.removeItem(HANDOFF_MARKER);
      } catch {
        // Session storage is optional; direct document navigation remains valid.
      }
      navigateDocument(getWooCheckoutFallbackUrl(), { replace: true });
      return;
    }

    try {
      window.sessionStorage.setItem(HANDOFF_MARKER, String(now));
    } catch {
      // Session storage is optional; the canonical checkout handoff still works.
    }
    navigateDocument(getWooCheckoutUrl(), { replace: true });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <SEOHead noindex title="Checkout" />
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-blue-200 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <Loader2
            size={20}
            className="animate-[spin_1.15s_cubic-bezier(0.45,0,0.55,1)_infinite]"
            aria-hidden="true"
          />
        </span>
        <p className="text-sm font-medium tracking-wide text-slate-200">Opening secure checkout…</p>
      </div>
    </div>
  );
}
