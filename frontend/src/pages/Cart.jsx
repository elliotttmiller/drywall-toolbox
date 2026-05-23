/**
 * frontend/src/pages/Cart.jsx
 *
 * Fully redesigned — modern, sleek two-column layout.
 *   - Framer Motion item entrance / exit animations
 *   - Animated free-shipping progress bar
 *   - Brand-styled summary panel with accepted-payment icons
 *   - Clean pill quantity controls + hover-reveal remove button
 */

import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Truck,
  Lock,
  ChevronLeft,
  ShoppingCart,
} from 'lucide-react';
import SEOHead from '../components/shared/SEOHead';
import { FREE_SHIP_THRESHOLD, ESTIMATED_SHIP_RATE } from '../constants/shipping';

// ─── Framer Motion variants ────────────────────────────────────────────────────
const itemVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: ( i ) => ( {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: i * 0.055 },
  } ),
  exit: { opacity: 0, x: -28, scale: 0.97, transition: { duration: 0.2 } },
};

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart } = useCart();

  // Shipping is estimated; final rate confirmed at checkout via carrier quote.
  const subtotal      = cartItems.reduce( ( sum, item ) => sum + item.price * item.quantity, 0 );
  const shipping      = subtotal >= FREE_SHIP_THRESHOLD ? 0 : ESTIMATED_SHIP_RATE;
  // Tax is calculated server-side at checkout — we intentionally omit it here.
  const total         = subtotal + shipping;
  const freeShipPct   = Math.min( ( subtotal / FREE_SHIP_THRESHOLD ) * 100, 100 );
  const toFree        = Math.max( FREE_SHIP_THRESHOLD - subtotal, 0 );

  // ── Empty state ──────────────────────────────────────────────────────────────
  if ( cartItems.length === 0 ) {
    return (
      <Motion.div
        initial={ { opacity: 0, y: 20 } }
        animate={ { opacity: 1, y: 0 } }
        transition={ { duration: 0.4 } }
        className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4"
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_16px_rgba(15,23,42,0.06)] p-12 text-center max-w-md w-full">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 mx-auto mb-6">
            <ShoppingBag className="h-10 w-10 text-primary-400" strokeWidth={ 1.5 } />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Your Cart is Empty</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Discover professional drywall tools and equipment for every job.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white px-7 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm"
          >
            <ShoppingBag size={ 16 } />
            Browse Products
          </Link>
        </div>
      </Motion.div>
    );
  }

  // ── Cart ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 page-wrapper">
      <SEOHead noindex title="Shopping Cart" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* Page header */}
        <Motion.div
          initial={ { opacity: 0, y: -8 } }
          animate={ { opacity: 1, y: 0 } }
          transition={ { duration: 0.3 } }
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Shopping Cart
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              { cartItems.length } item{ cartItems.length !== 1 ? 's' : '' }
            </p>
          </div>
          <Link
            to="/products"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft size={ 16 } strokeWidth={ 2.5 } />
            Continue Shopping
          </Link>
        </Motion.div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── Cart items column ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout" initial={ false }>
              { cartItems.map( ( item, index ) => {
                const itemKey    = item.cartKey || item.id;
                const optionText = Array.isArray( item.variation_attribute_values )
                  ? item.variation_attribute_values.map( ( a ) => a.option ).filter( Boolean ).join( ' / ' )
                  : '';

                return (
                  <Motion.div
                    key={ itemKey }
                    layout
                    variants={ itemVariants }
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    custom={ index }
                    className="group bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.05)] hover:shadow-[0_4px_20px_rgba(15,23,42,0.09)] transition-shadow"
                  >
                    <div className="p-4 sm:p-5 flex gap-4">

                      {/* Product image */}
                      <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                        { item.image ? (
                          <img
                            src={ item.image }
                            alt={ item.name }
                            className="w-full h-full object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ShoppingCart size={ 24 } strokeWidth={ 1.5 } />
                          </div>
                        ) }
                      </div>

                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            { item.brand && (
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-500 mb-0.5">
                                { item.brand }
                              </p>
                            ) }
                            <h3 className="text-sm sm:text-[0.95rem] font-semibold text-slate-900 leading-snug">
                              { item.name }
                            </h3>
                            { optionText && (
                              <p className="text-xs text-slate-500 mt-0.5">{ optionText }</p>
                            ) }
                          </div>
                          {/* Remove — fades in on card hover */}
                          <button
                            onClick={ () => removeFromCart( itemKey ) }
                            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label={ `Remove ${ item.name }` }
                          >
                            <Trash2 size={ 14 } strokeWidth={ 2 } />
                          </button>
                        </div>

                        {/* Qty + price row */}
                        <div className="flex items-center justify-between mt-3">

                          {/* Pill quantity control */}
                          <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                            <button
                              onClick={ () => updateQuantity( itemKey, item.quantity - 1 ) }
                              className="h-7 w-7 flex items-center justify-center rounded-[9px] text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={ 12 } strokeWidth={ 2.5 } />
                            </button>
                            <span className="px-3 text-sm font-black text-slate-900 tabular-nums min-w-[1.75rem] text-center">
                              { item.quantity }
                            </span>
                            <button
                              onClick={ () => updateQuantity( itemKey, item.quantity + 1 ) }
                              className="h-7 w-7 flex items-center justify-center rounded-[9px] text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                              aria-label="Increase quantity"
                            >
                              <Plus size={ 12 } strokeWidth={ 2.5 } />
                            </button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              ${ item.price.toFixed( 2 ) } ea
                            </p>
                            <p className="text-base font-black text-slate-900 tabular-nums">
                              ${ ( item.price * item.quantity ).toFixed( 2 ) }
                            </p>
                          </div>

                        </div>
                      </div>
                    </div>
                  </Motion.div>
                );
              } ) }
            </AnimatePresence>
          </div>

          {/* ── Order summary sidebar ─────────────────────────────────────────── */}
          <Motion.div
            initial={ { opacity: 0, y: 20 } }
            animate={ { opacity: 1, y: 0 } }
            transition={ { duration: 0.4, delay: 0.1 } }
            className="sticky top-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_rgba(15,23,42,0.06)] overflow-hidden">

              {/* Top brand accent stripe */}
              <div className="h-[3px] bg-gradient-to-r from-primary-700 via-primary-500 to-primary-600" />

              <div className="p-5 sm:p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-5">Order Summary</h2>

                {/* Free shipping progress */}
                { subtotal < FREE_SHIP_THRESHOLD && (
                  <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Truck size={ 13 } className="text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-800">
                        Add <strong>${ toFree.toFixed( 2 ) }</strong> more for free shipping
                      </p>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                      <Motion.div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                        initial={ { width: 0 } }
                        animate={ { width: `${ freeShipPct }%` } }
                        transition={ { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
                      />
                    </div>
                  </div>
                ) }

                { subtotal >= FREE_SHIP_THRESHOLD && (
                  <Motion.div
                    initial={ { opacity: 0, scale: 0.97 } }
                    animate={ { opacity: 1, scale: 1 } }
                    className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2"
                  >
                    <Truck size={ 13 } className="text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-700">
                      🎉 Free shipping unlocked!
                    </p>
                  </Motion.div>
                ) }

                {/* Line items */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      Subtotal ({ cartItems.length } { cartItems.length === 1 ? 'item' : 'items' })
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      ${ subtotal.toFixed( 2 ) }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Shipping (est.)</span>
                    <span className={ `font-semibold tabular-nums ${ shipping === 0 ? 'text-emerald-600' : 'text-slate-900' }` }>
                      { shipping === 0 ? 'Free' : `$${ shipping.toFixed( 2 ) }` }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm items-baseline">
                    <span className="text-slate-500">Tax</span>
                    <span className="text-slate-400 text-xs italic">Calculated at checkout</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-baseline pt-4 border-t border-slate-100 mb-5">
                  <span className="text-base font-bold text-slate-900">Est. Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-950 tabular-nums">
                      ${ total.toFixed( 2 ) }
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">+ tax at checkout</p>
                  </div>
                </div>

                {/* Checkout CTA */}
                <Link
                  to="/checkout"
                  className="w-full inline-flex items-center justify-center gap-2.5 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm min-h-[48px]"
                >
                  <Lock size={ 14 } strokeWidth={ 2.5 } />
                  Proceed to Checkout
                  <ArrowRight size={ 14 } strokeWidth={ 2.5 } />
                </Link>

                {/* Accepted payments */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 text-center mb-2.5">
                    Accepted Payments
                  </p>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    { [ ['VISA', '#1A1F71'], ['MC', '#EB001B'], ['AMEX', '#006FCF'] ].map( ( [ label, color ] ) => (
                      <span
                        key={ label }
                        style={ { color } }
                        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black"
                      >
                        { label }
                      </span>
                    ) ) }
                    <span className="rounded border border-gray-800 bg-black text-white px-1.5 py-0.5 text-[9px] font-semibold">
                      Apple Pay
                    </span>
                    <span
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold"
                      style={ { color: '#4285F4' } }
                    >
                      G Pay
                    </span>
                    <span className="rounded border border-pink-200 bg-pink-50 text-[#17120e] px-1.5 py-0.5 text-[9px] font-black">
                      Klarna
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </Motion.div>

        </div>
      </div>
    </div>
  );
}
