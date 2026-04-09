/**
 * frontend/src/pages/Checkout.jsx
 *
 * Modernised headless WooCommerce checkout.
 *   - Two-column layout (form left, sticky order summary right)
 *   - Framer Motion step-enter animations + AnimatePresence payment panels
 *   - Mobile: single-column + sticky "Complete Purchase" CTA docked to viewport bottom
 *   - 4-dot breathing loader during cart-sync / order-placement
 *   - Skeleton order summary during processing
 *   - Stripe UPE card UI placeholder (activated once WC Stripe gateway is live)
 *   - PayPal Express button stubs (activated once WC PayPal Payments plugin is live)
 *   - All existing business logic preserved: syncAndPlace(), DOMPurify, Veeqo
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Lock,
  Truck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ShoppingCart,
  User,
  Smartphone,
} from 'lucide-react';
import DOMPurify from 'dompurify';

import { useCart } from '../context/CartContext';
import { syncAndPlace } from '../api/cart.js';
import veeqoService from '../services/veeqo';
import SEOHead from '../components/SEOHead';

// ─── Payment gateway definitions ──────────────────────────────────────────────
// IDs must match WC payment gateway slugs enabled in WP Admin →
// WooCommerce → Settings → Payments.
// 'stripe' and 'paypal' are included as UI placeholders; they activate
// automatically once their corresponding WC gateways are configured.
const PAYMENT_METHODS = [
  { id: 'stripe', label: 'Credit / Debit Card' },
  { id: 'paypal', label: 'PayPal / Express'    },
];

// ─── Framer Motion shared variants ────────────────────────────────────────────
// will-change is set on the hidden/initial state (before animation starts) and
// reset to 'auto' on the final visible state so the compositor layer is released
// once animation completes — avoids permanent memory/paint cost.
const cardVariants = {
  hidden:  { opacity: 0, y: 18, willChange: 'transform, opacity' },
  visible: (delay) => ({
    opacity: 1,
    y: 0,
    willChange: 'auto',
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: delay ?? 0 },
  }),
};

const panelVariants = {
  initial: { opacity: 0, height: 0, willChange: 'transform, opacity' },
  animate: { opacity: 1, height: 'auto', willChange: 'auto', transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, height: 0,      willChange: 'auto', transition: { duration: 0.2,  ease: 'easeIn' } },
};

// ─── BreathingLoader ──────────────────────────────────────────────────────────
// Four dots that breathe in/out with a staggered delay, used while the cart is
// being synced to the WC Store API or the order is being placed.
function BreathingLoader( { label = 'Processing…' } ) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="flex items-center gap-2">
        { [0, 1, 2, 3].map( ( i ) => (
          <Motion.span
            key={ i }
            className="block w-2.5 h-2.5 rounded-full bg-primary-500"
            animate={ { scale: [1, 1.45, 1], opacity: [0.35, 1, 0.35] } }
            transition={ { duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' } }
          />
        ) ) }
      </div>
      <p className="text-sm text-gray-500 tracking-wide">{ label }</p>
    </div>
  );
}

// ─── StepCard ─────────────────────────────────────────────────────────────────
// Animated section card that slides up on mount.
function StepCard( { children, delay = 0, className = '' } ) {
  return (
    <Motion.div
      variants={ cardVariants }
      initial="hidden"
      animate="visible"
      custom={ delay }
      className={ `bg-white rounded-2xl border border-gray-100 shadow-sm ${ className }` }
    >
      { children }
    </Motion.div>
  );
}

// ─── Skeleton summary row ──────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex justify-between items-start animate-pulse">
      <div className="flex-1 mr-4 space-y-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
      <div className="h-3.5 bg-gray-200 rounded w-14 shrink-0" />
    </div>
  );
}

// ─── OrderSummaryPanel ────────────────────────────────────────────────────────
// Sticky right-column panel that shows cart items, pricing totals, and a
// skeleton loading state while the order is being processed.
function OrderSummaryPanel( { cartItems, subtotal, shipping, tax, total, loading } ) {
  return (
    <StepCard delay={ 0.15 } className="p-6 sticky top-24">
      <h2 className="text-lg font-bold text-gray-900 mb-5 tracking-tight">Order Summary</h2>

      <div className="space-y-3.5 mb-5 max-h-60 overflow-y-auto pr-1">
        <AnimatePresence>
          { loading
            ? [0, 1, 2].map( ( i ) => <SkeletonRow key={ i } /> )
            : cartItems.map( ( item ) => (
                <Motion.div
                  key={ item.id }
                  initial={ { opacity: 0 } }
                  animate={ { opacity: 1 } }
                  exit={ { opacity: 0 } }
                  className="flex justify-between text-sm"
                >
                  <div className="grow mr-3 min-w-0">
                    <p className="font-medium text-gray-900 truncate leading-snug">{ item.name }</p>
                    <p className="text-gray-400 text-xs mt-0.5">Qty { item.quantity }</p>
                  </div>
                  <p className="font-semibold text-gray-900 shrink-0 tabular-nums">
                    ${ ( item.price * item.quantity ).toFixed( 2 ) }
                  </p>
                </Motion.div>
              ) )
          }
        </AnimatePresence>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-2.5 mb-5 text-sm text-gray-600">
        { [
          { label: 'Subtotal', value: `$${ subtotal.toFixed( 2 ) }` },
          {
            label: 'Shipping',
            value: shipping === 0
              ? <span className="text-emerald-600 font-semibold">FREE</span>
              : `$${ shipping.toFixed( 2 ) }`,
          },
          { label: 'Tax (8%)', value: `$${ tax.toFixed( 2 ) }` },
        ].map( ( { label, value } ) => (
          <div key={ label } className="flex justify-between">
            <span>{ label }</span>
            <span className="font-medium text-gray-900 tabular-nums">{ value }</span>
          </div>
        ) ) }
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between items-baseline">
          <span className="text-base font-bold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-primary-600 tabular-nums">
            ${ total.toFixed( 2 ) }
          </span>
        </div>
        { shipping === 0 && (
          <p className="text-xs text-emerald-600 mt-1.5 text-right">
            <span aria-hidden="true">🎉</span> You qualify for free shipping
          </p>
        ) }
      </div>
    </StepCard>
  );
}

// ─── PayPal Express stub ──────────────────────────────────────────────────────
// Renders PayPal / Apple Pay / Google Pay express buttons as visual placeholders.
// The @paypal/react-paypal-js SDK will replace these once the WC PayPal Payments
// plugin is configured.
function PayPalExpressButtons() {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
        <AlertTriangle size={ 12 } aria-hidden="true" />
        PayPal gateway must be enabled in WP Admin → WooCommerce → Payments to activate.
      </p>
      <button
        type="button"
        disabled
        className="w-full h-12 bg-[#0070BA] text-white rounded-xl font-bold text-sm
                   tracking-wide flex items-center justify-center gap-2
                   opacity-50 cursor-not-allowed"
      >
        <span className="font-extrabold">Pay</span>
        <span className="font-extrabold text-[#009cde]">Pal</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled
          aria-label="Apple Pay (requires PayPal gateway)"
          className="h-12 bg-black text-white rounded-xl text-sm font-semibold
                     opacity-50 cursor-not-allowed"
        >
          Apple Pay
        </button>
        <button
          type="button"
          disabled
          aria-label="Google Pay (requires PayPal gateway)"
          className="h-12 bg-white border border-gray-300 text-gray-800 rounded-xl
                     text-sm font-semibold opacity-50 cursor-not-allowed"
        >
          G Pay
        </button>
      </div>
    </div>
  );
}

// ─── PaymentMethodSelector ────────────────────────────────────────────────────
// Radio-group for payment methods with animated detail panels per method.
// Uses AnimatePresence so only the active panel is mounted, preventing layout
// shifts when switching between Stripe, PayPal, or offline methods.
const METHOD_META = {
  stripe: { sublabel: 'Secured by Stripe TLS. PCI-DSS compliant.',  Icon: CreditCard },
  paypal: { sublabel: 'PayPal, Apple Pay, and Google Pay.',          Icon: Smartphone },
};

function PaymentMethodSelector( { selectedMethod, onChange, inputClass } ) {
  return (
    <div className="space-y-2">
      { PAYMENT_METHODS.map( ( { id, label } ) => {
        const meta   = METHOD_META[id] ?? {};
        const Icon   = meta.Icon ?? CreditCard;
        const active = selectedMethod === id;

        return (
          <div key={ id }>
            <label
              className={
                `flex items-center gap-3.5 p-4 rounded-xl border-2 cursor-pointer
                 transition-all duration-150 select-none ${
                   active
                     ? 'border-primary-500 bg-primary-50/60'
                     : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                 }`
              }
            >
              <input
                type="radio"
                name="paymentMethod"
                value={ id }
                checked={ active }
                onChange={ onChange }
                className="sr-only"
              />
              {/* Custom radio indicator */}
              <span
                className={
                  `flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                   border-2 transition-colors ${
                     active ? 'border-primary-500' : 'border-gray-300'
                   }`
                }
              >
                { active && (
                  <span className="block h-2.5 w-2.5 rounded-full bg-primary-500" />
                ) }
              </span>
              <Icon size={ 17 } className={ active ? 'text-primary-600' : 'text-gray-400' } />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-900 leading-tight">
                  { label }
                </span>
                { meta.sublabel && (
                  <span className="block text-xs text-gray-500 mt-0.5 leading-tight">
                    { meta.sublabel }
                  </span>
                ) }
              </span>
            </label>

            {/* Animated detail panel — only mounted when this method is active */}
            <AnimatePresence initial={ false }>
              { active && ( id === 'stripe' || id === 'paypal' || id === 'bacs' ) && (
                <Motion.div
                  key={ `panel-${ id }` }
                  variants={ panelVariants }
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="overflow-hidden px-1"
                >
                  { id === 'stripe' && (
                    <div className="pt-4 space-y-3">
                      <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
                        <AlertTriangle size={ 12 } aria-hidden="true" />
                        Stripe gateway must be enabled in WP Admin → WooCommerce → Payments.
                        The card form below will be replaced by Stripe Elements once active.
                      </p>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider
                                          text-gray-500 mb-1.5">
                          Card Number
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="1234 5678 9012 3456"
                          maxLength={ 19 }
                          readOnly
                          className={ inputClass( '_stripe_num' ) }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider
                                            text-gray-500 mb-1.5">
                            Expiry
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            placeholder="MM / YY"
                            maxLength={ 7 }
                            readOnly
                            className={ inputClass( '_stripe_exp' ) }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider
                                            text-gray-500 mb-1.5">
                            CVC
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            placeholder="···"
                            maxLength={ 4 }
                            readOnly
                            className={ inputClass( '_stripe_cvc' ) }
                          />
                        </div>
                      </div>
                    </div>
                  ) }
                  { id === 'paypal' && (
                    <div className="pt-4">
                      <PayPalExpressButtons />
                    </div>
                  ) }
                  { id === 'bacs' && (
                    <div className="pt-3 bg-gray-50 rounded-xl p-4 mt-1 text-sm text-gray-700 space-y-1">
                      <p className="font-semibold text-gray-900">Bank Transfer Details</p>
                      <p>Account Name: <span className="font-medium">Drywall Toolbox LLC</span></p>
                      <p className="text-xs text-gray-500 mt-1">
                        Your order will be held until payment is confirmed. Details will also
                        be included in your confirmation email.
                      </p>
                    </div>
                  ) }
                </Motion.div>
              ) }
            </AnimatePresence>
          </div>
        );
      } ) }
    </div>
  );
}

// ─── Main Checkout component ──────────────────────────────────────────────────
export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();

  const [formData, setFormData] = useState( {
    firstName:     '',
    lastName:      '',
    email:         '',
    phone:         '',
    address:       '',
    city:          '',
    state:         '',
    zip:           '',
    country:       'US',
    paymentMethod: 'stripe',
    customerNote:  '',
  } );

  const [errors,        setErrors       ] = useState( {} );
  const [processing,    setProcessing   ] = useState( false );
  const [checkoutError, setCheckoutError] = useState( null );
  const [orderComplete, setOrderComplete] = useState( false );
  const [orderDetails,  setOrderDetails ] = useState( null );
  const [step,          setStep         ] = useState( 'form' ); // 'form' | 'syncing' | 'placing'

  // ── Shipping rates ────────────────────────────────────────────────────────
  const [shippingRates,    setShippingRates   ] = useState( [] );
  const [selectedRate,     setSelectedRate    ] = useState( null );   // full rate object
  const [ratesLoading,     setRatesLoading    ] = useState( false );
  const [ratesError,       setRatesError      ] = useState( null );

  // Ref lets fetchShippingRates read the latest selectedRate without being
  // listed as a dependency (adding it would re-create the callback on every
  // user rate selection and cause the effect to re-run, resetting the choice).
  const selectedRateRef = useRef( selectedRate );
  selectedRateRef.current = selectedRate;

  const subtotal = getCartTotal();
  // Show shipping from the selected rate when available, otherwise fall back
  // to a provisional estimate matching the server-side tiered logic.
  const shipping = selectedRate
    ? selectedRate.price
    : ( subtotal >= 500 ? 0 : 25 );
  const tax   = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  // True when all required fields have a non-empty value (used to activate
  // the mobile sticky CTA before full form validation runs on submit).
  const isFormComplete = useMemo( () => (
    formData.firstName.trim() !== '' &&
    formData.lastName.trim()  !== '' &&
    formData.email.trim()     !== '' &&
    formData.phone.trim()     !== '' &&
    formData.address.trim()   !== '' &&
    formData.city.trim()      !== '' &&
    formData.state.trim()     !== '' &&
    formData.zip.trim()       !== ''
  ), [formData] );

  // True when the address fields needed for rate calculation are all filled.
  const isAddressComplete = useMemo( () => (
    formData.address.trim() !== '' &&
    formData.city.trim()    !== '' &&
    formData.state.trim()   !== '' &&
    formData.zip.trim()     !== ''
  ), [formData] );

  /**
   * Fetch shipping rates from the server whenever the shipping address changes.
   * Uses the DTB Veeqo server-side proxy so no API key is exposed in the browser.
   * Stable callback (no deps) — reads selectedRate through a ref to avoid
   * re-creating this function every time the user picks a different rate.
   */
  const fetchShippingRates = useCallback( async ( data, items ) => {
    if ( ! data.address || ! data.city || ! data.state || ! data.zip ) return;

    setRatesLoading( true );
    setRatesError( null );

    try {
      const destination = {
        address: data.address,
        city:    data.city,
        state:   data.state,
        zip:     data.zip,
        country: data.country || 'US',
      };
      const lineItems = items.map( ( item ) => ( {
        id:       item.id,
        sku:      item.sku  || '',
        name:     item.name || '',
        quantity: item.quantity,
        price:    item.price || 0,
        weight:   item.weight || 0.5,
        category: 'product',
      } ) );

      const rates = await veeqoService.getShippingRates( destination, lineItems );
      setShippingRates( rates );

      // Auto-select the first (cheapest) rate when none has been chosen yet.
      if ( rates.length > 0 && ! selectedRateRef.current ) {
        setSelectedRate( rates[0] );
      }
    } catch ( err ) {
      setRatesError( 'Could not load shipping options. Rates will be calculated at checkout.' );
      console.warn( 'Shipping rate fetch failed:', err.message );
    } finally {
      setRatesLoading( false );
    }
  }, [] ); // Stable — reads selectedRate via ref; all setters are stable too.

  // Re-fetch rates whenever the shipping address or cart contents change.
  useEffect( () => {
    if ( isAddressComplete ) {
      fetchShippingRates( formData, cartItems );
    }
  }, [ formData.address, formData.city, formData.state, formData.zip, formData.country, fetchShippingRates, cartItems ] ); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ formData is destructured so only address fields trigger (not every keystroke).
  //   cartItems identity changes on quantity updates which is intentional — different
  //   weights need fresh rates.

  const sanitize = ( v ) => DOMPurify.sanitize( v, { ALLOWED_TAGS: [] } );

  const handleInputChange = ( e ) => {
    const { name, value } = e.target;
    setFormData( ( prev ) => ( { ...prev, [name]: sanitize( value ) } ) );
    if ( errors[name] ) setErrors( ( prev ) => ( { ...prev, [name]: '' } ) );
  };

  const validateForm = () => {
    const e = {};
    if ( ! formData.firstName.trim() ) e.firstName = 'Required';
    if ( ! formData.lastName.trim()  ) e.lastName  = 'Required';
    if ( ! formData.email.trim() ) {
      e.email = 'Required';
    } else if ( ! /\S+@\S+\.\S+/.test( formData.email ) ) {
      e.email = 'Invalid email';
    }
    if ( ! formData.phone.trim()   ) e.phone   = 'Required';
    if ( ! formData.address.trim() ) e.address = 'Required';
    if ( ! formData.city.trim()    ) e.city    = 'Required';
    if ( ! formData.state.trim()   ) e.state   = 'Required';
    if ( ! formData.zip.trim()     ) e.zip     = 'Required';
    setErrors( e );
    return Object.keys( e ).length === 0;
  };

  const handleSubmit = async ( e ) => {
    e.preventDefault();
    if ( ! validateForm() ) return;

    setProcessing( true );
    setCheckoutError( null );

    const billingAddress = {
      first_name: formData.firstName,
      last_name:  formData.lastName,
      address_1:  formData.address,
      address_2:  '',
      city:       formData.city,
      state:      formData.state,
      postcode:   formData.zip,
      country:    formData.country,
      email:      formData.email,
      phone:      formData.phone,
    };

    try {
      // ── Step 1: Sync CartContext → WC Store API cart, apply shipping rate,
      //            then submit checkout. Veeqo order sync happens server-side
      //            via the woocommerce_store_api_checkout_order_processed hook
      //            in dtb-veeqo.php — no separate client-side call needed.
      setStep( 'syncing' );

      // Map the selected rate ID to the WC shipping method rate ID.
      // DTB_Veeqo_Shipping_Method registers rates as 'dtb_veeqo_rates:{key}'.
      const wcRateId = selectedRate
        ? `dtb_veeqo_rates:${ selectedRate.id }`
        : '';

      const wcOrder = await syncAndPlace(
        cartItems,
        billingAddress,
        billingAddress,          // use billing as shipping (user can update in WP later)
        formData.paymentMethod,
        [],                      // payment_data — extend here for Stripe/PayPal tokens
        formData.customerNote,
        wcRateId,                // selected shipping rate ID
      );

      setStep( 'placing' );
      setOrderDetails( { wooCommerce: wcOrder } );
      setOrderComplete( true );
      clearCart();

    } catch ( err ) {
      setCheckoutError( err.message || 'Checkout failed. Please try again.' );
    } finally {
      setProcessing( false );
      setStep( 'form' );
    }
  };

  // ── Input / label class helpers ───────────────────────────────────────────
  const inputClass = ( field ) =>
    `w-full px-4 py-3 rounded-xl border text-sm transition-all min-h-[44px]
     focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500
     ${ errors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white hover:border-gray-300' }`;

  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5';
  const requiredMark = <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;

  // ── Empty cart guard ──────────────────────────────────────────────────────
  if ( cartItems.length === 0 && ! orderComplete ) {
    return (
      <Motion.div
        initial={ { opacity: 0, y: 20 } }
        animate={ { opacity: 1, y: 0 } }
        transition={ { duration: 0.4 } }
        className="min-h-screen bg-gray-50/60 flex items-center justify-center py-16"
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-lg mx-4">
          <ShoppingCart className="h-20 w-20 mx-auto mb-6 text-gray-200" strokeWidth={ 1.5 } />
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Your Cart is Empty</h2>
          <p className="text-gray-500 mb-8">Add some products to your cart before checking out.</p>
          <button
            onClick={ () => navigate( '/products' ) }
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700
                       active:scale-95 text-white px-8 py-3.5 rounded-xl font-semibold
                       transition-all min-h-12"
          >
            Continue Shopping
          </button>
        </div>
      </Motion.div>
    );
  }

  // ── Order confirmation ────────────────────────────────────────────────────
  if ( orderComplete && orderDetails ) {
    const wcOrder = orderDetails.wooCommerce;
    return (
      <Motion.div
        initial={ { opacity: 0, scale: 0.97 } }
        animate={ { opacity: 1, scale: 1 } }
        transition={ { duration: 0.45 } }
        className="min-h-screen bg-gray-50/60 flex items-center justify-center py-16"
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10
                        text-center max-w-lg mx-4 w-full">
          <Motion.div
            initial={ { scale: 0 } }
            animate={ { scale: 1 } }
            transition={ { type: 'spring', stiffness: 260, damping: 20, delay: 0.1 } }
          >
            <CheckCircle className="h-20 w-20 mx-auto mb-6 text-emerald-500" strokeWidth={ 1.5 } />
          </Motion.div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Order Placed!</h2>
          <p className="text-gray-500 mb-8 text-sm">
            Thank you! A confirmation email will be sent to{ ' ' }
            <strong className="text-gray-800">{ formData.email }</strong>.
          </p>

          { wcOrder && (
            <div className="bg-gray-50 rounded-xl p-5 mb-8 text-left space-y-2 text-sm">
              <p className="font-semibold text-gray-900 mb-2">Order Details</p>
              <div className="flex justify-between">
                <span className="text-gray-500">Order #</span>
                <span className="font-semibold text-gray-900">#{ wcOrder.order_id }</span>
              </div>
              { wcOrder.status && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="font-semibold capitalize text-gray-900">{ wcOrder.status }</span>
                </div>
              ) }
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-primary-600 tabular-nums">${ total.toFixed( 2 ) }</span>
              </div>
              { orderDetails.veeqo && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fulfilment #</span>
                  <span className="font-semibold text-gray-900">#{ orderDetails.veeqo.id }</span>
                </div>
              ) }            </div>
          ) }

          <div className="flex gap-3 justify-center flex-wrap">
            { wcOrder?.order_id && (
              <Link
                to={ `/order/${ wcOrder.order_id }` }
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700
                           active:scale-95 text-white px-6 py-3 rounded-xl font-semibold
                           text-sm transition-all min-h-12"
              >
                View Order Status
              </Link>
            ) }
            <button
              onClick={ () => navigate( '/products' ) }
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-700
                         hover:bg-gray-50 active:scale-95 px-6 py-3 rounded-xl font-semibold
                         text-sm transition-all min-h-12"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </Motion.div>
    );
  }

  // ── Processing overlay ────────────────────────────────────────────────────
  if ( processing ) {
    return (
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center">
        <BreathingLoader
          label={ step === 'syncing' ? 'Syncing your cart…' : 'Placing your order…' }
        />
      </div>
    );
  }

  // ── Checkout form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/60 pb-28 md:pb-12 page-wrapper">
      <SEOHead noindex title="Checkout" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">

        {/* Page heading */}
        <Motion.div
          initial={ { opacity: 0, y: -12 } }
          animate={ { opacity: 1, y: 0 } }
          transition={ { duration: 0.4 } }
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-1">
            Checkout
          </h1>
          <p className="text-gray-500 text-sm flex items-center gap-1.5">
            <Lock size={ 13 } />
            256-bit SSL encrypted checkout
          </p>
        </Motion.div>

        <form id="checkout-form" onSubmit={ handleSubmit } noValidate>
          <div className="grid lg:grid-cols-[1fr_380px] gap-6">

            {/* ── Left column: form steps ─────────────────────────────────── */}
            <div className="space-y-5">

              {/* Express checkout section */}
              <StepCard delay={ 0 } className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Express Checkout
                </p>
                <PayPalExpressButtons />
                <div className="relative flex items-center mt-5 mb-1">
                  <div className="grow border-t border-gray-100" />
                  <span className="mx-3 text-xs text-gray-400 shrink-0">or continue below</span>
                  <div className="grow border-t border-gray-100" />
                </div>
              </StepCard>

              {/* Contact Information */}
              <StepCard delay={ 0.05 } className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-5">
                  <User size={ 17 } className="text-primary-500" />
                  Contact Information
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  { [
                    { name: 'firstName', label: 'First Name',    type: 'text',  autoComplete: 'given-name'  },
                    { name: 'lastName',  label: 'Last Name',     type: 'text',  autoComplete: 'family-name' },
                    { name: 'email',     label: 'Email Address', type: 'email', autoComplete: 'email'       },
                    { name: 'phone',     label: 'Phone',         type: 'tel',   autoComplete: 'tel',         inputMode: 'numeric' },
                  ].map( ( { name, label, type, autoComplete, inputMode } ) => (
                    <div key={ name }>
                      <label htmlFor={ `field-${ name }` } className={ labelClass }>
                        { label }{ requiredMark }
                      </label>
                      <input
                        id={ `field-${ name }` }
                        type={ type }
                        name={ name }
                        value={ formData[name] }
                        onChange={ handleInputChange }
                        autoComplete={ autoComplete }
                        { ...( inputMode ? { inputMode } : {} ) }
                        className={ inputClass( name ) }
                        aria-invalid={ !! errors[name] }
                        aria-describedby={ errors[name] ? `err-${ name }` : undefined }
                      />
                      { errors[name] && (
                        <p id={ `err-${ name }` } className="text-red-500 text-xs mt-1" role="alert">
                          { errors[name] }
                        </p>
                      ) }
                    </div>
                  ) ) }
                </div>
              </StepCard>

              {/* Shipping Address */}
              <StepCard delay={ 0.1 } className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-5">
                  <Truck size={ 17 } className="text-primary-500" />
                  Shipping Address
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="field-address" className={ labelClass }>
                      Street Address{ requiredMark }
                    </label>
                    <input
                      id="field-address"
                      type="text"
                      name="address"
                      value={ formData.address }
                      onChange={ handleInputChange }
                      autoComplete="street-address"
                      className={ inputClass( 'address' ) }
                      aria-invalid={ !! errors.address }
                    />
                    { errors.address && (
                      <p className="text-red-500 text-xs mt-1" role="alert">{ errors.address }</p>
                    ) }
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    { [
                      { name: 'city',  label: 'City',     autoComplete: 'address-level2' },
                      { name: 'state', label: 'State',    autoComplete: 'address-level1' },
                      { name: 'zip',   label: 'ZIP Code', autoComplete: 'postal-code',    inputMode: 'numeric' },
                    ].map( ( { name, label, autoComplete, inputMode } ) => (
                      <div key={ name }>
                        <label htmlFor={ `field-${ name }` } className={ labelClass }>
                          { label }{ requiredMark }
                        </label>
                        <input
                          id={ `field-${ name }` }
                          type="text"
                          name={ name }
                          value={ formData[name] }
                          onChange={ handleInputChange }
                          autoComplete={ autoComplete }
                          { ...( inputMode ? { inputMode } : {} ) }
                          className={ inputClass( name ) }
                          aria-invalid={ !! errors[name] }
                        />
                        { errors[name] && (
                          <p className="text-red-500 text-xs mt-1" role="alert">{ errors[name] }</p>
                        ) }
                      </div>
                    ) ) }
                  </div>

                  { subtotal > 0 && subtotal < 500 && (
                    <p className="text-xs text-primary-600 bg-primary-50 rounded-xl px-4 py-2.5">
                      <span aria-hidden="true">💡</span> Spend{ ' ' }
                      <strong>${ ( 500 - subtotal ).toFixed( 2 ) }</strong> more to unlock free shipping!
                    </p>
                  ) }
                </div>
              </StepCard>

              {/* Shipping Method */}
              <StepCard delay={ 0.12 } className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-5">
                  <Truck size={ 17 } className="text-primary-500" />
                  Shipping Method
                </h2>

                { ratesLoading && (
                  <p className="text-sm text-gray-400 animate-pulse py-2">Loading shipping options…</p>
                ) }

                { ratesError && ! ratesLoading && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertTriangle size={ 13 } className="inline mr-1" />
                    { ratesError }
                  </p>
                ) }

                { ! ratesLoading && shippingRates.length === 0 && ! ratesError && (
                  <p className="text-xs text-gray-400">
                    Enter your shipping address above to see available rates.
                  </p>
                ) }

                { ! ratesLoading && shippingRates.length > 0 && (
                  <div className="space-y-2" role="radiogroup" aria-label="Shipping method">
                    { shippingRates.map( ( rate ) => (
                      <label
                        key={ rate.id }
                        className={ `flex items-center justify-between gap-3 px-4 py-3 rounded-xl border
                                     cursor-pointer transition-all
                                     ${ selectedRate?.id === rate.id
                                         ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-500/30'
                                         : 'border-gray-200 hover:border-gray-300' }` }
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shippingRate"
                            value={ rate.id }
                            checked={ selectedRate?.id === rate.id }
                            onChange={ () => setSelectedRate( rate ) }
                            className="accent-primary-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{ rate.name }</p>
                            { rate.eta && (
                              <p className="text-xs text-gray-500">{ rate.eta }</p>
                            ) }
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                          { rate.price === 0 ? 'Free' : `$${ rate.price.toFixed( 2 ) }` }
                        </span>
                      </label>
                    ) ) }
                  </div>
                ) }
              </StepCard>

              {/* Payment Method */}
              <StepCard delay={ 0.15 } className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-5">
                  <CreditCard size={ 17 } className="text-primary-500" />
                  Payment Method
                </h2>
                <PaymentMethodSelector
                  selectedMethod={ formData.paymentMethod }
                  onChange={ handleInputChange }
                  inputClass={ inputClass }
                />

                {/* Order note */}
                <div className="mt-5">
                  <label htmlFor="field-customerNote" className={ labelClass }>
                    Order Note{ ' ' }
                    <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="field-customerNote"
                    name="customerNote"
                    value={ formData.customerNote }
                    onChange={ handleInputChange }
                    rows={ 2 }
                    placeholder="Special instructions for your order…"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white
                               text-sm resize-none min-h-11
                               focus:outline-none focus:ring-2 focus:ring-primary-500/30
                               focus:border-primary-500 transition-all hover:border-gray-300"
                  />
                </div>
              </StepCard>

              {/* Checkout error */}
              <AnimatePresence>
                { checkoutError && (
                  <Motion.div
                    initial={ { opacity: 0, y: -8 } }
                    animate={ { opacity: 1, y: 0 } }
                    exit={ { opacity: 0, y: -8 } }
                    className="bg-red-50 border border-red-200 rounded-xl p-4"
                    role="alert"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{ checkoutError }</p>
                    </div>
                  </Motion.div>
                ) }
              </AnimatePresence>

              {/* Desktop submit button */}
              <div className="hidden md:block">
                <button
                  type="submit"
                  disabled={ processing }
                  className="w-full inline-flex items-center justify-center gap-2.5
                             bg-primary-600 hover:bg-primary-700 active:scale-[0.99]
                             text-white px-6 py-4 rounded-xl font-bold text-base
                             tracking-wide transition-all shadow-md hover:shadow-lg
                             disabled:opacity-50 disabled:cursor-not-allowed min-h-13"
                >
                  <Lock size={ 17 } />
                  Complete Purchase — ${ total.toFixed( 2 ) }
                </button>
                <p className="text-[11px] text-gray-400 text-center mt-3">
                  By placing your order you agree to our terms and conditions.
                </p>
              </div>
            </div>

            {/* ── Right column: sticky order summary ─────────────────────── */}
            <div className="hidden lg:block">
              <OrderSummaryPanel
                cartItems={ cartItems }
                subtotal={ subtotal }
                shipping={ shipping }
                tax={ tax }
                total={ total }
                loading={ processing }
              />
            </div>
          </div>
        </form>
      </div>

      {/* ── Mobile sticky CTA bar ─────────────────────────────────────────────
          Visible only on mobile (< md breakpoint), docked to the viewport
          bottom. The "Complete Purchase" button is enabled only once all
          required fields contain a non-empty value (isFormComplete). Full
          validation still runs on submit to surface individual field errors. */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40
                   bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3 shadow-xl"
      >
        <div className="flex justify-between items-center text-xs text-gray-500 mb-2.5 px-0.5">
          <span>{ cartItems.length } item{ cartItems.length !== 1 ? 's' : '' }</span>
          <span className="font-bold text-gray-900 tabular-nums text-sm">
            ${ total.toFixed( 2 ) }
          </span>
        </div>
        <button
          type="submit"
          form="checkout-form"
          disabled={ processing || ! isFormComplete }
          className="w-full inline-flex items-center justify-center gap-2
                     bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-xl
                     font-bold text-sm tracking-wide transition-all shadow-md
                     active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed
                     min-h-12"
        >
          <Lock size={ 16 } />
          { isFormComplete
            ? `Complete Purchase — $${ total.toFixed( 2 ) }`
            : 'Fill in required fields' }
        </button>
      </div>
    </div>
  );
}
