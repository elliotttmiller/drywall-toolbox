import { useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import StorefrontCartSheet from '../storefront/StorefrontCartSheet';
import { getWooCheckoutUrl } from '../../utils/checkoutUrl.js';

const CART_DEBOUNCE_DRAIN_MS = 350;
const CART_MUTATION_WAIT_LIMIT_MS = 8000;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function CartSidebar({ isOpen, onClose }) {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, isMutating } = useCart();
  const isMutatingRef = useRef(isMutating);
  const checkoutPendingRef = useRef(false);

  useEffect(() => {
    isMutatingRef.current = isMutating;
  }, [isMutating]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const interceptCheckout = async (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || !anchor.closest('.storefront-cart-sheet')) return;

      let targetUrl;
      try {
        targetUrl = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (!/\/checkout\/?$/.test(targetUrl.pathname)) return;

      event.preventDefault();
      event.stopPropagation();
      if (checkoutPendingRef.current) return;
      checkoutPendingRef.current = true;

      // The cart sheet intentionally debounces quantity writes. Give that timer
      // time to fire, then wait for the CartContext Store API mutation to settle
      // before transferring the document to WooCommerce checkout.
      await sleep(CART_DEBOUNCE_DRAIN_MS);
      const startedAt = Date.now();
      while (isMutatingRef.current && Date.now() - startedAt < CART_MUTATION_WAIT_LIMIT_MS) {
        await sleep(75);
      }

      if (isMutatingRef.current) {
        checkoutPendingRef.current = false;
        window.alert('Your cart is still updating. Please wait a moment and try checkout again.');
        anchor.focus?.();
        return;
      }

      onClose?.();
      window.location.assign(getWooCheckoutUrl());
    };

    document.addEventListener('click', interceptCheckout, true);
    return () => document.removeEventListener('click', interceptCheckout, true);
  }, [isOpen, onClose]);

  return (
    <StorefrontCartSheet
      isOpen={isOpen}
      onClose={onClose}
      cartItems={cartItems}
      removeFromCart={removeFromCart}
      updateQuantity={updateQuantity}
      getCartTotal={getCartTotal}
      isMutating={isMutating}
    />
  );
}
