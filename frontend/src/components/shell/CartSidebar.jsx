import { useCart } from '../../context/CartContext';
import MobileCartCheckoutDock from '../checkout/MobileCartCheckoutDock.jsx';
import StorefrontCartSheet from '../storefront/StorefrontCartSheet';

export default function CartSidebar({ isOpen, onClose }) {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, isMutating } = useCart();

  return (
    <>
      <StorefrontCartSheet
        isOpen={isOpen}
        onClose={onClose}
        cartItems={cartItems}
        removeFromCart={removeFromCart}
        updateQuantity={updateQuantity}
        getCartTotal={getCartTotal}
        isMutating={isMutating}
      />
      <MobileCartCheckoutDock
        isOpen={isOpen}
        onClose={onClose}
        cartItems={cartItems}
      />
    </>
  );
}
