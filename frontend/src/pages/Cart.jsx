/**
 * frontend/src/pages/Cart.jsx
 *
 * Responsive cart page. WooCommerce Store API remains the cart authority.
 * Checkout and payment collection are owned by the same-domain native
 * WooCommerce Checkout Block + official WooCommerce Stripe Payment Gateway.
 */

import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Lock,
  ChevronLeft,
  ShoppingCart,
} from 'lucide-react';

import SEOHead from '../components/shared/SEOHead';
import { useCart } from '../context/CartContext';
import { getWooCheckoutUrl } from '../utils/checkoutUrl.js';

const CHECKOUT_HREF = getWooCheckoutUrl();

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.055 },
  }),
  exit: { opacity: 0, x: -28, scale: 0.97, transition: { duration: 0.2 } },
};

function parseStoreMoney(value, minorUnit) {
  const raw = Number(value);
  const unit = Number(minorUnit);
  if (!Number.isFinite(raw)) return null;
  return Number.isFinite(unit) && unit >= 0 ? raw / (10 ** unit) : raw;
}

export default function Cart() {
  const { cart, cartItems, updateQuantity, removeFromCart, isMutating } = useCart();

  const localSubtotal = cartItems.reduce(
    (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
  const serverSubtotal = parseStoreMoney(
    cart?.totals?.total_items,
    cart?.totals?.currency_minor_unit
  );
  const subtotal = serverSubtotal ?? localSubtotal;

  const preventUnsafeCheckout = (event) => {
    if (isMutating) event.preventDefault();
  };

  if (cartItems.length === 0) {
    return (
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4"
      >
        <SEOHead noindex title="Shopping Cart" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_16px_rgba(15,23,42,0.06)] p-12 text-center max-w-md w-full">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 mx-auto mb-6">
            <ShoppingBag className="h-10 w-10 text-primary-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Your Cart is Empty</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Discover professional drywall tools and equipment for every job.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white px-7 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm"
          >
            <ShoppingBag size={16} />
            Browse Products
          </Link>
        </div>
      </Motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 page-wrapper dtb-cart-page">
      <SEOHead noindex title="Shopping Cart" />
      <div className="dtb-cart-page__container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8 sm:py-12">
        <Motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="dtb-cart-page__header mb-8"
        >
          <Link
            to="/products"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
            Continue Shopping
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">Shopping Cart</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </Motion.div>

        <div className="dtb-cart-page__layout grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="dtb-cart-page__items space-y-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {cartItems.map((item, index) => {
                const itemKey = item.cartKey || item.id;
                const quantity = Number(item.quantity) || 1;
                const unitPrice = Number(item.price) || 0;
                const optionText = Array.isArray(item.variation_attribute_values)
                  ? item.variation_attribute_values.map((attribute) => attribute.option).filter(Boolean).join(' / ')
                  : '';

                return (
                  <Motion.div
                    key={itemKey}
                    layout
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    custom={index}
                    className="dtb-cart-item-card group bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.05)] hover:shadow-[0_4px_20px_rgba(15,23,42,0.09)] transition-shadow"
                  >
                    <div className="dtb-cart-item-card__inner p-4 sm:p-5 flex gap-4">
                      <div className="dtb-cart-item-card__image shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" loading="lazy" decoding="async" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ShoppingCart size={24} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            {item.brand && (
                              <p className="dtb-cart-item-card__brand text-[11px] font-bold uppercase tracking-[0.16em] text-primary-500 mb-0.5">{item.brand}</p>
                            )}
                            <h3 className="dtb-cart-item-card__name text-sm sm:text-[0.95rem] font-semibold text-slate-900 leading-snug">{item.name}</h3>
                            {optionText && <p className="text-xs text-slate-500 mt-0.5">{optionText}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(itemKey)}
                            disabled={isMutating}
                            className="dtb-cart-item-card__remove shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>

                        <div className="dtb-cart-item-card__purchase-row flex items-center justify-between mt-3">
                          <div className="dtb-cart-item-card__quantity flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label={`Quantity for ${item.name}`}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(itemKey, quantity - 1)}
                              disabled={isMutating}
                              className="h-7 w-7 flex items-center justify-center rounded-[9px] text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={12} strokeWidth={2.5} />
                            </button>
                            <span className="px-3 text-sm font-black text-slate-900 tabular-nums min-w-7" aria-live="polite">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(itemKey, quantity + 1)}
                              disabled={isMutating}
                              className="h-7 w-7 flex items-center justify-center rounded-[9px] text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Increase quantity"
                            >
                              <Plus size={12} strokeWidth={2.5} />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-[11px] text-slate-400 tabular-nums">${unitPrice.toFixed(2)} ea</p>
                            <p className="text-base font-black text-slate-900 tabular-nums">${(unitPrice * quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="dtb-cart-page__summary-wrap sticky top-6"
          >
            <div className="dtb-cart-summary-card bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_rgba(15,23,42,0.06)] overflow-hidden">
              <div className="h-[3px] bg-gradient-to-r from-primary-700 via-primary-500 to-primary-600" />
              <div className="dtb-cart-summary-card__body p-5 sm:p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-5">Order Summary</h2>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-slate-500">Merchandise subtotal</span>
                  <span className="font-semibold text-slate-900 tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                <p className="mb-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
                  Shipping, discounts, and taxes are calculated by WooCommerce from your checkout details before payment.
                </p>

                <a
                  href={CHECKOUT_HREF}
                  onClick={preventUnsafeCheckout}
                  aria-disabled={isMutating ? 'true' : undefined}
                  className={`dtb-cart-summary-card__checkout w-full inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-primary-600 py-3.5 text-sm font-bold tracking-wide text-white shadow-sm transition-all ${isMutating ? 'cursor-not-allowed opacity-60' : 'hover:bg-primary-700 active:scale-[0.99]'}`}
                >
                  <Lock size={14} strokeWidth={2.5} />
                  {isMutating ? 'Updating cart…' : 'Continue to secure checkout'}
                  <ArrowRight size={14} strokeWidth={2.5} />
                </a>

                <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
                  Payment is collected on our same-domain WooCommerce checkout by the official Stripe gateway.
                </p>
              </div>
            </div>
          </Motion.div>
        </div>
      </div>
    </div>
  );
}
