import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';

import MobileExpressCheckout from './MobileExpressCheckout.jsx';

const CHECKOUT_HREF = `${(process.env.PUBLIC_URL || '').replace(/\/+$/, '')}/checkout`;

function getSubtotal(cartItems) {
  return cartItems.reduce(
    (total, item) => total + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
}

export default function MobileCartCheckoutDock({ isOpen, onClose, cartItems = [] }) {
  const [walletAvailable, setWalletAvailable] = useState(null);
  const subtotal = useMemo(() => getSubtotal(cartItems), [cartItems]);

  if (!isOpen || cartItems.length === 0) return null;

  const walletState = walletAvailable === true
    ? 'ready'
    : walletAvailable === false
      ? 'unavailable'
      : 'loading';

  return (
    <aside
      className="dtb-mobile-cart-checkout-dock hidden"
      data-wallet-state={walletState}
      aria-label="Cart checkout options"
    >
      <MobileExpressCheckout
        cartItems={cartItems}
        variant="drawer"
        onAvailabilityChange={setWalletAvailable}
      />

      <div className="dtb-mobile-cart-checkout-dock__total-row">
        <div>
          <span className="dtb-mobile-cart-checkout-dock__label">Subtotal</span>
          <span className="dtb-mobile-cart-checkout-dock__hint">Shipping and tax at checkout</span>
        </div>
        <strong>${subtotal.toFixed(2)}</strong>
      </div>

      <a
        href={CHECKOUT_HREF}
        className="dtb-mobile-cart-checkout-dock__checkout"
        onClick={onClose}
      >
        <Lock size={15} strokeWidth={2.4} aria-hidden="true" />
        <span>Continue to checkout</span>
        <ArrowRight size={16} strokeWidth={2.3} aria-hidden="true" />
      </a>

      <Link
        to="/cart"
        className="dtb-mobile-cart-checkout-dock__view-cart"
        onClick={onClose}
      >
        View full cart
      </Link>
    </aside>
  );
}
