/**
 * frontend/src/pages/Checkout.jsx
 *
 * Modernized headless WooCommerce checkout.
 *   - Split two-column desktop layout: form left, sticky dark summary right
 *   - Step progress indicator (Contact/Shipping → Payment → Review)
 *   - Framer Motion step-enter animations + AnimatePresence
 *   - All business logic preserved: syncAndPlace(), DOMPurify, Veeqo
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
  CreditCard,
  PackageCheck,
  ClipboardCheck,
  ShoppingBag,
  MapPin,
  Tag,
  ChevronRight,
  Star,
} from 'lucide-react';
import DOMPurify from 'dompurify';

import { useCart } from '../context/CartContext';
import { useWorkflowTransition } from '../context/WorkflowTransitionContext.jsx';
import { syncAndPlace } from '../api/cart.js';
import { getCheckoutCapabilities } from '../api/checkout.js';
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
import { isRewardsEnabled } from '../utils/featureFlags.js';

// ─── Framer Motion shared variants ────────────────────────────────────────────
const cardVariants = {
  hidden:  { opacity: 0, y: 16, willChange: 'transform, opacity' },
  visible: (delay) => ({
    opacity: 1,
    y: 0,
    willChange: 'auto',
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: delay ?? 0 },
  }),
};

// ─── Shared money helper (used by all sub-components) ─────────────────────────
const toMoneyValue = ( v ) => { const n = Number( v ); return Number.isFinite( n ) ? n : 0; };

const MANUAL_PAYMENT_METHOD_IDS = new Set( [ 'cod', 'bacs', 'cheque' ] );

function isManualPaymentMethod( method ) {
  const methodId = typeof method === 'string' ? method : method?.id;
  if ( ! methodId ) return false;
  return Boolean( method?.is_manual ) || MANUAL_PAYMENT_METHOD_IDS.has( String( methodId ).toLowerCase() );
}

function resolvePreferredPaymentMethod( methods = [] ) {
  if ( ! Array.isArray( methods ) || methods.length === 0 ) return '';
  const online = methods.find( ( method ) => ! isManualPaymentMethod( method ) );
  return ( online?.id || methods[0]?.id || '' );
}

// BNPL gateway identifier keywords — update when adding new providers.
const BNPL_KEYWORDS = ['klarna', 'affirm', 'afterpay', 'bnpl', 'pay_later'];
// Card gateway identifier keywords.
const CARD_KEYWORDS = ['stripe', 'square', 'card', 'credit'];

function paymentTabForMethod( methodId = '' ) {
  const m = String( methodId ).toLowerCase();
  if ( m.includes( 'paypal' ) ) return 'paypal';
  if ( BNPL_KEYWORDS.some( ( kw ) => m.includes( kw ) ) ) return 'bnpl';
  if ( CARD_KEYWORDS.some( ( kw ) => m.includes( kw ) ) ) return 'card';
  return 'other';
}

function resolveCartItemImage( item ) {
  if ( !item || typeof item !== 'object' ) return '';
  return (
    item.image
    || item.image_src
    || item.thumbnail
    || item.image_url
    || item.product?.image
    || item.product?.image_src
    || item.product?.thumbnail
    || item.images?.[0]?.src
    || item.images?.[0]
    || ''
  );
}

// ─── Payment brand icon helpers ───────────────────────────────────────────────
const GOOGLE_BRAND_BLUE = '#4285F4';

function ApplePayMark( { className = '' } ) {
  return (
    <svg className={ className } viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.22.15-2.17 1.28-2.14 3.8.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function GooglePayMark() {
  return (
    <span
      aria-hidden="true"
      style={ {
        background: GOOGLE_BRAND_BLUE,
        color: '#fff',
        borderRadius: '50%',
        width: 18,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
        fontFamily: 'sans-serif',
        flexShrink: 0,
      } }
    >
      G
    </span>
  );
}

// ─── StepProgress ─────────────────────────────────────────────────────────────
// Visual 3-step checkout progress indicator.
const CHECKOUT_STEPS = [
  { id: 'shipping',  label: 'Shipping',  icon: Truck },
  { id: 'payment',   label: 'Payment',   icon: CreditCard },
  { id: 'review',    label: 'Review',    icon: ClipboardCheck },
];

function StepProgress( { activeStep = 'shipping' } ) {
  const activeIdx = CHECKOUT_STEPS.findIndex( ( s ) => s.id === activeStep );
  return (
    <div className="flex items-center gap-0 mb-7 md:mb-8" aria-label="Checkout steps">
      { CHECKOUT_STEPS.map( ( step, idx ) => {
        const done    = idx < activeIdx;
        const current = idx === activeIdx;
        const Icon    = step.icon;
        return (
          <div key={ step.id } className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1.5">
              <div
                className={ `flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300
                  ${ done    ? 'border-primary-600 bg-primary-600 text-white'
                  : current ? 'border-primary-600 bg-white text-primary-600'
                  : 'border-slate-200 bg-white text-slate-400' }` }
              >
                { done
                  ? <CheckCircle size={ 14 } strokeWidth={ 2.5 } />
                  : <Icon size={ 12 } strokeWidth={ 2 } />
                }
              </div>
              <span
                className={ `text-xs font-semibold hidden sm:block transition-colors duration-200
                  ${ current ? 'text-slate-900' : done ? 'text-primary-600' : 'text-slate-400' }` }
              >
                { step.label }
              </span>
            </div>
            { idx < CHECKOUT_STEPS.length - 1 && (
              <div className="flex-1 mx-2">
                <div className="h-px bg-slate-200 relative overflow-hidden rounded-full">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary-600 transition-all duration-500"
                    style={ { width: done ? '100%' : '0%' } }
                  />
                </div>
              </div>
            ) }
          </div>
        );
      } ) }
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
      className={ `bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_16px_rgba(15,23,42,0.06)] ${ className }` }
    >
      { children }
    </Motion.div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader( { icon: Icon, title, action } ) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Icon size={ 15 } strokeWidth={ 2 } />
        </span>
        <h2 className="text-[0.95rem] font-bold text-slate-900 tracking-tight">{ title }</h2>
      </div>
      { action }
    </div>
  );
}

// ─── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex justify-between items-start animate-pulse">
      <div className="flex items-start gap-3 flex-1 mr-4">
        <div className="h-10 w-10 rounded-xl bg-white/10 shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <div className="h-3 bg-white/15 rounded w-3/4" />
          <div className="h-2.5 bg-white/10 rounded w-1/4" />
        </div>
      </div>
      <div className="h-3.5 bg-white/15 rounded w-14 shrink-0 mt-0.5" />
    </div>
  );
}

// ─── DesktopSummaryPanel ──────────────────────────────────────────────────────
// Sticky right-column branded navy panel: order items + totals + CTA.
function DesktopSummaryPanel( {
  cartItems,
  subtotal,
  shipping,
  tax,
  total,
  couponInput,
  setCouponInput,
  addManualCoupon,
  manualCoupons,
  removeManualCoupon,
  processing,
  canSubmit,
  onPlaceOrder,
} ) {
  const totalQty = cartItems.reduce( ( sum, item ) => sum + Number( item.quantity || 0 ), 0 );

  return (
    <aside
      className="dtb-summary-panel hidden lg:flex flex-col sticky top-0 h-screen overflow-hidden"
      style={ { background: 'linear-gradient(170deg, #0d1829 0%, #0a1020 80%)' } }
    >
      {/* Top brand accent stripe */}
      <div className="h-[3px] shrink-0 bg-gradient-to-r from-primary-700 via-primary-500 to-primary-600" />

      {/* Header */}
      <div className="px-7 pt-7 pb-5 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-1.5 mb-4">
          <Lock size={ 9 } className="text-primary-400/80" />
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary-400/80">
            Secure Checkout
          </span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-0.5">
              Order Summary
            </p>
            <h2 className="text-xl font-bold text-white leading-tight">
              { totalQty } item{ totalQty !== 1 ? 's' : '' }
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 mb-0.5">Total</p>
            <span className="text-2xl font-black text-white tabular-nums">${ total.toFixed( 2 ) }</span>
          </div>
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
        <AnimatePresence>
          { processing
            ? [0, 1, 2].map( ( i ) => <SkeletonRow key={ i } /> )
            : cartItems.map( ( item ) => (
                <Motion.div
                  key={ item.cartKey || item.id }
                  initial={ { opacity: 0, x: 10 } }
                  animate={ { opacity: 1, x: 0 } }
                  exit={ { opacity: 0 } }
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors"
                >
                  <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/[0.06]">
                    { resolveCartItemImage( item ) ? (
                      <img
                        src={ resolveCartItemImage( item ) }
                        alt={ item.name || 'Product' }
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20">
                        <ShoppingBag size={ 16 } />
                      </div>
                    ) }
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white shadow-sm">
                      { item.quantity }
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white truncate leading-snug">{ item.name }</p>
                    <p className="text-xs text-slate-500 mt-0.5">Qty { item.quantity }</p>
                  </div>
                  <p className="text-sm font-bold text-slate-200 shrink-0 tabular-nums">
                    ${ ( toMoneyValue( item.price ) * toMoneyValue( item.quantity ) ).toFixed( 2 ) }
                  </p>
                </Motion.div>
              ) )
          }
        </AnimatePresence>
      </div>

      {/* Coupon */}
      <div className="px-6 py-4 border-t border-white/8 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
          Discount Code
        </p>
        <div className="flex gap-2">
          <input
            value={ couponInput }
            onChange={ ( e ) => setCouponInput( e.target.value.toUpperCase() ) }
            placeholder="Enter code"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
          />
          <button
            type="button"
            onClick={ addManualCoupon }
            className="rounded-xl bg-primary-600/20 hover:bg-primary-600/30 border border-primary-500/30 px-4 py-2.5 text-sm font-bold text-primary-300 transition-colors"
          >
            Apply
          </button>
        </div>
        { manualCoupons.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            { manualCoupons.map( ( code ) => (
              <button
                key={ code }
                type="button"
                onClick={ () => removeManualCoupon( code ) }
                className="flex items-center gap-1 rounded-full border border-primary-500/30 bg-primary-500/10 px-2.5 py-1 text-[11px] font-semibold text-primary-300"
              >
                <Tag size={ 9 } /> { code } ×
              </button>
            ) ) }
          </div>
        ) }
      </div>

      {/* Totals */}
      <div className="px-6 pt-4 pb-1 border-t border-white/8 shrink-0 space-y-2.5">
        { [
          { label: 'Subtotal', value: `$${ subtotal.toFixed( 2 ) }` },
          { label: 'Shipping', value: shipping === 0 ? 'Free' : `$${ shipping.toFixed( 2 ) }` },
          { label: 'Tax (8%)', value: `$${ tax.toFixed( 2 ) }` },
        ].map( ( { label, value } ) => (
          <div key={ label } className="flex justify-between text-sm">
            <span className="text-slate-500">{ label }</span>
            <span className={ `font-medium tabular-nums ${ label === 'Shipping' && shipping === 0 ? 'text-emerald-400' : 'text-slate-300' }` }>
              { value }
            </span>
          </div>
        ) ) }
        <div className="flex justify-between items-baseline pt-3 pb-1 border-t border-white/8">
          <span className="text-base font-bold text-white">Total</span>
          <span className="text-2xl font-black text-white tabular-nums">${ total.toFixed( 2 ) }</span>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-7 pt-3 shrink-0">
        {/* Payment icons */}
        <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap">
          { [ ['VISA', '#a0b4f5'], ['MC', '#f87171'], ['AMEX', '#60a5fa'] ].map( ( [ label, color ] ) => (
            <span key={ label } style={ { color } } className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-black">
              { label }
            </span>
          ) ) }
          <span className="rounded border border-white/10 bg-white/[0.06] text-slate-300 px-1.5 py-0.5 text-[9px] font-semibold">
            Apple Pay
          </span>
          <span className="rounded border border-white/10 bg-white/[0.06] text-slate-300 px-1.5 py-0.5 text-[9px] font-semibold">
            G Pay
          </span>
        </div>
        <button
          type="button"
          onClick={ onPlaceOrder }
          disabled={ ! canSubmit }
          className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-primary-600 hover:bg-primary-500 active:scale-[0.99] text-white py-4 text-sm font-bold tracking-wide shadow-[0_4px_20px_rgba(37,99,235,0.30)] transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
        >
          <Lock size={ 14 } strokeWidth={ 2.5 } />
          { processing ? 'Processing…' : 'Place Order & Pay' }
        </button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
          <Lock size={ 10 } />
          <span>256-bit SSL encrypted</span>
        </div>
      </div>
    </aside>
  );
}

// ─── MobileSummaryStrip ───────────────────────────────────────────────────────
// Compact top-of-page summary for mobile (< lg). Collapsible.
function MobileSummaryStrip( { cartItems, subtotal, shipping, tax, total } ) {
  const [open, setOpen] = useState( false );

  return (
    <Motion.div
      variants={ cardVariants }
      initial="hidden"
      animate="visible"
      custom={ 0.05 }
      className="lg:hidden mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={ () => setOpen( ( v ) => !v ) }
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm"
        aria-expanded={ open }
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          <ShoppingCart size={ 15 } className="text-primary-500" />
          { open ? 'Hide order summary' : 'Show order summary' }
          <ChevronRight
            size={ 13 }
            className={ `text-slate-400 transition-transform duration-200 ${ open ? 'rotate-90' : '' }` }
          />
        </span>
        <span className="font-black text-slate-950 tabular-nums">${ total.toFixed( 2 ) }</span>
      </button>

      <AnimatePresence initial={ false }>
        { open && (
          <Motion.div
            initial={ { height: 0, opacity: 0 } }
            animate={ { height: 'auto', opacity: 1 } }
            exit={ { height: 0, opacity: 0 } }
            transition={ { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-4 pt-3.5 pb-1 space-y-3">
              { cartItems.map( ( item ) => (
                <div key={ item.cartKey || item.id } className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                    { resolveCartItemImage( item ) ? (
                      <img src={ resolveCartItemImage( item ) } alt={ item.name } className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300"><ShoppingBag size={ 12 } /></div>
                    ) }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{ item.name }</p>
                    <p className="text-[11px] text-slate-400">Qty { item.quantity }</p>
                  </div>
                  <p className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                    ${ ( toMoneyValue( item.price ) * toMoneyValue( item.quantity ) ).toFixed( 2 ) }
                  </p>
                </div>
              ) ) }
            </div>
            <div className="px-4 py-3.5 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
              { [
                { label: 'Subtotal', value: `$${ subtotal.toFixed( 2 ) }` },
                { label: 'Shipping', value: shipping === 0 ? 'Free' : `$${ shipping.toFixed( 2 ) }` },
                { label: 'Tax (8%)', value: `$${ tax.toFixed( 2 ) }` },
              ].map( ( { label, value } ) => (
                <div key={ label } className="flex justify-between">
                  <span>{ label }</span>
                  <span className={ `font-semibold tabular-nums ${ label === 'Shipping' && shipping === 0 ? 'text-emerald-600' : 'text-slate-800' }` }>{ value }</span>
                </div>
              ) ) }
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 text-sm">Total</span>
                <span className="font-black text-primary-600 tabular-nums text-base">${ total.toFixed( 2 ) }</span>
              </div>
            </div>
          </Motion.div>
        ) }
      </AnimatePresence>
    </Motion.div>
  );
}

// ─── Main Checkout component ──────────────────────────────────────────────────
export default function Checkout() {
  const rewardsEnabled = isRewardsEnabled();
  const toMoney = useCallback( ( value ) => {
    const n = Number( value );
    return Number.isFinite( n ) ? n : 0;
  }, [] );
  const toNumber = useCallback( ( value, fallback = 0 ) => {
    const n = Number( value );
    return Number.isFinite( n ) ? n : fallback;
  }, [] );

  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const safeCartItems = useMemo(
    () => ( Array.isArray( cartItems ) ? cartItems : [] ),
    [ cartItems ],
  );
  const { showWorkflow, hideWorkflow } = useWorkflowTransition();
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
  const [paymentMethod, setPaymentMethod] = useState( '' );
  const [paymentMethods, setPaymentMethods] = useState( [] );
  const [paymentTab, setPaymentTab] = useState( 'card' );
  const [couponInput, setCouponInput] = useState( '' );
  const [manualCoupons, setManualCoupons] = useState( [] );

  // ── Points redemption ─────────────────────────────────────────────────────
  const [pointsBalance,   setPointsBalance  ] = useState( null );   // raw balance from API
  const [pointsToRedeem,  setPointsToRedeem ] = useState( 0 );      // chosen by slider
  const [appliedCoupon,   setAppliedCoupon  ] = useState( null );   // { code, discount_amount }
  const [applyingPoints,  setApplyingPoints ] = useState( false );
  const [pointsError,     setPointsError    ] = useState( '' );

  // Fetch points balance once we have an authenticated user.
  useEffect( () => {
    if ( ! rewardsEnabled ) return;
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
  }, [ isAuthenticated, rewardsEnabled, user?.id ] );

  useEffect( () => {
    let mounted = true;
    getCheckoutCapabilities()
      .then( (caps) => {
        if ( !mounted ) return;
        const defaultGateway = caps?.default_gateway || 'woo_native';
        const gateway = Array.isArray( caps?.gateways )
          ? caps.gateways.find( (g) => g.id === defaultGateway ) || caps.gateways[0]
          : null;
        const methods = Array.isArray( gateway?.payment_methods ) ? gateway.payment_methods : [];
        setPaymentMethods( methods );
        const preferredMethod = resolvePreferredPaymentMethod( methods );
        if ( preferredMethod ) {
          setPaymentMethod( preferredMethod );
          setPaymentTab( paymentTabForMethod( preferredMethod ) );
        }
      } )
      .catch( () => {} );
    return () => { mounted = false; };
  }, [] );

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find( ( method ) => method.id === paymentMethod ) || null,
    [ paymentMethod, paymentMethods ],
  );
  const filteredPaymentMethods = useMemo(
    () => paymentMethods.filter( ( method ) => paymentTabForMethod( method.id ) === paymentTab ),
    [ paymentMethods, paymentTab ],
  );

  useEffect( () => {
    if ( filteredPaymentMethods.length === 0 ) return;
    const existsInTab = filteredPaymentMethods.some( ( method ) => method.id === paymentMethod );
    if ( !existsInTab ) {
      setPaymentMethod( filteredPaymentMethods[0].id );
    }
  }, [ filteredPaymentMethods, paymentMethod ] );

  // Clear the selected payment method when the user switches to the BNPL tab
  // (coming-soon tab has no real methods; clearing ensures checkout stays disabled
  // until the user switches back to a tab with a valid method selected).
  useEffect( () => {
    if ( paymentTab === 'bnpl' ) setPaymentMethod( '' );
  }, [ paymentTab ] );

  const manualPaymentSelected = useMemo(
    () => isManualPaymentMethod( selectedPaymentMethod || paymentMethod ),
    [ paymentMethod, selectedPaymentMethod ],
  );

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

  function addManualCoupon() {
    const normalized = couponInput.trim().toUpperCase();
    if ( !normalized ) return;
    setManualCoupons( ( prev ) => ( prev.includes( normalized ) ? prev : [ ...prev, normalized ] ) );
    setCouponInput( '' );
  }

  function removeManualCoupon( code ) {
    setManualCoupons( ( prev ) => prev.filter( ( c ) => c !== code ) );
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

  const subtotal = toMoney( getCartTotal() );
  // Show shipping from the selected rate when available, otherwise fall back
  // to a provisional estimate matching the server-side tiered logic.
  const shipping = selectedRate
    ? toMoney( selectedRate.price )
    : ( subtotal >= FREE_SHIP_THRESHOLD ? 0 : ESTIMATED_SHIP_RATE );
  const tax   = toMoney( subtotal * 0.08 );
  const total = toMoney( subtotal + shipping + tax );

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

  const canSubmitCheckout = useMemo(
    () => (
      !processing
      && isFormComplete
      && safeCartItems.length > 0
      && Boolean( paymentMethod )
      && !manualPaymentSelected
    ),
    [ isFormComplete, manualPaymentSelected, paymentMethod, processing, safeCartItems.length ],
  );

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
      const normalizedRates = Array.isArray( rates ) ? rates : [];
      setShippingRates( normalizedRates );

      // Auto-select the first (cheapest) rate when none has been chosen yet.
      if ( normalizedRates.length > 0 && ! selectedRateRef.current ) {
        setSelectedRate( normalizedRates[0] );
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
      fetchShippingRates( formData, safeCartItems );
    }
  }, [ formData.address, formData.city, formData.state, formData.zip, formData.country, fetchShippingRates, safeCartItems ] ); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ formData is destructured so only address fields trigger (not every keystroke).
  //   cartItems identity changes on quantity updates which is intentional — different
  //   weights need fresh rates.

  const sanitize = ( v ) => DOMPurify.sanitize( v, { ALLOWED_TAGS: [] } );

  const handleInputChange = ( e ) => {
    const { name, value } = e.target;
    setFormData( ( prev ) => ( { ...prev, [name]: sanitize( value ) } ) );
    if ( errors[name] ) setErrors( ( prev ) => ( { ...prev, [name]: '' } ) );
  };

  const validateForm = useCallback( () => {
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
  }, [ formData ] );

  const handlePlaceOrder = useCallback( async () => {
    if ( ! validateForm() ) {
      return;
    }

    if ( ! paymentMethod ) {
      setCheckoutError( 'No payment method is currently available. Please contact support.' );
      return;
    }

    if ( manualPaymentSelected ) {
      setCheckoutError( 'This method requires offline/manual payment. Please select an online payment option to complete checkout.' );
      return;
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

    try {
      const wcOrder = await syncAndPlace(
        safeCartItems,
        billingAddress,
        billingAddress,
        paymentMethod,
        [],
        formData.customerNote,
        wcRateId,
        selectedRate ? selectedRate.price : '',
        [ ...( appliedCoupon ? [ appliedCoupon.code ] : [] ), ...manualCoupons ],
      );

      setStep( 'placing' );
      setOrderDetails( { wooCommerce: wcOrder?.finalize || wcOrder } );
      setOrderComplete( true );
      clearCart();
    } catch ( error ) {
      setCheckoutError( error?.message || 'Checkout failed. Please try again.' );
    } finally {
      setProcessing( false );
      setStep( 'form' );
    }
  }, [ appliedCoupon, clearCart, formData, manualCoupons, manualPaymentSelected, paymentMethod, safeCartItems, selectedRate, validateForm ] );

  useEffect(() => {
    if (processing) {
      showWorkflow({
        label: step === 'syncing' ? 'Syncing your cart…' : 'Placing your order…',
        sublabel: 'Securely processing your checkout details.',
        blocking: true,
      });
      return;
    }
    hideWorkflow();
  }, [hideWorkflow, processing, showWorkflow, step]);

  // ── Input / label class helpers ───────────────────────────────────────────
  const inputClass = ( field ) =>
    `w-full px-4 py-3 rounded-xl border text-sm transition-all min-h-[46px]
     text-slate-950 placeholder:text-slate-400
     focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
     ${ errors[field] ? 'border-red-400 bg-red-50/40' : 'border-slate-200 bg-white hover:border-slate-300' }`;

  const labelClass = 'block text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500 mb-1.5';
  const requiredMark = <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;

  // ── Empty cart guard ──────────────────────────────────────────────────────
  if ( safeCartItems.length === 0 && ! orderComplete ) {
    return (
      <Motion.div
        initial={ { opacity: 0, y: 20 } }
        animate={ { opacity: 1, y: 0 } }
        transition={ { duration: 0.4 } }
        className="dtb-checkout min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4"
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-md w-full">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mx-auto mb-6">
            <ShoppingCart className="h-9 w-9 text-slate-400" strokeWidth={ 1.5 } />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
          <p className="text-slate-500 text-sm mb-8">Add products to your cart before checking out.</p>
          <button
            onClick={ () => navigate( '/products' ) }
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800
                       active:scale-[0.99] text-white px-7 py-3 rounded-xl font-semibold text-sm
                       transition-all"
          >
            Browse Products
          </button>
        </div>
      </Motion.div>
    );
  }

  // ── Order confirmation ────────────────────────────────────────────────────
  if ( orderComplete && orderDetails ) {
    const wcOrder = orderDetails.wooCommerce;
    const paymentRequired = Boolean( wcOrder?.payment_required );
    const paymentUrl = typeof wcOrder?.payment_url === 'string' ? wcOrder.payment_url : '';
    return (
      <Motion.div
        initial={ { opacity: 0, scale: 0.97 } }
        animate={ { opacity: 1, scale: 1 } }
        transition={ { duration: 0.45 } }
        className="dtb-checkout min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4"
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center max-w-md w-full">
          <Motion.div
            initial={ { scale: 0 } }
            animate={ { scale: 1 } }
            transition={ { type: 'spring', stiffness: 260, damping: 20, delay: 0.1 } }
            className="inline-flex"
          >
            <div className={ `flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-6 ${ paymentRequired ? 'bg-amber-50' : 'bg-emerald-50' }` }>
              <CheckCircle
                className={ `h-10 w-10 ${ paymentRequired ? 'text-amber-500' : 'text-emerald-500' }` }
                strokeWidth={ 1.8 }
              />
            </div>
          </Motion.div>

          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
            { paymentRequired ? 'Payment Required' : 'Order Confirmed!' }
          </h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            { paymentRequired
              ? 'Your order has been created. Complete payment now to avoid cancellation.'
              : <>Thank you! A confirmation email will be sent to{' '}<strong className="text-slate-800">{ formData.email }</strong>.</>
            }
          </p>

          { wcOrder && (
            <div className="bg-slate-50 rounded-xl p-5 mb-6 text-left space-y-2.5 text-sm border border-slate-100">
              <p className="font-bold text-slate-900 text-[13px] mb-3">Order Details</p>
              { [
                { label: 'Order #',       value: `#${ wcOrder.order_id }` },
                wcOrder.status ? { label: 'Status', value: wcOrder.status } : null,
                { label: 'Total',         value: `$${ total.toFixed( 2 ) }`, highlight: true },
                orderDetails.veeqo ? { label: 'Fulfilment #', value: `#${ orderDetails.veeqo.id }` } : null,
              ].filter( Boolean ).map( ( { label, value, highlight } ) => (
                <div key={ label } className="flex justify-between items-center">
                  <span className="text-slate-500">{ label }</span>
                  <span className={ `font-semibold capitalize tabular-nums ${ highlight ? 'text-primary-600' : 'text-slate-900' }` }>
                    { value }
                  </span>
                </div>
              ) ) }
            </div>
          ) }

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            { paymentRequired && paymentUrl && (
              <a
                href={ paymentUrl }
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600
                           active:scale-[0.99] text-white px-6 py-3 rounded-xl font-semibold
                           text-sm transition-all"
              >
                Complete Payment
              </a>
            ) }
            { wcOrder?.order_id && (
              <Link
                to={ `/order/${ wcOrder.order_id }` }
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800
                           active:scale-[0.99] text-white px-6 py-3 rounded-xl font-semibold
                           text-sm transition-all"
              >
                View Order
              </Link>
            ) }
            <button
              onClick={ () => navigate( '/products' ) }
              className="inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700
                         hover:bg-slate-50 active:scale-[0.99] px-6 py-3 rounded-xl font-semibold
                         text-sm transition-all"
            >
              Keep Shopping
            </button>
          </div>
        </div>
      </Motion.div>
    );
  }

  // ── Checkout form ─────────────────────────────────────────────────────────
  return (
    <div className="dtb-checkout min-h-screen bg-slate-50 page-wrapper">
      <SEOHead noindex title="Checkout" />

      {/* ── Two-column grid: form (left) + dark summary (right, desktop only) ── */}
      <div className="lg:grid lg:grid-cols-[1fr_500px] min-h-screen">

        {/* ── Left column: form ───────────────────────────────────────────── */}
        <div className="px-4 py-8 sm:px-8 md:px-10 lg:px-12 xl:px-16 pb-32 lg:pb-16 lg:overflow-y-auto lg:max-h-screen">
          <div className="max-w-xl mx-auto lg:mx-0">

            {/* Page heading */}
            <Motion.div
              initial={ { opacity: 0, y: -10 } }
              animate={ { opacity: 1, y: 0 } }
              transition={ { duration: 0.35 } }
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <Lock size={ 11 } />
                  Secure checkout
                </div>
                <Link to="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                  Sign in
                </Link>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Complete your order
              </h1>
            </Motion.div>

            {/* Step progress */}
            <Motion.div
              initial={ { opacity: 0 } }
              animate={ { opacity: 1 } }
              transition={ { duration: 0.3, delay: 0.05 } }
            >
              <StepProgress activeStep={
                orderComplete   ? 'review'
                : ( paymentMethod && isFormComplete ) ? 'payment'
                : 'shipping'
              } />
            </Motion.div>

            {/* Mobile order summary */}
            <MobileSummaryStrip
              cartItems={ safeCartItems }
              subtotal={ subtotal }
              shipping={ shipping }
              tax={ tax }
              total={ total }
            />

            <div className="space-y-4">

              {/* ── Contact ─────────────────────────────────────────────── */}
              <StepCard delay={ 0 } className="p-5 sm:p-6">
                <SectionHeader icon={ User } title="Contact Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  { [
                    { name: 'firstName', label: 'First Name',    type: 'text',  autoComplete: 'given-name'  },
                    { name: 'lastName',  label: 'Last Name',     type: 'text',  autoComplete: 'family-name' },
                    { name: 'email',     label: 'Email Address', type: 'email', autoComplete: 'email'       },
                    { name: 'phone',     label: 'Phone',         type: 'tel',   autoComplete: 'tel',        inputMode: 'numeric' },
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
                        <p id={ `err-${ name }` } className="text-red-500 text-[11px] mt-1 font-medium" role="alert">
                          { errors[name] }
                        </p>
                      ) }
                    </div>
                  ) ) }
                </div>
              </StepCard>

              {/* ── Shipping Address ─────────────────────────────────────── */}
              <StepCard delay={ 0.05 } className="p-5 sm:p-6">
                <SectionHeader icon={ MapPin } title="Shipping Address" />
                <div className="space-y-3.5">
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
                      <p className="text-red-500 text-[11px] mt-1 font-medium" role="alert">{ errors.address }</p>
                    ) }
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    { [
                      { name: 'city',  label: 'City',     autoComplete: 'address-level2' },
                      { name: 'state', label: 'State',    autoComplete: 'address-level1' },
                      { name: 'zip',   label: 'ZIP Code', autoComplete: 'postal-code',   inputMode: 'numeric' },
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
                          <p className="text-red-500 text-[11px] mt-1 font-medium" role="alert">{ errors[name] }</p>
                        ) }
                      </div>
                    ) ) }
                  </div>

                  { subtotal > 0 && subtotal < FREE_SHIP_THRESHOLD && (
                    <div className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-100 px-4 py-2.5 text-xs text-primary-700">
                      <Truck size={ 13 } className="shrink-0" />
                      <span>
                        Spend <strong>${ ( FREE_SHIP_THRESHOLD - subtotal ).toFixed( 2 ) }</strong> more for free shipping
                      </span>
                    </div>
                  ) }
                </div>
              </StepCard>

              {/* ── Shipping Method ──────────────────────────────────────── */}
              <StepCard delay={ 0.1 } className="p-5 sm:p-6">
                <SectionHeader icon={ Truck } title="Shipping Method" />

                { ratesLoading && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 animate-pulse py-1">
                    <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" />
                    Loading shipping options…
                  </div>
                ) }

                { ratesError && ! ratesLoading && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
                    <AlertTriangle size={ 13 } className="shrink-0" />
                    { ratesError }
                  </div>
                ) }

                { ! ratesLoading && shippingRates.length === 0 && ! ratesError && (
                  <p className="text-xs text-slate-400 italic">
                    Enter your address above to see available rates.
                  </p>
                ) }

                { ! ratesLoading && shippingRates.length > 0 && (
                  <div className="space-y-2" role="radiogroup" aria-label="Shipping method">
                    { shippingRates.map( ( rate ) => (
                      <label
                        key={ rate.id }
                        className={ `flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all
                                     ${ selectedRate?.id === rate.id
                                         ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-400/30'
                                         : 'border-slate-200 bg-white hover:border-slate-300' }` }
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
                            <p className="text-sm font-semibold text-slate-900">{ rate.name }</p>
                            { rate.eta && <p className="text-xs text-slate-500 mt-0.5">{ rate.eta }</p> }
                          </div>
                        </div>
                        <span className={ `text-sm font-bold shrink-0 ${ toMoney( rate.price ) === 0 ? 'text-emerald-600' : 'text-slate-900' }` }>
                          { toMoney( rate.price ) === 0 ? 'Free' : `$${ toMoney( rate.price ).toFixed( 2 ) }` }
                        </span>
                      </label>
                    ) ) }
                  </div>
                ) }
              </StepCard>

              {/* ── Points redemption ────────────────────────────────────── */}
              { rewardsEnabled && isAuthenticated && pointsBalance && pointsBalance.points >= POINTS_MIN_REDEEM && (
                <StepCard delay={ 0.15 } className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                        <Star size={ 14 } strokeWidth={ 2 } />
                      </span>
                      <h3 className="text-[0.95rem] font-bold text-slate-900">Redeem Points</h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
                      { toNumber( pointsBalance.points, 0 ) } pts
                    </span>
                  </div>

                  { appliedCoupon ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">
                          ✓ ${ toNumber( appliedCoupon.discount_amount, 0 ).toFixed( 2 ) } discount applied
                        </p>
                        <code className="text-xs text-emerald-600 font-mono">{ appliedCoupon.code }</code>
                      </div>
                      <button
                        type="button"
                        onClick={ handleRemovePoints }
                        className="text-xs text-red-500 hover:text-red-700 font-semibold ml-3"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs text-slate-500 mb-2.5">
                        Redeem&nbsp;<strong className="text-slate-800">{ pointsToRedeem } pts</strong>
                        &nbsp;=&nbsp;<strong className="text-emerald-700">${ pointsUsd.toFixed( 2 ) } off</strong>
                      </label>
                      <input
                        type="range"
                        min={ POINTS_MIN_REDEEM }
                        max={ roundedMax || POINTS_MIN_REDEEM }
                        step={ POINTS_REDEEM_STEP }
                        value={ pointsToRedeem }
                        onChange={ ( e ) => setPointsToRedeem( Number( e.target.value ) ) }
                        className="w-full mb-3.5 accent-primary-600"
                      />
                      { pointsError && <p className="text-xs text-red-500 mb-2">{ pointsError }</p> }
                      <button
                        type="button"
                        onClick={ handleApplyPoints }
                        disabled={ applyingPoints || pointsToRedeem < POINTS_MIN_REDEEM }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        { applyingPoints ? 'Applying…' : `Apply ${ pointsToRedeem } pts` }
                      </button>
                    </>
                  ) }
                </StepCard>
              ) }

              {/* ── Coupon code ──────────────────────────────────────────── */}
              <StepCard delay={ 0.17 } className="p-5 sm:p-6">
                <SectionHeader icon={ Tag } title="Discount Code" />
                <div className="flex gap-2">
                  <input
                    id="coupon-code"
                    type="text"
                    value={ couponInput }
                    onChange={ ( e ) => setCouponInput( e.target.value.toUpperCase() ) }
                    placeholder="ENTER CODE"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={ addManualCoupon }
                    className="rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>
                { manualCoupons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    { manualCoupons.map( ( code ) => (
                      <button
                        key={ code }
                        type="button"
                        onClick={ () => removeManualCoupon( code ) }
                        className="flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                      >
                        <Tag size={ 9 } /> { code } ×
                      </button>
                    ) ) }
                  </div>
                ) }
              </StepCard>

              {/* ── Order note ───────────────────────────────────────────── */}
              <StepCard delay={ 0.19 } className="p-5 sm:p-6">
                <label htmlFor="field-customerNote" className={ labelClass }>
                  Order Note{ ' ' }
                  <span className="text-slate-400 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  id="field-customerNote"
                  name="customerNote"
                  value={ formData.customerNote }
                  onChange={ handleInputChange }
                  rows={ 2 }
                  placeholder="Special instructions for your order…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm resize-none
                             placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20
                             focus:border-primary-500 transition-all hover:border-slate-300"
                />
              </StepCard>

              {/* ── Payment ──────────────────────────────────────────────── */}
              <StepCard delay={ 0.21 } className="p-5 sm:p-6" id="payment-section">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <CreditCard size={ 15 } strokeWidth={ 2 } />
                    </span>
                    <h2 className="text-[0.95rem] font-bold text-slate-900 tracking-tight">Payment</h2>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end max-w-[200px]">
                    { [ ['VISA', '#1A1F71'], ['MC', '#EB001B'], ['AMEX', '#006FCF'] ].map( ( [ label, color ] ) => (
                      <span key={ label } style={ { color } } className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black">
                        { label }
                      </span>
                    ) ) }
                    <span className="rounded border border-gray-800 bg-black text-white px-1.5 py-0.5 text-[9px] font-semibold">
                      Apple Pay
                    </span>
                    <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold" style={ { color: GOOGLE_BRAND_BLUE } }>
                      G Pay
                    </span>
                    <span className="rounded border border-pink-200 bg-pink-50 text-[#17120e] px-1.5 py-0.5 text-[9px] font-black">
                      Klarna
                    </span>
                  </div>
                </div>

                {/* Express checkout row */}
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 mb-2.5 text-center">
                    Express Checkout
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      disabled
                      title="Apple Pay coming soon"
                      className="relative flex items-center justify-center gap-2 h-11 rounded-xl bg-black border border-black/80 text-white text-[13px] font-semibold opacity-60 cursor-not-allowed select-none"
                    >
                      <ApplePayMark className="h-4 w-4" />
                      Apple Pay
                      <span className="absolute -top-2 -right-1.5 bg-slate-200 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        Soon
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Google Pay coming soon"
                      className="relative flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 opacity-60 cursor-not-allowed select-none"
                    >
                      <GooglePayMark />
                      Google Pay
                      <span className="absolute -top-2 -right-1.5 bg-slate-200 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        Soon
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">or pay another way</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                </div>

                {/* Payment type tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
                  { [
                    { id: 'card',   label: 'Card' },
                    { id: 'paypal', label: 'PayPal' },
                    { id: 'bnpl',   label: 'Pay Later' },
                    { id: 'other',  label: 'Other' },
                  ].map( ( tab ) => (
                    <button
                      key={ tab.id }
                      type="button"
                      onClick={ () => setPaymentTab( tab.id ) }
                      className={ `flex-1 rounded-lg py-2 text-[11px] font-semibold transition-all
                                   ${ paymentTab === tab.id
                                     ? 'bg-white text-slate-900 shadow-sm'
                                     : 'text-slate-500 hover:text-slate-700' }` }
                    >
                      { tab.label }
                    </button>
                  ) ) }
                </div>

                {/* BNPL coming-soon cards (always shown when on bnpl tab) */}
                { paymentTab === 'bnpl' && (
                  <div className="mb-4 space-y-2.5">
                    <div className="flex items-center gap-3.5 rounded-xl border border-pink-200/60 bg-[#fdf0f4] px-4 py-3.5">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-[#ffb3c7] flex items-center justify-center">
                        <span className="text-[#17120e] text-sm font-black">K</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">Klarna</p>
                        <p className="text-xs text-slate-500 mt-0.5">Pay in 4 · 0% interest · No fees</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <div className="flex items-center gap-3.5 rounded-xl border border-indigo-200/60 bg-indigo-50 px-4 py-3.5">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-700 text-[10px] font-black leading-none">aff</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">Affirm</p>
                        <p className="text-xs text-slate-500 mt-0.5">Monthly payments · 0–30% APR</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 text-center pt-1">
                      Buy now, pay later options launching soon.
                    </p>
                  </div>
                ) }

                {/* Standard payment method error (non-BNPL tabs only) */}
                { paymentTab !== 'bnpl' && paymentMethods.length === 0 && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    <AlertCircle size={ 14 } className="shrink-0 mt-0.5" />
                    No payment methods configured. Please contact support.
                  </div>
                ) }

                {/* Standard payment methods (non-BNPL tabs) */}
                { paymentTab !== 'bnpl' && paymentMethods.length > 0 && (
                  <div className="mb-4 space-y-2" role="radiogroup" aria-label="Payment Method">
                    { filteredPaymentMethods.map( ( method ) => {
                      const isSelected = paymentMethod === method.id;
                      const isManual   = isManualPaymentMethod( method );
                      return (
                        <label
                          key={ method.id }
                          className={ `flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-all
                                       ${ isSelected
                                           ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-400/30'
                                           : 'border-slate-200 bg-white hover:border-slate-300' }` }
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={ method.id }
                            checked={ isSelected }
                            onChange={ () => setPaymentMethod( method.id ) }
                            className="accent-primary-600 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{ method.title || method.id }</p>
                            { method.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{ method.description }</p>
                            ) }
                          </div>
                          <span className={ `shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]
                                             ${ isManual ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700' }` }>
                            { isManual ? 'Manual' : 'Online' }
                          </span>
                        </label>
                      );
                    } ) }
                    { filteredPaymentMethods.length === 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 italic">
                        No methods available in this payment type.
                      </div>
                    ) }
                  </div>
                ) }

                { selectedPaymentMethod && (
                  <div className={ `mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs
                                    ${ manualPaymentSelected
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700' }` }>
                    { manualPaymentSelected
                      ? <AlertTriangle size={ 13 } className="shrink-0 mt-0.5" />
                      : <Lock size={ 12 } className="shrink-0 mt-0.5" />
                    }
                    { manualPaymentSelected
                      ? 'Manual payment methods are disabled for this headless checkout. Select an online method to continue.'
                      : 'Your order will be created and you will complete payment on a secure payment page.' }
                  </div>
                ) }

                {/* Mobile: place order button lives here */}
                <button
                  type="button"
                  onClick={ handlePlaceOrder }
                  disabled={ ! canSubmitCheckout }
                  className="lg:hidden w-full inline-flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-12"
                >
                  <Lock size={ 15 } strokeWidth={ 2.5 } />
                  { processing ? 'Processing…' : 'Place Order & Pay' }
                </button>
              </StepCard>

              {/* Checkout error */}
              <AnimatePresence>
                { checkoutError && (
                  <Motion.div
                    initial={ { opacity: 0, y: -8 } }
                    animate={ { opacity: 1, y: 0 } }
                    exit={ { opacity: 0, y: -8 } }
                    className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4"
                    role="alert"
                  >
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{ checkoutError }</p>
                  </Motion.div>
                ) }
              </AnimatePresence>

            </div>{/* end space-y-4 */}
          </div>{/* end max-w-xl */}
        </div>{/* end left column */}

        {/* ── Right column: sticky dark order summary (desktop only) ──────── */}
        <DesktopSummaryPanel
          cartItems={ safeCartItems }
          subtotal={ subtotal }
          shipping={ shipping }
          tax={ tax }
          total={ total }
          couponInput={ couponInput }
          setCouponInput={ setCouponInput }
          addManualCoupon={ addManualCoupon }
          manualCoupons={ manualCoupons }
          removeManualCoupon={ removeManualCoupon }
          processing={ processing }
          canSubmit={ canSubmitCheckout }
          onPlaceOrder={ handlePlaceOrder }
        />

      </div>{/* end two-column grid */}

      {/* ── Mobile sticky footer bar ─────────────────────────────────────────
          Visible only on mobile (< lg breakpoint).                           */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/97 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          <span>{ safeCartItems.length } item{ safeCartItems.length !== 1 ? 's' : '' }</span>
          <span className="font-black text-slate-900 tabular-nums">${ total.toFixed( 2 ) }</span>
        </div>
        <a
          href="#payment-section"
          className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold tracking-wide text-white shadow-sm transition-all active:scale-[0.99] hover:bg-slate-800"
        >
          <Lock size={ 15 } />
          { isFormComplete ? 'Review Payment' : 'Fill required fields' }
        </a>
      </div>
    </div>
  );
}
