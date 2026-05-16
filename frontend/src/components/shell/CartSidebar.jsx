import { useCart } from '../../context/CartContext';
import StorefrontCartSheet from '../storefront/StorefrontCartSheet';

export default function CartSidebar({ isOpen, onClose }) {
  const { cartItems, removeFromCart, getCartTotal } = useCart();

  return (
    <StorefrontCartSheet
      isOpen={isOpen}
      onClose={onClose}
      cartItems={cartItems}
      removeFromCart={removeFromCart}
      getCartTotal={getCartTotal}
    />
  );
}
