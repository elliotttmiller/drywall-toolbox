import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, LockKeyhole } from 'lucide-react';

import SEOHead from '../components/shared/SEOHead.jsx';

function checkoutUrl() {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/checkout/?dtb_woo_checkout=1`;
}

export default function WooNativeCheckout() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.location.replace(checkoutUrl());
    return undefined;
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-white flex items-center justify-center">
      <SEOHead noindex title="Checkout" />
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <LockKeyhole size={30} aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">Secure checkout</p>
        <h1 className="mb-3 text-2xl font-black tracking-tight">Opening WooCommerce checkout</h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-200">
          WooCommerce and the official Stripe gateway own the payment form, order creation, payment webhooks, and saved payment method workflow.
        </p>
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-bold text-blue-100" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Redirecting…
        </div>
        <Link to="/checkout/?dtb_woo_checkout=1" reloadDocument className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50">
          Continue to checkout
        </Link>
      </div>
    </div>
  );
}
