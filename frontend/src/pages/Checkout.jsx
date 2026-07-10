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
import { getCheckoutCapabilities, previewCheckoutTax } from '../api/checkout.js';
import { buildCheckoutLineItems, syncAndPlace } from '../api/cart.js';
import { useAuthContext } from '../auth/AuthContext.js';
import { useCart } from '../context/CartContext';
import { ESTIMATED_SHIP_RATE, FREE_SHIP_THRESHOLD } from '../constants/shipping';
import veeqoService from '../services/veeqo';
import SEOHead from '../components/shared/SEOHead';
import {
  clearPendingCheckoutPayment,
  makeCheckoutAttemptId,
  readPendingCheckoutPayment,
  writePendingCheckoutPayment,
} from '../utils/checkoutRecovery.js';

const WOO_NATIVE_GATEWAY_ID = 'woo_native';
const WOO_PAYMENTS_METHOD_ID = 'woocommerce_payments';
const MANUAL_PAYMENT_METHOD_IDS = new Set(['cod', 'bacs', 'cheque']);
const PREFERRED_ONLINE_PAYMENT_IDS = [WOO_PAYMENTS_METHOD_ID, 'stripe', 'ppcp-gateway'];
const PUBLIC_PAYMENT_LABEL = 'Secure card payment';
const PUBLIC_PAYMENT_TITLE = 'Secure Card Payment';
const PAYMENT_LOGO_BASE = `${process.env.PUBLIC_URL || ''}/payment_logos`;
const SHIPPING_DEBOUNCE_MS = 650;
const TAX_PREVIEW_DEBOUNCE_MS = 700;
const TAX_PREVIEW_TIMEOUT_MS = 12000;
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

/* ─── Utilities ─────────────────────────────────────────── */

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Tax preview timed out.')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
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

function getPaymentBaseUrl() {
  const configured = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '');
  return '';
}

function normalizeWooPaymentUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const fallbackBase = getPaymentBaseUrl() || 'https://drywalltoolbox.com';
  try {
    const url = new URL(value.trim(), fallbackBase);
    if (/^\/wp\/checkout\/order-pay(?:\/|$)/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/^\/wp/, '');
    } else if (/^\/order-pay(?:\/|$)/.test(url.pathname)) {
      url.pathname = `/checkout${url.pathname}`;
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

function resolvePaymentUrl(orderPayload) {
  const order = orderPayload?.finalize || orderPayload?.order || orderPayload || {};
  const direct = order.payment_url || order.paymentUrl || order.pay_url || order.payUrl || order.checkout_payment_url;
  if (typeof direct === 'string' && direct.trim()) return normalizeWooPaymentUrl(direct);
  const id = order.order_id || order.id || order.orderId;
  const key = order.order_key || order.key || order.orderKey;
  const base = getPaymentBaseUrl();
  if (!id || !key || !base) return '';
  return normalizeWooPaymentUrl(`${base}/checkout/order-pay/${encodeURIComponent(id)}/?pay_for_order=true&key=${encodeURIComponent(key)}`);
}

function resolveOrderPayload(response) {
  return response?.finalize || response?.order || response || null;
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
    price: item.price,
    image: resolveCartItemImage(item),
  }));
}

/* ─── Sub-components ────────────────────────────────────── */

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

function SectionHeader({ title, complete = false }) {
  return (
    <div className="dtb-co-section__header">
      <h2 className="dtb-co-section__title">{title}</h2>
      {complete && (
        <span className="dtb-co-complete-badge" aria-label={`${title} complete`}>
          <CheckCircle size={11} strokeWidth={2.5} />
          Complete
        </span>
      )}
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

function MobileSummaryStrip({ cartItems, subtotal, shipping, total, taxAmount, taxStatus }) {
  const [open, setOpen] = useState(true);
  const totalQty = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const displayTotal = total + taxAmount;

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
              <div className={`dtb-co-msummary__total-row${shipping === 0 ? ' dtb-co-msummary__total-row--free' : ''}`}>
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
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

/* ─── Main Component ────────────────────────────────────── */

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { isAuthenticated } = useAuthContext();
  const safeCartItems = useMemo(() => (Array.isArray(cartItems) ? cartItems : []), [cartItems]);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'US', customerNote: '',
  });
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [checkoutError, setCheckoutError] = useState(null);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(WOO_PAYMENTS_METHOD_ID);
  const [paymentMethodTitle, setPaymentMethodTitle] = useState(PUBLIC_PAYMENT_TITLE);
  const [paymentSetupError, setPaymentSetupError] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [couponInput, setCouponInput] = useState('');
  const [manualCoupons, setManualCoupons] = useState([]);
  const [shippingRates, setShippingRates] = useState([]);
  const [selectedRate, setSelectedRate] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(null);
  const [taxPreview, setTaxPreview] = useState({ status: 'idle', amount: 0 });
  const [pendingPayment, setPendingPayment] = useState(() => readPendingCheckoutPayment());

  const selectedRateRef = useRef(selectedRate);
  const checkoutAttemptIdRef = useRef(pendingPayment?.attemptId || makeCheckoutAttemptId());
  const shippingRequestSeq = useRef(0);
  const taxRequestSeq = useRef(0);
  const isSubmittingRef = useRef(false);
  selectedRateRef.current = selectedRate;

  const processing = submitStatus !== 'idle';
  const subtotal = toMoney(getCartTotal());
  const shipping = selectedRate ? toMoney(selectedRate.price) : (subtotal >= FREE_SHIP_THRESHOLD ? 0 : ESTIMATED_SHIP_RATE);
  const total = toMoney(subtotal + shipping);
  const taxAmount = taxPreview.status === 'ready' ? toMoney(taxPreview.amount) : 0;
  const displayTotal = total + taxAmount;

  const isContactComplete = useMemo(
    () => formData.firstName.trim() !== '' && formData.lastName.trim() !== '' && formData.email.trim() !== '' && formData.phone.trim() !== '',
    [formData],
  );
  const isAddressComplete = useMemo(
    () => formData.address.trim() !== '' && formData.city.trim() !== '' && formData.state.trim() !== '' && formData.zip.trim() !== '',
    [formData],
  );
  const isFormComplete = isContactComplete && isAddressComplete;
  const canSubmitCheckout = useMemo(
    () => !processing && !capabilitiesLoading && !paymentSetupError && isFormComplete && safeCartItems.length > 0 && Boolean(paymentMethod) && !isManualPaymentMethod(paymentMethod),
    [capabilitiesLoading, isFormComplete, paymentMethod, paymentSetupError, processing, safeCartItems.length],
  );

  useEffect(() => {
    let mounted = true;
    getCheckoutCapabilities()
      .then((caps) => {
        if (!mounted) return;
        const selection = resolvePaymentSelection(caps);
        setPaymentMethod(selection.methodId);
        setPaymentMethodTitle(selection.orderTitle);
        setPaymentSetupError(selection.setupError);
      })
      .catch(() => {
        if (!mounted) return;
        setPaymentMethod(WOO_PAYMENTS_METHOD_ID);
        setPaymentMethodTitle(PUBLIC_PAYMENT_TITLE);
        setPaymentSetupError(null);
      })
      .finally(() => { if (mounted) setCapabilitiesLoading(false); });
    return () => { mounted = false; };
  }, []);

  const fetchShippingRates = useCallback(async (data, items) => {
    const requestId = shippingRequestSeq.current + 1;
    shippingRequestSeq.current = requestId;
    setRatesLoading(true);
    setRatesError(null);
    try {
      const destination = { address: data.address, city: data.city, state: data.state, zip: data.zip, country: data.country || 'US' };
      const lineItems = items.map((item) => ({
        id: item.id, sku: item.sku || '', name: item.name || '',
        quantity: item.quantity, price: item.price || 0,
        weight: item.weight || 0.5, category: 'product',
      }));
      const rates = await veeqoService.getShippingRates(destination, lineItems);
      if (requestId !== shippingRequestSeq.current) return;
      const normalizedRates = Array.isArray(rates) ? rates : [];
      setShippingRates(normalizedRates);
      if (normalizedRates.length > 0 && !selectedRateRef.current) setSelectedRate(normalizedRates[0]);
    } catch (err) {
      if (requestId !== shippingRequestSeq.current) return;
      setRatesError('Could not load shipping options. Rates will be calculated at payment.');
      console.warn('Shipping rate fetch failed:', err.message);
    } finally {
      if (requestId === shippingRequestSeq.current) setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAddressComplete) return undefined;
    const timer = window.setTimeout(() => { fetchShippingRates(formData, safeCartItems); }, SHIPPING_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [fetchShippingRates, formData, isAddressComplete, safeCartItems]);

  useEffect(() => {
    if (!isAddressComplete) {
      taxRequestSeq.current += 1;
      setTaxPreview({ status: 'idle', amount: 0 });
      return undefined;
    }
    const requestId = taxRequestSeq.current + 1;
    taxRequestSeq.current = requestId;
    const timer = window.setTimeout(async () => {
      const address = {
        first_name: formData.firstName, last_name: formData.lastName,
        address_1: formData.address, address_2: '',
        city: formData.city, state: formData.state,
        postcode: formData.zip, country: formData.country || 'US',
        email: formData.email, phone: formData.phone,
      };
      setTaxPreview((current) => ({ status: 'loading', amount: current.status === 'ready' ? current.amount : 0 }));
      try {
        const shippingLines = selectedRate ? [{
          method_id: `dtb_veeqo_rates`,
          method_title: selectedRate.name || 'Shipping',
          total: String(toMoney(selectedRate.price)),
        }] : [];
        const preview = await withTimeout(
          previewCheckoutTax({
            billing: address, shipping: address,
            line_items: buildCheckoutLineItems(safeCartItems),
            shipping_lines: shippingLines,
            coupon_codes: manualCoupons,
          }),
          TAX_PREVIEW_TIMEOUT_MS,
        );
        if (requestId !== taxRequestSeq.current) return;
        setTaxPreview({ status: 'ready', amount: toMoney(preview?.tax) });
      } catch (error) {
        if (requestId !== taxRequestSeq.current) return;
        console.warn('Tax preview fetch failed:', error?.message || error);
        setTaxPreview({ status: 'error', amount: 0 });
      }
    }, TAX_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [formData, isAddressComplete, manualCoupons, safeCartItems, selectedRate]);

  const sanitize = (value) => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: sanitize(value) }));
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
    if (!formData.phone.trim()) nextErrors.phone = 'Enter a phone number for delivery updates.';
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
    clearPendingCheckoutPayment();
    setPendingPayment(null);
    checkoutAttemptIdRef.current = makeCheckoutAttemptId();
  }, []);

  const resumePendingPayment = useCallback(() => {
    if (pendingPayment?.paymentUrl) {
      const paymentUrl = normalizeWooPaymentUrl(pendingPayment.paymentUrl);
      window.location.assign(paymentUrl);
    }
  }, [pendingPayment]);

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

    const billingAddress = {
      first_name: formData.firstName, last_name: formData.lastName,
      address_1: formData.address, address_2: '',
      city: formData.city, state: formData.state,
      postcode: formData.zip, country: formData.country,
      email: formData.email, phone: formData.phone,
    };
    const wcRateId = selectedRate ? `dtb_veeqo_rates:${selectedRate.id}` : '';

    try {
      setSubmitStatus('creating');
      const response = await syncAndPlace(
        safeCartItems, billingAddress, billingAddress,
        paymentMethod, [], formData.customerNote,
        wcRateId, selectedRate ? selectedRate.price : '',
        manualCoupons, paymentMethodTitle, checkoutAttemptIdRef.current,
      );
      const orderPayload = resolveOrderPayload(response);
      const paymentUrl = resolvePaymentUrl(orderPayload);
      const orderId = orderPayload?.order_id || orderPayload?.id || orderPayload?.orderId || '';
      const orderKey = orderPayload?.order_key || orderPayload?.key || orderPayload?.orderKey || '';
      setOrderDetails({ order: { ...orderPayload, payment_url: paymentUrl, payment_required: Boolean(paymentUrl) } });

      if (paymentUrl) {
        const recovery = writePendingCheckoutPayment({
          attemptId: checkoutAttemptIdRef.current,
          orderId, orderKey, paymentUrl,
          status: orderPayload?.status || 'pending',
          total: orderPayload?.total, currency: orderPayload?.currency,
          cartSnapshot: makeCartSnapshot(safeCartItems),
        });
        setPendingPayment(recovery);
        setSubmitStatus('ready');
        window.setTimeout(() => window.location.assign(paymentUrl), 250);
        return;
      }

      clearPendingCheckoutPayment();
      setPendingPayment(null);
      setOrderComplete(true);
      checkoutAttemptIdRef.current = makeCheckoutAttemptId();
      await clearCart();
      setSubmitStatus('idle');
      isSubmittingRef.current = false;
    } catch (error) {
      setCheckoutError(error?.message || 'Checkout failed. Please try again.');
      setSubmitStatus('idle');
      isSubmittingRef.current = false;
    }
  }, [clearCart, formData, manualCoupons, paymentMethod, paymentMethodTitle, paymentSetupError, processing, safeCartItems, selectedRate, validateForm]);

  /* ─── Derived helpers ────────────────────────────────── */
  const inputCls = (field) =>
    `dtb-co-input${errors[field] ? ' dtb-co-input--error' : ''}`;

  const activeStep = processing ? 'review' : isFormComplete ? 'payment' : 'shipping';

  /* ─── Empty cart ─────────────────────────────────────── */
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
          {pendingPayment?.paymentUrl ? (
            <>
              <p>A previous order still has an incomplete secure payment step.</p>
              <button
                type="button"
                onClick={resumePendingPayment}
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

  /* ─── Order complete ─────────────────────────────────── */
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

  /* ─── Main checkout ───────────────────────────────────── */
  return (
    <div className="dtb-checkout">
      <SEOHead noindex title="Checkout" />

      {/* Header */}
      <header className="dtb-co-header">
        <div className="dtb-co-header__brand">
          <Link to="/" aria-label="Drywall Toolbox home">
            <img src={LogoWhite} alt="Drywall Toolbox" className="dtb-co-header__logo" />
          </Link>
        </div>

        <StepProgress activeStep={activeStep} />

        <div className="dtb-co-header__actions">
          {!isAuthenticated && (
            <Link to="/login" className="dtb-co-header__signin">Sign in</Link>
          )}
          <span className="dtb-co-header__secure">
            <ShieldCheck size={14} aria-hidden="true" />
            Secure checkout
          </span>
        </div>
      </header>

      {/* Trust bar */}
      <div className="dtb-co-trustbar">
        <span className="dtb-co-trustbar__item">
          Free shipping on orders ${FREE_SHIP_THRESHOLD}+
        </span>
        <span className="dtb-co-trustbar__sep" aria-hidden="true">|</span>
        <span className="dtb-co-trustbar__item">
          Secure, encrypted checkout
        </span>
        <span className="dtb-co-trustbar__sep" aria-hidden="true">|</span>
        <span className="dtb-co-trustbar__item">
          Easy returns
        </span>
      </div>

      {/* Two-column layout */}
      <div className="dtb-co-grid">

        {/* ── Left: Form pane ── */}
        <main className="dtb-co-formpane">
          <div className="dtb-co-formpane__inner">

            {/* Mobile order summary */}
            <MobileSummaryStrip
              cartItems={safeCartItems}
              subtotal={subtotal}
              shipping={shipping}
              total={total}
              taxAmount={taxAmount}
              taxStatus={taxPreview.status}
            />

            {/* Pending payment recovery */}
            {pendingPayment?.paymentUrl && (
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
                      onClick={resumePendingPayment}
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

            {/* ── Contact section ── */}
            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title="Contact" complete={isContactComplete} />
              {!isAuthenticated && (
                <p className="dtb-co-section__subheader">
                  Have an account?{' '}
                  <Link to="/login">Log in</Link>
                </p>
              )}
              <div className="dtb-co-grid-2">
                {[
                  { name: 'firstName', label: 'First Name', type: 'text', autoComplete: 'given-name' },
                  { name: 'lastName', label: 'Last Name', type: 'text', autoComplete: 'family-name' },
                  { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email' },
                  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
                ].map(({ name, label, type, autoComplete, inputMode }) => (
                  <div key={name} className="dtb-co-field">
                    <label htmlFor={`field-${name}`} className="dtb-co-label">
                      {label} <span style={{ color: 'var(--co-error)' }} aria-hidden="true">*</span>
                    </label>
                    <input
                      id={`field-${name}`}
                      type={type}
                      name={name}
                      value={formData[name]}
                      onChange={handleInputChange}
                      autoComplete={autoComplete}
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

            {/* ── Shipping Address section ── */}
            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.05}
            >
              <SectionHeader title="Shipping address" complete={isAddressComplete} />

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
                  className={inputCls('address')}
                  aria-invalid={!!errors.address}
                />
                {errors.address && (
                  <span className="dtb-co-field-error" role="alert">{errors.address}</span>
                )}
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
                    className={inputCls('city')}
                    aria-invalid={!!errors.city}
                  />
                  {errors.city && <span className="dtb-co-field-error" role="alert">{errors.city}</span>}
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
                  >
                    <option value="">Select state</option>
                    {US_STATES.map(([code, name]) => (
                      <option key={code} value={code}>{name} ({code})</option>
                    ))}
                  </select>
                  {errors.state && <span className="dtb-co-field-error" role="alert">{errors.state}</span>}
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
                    className={inputCls('zip')}
                    aria-invalid={!!errors.zip}
                  />
                  {errors.zip && <span className="dtb-co-field-error" role="alert">{errors.zip}</span>}
                </div>
              </div>

              {subtotal > 0 && subtotal < FREE_SHIP_THRESHOLD && (
                <div className="dtb-co-ship-nudge">
                  Spend <strong>${(FREE_SHIP_THRESHOLD - subtotal).toFixed(2)}</strong> more for free shipping
                </div>
              )}
            </Motion.section>

            {/* ── Shipping Method section ── */}
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
                      className={`dtb-co-rate-option${selectedRate?.id === rate.id ? ' dtb-co-rate-option--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="shippingRate"
                        value={rate.id}
                        checked={selectedRate?.id === rate.id}
                        onChange={() => setSelectedRate(rate)}
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

            {/* ── Coupon (mobile only) ── */}
            <Motion.section
              className="dtb-co-section lg:hidden"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.1}
            >
              <SectionHeader title="Discount code" />
              <div className="dtb-co-coupon__row">
                <input
                  id="coupon-code-mobile"
                  type="text"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="dtb-co-coupon__input"
                />
                <button type="button" onClick={addManualCoupon} className="dtb-co-coupon__btn">
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
            </Motion.section>

            {/* ── Order note ── */}
            <Motion.section
              className="dtb-co-section"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              custom={0.12}
            >
              <label htmlFor="field-customerNote" className="dtb-co-label">
                Order note{' '}
                <span style={{ color: 'var(--co-text-400)', textTransform: 'none', fontWeight: 500, fontSize: '10px' }}>
                  (optional)
                </span>
              </label>
              <textarea
                id="field-customerNote"
                name="customerNote"
                value={formData.customerNote}
                onChange={handleInputChange}
                rows={2}
                placeholder="Special instructions for your order…"
                className="dtb-co-textarea"
                style={{ marginTop: 6 }}
              />
            </Motion.section>

            {/* Error */}
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

            {/* Actions row */}
            <div className="dtb-co-actions">
              <Link to="/cart" className="dtb-co-back-link">
                <ChevronLeft size={14} />
                Return to cart
              </Link>
            </div>

          </div>
        </main>

        {/* ── Right: Sticky sidebar ── */}
        <aside className="dtb-co-sidebar" aria-label="Order summary">

          {/* Items list */}
          <div className="dtb-co-order-items">
            {safeCartItems.map((item) => {
              const image = resolveCartItemImage(item);
              return (
                <div key={item.cartKey || item.id} className="dtb-co-order-item">
                  <div className="dtb-co-order-item__thumb">
                    <div className="dtb-co-order-item__thumb-img">
                      {image && (
                        <img src={image} alt={item.name} loading="lazy" />
                      )}
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

          {/* Coupon */}
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
              />
              <button type="button" onClick={addManualCoupon} className="dtb-co-coupon__btn">
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

          {/* Totals */}
          <div className="dtb-co-totals">
            <div className="dtb-co-total-row">
              <span className="dtb-co-total-row__label">Subtotal</span>
              <span className="dtb-co-total-row__value">${subtotal.toFixed(2)}</span>
            </div>
            <div className="dtb-co-total-row">
              <span className="dtb-co-total-row__label">Shipping</span>
              <span className={`dtb-co-total-row__value${shipping === 0 ? ' dtb-co-total-row__value--free' : ''}`}>
                {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
              </span>
            </div>
            <div className="dtb-co-total-row">
              <span className="dtb-co-total-row__label">Tax</span>
              <TaxSummaryValue status={taxPreview.status} amount={taxAmount} />
            </div>
            <div className="dtb-co-total-row dtb-co-total-row--final">
              <span className="dtb-co-total-row__label">Total</span>
              <span className="dtb-co-total-row__value">
                <span className="dtb-co-total-currency">USD</span>
                ${displayTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Desktop submit */}
          <div className="dtb-co-sidebar-cta">
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
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : null}
              {processing ? 'Preparing Payment…' : 'Continue to Secure Payment'}
            </button>
            <InlineSubmitStatus status={submitStatus} />
          </div>

          {/* Payment logos */}
          <div className="dtb-co-payment-section">
            <p className="dtb-co-payment-label">We accept</p>
            <PaymentMethodLogos />
          </div>

        </aside>
      </div>

      {/* ── Mobile sticky CTA ── */}
      <div className="dtb-co-mobile-cta lg:hidden">
        <div className="dtb-co-mobile-cta__inner">
          <div className="dtb-co-mobile-cta__total-row">
            <span>Est. Total</span>
            <span className="dtb-co-mobile-cta__total-amount">${displayTotal.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={!canSubmitCheckout || processing}
            className="dtb-co-btn-primary dtb-co-btn-primary--wide"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : null}
            {processing ? 'Preparing Payment…' : 'Continue to Secure Payment'}
          </button>
          <div className="dtb-co-mobile-cta__logos">
            <PaymentMethodLogos compact />
          </div>
        </div>
      </div>

    </div>
  );
}
