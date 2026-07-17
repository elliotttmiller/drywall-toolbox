import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import SEOHead from '../components/shared/SEOHead.jsx';
import { navigateDocument } from '../utils/documentNavigation.js';

const CHECKOUT_QUERY_FLAG = 'dtb_woo_checkout';

function checkoutPath() {
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  return `${publicUrl}/checkout/`;
}

function checkoutUrl() {
  const path = checkoutPath();

  if (typeof window === 'undefined') {
    return `${path}?${CHECKOUT_QUERY_FLAG}=1`;
  }

  const url = new URL(path, window.location.origin);
  url.searchParams.set(CHECKOUT_QUERY_FLAG, '1');
  return url.toString();
}

function isWooCheckoutHandoffRequest() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(CHECKOUT_QUERY_FLAG) === '1';
}

export default function WooNativeCheckout() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isWooCheckoutHandoffRequest()) return undefined;
    navigateDocument(checkoutUrl(), { replace: true });
    return undefined;
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
        <p className="text-sm font-medium tracking-wide text-slate-200">Loading checkout...</p>
      </div>
    </div>
  );
}
