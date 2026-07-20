import { useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { getCart } from '../../api/cart.js';
import StorefrontCartSheet from '../storefront/StorefrontCartSheet';
import { getWooCheckoutUrl } from '../../utils/checkoutUrl.js';
import { navigateDocument } from '../../utils/documentNavigation.js';

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

      try {
        // The cart sheet intentionally debounces quantity writes. Give that timer
        // time to fire, then wait for the CartContext Store API mutation to settle
        // before transferring the document to WooCommerce checkout.
        await sleep(CART_DEBOUNCE_DRAIN_MS);
        const startedAt = Date.now();
        while (isMutatingRef.current && Date.now() - startedAt < CART_MUTATION_WAIT_LIMIT_MS) {
          await sleep(75);
        }

        if (isMutatingRef.current) {
          window.alert('Your cart is still updating. Please wait a moment and try checkout again.');
          anchor.focus?.();
          return;
        }

        // Re-read WooCommerce immediately before document navigation. The visual
        // cart snapshot is never sufficient proof that the server-side session
        // has the same items/quantities.
        const authoritativeCart = await getCart();
        if (!Array.isArray(authoritativeCart?.items) || authoritativeCart.items.length === 0) {
          window.alert('Your checkout cart could not be confirmed. Please refresh your cart and try again.');
          anchor.focus?.();
          return;
        }

        navigateDocument(getWooCheckoutUrl(), { transition: 'checkout' });
        onClose?.();
      } catch {
        window.alert('We could not confirm your cart for checkout. Please try again.');
        anchor.focus?.();
      } finally {
        checkoutPendingRef.current = false;
      }
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
