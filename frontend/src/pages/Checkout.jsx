/**
 * frontend/src/pages/Checkout.jsx
 *
 * Production-ready headless WooCommerce checkout with Stripe SDK integration.
 *   - Stripe PaymentElement + ExpressCheckoutElement via StripePaymentBlock
 *   - Responsive two-column layout with mobile summary + sticky CTA
 *   - Framer Motion step-enter animations + AnimatePresence
 *   - Existing business logic preserved: syncAndPlace(), DOMPurify, Veeqo
 *   - PaymentIntent architecture ready for Stripe account activation
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Truck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ShoppingCart,
  User,
} from 'lucide-react';
import DOMPurify from 'dompurify';

import { useCart } from '../context/CartContext';
import { syncAndPlace } from '../api/cart.js';
import veeqoService from '../services/veeqo';
import SEOHead from '../components/shared/SEOHead';
import { useAuthContext } from '../auth/AuthContext.js';
import { FREE_SHIP_THRESHOLD, ESTIMATED_SHIP_RATE } from '../constants/shipping';
import {
  getUserPoints,
  redeemPoints,
  pointsToUsd,
  POINTS_MIN_REDEEM,
  POINTS_MAX_REDEEM,
  POINTS_REDEEM_STEP,
} from '../api/rewards.js';
import StripePaymentBlock from '../components/checkout/StripePaymentBlock.jsx';

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
      className={ `bg-white/95 rounded-[1.35rem] border border-slate-200/80 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur ${ className }` }
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
function OrderSummaryPanel( { cartItems, subtotal, shipping, tax, total, loading, className = '' } ) {
  return (
    <StepCard delay={ 0.15 } className={ `overflow-hidden ${ className }` }>
      <div className="bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200">
              Secure Total
            </p>
            <h2 className="text-lg font-bold tracking-tight">Order Summary</h2>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold tabular-nums">
            ${ total.toFixed( 2 ) }
          </div>
        </div>
      </div>

      <div className="space-y-3.5 px-5 py-5 max-h-64 overflow-y-auto">
        <AnimatePresence>
          { loading
            ? [0, 1, 2].map( ( i ) => <SkeletonRow key={ i } /> )
            : cartItems.map( ( item ) => (
                <Motion.div
                  key={ item.id }
                  initial={ { opacity: 0 } }
                  animate={ { opacity: 1 } }
                  exit={ { opacity: 0 } }
                  className="flex justify-between gap-4 text-sm"
                >
                  <div className="grow mr-3 min-w-0">
                    <p className="font-semibold text-slate-950 truncate leading-snug">{ item.name }</p>
                    <p className="text-slate-400 text-xs mt-0.5">Qty { item.quantity }</p>
                  </div>
                  <p className="font-bold text-slate-950 shrink-0 tabular-nums">
                    ${ ( item.price * item.quantity ).toFixed( 2 ) }
                  </p>
                </Motion.div>
              ) )
          }
        </AnimatePresence>
      </div>

      <div className="mx-5 border-t border-slate-100 py-4 space-y-2.5 text-sm text-slate-500">
        { [
          { label: 'Subtotal', value: `$${ subtotal.toFixed( 2 ) }` },
          {
            label: 'Shipping',
            value: shipping === 0
              ? <span className="text-emerald-600 font-bold">Free</span>
              : `$${ shipping.toFixed( 2 ) }`,
          },
          { label: 'Tax (8%)', value: `$${ tax.toFixed( 2 ) }` },
        ].map( ( { label, value } ) => (
          <div key={ label } className="flex justify-between">
            <span>{ label }</span>
            <span className="font-semibold text-slate-950 tabular-nums">{ value }</span>
          </div>
        ) ) }
      </div>

      <div className="mx-5 border-t border-slate-200 py-5">
        <div className="flex justify-between items-baseline">
          <span className="text-base font-bold text-slate-950">Total</span>
          <span className="text-2xl font-black text-primary-600 tabular-nums">
            ${ total.toFixed( 2 ) }
          </span>
        </div>
        { shipping === 0 && (
          <p className="text-xs text-emerald-600 mt-1.5 text-right font-semibold">
            Free shipping unlocked
          </p>
        ) }
      </div>
    </StepCard>
  );
}

// ─── Main Checkout component ──────────────────────────────────────────────────
export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuthContext();

  const [formData, setFormData] = useState( {
    firstName:    '',
    lastName:     '',
    email:        '',
    phone:        '',
    address:      '',
    city:         '',
    state:        '',
    zip:          '',
    country:      'US',
    customerNote: '',
  } );

  const [errors,        setErrors       ] = useState( {} );
  const [processing,    setProcessing   ] = useState( false );
  const [checkoutError, setCheckoutError] = useState( null );
  const [orderComplete, setOrderComplete] = useState( false );
  const [orderDetails,  setOrderDetails ] = useState( null );
  const [step,          setStep         ] = useState( 'form' ); // 'form' | 'syncing' | 'placing'

  // ── Stripe PaymentIntent client_secret ────────────────────────────────────
  // Set when the PaymentIntent is created on checkout entry.
  // TODO: Activate this effect once the Stripe account and server endpoint are ready.
  // The WP endpoint should POST to Stripe's PaymentIntents API and return { client_secret }.
  const [clientSecret, setClientSecret] = useState( null );

  // Silence the unused-setter warning until the backend endpoint is wired.
  // Remove this line and uncomment the useEffect below when Stripe is live.
  void setClientSecret;

  // Ref to capture the WC order created during the Stripe onCreateSession callback
  // so it is available in handlePaymentSuccess without needing a state round-trip.
  const wcOrderRef = useRef( null );

  // ── Points redemption ─────────────────────────────────────────────────────
  const [pointsBalance,   setPointsBalance  ] = useState( null );   // raw balance from API
  const [pointsToRedeem,  setPointsToRedeem ] = useState( 0 );      // chosen by slider
  const [appliedCoupon,   setAppliedCoupon  ] = useState( null );   // { code, discount_amount }
  const [applyingPoints,  setApplyingPoints ] = useState( false );
  const [pointsError,     setPointsError    ] = useState( '' );

  // Fetch points balance once we have an authenticated user.
  useEffect( () => {
    if ( isAuthenticated && user?.id ) {
      getUserPoints( user.id )
        .then( ( data ) => {
          setPointsBalance( data );
          // Snap slider to max allowed or min (whichever is appropriate).
          if ( data.points >= POINTS_MIN_REDEEM ) {
            const maxSnapped = Math.min(
              Math.floor( data.points / POINTS_REDEEM_STEP ) * POINTS_REDEEM_STEP,
              POINTS_MAX_REDEEM,
            );
            setPointsToRedeem( maxSnapped );
          }
        } )
        .catch( () => {} );
    }
  }, [ isAuthenticated, user?.id ] );

  const pointsUsd         = pointsToUsd( pointsToRedeem );
  const availablePts      = pointsBalance?.points ?? 0;
  const roundedMax        = Math.min(
    Math.floor( availablePts / POINTS_REDEEM_STEP ) * POINTS_REDEEM_STEP,
    POINTS_MAX_REDEEM,
  );

  async function handleApplyPoints() {
    if ( ! user?.id || pointsToRedeem < POINTS_MIN_REDEEM ) return;
    setPointsError( '' );
    setApplyingPoints( true );
    try {
      const result = await redeemPoints( user.id, pointsToRedeem );
      setAppliedCoupon( { code: result.coupon_code, discount_amount: result.discount_amount } );
      setPointsBalance( ( prev ) => prev ? { ...prev, points: result.new_balance } : prev );
    } catch ( err ) {
      setPointsError( err.message || 'Could not apply points. Please try again.' );
    } finally {
      setApplyingPoints( false );
    }
  }

  function handleRemovePoints() {
    setAppliedCoupon( null );
    setPointsError( '' );
  }

  // ── Shipping rates ─────────────────────────────────────────────────────────
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
    : ( subtotal >= FREE_SHIP_THRESHOLD ? 0 : ESTIMATED_SHIP_RATE );
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

  /**
   * Called by StripePaymentBlock before the Stripe SDK confirms payment.
   * Validates the form and syncs the cart + billing info to WooCommerce.
   * The resulting WC order is captured in wcOrderRef for use after payment success.
   *
   * Dependency note: validateForm reads formData from closure; since formData is
   * already in the dep array, recreating handleCreateSession when formData changes
   * is correct and sufficient. useState setters (setProcessing, setCheckoutError,
   * setStep) are stable references and do not need to be listed.
   */
  const handleCreateSession = useCallback( async () => {
    if ( ! validateForm() ) {
      // Field-level errors are already surfaced by validateForm() via setErrors().
      // Throw a sentinel so the Stripe flow aborts without showing a duplicate banner.
      throw Object.assign( new Error( 'Form validation failed.' ), { isValidation: true } );
    }

    setProcessing( true );
    setCheckoutError( null );
    setStep( 'syncing' );

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

    // Map the selected Veeqo rate to the WC shipping method rate ID.
    const wcRateId = selectedRate ? `dtb_veeqo_rates:${ selectedRate.id }` : '';

    const wcOrder = await syncAndPlace(
      cartItems,
      billingAddress,
      billingAddress,   // billing used as shipping; customer may update in WP account
      'stripe',
      [],               // payment_data is provided by Stripe SDK after this callback
      formData.customerNote,
      wcRateId,
      appliedCoupon ? [ appliedCoupon.code ] : [],
    );

    wcOrderRef.current = wcOrder;
    setStep( 'placing' );
  }, [ formData, cartItems, selectedRate, appliedCoupon ] ); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Called by StripePaymentBlock after the Stripe SDK confirms payment successfully.
   */
  const handlePaymentSuccess = useCallback( async () => {
    setOrderDetails( { wooCommerce: wcOrderRef.current } );
    setOrderComplete( true );
    clearCart();
    setProcessing( false );
    setStep( 'form' );
  }, [ clearCart ] );

  /**
   * Called by StripePaymentBlock when payment confirmation fails.
   * Validation errors (isValidation=true) are shown as field errors only —
   * no duplicate banner is rendered for them.
   */
  const handlePaymentError = useCallback( ( error ) => {
    if ( ! error?.isValidation ) {
      setCheckoutError( error.message || 'Payment failed. Please try again.' );
    }
    setProcessing( false );
    setStep( 'form' );
  }, [] );

  // ── Input / label class helpers ───────────────────────────────────────────
  const inputClass = ( field ) =>
    `w-full px-4 py-3.5 rounded-2xl border text-sm transition-all min-h-[48px]
     text-slate-950 placeholder:text-slate-400 shadow-sm
     focus:outline-none focus:ring-4 focus:ring-primary-500/15 focus:border-primary-500
     ${ errors[field] ? 'border-red-400 bg-red-50/40' : 'border-slate-200 bg-white hover:border-slate-300' }`;

  const labelClass = 'block text-xs font-bold uppercase tracking-[0.14em] text-slate-500 mb-1.5';
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
    <div className="relative min-h-screen overflow-hidden bg-slate-100 pb-28 md:pb-14 page-wrapper">
      <SEOHead noindex title="Checkout" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] bg-slate-950" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] opacity-90"
        style={ {
          background:
            'radial-gradient(circle at 18% 15%, rgba(59,130,246,0.42), transparent 28%), radial-gradient(circle at 72% 10%, rgba(20,184,166,0.24), transparent 24%), linear-gradient(135deg, #020617 0%, #0f2658 48%, #020617 100%)',
        } }
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">

        {/* Page heading */}
        <Motion.div
          initial={ { opacity: 0, y: -12 } }
          animate={ { opacity: 1, y: 0 } }
          transition={ { duration: 0.4 } }
          className="mb-6 md:mb-8 text-white"
        >
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
            <Lock size={ 13 } />
            Secure checkout
          </p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Complete your order
          </h1>
        </Motion.div>

        <div className="lg:hidden mb-5">
          <OrderSummaryPanel
            cartItems={ cartItems }
            subtotal={ subtotal }
            shipping={ shipping }
            tax={ tax }
            total={ total }
            loading={ processing }
          />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_410px] gap-6 xl:gap-8">

          {/* ── Left column: form steps ─────────────────────────────────── */}
          <div className="space-y-5">

            {/* Contact Information */}
            <StepCard delay={ 0 } className="p-6">
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
            <StepCard delay={ 0.05 } className="p-6">
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

                <div className="grid sm:grid-cols-3 gap-3">
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

                { subtotal > 0 && subtotal < FREE_SHIP_THRESHOLD && (
                  <p className="text-xs text-primary-600 bg-primary-50 rounded-xl px-4 py-2.5">
                    <span aria-hidden="true">💡</span> Spend{ ' ' }
                    <strong>${ ( FREE_SHIP_THRESHOLD - subtotal ).toFixed( 2 ) }</strong> more to unlock free shipping!
                  </p>
                ) }
              </div>
            </StepCard>

            {/* Shipping Method */}
            <StepCard delay={ 0.1 } className="p-6">
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

            {/* ── Points redemption panel (authenticated users only) ── */}
            { isAuthenticated && pointsBalance && pointsBalance.points >= POINTS_MIN_REDEEM && (
              <StepCard delay={ 0.15 } className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>⭐</span> Redeem Points
                  </h3>
                  <span className="text-xs text-gray-500">
                    Balance: { pointsBalance.points } pts (${pointsToUsd(pointsBalance.points).toFixed(2)})
                  </span>
                </div>

                { appliedCoupon ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-green-800">
                        ✓ ${ appliedCoupon.discount_amount.toFixed( 2 ) } discount applied
                      </p>
                      <code className="text-xs text-green-700 font-mono">{ appliedCoupon.code }</code>
                    </div>
                    <button
                      type="button"
                      onClick={ handleRemovePoints }
                      className="text-xs text-red-600 hover:text-red-800 font-semibold ml-3"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="block text-xs text-gray-500 mb-2">
                      Redeem&nbsp;
                      <strong className="text-gray-800">{ pointsToRedeem } pts</strong>
                      &nbsp;=&nbsp;
                      <strong className="text-emerald-700">${ pointsUsd.toFixed( 2 ) } off</strong>
                    </label>
                    <input
                      type="range"
                      min={ POINTS_MIN_REDEEM }
                      max={ roundedMax || POINTS_MIN_REDEEM }
                      step={ POINTS_REDEEM_STEP }
                      value={ pointsToRedeem }
                      onChange={ ( e ) => setPointsToRedeem( Number( e.target.value ) ) }
                      className="w-full mb-3 accent-primary-600"
                    />
                    { pointsError && <p className="text-xs text-red-600 mb-2">{ pointsError }</p> }
                    <button
                      type="button"
                      onClick={ handleApplyPoints }
                      disabled={ applyingPoints || pointsToRedeem < POINTS_MIN_REDEEM }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      { applyingPoints ? 'Applying…' : `Apply ${ pointsToRedeem } pts` }
                    </button>
                  </>
                ) }
              </StepCard>
            ) }

            {/* Order note */}
            <StepCard delay={ 0.18 } className="p-5">
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
            </StepCard>

            {/* ── Stripe payment section ──────────────────────────────────── */}
            <StepCard delay={ 0.2 } className="p-6" id="payment-section">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Payment
              </p>
              <StripePaymentBlock
                clientSecret={ clientSecret }
                email={ formData.email }
                disabled={ processing }
                onCreateSession={ handleCreateSession }
                onPaymentSuccess={ handlePaymentSuccess }
                onPaymentError={ handlePaymentError }
              />
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
              className="sticky top-24"
            />
          </div>
        </div>
      </div>

      {/* ── Mobile sticky summary bar ─────────────────────────────────────────
          Visible only on mobile (< md breakpoint), docked to the viewport
          bottom. Shows cart total and scrolls to the payment section.         */}
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
        <a
          href="#payment-section"
          className="w-full inline-flex items-center justify-center gap-2
                     bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-xl
                     font-bold text-sm tracking-wide transition-all shadow-md
                     active:scale-[0.99] min-h-12"
        >
          <Lock size={ 16 } />
          { isFormComplete ? 'Continue to Payment' : 'Fill in required fields' }
        </a>
      </div>
    </div>
  );
}
