import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const CartContext = createContext();


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
      return savedCart ? JSON.parse(savedCart) : [];
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

  const getCartItemKey = useCallback((product) => {
    if (!product) return '';
    const parent = product.parent_id ? `parent:${product.parent_id}` : '';
    const selectedAttrs = Array.isArray(product.variation_attribute_values)
      ? product.variation_attribute_values
          .map((attr) => `${attr.name}:${attr.option}`)
          .join('|')
      : '';
    return [
      product.id || '',
      product.sku || product.part_number || '',
      parent,
      selectedAttrs,
    ].filter(Boolean).join('::');
  }, []);

  const addToCart = useCallback((product, quantity = 1) => {
    setCartItems(prevItems => {
      const itemKey = getCartItemKey(product);
      const existingItem = prevItems.find(item => String(item.cartKey || item.id) === itemKey);
      
      if (existingItem) {
        // Update quantity if item already in cart
        return prevItems.map(item =>
          String(item.cartKey || item.id) === itemKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item to cart
        return [...prevItems, {
          cartKey: itemKey,
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price || 0,
          image: product.image,
          part_number: product.part_number,
          sku: product.sku || product.part_number || '',
          parent_id: product.parent_id || null,
          variation_attribute_values: product.variation_attribute_values || null,
          quantity
        }];
      }
    });
  }, [getCartItemKey]);

  const removeFromCart = useCallback((productId) => {
    const key = String(productId);
    setCartItems(prevItems => prevItems.filter(item => String(item.id) !== key && String(item.cartKey || '') !== key));
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        String(item.id) === String(productId) || String(item.cartKey || '') === String(productId)
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getCartTotal = useCallback(
    () => cartItems.reduce((total, item) => total + (item.price * item.quantity), 0),
    [cartItems]
  );

  const getCartCount = useCallback(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );

  const value = useMemo(() => ({
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount
  }), [cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartCount]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
