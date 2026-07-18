import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';

import WooPaymentsExpressCheckout from '../payments/WooPaymentsExpressCheckout.jsx';

const CHECKOUT_HREF = `${(process.env.PUBLIC_URL || '').replace(/\/+$/, '')}/checkout`;

function getSubtotal(cartItems) {
  return cartItems.reduce(
    (total, item) => total + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
}

export default function MobileCartCheckoutDock({ isOpen, onClose, cartItems = [] }) {
  const subtotal = useMemo(() => getSubtotal(cartItems), [cartItems]);

  if (!isOpen || cartItems.length === 0) return null;

  return (
    <aside
      className="dtb-cart-express-dock"
      aria-label="Cart express checkout options"
    >
      <WooPaymentsExpressCheckout
        context="drawer"
        cartItems={cartItems}
        className="dtb-cart-express-dock__express"
      />

      <div className="dtb-cart-express-dock__total-row">
        <div>
          <span className="dtb-cart-express-dock__label">Subtotal</span>
          <span className="dtb-cart-express-dock__hint">Shipping and tax at checkout</span>
        </div>
        <strong>${subtotal.toFixed(2)}</strong>
      </div>

      <a
        href={CHECKOUT_HREF}
        className="dtb-cart-express-dock__checkout"
        onClick={onClose}
      >
        <Lock size={15} strokeWidth={2.4} aria-hidden="true" />
        <span>Continue to checkout</span>
        <ArrowRight size={16} strokeWidth={2.3} aria-hidden="true" />
      </a>

      <Link
        to="/cart"
        className="dtb-cart-express-dock__view-cart"
        onClick={onClose}
      >
        View full cart
      </Link>
    </aside>
  );
}
