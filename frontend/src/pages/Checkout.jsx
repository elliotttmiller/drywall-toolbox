/**
 * frontend/src/pages/Checkout.jsx
 *
 * Branded checkout intake with secure backend payment handoff.
 * The storefront collects order intent; the backend payment runtime collects funds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import DOMPurify from 'dompurify';

import LogoWhite from '/logo-white.svg';
import { getCheckoutCapabilities } from '../api/checkout.js';
import { useAuthContext } from '../auth/AuthContext.js';
import { useCart } from '../context/CartContext';
import SEOHead from '../components/shared/SEOHead';
import CheckoutIdentityChoice from '../features/checkout/components/CheckoutIdentityChoice.jsx';
import CheckoutMobileActionSheet from '../features/checkout/components/CheckoutMobileActionSheet.jsx';
import { useCheckoutController } from '../features/checkout/hooks/useCheckoutController.js';
import { readCheckoutDraft, writeCheckoutDraft, clearCheckoutDraft } from '../features/checkout/hooks/useCheckoutDraft.js';
import { useCheckoutQuote } from '../features/checkout/hooks/useCheckoutQuote.js';
import { useCheckoutRecovery } from '../features/checkout/hooks/useCheckoutRecovery.js';
import { makeCheckoutAttemptId } from '../utils/checkoutRecovery.js';
import { normalizePaymentUrl } from '../utils/paymentUrl.js';

const WOO_NATIVE_GATEWAY_ID = 'woo_native';
const WOO_PAYMENTS_METHOD_ID = '';
const MANUAL_PAYMENT_METHOD_IDS = new Set(['cod', 'bacs', 'cheque']);

const BLANK_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  customerNote: '',
};

const PREFERRED_ONLINE_PAYMENT_IDS = [WOO_PAYMENTS_METHOD_ID, 'stripe', 'ppcp-gateway'];
const PUBLIC_PAYMENT_LABEL = 'Secure card payment';
const PUBLIC_PAYMENT_TITLE = 'Secure Card Payment';
const PAYMENT_LOGO_BASE = `${process.env.PUBLIC_URL || ''}/payment_logos`;

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['DC', 'District of Columbia'],
];

const CARD_BRAND_LOGOS = [
  { key: 'visa', src: `${PAYMENT_LOGO_BASE}/visa.svg`, alt: 'Visa' },
  { key: 'mastercard', src: `${PAYMENT_LOGO_BASE}/mastercard.svg`, alt: 'Mastercard' },
  { key: 'amex', src: `${PAYMENT_LOGO_BASE}/american-express.svg`, alt: 'American Express' },
];

const PAYMENT_METHOD_LOGOS = [
  { key: 'paypal', src: `${PAYMENT_LOGO_BASE}/paypal.svg`, alt: 'PayPal' },
  { key: 'apple-pay', src: `${PAYMENT_LOGO_BASE}/apple-pay.svg`, alt: 'Apple Pay' },
  { key: 'google-pay', src: `${PAYMENT_LOGO_BASE}/google-pay.svg`, alt: 'Google Pay' },
  ...CARD_BRAND_LOGOS,
];

const CHECKOUT_STEPS = [
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
];

const SUBMIT_MESSAGES = {
  idle: '',
  validating: 'Checking your checkout details…',
  creating: 'Creating your secure order…',
  ready: 'Secure payment is ready. Redirecting…',
};

const fadeSlide = {
  hidden: { opacity: 0, y: 12, willChange: 'transform, opacity' },
  visible: { opacity: 1, y: 0, willChange: 'auto', transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isManualPaymentMethod(method) {
  const methodId = typeof method === 'string' ? method : method?.id;
  return methodId ? MANUAL_PAYMENT_METHOD_IDS.has(String(methodId).toLowerCase()) || Boolean(method?.is_manual) : false;
}

function getPublicPaymentCopy(method) {
  const methodId = String(method?.id || method || '').toLowerCase();
  if (methodId.includes('paypal') || methodId.includes('ppcp')) {
    return { label: 'Secure online payment', title: 'Secure Online Payment' };
  }
  return { label: PUBLIC_PAYMENT_LABEL, title: PUBLIC_PAYMENT_TITLE };
}

function resolvePaymentSelection(capabilities) {
  const gateways = Array.isArray(capabilities?.gateways) ? capabilities.gateways : [];
  const nativeGateway = gateways.find((gateway) => gateway?.id === WOO_NATIVE_GATEWAY_ID) || null;
  const rawMethods = Array.isArray(nativeGateway?.payment_methods)
    ? nativeGateway.payment_methods
    : gateways.filter((gateway) => gateway?.id && gateway.id !== WOO_NATIVE_GATEWAY_ID);

  const onlineMethods = rawMethods
    .filter((method) => method && method.enabled !== false && method.id)
    .filter((method) => !isManualPaymentMethod(method));

  const preferred = PREFERRED_ONLINE_PAYMENT_IDS
    .map((id) => onlineMethods.find((method) => String(method.id).toLowerCase() === id))
    .find(Boolean) || onlineMethods[0] || null;

  if (!preferred) {
    return {
      methodId: '',
      label: 'Secure payment unavailable',
      orderTitle: PUBLIC_PAYMENT_TITLE,
      setupError: 'Secure online payment is currently unavailable. Please contact support before placing this order.',
    };
  }

  const copy = getPublicPaymentCopy(preferred);
  return {
    methodId: String(preferred.id),
    label: copy.label,
    orderTitle: copy.title,
    setupError: null,
  };
}

function resolveCartItemImage(item) {
  if (!item || typeof item !== 'object') return '';
  return item.image || item.image_src || item.thumbnail || item.image_url || item.product?.image || item.product?.thumbnail || item.images?.[0]?.src || item.images?.[0] || '';
}

function normalizeWooPaymentUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return normalizePaymentUrl(value);
}

function makeCartSnapshot(cartItems) {
  return (Array.isArray(cartItems) ? cartItems : []).map((item) => ({
    id: item.id,
    product_id: item.product_id,
    parent_id: item.parent_id,
    variation_id: item.variation_id,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    image: resolveCartItemImage(item),
  }));
}

function StepProgress({ activeStep }) {
  const activeIdx = CHECKOUT_STEPS.findIndex((step) => step.id === activeStep);
  return (
    <nav className="dtb-co-steps" aria-label="Checkout steps">
      {CHECKOUT_STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const current = idx === activeIdx;
        return [
          <div
            key={step.id}
            className={`dtb-co-step${done ? ' dtb-co-step--done' : ''}${current ? ' dtb-co-step--current' : ''}`}
          >
            <span className="dtb-co-step__bubble" aria-hidden="true">
              {done ? <CheckCircle size={13} strokeWidth={2.5} /> : <span>{idx + 1}</span>}
            </span>
            <span className="dtb-co-step__label">{step.label}</span>
          </div>,
          idx < CHECKOUT_STEPS.length - 1 && (
            <div
              key={`${step.id}-line`}
              className={`dtb-co-step__line${done ? ' dtb-co-step__line--done' : ''}`}
              aria-hidden="true"
            />
          ),
        ];
      })}
    </nav>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="dtb-co-section__header">
      <h2 className="dtb-co-section__title">{title}</h2>
      {subtitle ? <p className="dtb-co-section__subheader">{subtitle}</p> : null}
    </div>
  );
}

function InlineSubmitStatus({ status }) {
  if (!status || status === 'idle') return null;
  return (
    <div className="dtb-co-submit-status" role="status" aria-live="polite">
      <Loader2 size={13} className="animate-spin" style={{ color: 'var(--co-primary)' }} />
      {SUBMIT_MESSAGES[status] || 'Preparing checkout…'}
    </div>
  );
}

function PaymentMethodLogos({ compact = false }) {
  return (
    <div
      className={`dtb-checkout-payment-logos${compact ? ' dtb-checkout-payment-logos--compact' : ''}`}
      aria-label="Supported payment methods"
    >
      {PAYMENT_METHOD_LOGOS.map((logo) => (
        <img
          key={logo.key}
          src={logo.src}
          alt={logo.alt}
          className={`dtb-checkout-payment-logo dtb-checkout-payment-logo--${logo.key}`}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}

function TaxSummaryValue({ status, amount }) {
  if (status === 'loading') {
    return <span className="dtb-co-total-row__value dtb-co-total-row__value--muted">Calculating…</span>;
  }
  if (status === 'ready') {
    return <span className="dtb-co-total-row__value tabular-nums">${amount.toFixed(2)}</span>;
  }
  if (status === 'error') {
    return <span className="dtb-co-total-row__value dtb-co-total-row__value--muted">At payment</span>;
  }
  return <span className="dtb-co-total-row__value dtb-co-total-row__value--muted">By address</span>;
}

function MobileSummaryStrip({ cartItems, subtotal, shipping, displayTotal, taxAmount, taxStatus, quoteReady }) {
  const [open, setOpen] = useState(false);
  const totalQty = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <Motion.div className="dtb-co-msummary lg:hidden" initial={false}>
      <button
        type="button"
        className="dtb-co-msummary__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="dtb-co-msummary-body"
      >
        <span className="dtb-co-msummary__toggle-left">
          Order Summary
          <span className="dtb-co-msummary__count">({totalQty} item{totalQty === 1 ? '' : 's'})</span>
        </span>
        <span className="dtb-co-msummary__toggle-right">
          ${displayTotal.toFixed(2)}
          <ChevronRight
            size={16}
            className={`dtb-co-msummary__chevron${open ? ' dtb-co-msummary__chevron--open' : ''}`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <Motion.div
            id="dtb-co-msummary-body"
            className="dtb-co-msummary__body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="dtb-co-msummary__items">
              {cartItems.map((item) => {
                const image = resolveCartItemImage(item);
                return (
                  <div key={item.cartKey || item.id} className="dtb-co-msummary__item">
                    <div className="dtb-co-msummary__item-img">
                      {image && <img src={image} alt={item.name} loading="lazy" />}
                    </div>
                    <div className="dtb-co-msummary__item-info">
                      <p className="dtb-co-msummary__item-name">{item.name}</p>
                      <p className="dtb-co-msummary__item-unit">${toMoney(item.price).toFixed(2)} ea</p>
                    </div>
                    <span className="dtb-co-msummary__item-price">
                      ${(toMoney(item.price) * Number(item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="dtb-co-msummary__totals">
              <div className="dtb-co-msummary__total-row">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className={`dtb-co-msummary__total-row${quoteReady && shipping === 0 ? ' dtb-co-msummary__total-row--free' : ''}`}>
                <span>Shipping</span>
                <span>{quoteReady ? (shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`) : 'By address'}</span>
              </div>
              <div className="dtb-co-msummary__total-row">
                <span>Tax</span>
                {taxStatus === 'ready' ? (
                  <span>${taxAmount.toFixed(2)}</span>
                ) : (
                  <span style={{ color: 'var(--co-text-400)', fontStyle: 'italic', fontWeight: 400 }}>
                    {taxStatus === 'loading' ? 'Calculating…' : 'By address'}
                  </span>
                )}
              </div>
              <div className="dtb-co-msummary__total-row dtb-co-msummary__total-row--final">
                <span>Est. Total</span>
                <span>${displayTotal.toFixed(2)}</span>
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, clearCart, isLoading: cartLoading, lastSyncedAt } = useCart();
  const { isAuthenticated } = useAuthContext();
  const safeCartItems = useMemo(() => (Array.isArray(cartItems) ? cartItems : []), [cartItems]);
  const cartReady = !cartLoading && lastSyncedAt !== null;

  const [formData, setFormData] = useState(() => readCheckoutDraft(BLANK_FORM));
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [checkoutError, setCheckoutError] = useState(null);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(WOO_PAYMENTS_METHOD_ID);
  const [paymentSetupError, setPaymentSetupError] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [couponInput, setCouponInput] = useState('');
  const [manualCoupons, setManualCoupons] = useState([]);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [checkoutIdentity, setCheckoutIdentity] = useState(isAuthenticated ? 'account' : '');
  const [promoOpen, setPromoOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const { pendingPayment, rememberPayment, dismissPayment, resumePayment } = useCheckoutRecovery();

  const [checkoutAttemptId, setCheckoutAttemptId] = useState(
    () => pendingPayment?.attemptId || makeCheckoutAttemptId(),
  );
  const isSubmittingRef = useRef(false);
  const processing = submitStatus !== 'idle';

  const isContactComplete = useMemo(
    () => formData.firstName.trim() !== '' && formData.lastName.trim() !== '' && formData.email.trim() !== '',
    [formData],
  );
  const isAddressComplete = useMemo(
    () => formData.address.trim() !== '' && formData.city.trim() !== '' && formData.state.trim() !== '' && formData.zip.trim() !== '',
    [formData],
  );
  const isFormComplete = isContactComplete && isAddressComplete;

  const {
    quote: checkoutQuote,
    rates: shippingRates,
    loading: ratesLoading,
    quoteError: ratesError,
  } = useCheckoutQuote({
    formData,
    couponCodes: manualCoupons,
    selectedRateId,
    cartItems: safeCartItems,
    isAddressComplete: isFormComplete,
    cartReady,
  });

  const quoteTotals = checkoutQuote?.totals || {};
  const quoteReady = Boolean(checkoutQuote?.quote_id);
  const cartSubtotal = useMemo(
    () => safeCartItems.reduce(
      (sum, item) => sum + (toMoney(item.price) * Math.max(1, Number(item.quantity || 1))),
      0,
    ),
    [safeCartItems],
  );
  const subtotal = quoteReady ? toMoney(quoteTotals.subtotal) : cartSubtotal;
  const shipping = toMoney(quoteTotals.shipping);
  const taxAmount = toMoney(quoteTotals.tax);
  const displayTotal = quoteReady ? toMoney(quoteTotals.total) : cartSubtotal;
  const taxPreview = { status: quoteReady ? 'ready' : (ratesLoading ? 'loading' : 'idle'), amount: taxAmount };
  const activeSelectedRateId = shippingRates.some((rate) => String(rate.id) === String(selectedRateId))
    ? String(selectedRateId)
    : String(checkoutQuote?.selected_rate_id || shippingRates[0]?.id || '');

  const canSubmitCheckout = useMemo(
    () => !processing && !capabilitiesLoading && !paymentSetupError && quoteReady && isFormComplete && safeCartItems.length > 0 && Boolean(paymentMethod) && !isManualPaymentMethod(paymentMethod),
    [capabilitiesLoading, isFormComplete, paymentMethod, paymentSetupError, processing, quoteReady, safeCartItems.length],
  );

  const effectiveCheckoutIdentity = isAuthenticated ? 'account' : checkoutIdentity;

  useEffect(() => {
    let mounted = true;
    getCheckoutCapabilities()
      .then((caps) => {
        if (!mounted) return;
        const selection = resolvePaymentSelection(caps);
        setPaymentMethod(selection.methodId);
        setPaymentSetupError(selection.setupError);
      })
      .catch(() => {
        if (!mounted) return;
        setPaymentMethod('');
        setPaymentSetupError('Secure payment capabilities could not be verified. Please try again before placing the order.');
      })
      .finally(() => { if (mounted) setCapabilitiesLoading(false); });
    return () => { mounted = false; };
  }, []);

  const sanitize = (value) => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });

  useEffect(() => {
    writeCheckoutDraft(formData);
  }, [formData]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'state' ? String(value).toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: sanitize(nextValue) }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const focusFirstInvalidField = useCallback((nextErrors) => {
    const firstInvalid = Object.keys(nextErrors)[0];
    if (!firstInvalid) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`field-${firstInvalid}`)?.focus({ preventScroll: true });
      document.getElementById(`field-${firstInvalid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors = {};
    if (!formData.firstName.trim()) nextErrors.firstName = 'Enter your first name.';
    if (!formData.lastName.trim()) nextErrors.lastName = 'Enter your last name.';
    if (!formData.email.trim()) nextErrors.email = 'Enter your email address.';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = 'Enter a valid email address.';
    if (!formData.address.trim()) nextErrors.address = 'Enter your street address.';
    if (!formData.city.trim()) nextErrors.city = 'Enter your city.';
    if (!formData.state.trim()) nextErrors.state = 'Enter your state.';
    if (!formData.zip.trim()) nextErrors.zip = 'Enter your ZIP code.';
    setErrors(nextErrors);
    focusFirstInvalidField(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [focusFirstInvalidField, formData]);

  function addManualCoupon() {
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) return;
    setManualCoupons((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setCouponInput('');
  }

  function removeManualCoupon(code) {
    setManualCoupons((prev) => prev.filter((current) => current !== code));
  }

  const dismissPendingPayment = useCallback(() => {
    dismissPayment();
    setCheckoutAttemptId(makeCheckoutAttemptId());
  }, [dismissPayment]);

  const resumePendingPayment = useCallback(() => {
    resumePayment().catch((error) => setCheckoutError(error?.message || 'Unable to resume secure payment.'));
  }, [resumePayment]);

  const handlePaymentRequired = useCallback((result) => {
    const orderPayload = result?.order || {};
    const paymentUrl = normalizeWooPaymentUrl(result?.paymentUrl || '');
    setOrderDetails({ order: { ...orderPayload, payment_url: paymentUrl, payment_required: true } });
    rememberPayment({
      attemptId: checkoutAttemptId,
      resumeToken: result?.session?.resume_token,
      sessionId: result?.session?.session_id,
      expiresAt: result?.session?.expires_at,
      cartSnapshot: makeCartSnapshot(safeCartItems),
    });
    setSubmitStatus('ready');
    isSubmittingRef.current = false;
    window.setTimeout(() => window.location.assign(paymentUrl), 250);
  }, [checkoutAttemptId, rememberPayment, safeCartItems]);

  const handleCheckoutComplete = useCallback((result) => {
    const orderPayload = result?.order || {};
    setOrderDetails({ order: orderPayload });
    dismissPayment();
    setOrderComplete(true);
    clearCheckoutDraft();
    setCheckoutAttemptId(makeCheckoutAttemptId());
    void clearCart().catch(() => {});
    setSubmitStatus('idle');
    isSubmittingRef.current = false;
  }, [clearCart, dismissPayment]);

  const { submitCheckout } = useCheckoutController({
    quote: checkoutQuote,
    formData,
    couponCodes: manualCoupons,
    paymentMethod,
    selectedRateId: activeSelectedRateId,
    idempotencyKey: checkoutAttemptId,
    onPaymentRequired: handlePaymentRequired,
    onComplete: handleCheckoutComplete,
  });

  const handlePlaceOrder = useCallback(async () => {
    if (processing || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitStatus('validating');
    setCheckoutError(null);

    if (!validateForm()) {
      setSubmitStatus('idle');
      isSubmittingRef.current = false;
      return;
    }
    if (!paymentMethod || isManualPaymentMethod(paymentMethod) || paymentSetupError) {
      setCheckoutError(paymentSetupError || 'Secure online payment is not currently available. Please contact support.');
      setSubmitStatus('idle');
      isSubmittingRef.current = false;
      return;
    }

    if (!checkoutQuote?.quote_id) {
      setCheckoutError('Your server checkout quote is not ready. Enter or review your address and try again.');
      setSubmitStatus('idle');
      isSubmittingRef.current = false;
      return;
    }

    try {
      setSubmitStatus('creating');
      const result = await submitCheckout(validateForm);
      if (result?.blocked) {
        setSubmitStatus('idle');
        isSubmittingRef.current = false;
      }
    } catch (error) {
      setCheckoutError(error?.message || 'Checkout failed. Please try again.');
      setSubmitStatus('idle');
      isSubmittingRef.current = false;
    }
  }, [checkoutQuote, paymentMethod, paymentSetupError, processing, submitCheckout, validateForm]);

  const handleGuestChoice = useCallback(() => {
    setCheckoutIdentity('guest');
    window.requestAnimationFrame(() => {
      const target = document.getElementById('field-firstName') || document.querySelector('.dtb-co-section');
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => document.getElementById('field-firstName')?.focus({ preventScroll: true }), 180);
    });
  }, []);

  const inputCls = (field) => `dtb-co-input${errors[field] ? ' dtb-co-input--error' : ''}`;
  const activeStep = processing ? 'review' : isFormComplete ? 'payment' : 'shipping';
  const payButtonLabel = processing
    ? 'Preparing secure payment…'
    : !isAddressComplete
      ? 'Enter address to calculate total'
      : !quoteReady || ratesLoading
        ? 'Calculating shipping and tax…'
        : `Continue to secure payment — $${displayTotal.toFixed(2)}`;
  const payButtonAriaLabel = processing
    ? 'Preparing secure payment'
    : quoteReady
      ? `Continue to secure payment for ${displayTotal.toFixed(2)} dollars`
      : 'Complete checkout details to calculate total';

  if (safeCartItems.length === 0 && !orderComplete) {
    return (
      <div className="dtb-checkout dtb-co-state-bg">
        <SEOHead noindex title="Checkout" />
        <Motion.div
          className="dtb-co-state-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="dtb-co-state-icon dtb-co-state-icon--empty">
            <ShoppingCart size={32} strokeWidth={1.5} />
          </div>
          <h2>Your cart is empty</h2>
          {pendingPayment?.resumeToken ? (
            <>
              <p>A previous order still has an incomplete secure payment step.</p>
              <button
                type="button"
                onClick={() => { void resumePendingPayment(); }}
                className="dtb-co-btn-primary dtb-co-btn-primary--wide"
                style={{ marginBottom: '12px' }}
              >
                Resume Secure Payment <ExternalLink size={14} />
              </button>
              <button
                type="button"
                onClick={dismissPendingPayment}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--co-text-500)' }}
              >
                Dismiss and start over
              </button>
            </>
          ) : (
            <>
              <p>Add products to your cart before checking out.</p>
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="dtb-co-btn-primary"
              >
                Browse Products
              </button>
            </>
          )}
        </Motion.div>
      </div>
    );
  }

  if (orderComplete && orderDetails) {
    const order = orderDetails.order;
    return (
      <div className="dtb-checkout dtb-co-state-bg">
        <SEOHead noindex title="Order Created" />
        <Motion.div
          className="dtb-co-state-card"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
        >
          <div className="dtb-co-state-icon dtb-co-state-icon--success">
            <CheckCircle size={36} strokeWidth={1.8} />
          </div>
          <h2>Order Created</h2>
          <p>Your order has been created. We sent your confirmation details by email.</p>
          <Link
            to={`/order/${order?.order_id || order?.id || ''}`}
            className="dtb-co-btn-primary dtb-co-btn-primary--wide"
          >
            View Order
          </Link>
        </Motion.div>
      </div>
    );
  }

  return (
    <div className="dtb-checkout">
      <SEOHead noindex title="Checkout" />

      <header className="dtb-co-header">
        <div className="dtb-co-header__brand">
          <Link to="/" aria-label="Drywall Toolbox home">
            <img src={LogoWhite} alt="Drywall Toolbox" className="dtb-co-header__logo" />
          </Link>
        </div>

        <StepProgress activeStep={activeStep} />

        <div className="dtb-co-header__actions">
          {!isAuthenticated && (
            <Link to="/login" state={{ returnTo: '/checkout' }} className="dtb-co-header__signin">Sign in</Link>
          )}
          <span className="dtb-co-header__secure">
            <ShieldCheck size={14} aria-hidden="true" />
            Secure checkout
          </span>
        </div>
      </header>

      <div className="dtb-co-trustbar">
        <span className="dtb-co-trustbar__item">Server-calculated shipping for your delivery address</span>
        <span className="dtb-co-trustbar__sep" aria-hidden="true">|</span>
        <span className="dtb-co-trustbar__item">Secure payment handoff</span>
        <span className="dtb-co-trustbar__sep" aria-hidden="true">|</span>
        <span className="dtb-co-trustbar__item">Easy returns</span>
      </div>

      <div className="dtb-co-grid">
        <main className="dtb-co-formpane">
          <div className="dtb-co-formpane__inner">
            <MobileSummaryStrip
              cartItems={safeCartItems}
              subtotal={subtotal}
              shipping={shipping}
              displayTotal={displayTotal}
              taxAmount={taxAmount}
              taxStatus={taxPreview.status}
              quoteReady={quoteReady}
            />

            <CheckoutIdentityChoice
              isAuthenticated={isAuthenticated}
              selected={effectiveCheckoutIdentity}
              onGuest={handleGuestChoice}
            />

            {pendingPayment?.resumeToken && (
              <Motion.div
                className="dtb-co-alert dtb-co-alert--warning dtb-co-recovery"
                variants={fadeSlide}
                initial="hidden"
                animate="visible"
              >
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <span>A previous order has an incomplete payment step.</span>
                  <div className="dtb-co-recovery__actions">
                    <button
                      type="button"
                      className="dtb-co-recovery__btn dtb-co-recovery__btn--primary"
                      onClick={() => { void resumePendingPayment(); }}
                    >
                      Resume Payment <ExternalLink size={11} style={{ display: 'inline', marginLeft: 3 }} />
                    </button>
                    <button
                      type="button"
                      className="dtb-co-recovery__btn dtb-co-recovery__btn--ghost"
                      onClick={dismissPendingPayment}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </Motion.div>
            )}

            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title="Contact" />
              {!isAuthenticated && effectiveCheckoutIdentity === 'guest' && (
                <p className="dtb-co-guest-note">
                  Checking out as guest. <Link to="/login" state={{ returnTo: '/checkout' }}>Log in</Link> to use saved details.
                </p>
              )}
              <div className="dtb-co-grid-2">
                {[
                  { name: 'firstName', label: 'First Name', type: 'text', autoComplete: 'given-name', required: true },
                  { name: 'lastName', label: 'Last Name', type: 'text', autoComplete: 'family-name', required: true },
                  { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email', required: true },
                  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', inputMode: 'tel', required: false },
                ].map(({ name, label, type, autoComplete, inputMode, required }) => (
                  <div key={name} className="dtb-co-field">
                    <label htmlFor={`field-${name}`} className="dtb-co-label">
                      {label}{required ? <span style={{ color: 'var(--co-error)' }} aria-hidden="true"> *</span> : <span style={{ color: 'var(--co-text-400)', textTransform: 'none', fontWeight: 500, fontSize: '10px' }}> (optional)</span>}
                    </label>
                    <input
                      id={`field-${name}`}
                      type={type}
                      name={name}
                      value={formData[name]}
                      onChange={handleInputChange}
                      autoComplete={autoComplete}
                      enterKeyHint={name === 'phone' ? 'next' : undefined}
                      {...(inputMode ? { inputMode } : {})}
                      className={inputCls(name)}
                      aria-invalid={!!errors[name]}
                      aria-describedby={errors[name] ? `err-${name}` : undefined}
                    />
                    {errors[name] && (
                      <span id={`err-${name}`} className="dtb-co-field-error" role="alert">
                        {errors[name]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Motion.section>

            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.05}
            >
              <SectionHeader title="Shipping address" />

              <div className="dtb-co-field" style={{ marginBottom: 12 }}>
                <label htmlFor="field-address" className="dtb-co-label">
                  Street Address <span style={{ color: 'var(--co-error)' }} aria-hidden="true">*</span>
                </label>
                <input
                  id="field-address"
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  autoComplete="street-address"
                  enterKeyHint="next"
                  className={inputCls('address')}
                  aria-invalid={!!errors.address}
                  aria-describedby={errors.address ? 'err-address' : undefined}
                />
                {errors.address && <span id="err-address" className="dtb-co-field-error" role="alert">{errors.address}</span>}
              </div>

              <div className="dtb-co-grid-3">
                <div className="dtb-co-field">
                  <label htmlFor="field-city" className="dtb-co-label">
                    City <span style={{ color: 'var(--co-error)' }} aria-hidden="true">*</span>
                  </label>
                  <input
                    id="field-city"
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    autoComplete="address-level2"
                    enterKeyHint="next"
                    className={inputCls('city')}
                    aria-invalid={!!errors.city}
                    aria-describedby={errors.city ? 'err-city' : undefined}
                  />
                  {errors.city && <span id="err-city" className="dtb-co-field-error" role="alert">{errors.city}</span>}
                </div>

                <div className="dtb-co-field">
                  <label htmlFor="field-state" className="dtb-co-label">
                    State <span style={{ color: 'var(--co-error)' }} aria-hidden="true">*</span>
                  </label>
                  <select
                    id="field-state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    autoComplete="address-level1"
                    className={`dtb-co-select${errors.state ? ' dtb-co-select--error' : ''}`}
                    aria-invalid={!!errors.state}
                    aria-describedby={errors.state ? 'err-state' : undefined}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map(([code, name]) => (
                      <option key={code} value={code}>{name} ({code})</option>
                    ))}
                  </select>
                  {errors.state && <span id="err-state" className="dtb-co-field-error" role="alert">{errors.state}</span>}
                </div>

                <div className="dtb-co-field">
                  <label htmlFor="field-zip" className="dtb-co-label">
                    ZIP <span style={{ color: 'var(--co-error)' }} aria-hidden="true">*</span>
                  </label>
                  <input
                    id="field-zip"
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    enterKeyHint="done"
                    className={inputCls('zip')}
                    aria-invalid={!!errors.zip}
                    aria-describedby={errors.zip ? 'err-zip' : undefined}
                  />
                  {errors.zip && <span id="err-zip" className="dtb-co-field-error" role="alert">{errors.zip}</span>}
                </div>
              </div>
            </Motion.section>

            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.08}
            >
              <SectionHeader title="Shipping method" />

              {ratesLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--co-text-400)', padding: '4px 0' }}>
                  <Loader2 size={13} className="animate-spin" />
                  Loading shipping options…
                </div>
              )}

              {ratesError && !ratesLoading && (
                <div className="dtb-co-alert dtb-co-alert--warning" style={{ fontSize: 12 }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  {ratesError}
                </div>
              )}

              {!ratesLoading && shippingRates.length === 0 && !ratesError && (
                <p style={{ fontSize: 13, color: 'var(--co-text-400)', fontStyle: 'italic', margin: 0 }}>
                  Enter your address above to see available rates.
                </p>
              )}

              {!ratesLoading && shippingRates.length > 0 && (
                <div className="dtb-co-rates" role="radiogroup" aria-label="Shipping method">
                  {shippingRates.map((rate) => (
                    <label
                      key={rate.id}
                      className={`dtb-co-rate-option${activeSelectedRateId === String(rate.id) ? ' dtb-co-rate-option--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="shippingRate"
                        value={rate.id}
                        checked={activeSelectedRateId === String(rate.id)}
                        onChange={() => setSelectedRateId(String(rate.id))}
                      />
                      <div className="dtb-co-rate-meta">
                        <p className="dtb-co-rate-name">{rate.name}</p>
                        {rate.eta && <p className="dtb-co-rate-eta">{rate.eta}</p>}
                      </div>
                      <span className={`dtb-co-rate-price${toMoney(rate.price) === 0 ? ' dtb-co-rate-price--free' : ''}`}>
                        {toMoney(rate.price) === 0 ? 'Free' : `$${toMoney(rate.price).toFixed(2)}`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </Motion.section>

            <Motion.section
              className="dtb-co-section lg:hidden"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.1}
            >
              <div className="dtb-co-inline-disclosure">
                <button
                  type="button"
                  className="dtb-co-disclosure-toggle"
                  aria-expanded={promoOpen}
                  aria-controls="dtb-co-mobile-coupon"
                  onClick={() => setPromoOpen((value) => !value)}
                >
                  <span>
                    <strong>Discount code</strong><br />
                    <span className="dtb-co-disclosure-toggle__copy">Add a promo or gift card code.</span>
                  </span>
                  <ChevronRight className="dtb-co-disclosure-toggle__icon" size={18} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {promoOpen && (
                    <Motion.div
                      id="dtb-co-mobile-coupon"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="dtb-co-coupon__row">
                        <input
                          id="coupon-code-mobile"
                          type="text"
                          value={couponInput}
                          onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                          placeholder="Enter code"
                          className="dtb-co-coupon__input"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          enterKeyHint="done"
                        />
                        <button type="button" onClick={addManualCoupon} className="dtb-co-coupon__btn" disabled={!couponInput.trim()}>
                          Apply
                        </button>
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
              {manualCoupons.length > 0 && (
                <div className="dtb-co-coupon__tags">
                  {manualCoupons.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => removeManualCoupon(code)}
                      className="dtb-co-coupon__tag"
                      aria-label={`Remove coupon ${code}`}
                    >
                      {code} ×
                    </button>
                  ))}
                </div>
              )}
            </Motion.section>

            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.12}
            >
              <div className="dtb-co-inline-disclosure">
                <button
                  type="button"
                  className="dtb-co-disclosure-toggle"
                  aria-expanded={noteOpen}
                  aria-controls="field-customerNote-wrap"
                  onClick={() => setNoteOpen((value) => !value)}
                >
                  <span>
                    <strong>Order note</strong><br />
                    <span className="dtb-co-disclosure-toggle__copy">Optional delivery or handling instructions.</span>
                  </span>
                  <ChevronRight className="dtb-co-disclosure-toggle__icon" size={18} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {noteOpen && (
                    <Motion.div
                      id="field-customerNote-wrap"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <label htmlFor="field-customerNote" className="sr-only">Order note</label>
                      <textarea
                        id="field-customerNote"
                        name="customerNote"
                        value={formData.customerNote}
                        onChange={handleInputChange}
                        rows={2}
                        placeholder="Special instructions for your order…"
                        className="dtb-co-textarea"
                        style={{ marginTop: 6 }}
                        autoComplete="off"
                        enterKeyHint="done"
                      />
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Motion.section>

            {checkoutError && (
              <Motion.div
                className="dtb-co-alert dtb-co-alert--error"
                style={{ marginTop: 20 }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {checkoutError}
              </Motion.div>
            )}

            <div className="dtb-co-actions">
              <Link to="/cart" className="dtb-co-back-link">
                <ChevronLeft size={14} />
                Return to cart
              </Link>
            </div>
          </div>
        </main>

        <aside className="dtb-co-sidebar" aria-label="Order summary">
          <div className="dtb-co-order-items">
            {safeCartItems.map((item) => {
              const image = resolveCartItemImage(item);
              return (
                <div key={item.cartKey || item.id} className="dtb-co-order-item">
                  <div className="dtb-co-order-item__thumb">
                    <div className="dtb-co-order-item__thumb-img">
                      {image && <img src={image} alt={item.name} loading="lazy" />}
                    </div>
                    <span className="dtb-co-order-item__qty" aria-label={`Qty: ${item.quantity}`}>
                      {item.quantity}
                    </span>
                  </div>
                  <div className="dtb-co-order-item__info">
                    <p className="dtb-co-order-item__name">{item.name}</p>
                    <p className="dtb-co-order-item__unit">${toMoney(item.price).toFixed(2)} ea</p>
                  </div>
                  <span className="dtb-co-order-item__price">
                    ${(toMoney(item.price) * Number(item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="dtb-co-coupon">
            <div className="dtb-co-coupon__row">
              <input
                id="coupon-code-desktop"
                type="text"
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                placeholder="Gift card or discount code"
                className="dtb-co-coupon__input"
                aria-label="Discount or gift card code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="done"
              />
              <button type="button" onClick={addManualCoupon} className="dtb-co-coupon__btn" disabled={!couponInput.trim()}>
                Apply
              </button>
            </div>
            {manualCoupons.length > 0 && (
              <div className="dtb-co-coupon__tags">
                {manualCoupons.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => removeManualCoupon(code)}
                    className="dtb-co-coupon__tag"
                    aria-label={`Remove coupon ${code}`}
                  >
                    {code} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dtb-co-totals">
            <div className="dtb-co-total-row">
              <span className="dtb-co-total-row__label">Subtotal</span>
              <span className="dtb-co-total-row__value">${subtotal.toFixed(2)}</span>
            </div>
            <div className="dtb-co-total-row">
              <span className="dtb-co-total-row__label">Shipping</span>
              <span className={`dtb-co-total-row__value${quoteReady && shipping === 0 ? ' dtb-co-total-row__value--free' : ''}`}>
                {quoteReady ? (shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`) : 'By address'}
              </span>
            </div>
            <div className="dtb-co-total-row">
              <span className="dtb-co-total-row__label">Tax</span>
              <TaxSummaryValue status={taxPreview.status} amount={taxAmount} />
            </div>
            <div className="dtb-co-total-row dtb-co-total-row--final">
              <span className="dtb-co-total-row__label">Est. Total</span>
              <span className="dtb-co-total-row__value">
                <span className="dtb-co-total-currency">USD</span>
                ${displayTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="dtb-co-sidebar-cta">
            <div className="dtb-co-sidebar-cta__stage">
              <span>Secure checkout</span>
              <strong>Continue to payment</strong>
            </div>
            {paymentSetupError && (
              <div className="dtb-co-alert dtb-co-alert--warning" style={{ fontSize: 12, marginBottom: 12 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                {paymentSetupError}
              </div>
            )}
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={!canSubmitCheckout || processing}
              className="dtb-co-btn-primary dtb-co-btn-primary--wide"
              aria-label={payButtonAriaLabel}
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : null}
              {payButtonLabel}
            </button>
            <InlineSubmitStatus status={submitStatus} />
            <div className="dtb-co-cta-trust" aria-label="Secure payment details">
              <span><ShieldCheck size={13} aria-hidden="true" /> Encrypted checkout</span>
              <span>Payment is completed on the secure gateway screen before your order is finalized.</span>
            </div>
          </div>

          <div className="dtb-co-payment-section">
            <p className="dtb-co-payment-label">Express payment available next</p>
            <PaymentMethodLogos />
          </div>
        </aside>
      </div>

      <CheckoutMobileActionSheet
        displayTotal={displayTotal}
        subtotal={subtotal}
        shipping={shipping}
        taxAmount={taxAmount}
        taxStatus={taxPreview.status}
        quoteReady={quoteReady}
        processing={processing}
        canSubmitCheckout={canSubmitCheckout}
        payButtonLabel={payButtonLabel}
        payButtonAriaLabel={payButtonAriaLabel}
        onSubmit={handlePlaceOrder}
      />
    </div>
  );
}
