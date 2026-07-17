/**
 * Stripe-first checkout route.
 *
 * Stripe Embedded Checkout owns the checkout UI workflow. DTB owns the
 * server-side cart snapshot, Stripe Checkout Session creation, dynamic shipping
 * updates, webhook verification, and WooCommerce order materialization.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, ShieldCheck, ShoppingCart } from 'lucide-react';

import LogoWhite from '/logo-white.svg';
import SEOHead from '../components/shared/SEOHead';
import { useCart } from '../context/CartContext';
import { createStripeEmbeddedCheckoutSession, getStripeEmbeddedCheckoutConfig, updateStripeEmbeddedShippingOptions } from '../api/checkout.js';
import { makeCheckoutAttemptId } from '../utils/checkoutRecovery.js';

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveCartItemImage(item) {
  if (!item || typeof item !== 'object') return '';
  return item.image || item.image_src || item.thumbnail || item.image_url || item.product?.image || item.product?.thumbnail || item.images?.[0]?.src || item.images?.[0] || '';
}

function OrderSummary({ items }) {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((sum, item) => sum + (toMoney(item.price) * Math.max(1, Number(item.quantity || 1))), 0);
  const count = safeItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

  return (
    <aside className="dtb-stripe-checkout-summary" aria-label="Order summary">
      <div className="dtb-stripe-checkout-summary__head">
        <span>Order summary</span>
        <strong>{count} item{count === 1 ? '' : 's'}</strong>
      </div>
      <div className="dtb-stripe-checkout-summary__items">
        {safeItems.map((item) => {
          const image = resolveCartItemImage(item);
          const quantity = Math.max(1, Number(item.quantity || 1));
          return (
            <div key={item.cartKey || item.key || item.id || item.sku} className="dtb-stripe-checkout-summary__item">
              <div className="dtb-stripe-checkout-summary__image">
                {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : null}
              </div>
              <div className="dtb-stripe-checkout-summary__meta">
                <p>{item.name}</p>
                <span>Qty {quantity}</span>
              </div>
              <strong>${(toMoney(item.price) * quantity).toFixed(2)}</strong>
            </div>
          );
        })}
      </div>
      <div className="dtb-stripe-checkout-summary__totals">
        <div>
          <span>Subtotal</span>
          <strong>${subtotal.toFixed(2)}</strong>
        </div>
        <div>
          <span>Shipping and tax</span>
          <strong>Calculated in Stripe</strong>
        </div>
      </div>
    </aside>
  );
}

export default function StripeEmbeddedCheckout() {
  const navigate = useNavigate();
  const { cartItems, isLoading: cartLoading, lastSyncedAt } = useCart();
  const safeCartItems = useMemo(() => (Array.isArray(cartItems) ? cartItems : []), [cartItems]);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [started, setStarted] = useState(false);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [attemptId] = useState(() => makeCheckoutAttemptId());
  const sessionMetaRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getStripeEmbeddedCheckoutConfig()
      .then((nextConfig) => {
        if (!cancelled) setConfig(nextConfig || {});
      })
      .catch((error) => {
        if (!cancelled) setConfigError(error?.message || 'Stripe checkout configuration could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stripePromise = useMemo(() => {
    const key = config?.publishable_key;
    return key ? loadStripe(key) : null;
  }, [config?.publishable_key]);

  const fetchClientSecret = useCallback(async () => {
    setSessionError('');
    const response = await createStripeEmbeddedCheckoutSession({
      idempotency_key: attemptId,
      customer_note: customerNote,
    });
    const clientSecret = response?.stripe?.client_secret;
    if (!clientSecret) {
      throw new Error('Stripe Embedded Checkout did not return a client secret.');
    }
    const nextMeta = {
      checkoutSessionId: response?.stripe?.checkout_session_id || '',
      dtbSessionId: response?.checkout?.session_id || '',
      expiresAt: response?.checkout?.expires_at || '',
    };
    sessionMetaRef.current = nextMeta;
    setSessionMeta(nextMeta);
    return clientSecret;
  }, [attemptId, customerNote]);

  const onShippingDetailsChange = useCallback((event = {}) => {
    const checkoutSessionId = event.checkoutSessionId || '';
    const shippingDetails = event.shippingDetails || null;
    if (!checkoutSessionId || !shippingDetails) {
      return Promise.resolve({ type: 'reject', errorMessage: 'Shipping details could not be verified. Refresh checkout and try again.' });
    }
    return updateStripeEmbeddedShippingOptions({
      checkout_session_id: checkoutSessionId,
      shipping_details: shippingDetails,
    })
      .then((response) => {
        if (response?.type === 'accept') return { type: 'accept' };
        if (response?.action?.type === 'accept') return { type: 'accept' };
        const message = response?.message || response?.action?.errorMessage || 'Shipping is unavailable for this address.';
        return { type: 'reject', errorMessage: message };
      })
      .catch((error) => ({
        type: 'reject',
        errorMessage: error?.message || 'Shipping is unavailable for this address.',
      }));
  }, []);

  const onComplete = useCallback(() => {
    const checkoutSessionId = sessionMetaRef.current?.checkoutSessionId || sessionMeta?.checkoutSessionId || '';
    const query = checkoutSessionId ? `?stripe_session_id=${encodeURIComponent(checkoutSessionId)}` : '';
    navigate(`/checkout/complete${query}`, { replace: true });
  }, [navigate, sessionMeta?.checkoutSessionId]);

  const checkoutOptions = useMemo(() => ({
    fetchClientSecret,
    onShippingDetailsChange,
    onComplete,
  }), [fetchClientSecret, onComplete, onShippingDetailsChange]);

  const cartReady = !cartLoading && lastSyncedAt !== null;
  const isEmpty = cartReady && safeCartItems.length === 0;
  const available = config?.available === true && Boolean(stripePromise);

  function startCheckout() {
    setStarted(true);
  }

  return (
    <div className="dtb-stripe-checkout">
      <SEOHead noindex title="Checkout" />

      <header className="dtb-stripe-checkout-header">
        <Link to="/" aria-label="Drywall Toolbox home">
          <img src={LogoWhite} alt="Drywall Toolbox" className="dtb-stripe-checkout-header__logo" />
        </Link>
        <div className="dtb-stripe-checkout-header__trust">
          <ShieldCheck size={15} aria-hidden="true" />
          Stripe secure embedded checkout
        </div>
      </header>

      {isEmpty ? (
        <main className="dtb-stripe-checkout-state">
          <ShoppingCart size={34} strokeWidth={1.6} />
          <h1>Your cart is empty</h1>
          <p>Add products to your cart before starting checkout.</p>
          <button type="button" className="dtb-stripe-checkout-btn" onClick={() => navigate('/products')}>Browse products</button>
        </main>
      ) : (
        <main className="dtb-stripe-checkout-grid">
          <section className="dtb-stripe-checkout-panel" aria-label="Secure checkout">
            <button type="button" className="dtb-stripe-checkout-back" onClick={() => navigate('/cart')}>
              <ArrowLeft size={15} aria-hidden="true" /> Back to cart
            </button>
            <div className="dtb-stripe-checkout-titlebar">
              <span>Drywall Toolbox checkout</span>
              <h1>Secure checkout</h1>
              <p>Stripe collects contact, address, shipping, tax, and payment details in one embedded checkout flow. DTB creates the WooCommerce order only after Stripe verifies payment.</p>
            </div>

            {configError ? (
              <div className="dtb-stripe-checkout-alert" role="alert"><AlertTriangle size={16} />{configError}</div>
            ) : null}
            {config && !config.available ? (
              <div className="dtb-stripe-checkout-alert" role="alert"><AlertTriangle size={16} />Stripe Embedded Checkout is not configured.</div>
            ) : null}
            {sessionError ? (
              <div className="dtb-stripe-checkout-alert" role="alert"><AlertTriangle size={16} />{sessionError}</div>
            ) : null}

            {!started ? (
              <div className="dtb-stripe-checkout-start">
                <label className="dtb-stripe-checkout-note">
                  <span>Order note <em>optional</em></span>
                  <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} rows={3} maxLength={500} placeholder="Delivery instructions, job name, or PO reference" />
                </label>
                <button type="button" className="dtb-stripe-checkout-btn" disabled={!cartReady || !available} onClick={startCheckout}>
                  {!cartReady ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Start secure checkout
                </button>
                <div className="dtb-stripe-checkout-assurance"><CheckCircle size={14} /> No WooCommerce order is created until Stripe verifies payment.</div>
              </div>
            ) : (
              <div className="dtb-stripe-checkout-embed">
                {stripePromise ? (
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                ) : (
                  <div className="dtb-stripe-checkout-loading" role="status"><Loader2 size={18} className="animate-spin" /> Loading Stripe checkout…</div>
                )}
              </div>
            )}
          </section>

          <OrderSummary items={safeCartItems} />
        </main>
      )}
    </div>
  );
}
