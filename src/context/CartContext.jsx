import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    // Load cart from localStorage on init
    try {
      const savedCart = localStorage.getItem('drywall-cart');
      if (!savedCart) return [];
      // parse and normalize stored items to ensure price is numeric
      const parsed = JSON.parse(savedCart);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(it => ({
        ...it,
        price: (typeof it.price === 'number') ? it.price : (Number(String(it.price).replace(/[^0-9.-]+/g, '')) || 0),
        quantity: Number(it.quantity) || 0
      }));
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
      return [];
    }
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('drywall-cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [cartItems]);

  const addToCart = (product, quantity = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        // Update quantity if item already in cart
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // normalize price to numeric value (strip $ and commas). If non-numeric, default to 0
        const priceVal = (typeof product.price === 'number')
          ? product.price
          : (Number(String(product.price || '').replace(/[^0-9.-]+/g, '')) || 0);
        // Add new item to cart
        return [...prevItems, {
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: priceVal,
          image: product.image,
          part_number: product.part_number,
          quantity
        }];
      }
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
