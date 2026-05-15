import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  initCart,
  getCart,
  addToCart as storeAddToCart,
  updateCartItem,
  removeCartItem,
  clearStoreCart,
} from '../api/cart.js';
import { trackAddToCart, trackRemoveFromCart } from '../analytics/ecommerceEvents.js';

const CART_SNAPSHOT_KEY = 'drywall-cart-snapshot';
const CartContext = createContext();

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

function parsePriceFromStoreApi(value) {
  const raw = typeof value === 'number' ? value : parseFloat(String(value || '0'));
  if (!Number.isFinite(raw)) return 0;
  return raw > 999 ? raw / 100 : raw;
}

function getStoreItemImage(item) {
  const image = Array.isArray(item?.images) ? item.images[0] : null;
  return image?.thumbnail || image?.src || item?.image || '';
}

function normalizeStoreCartItem(item) {
  const variationValues = Array.isArray(item?.variation)
    ? item.variation.map((attr) => ({
        name: attr?.attribute || attr?.name || '',
        option: attr?.value || attr?.option || '',
      })).filter((attr) => attr.name && attr.option)
    : null;

  return {
    cartKey: item.key,
    id: item.id,
    key: item.key,
    name: item.name,
    brand: item.brand || '',
    price: parsePriceFromStoreApi(item?.prices?.price ?? item?.price),
    image: getStoreItemImage(item),
    part_number: item.sku || String(item.id || ''),
    sku: item.sku || '',
    parent_id: item.variation_id ? item.id : null,
    variation_id: item.variation_id || null,
    variation_attribute_values: variationValues,
    quantity: item.quantity || 1,
    raw: item,
  };
}

function normalizeStoreCart(cart) {
  return Array.isArray(cart?.items) ? cart.items.map(normalizeStoreCartItem) : [];
}

function buildStoreApiVariation(variationAttributeValues) {
  if (!Array.isArray(variationAttributeValues)) return {};
  return Object.fromEntries(
    variationAttributeValues
      .filter((attr) => attr?.name && attr?.option)
      .map((attr) => [attr.name, attr.option]),
  );
}

function buildStoreApiExtensions(product) {
  const metadata = Array.isArray(product?.metadata) ? product.metadata : [];
  if (!product?.extensions && metadata.length === 0) return {};
  if (product?.extensions && metadata.length === 0) return product.extensions;

  return {
    ...(product?.extensions || {}),
    dtb: {
      ...((product?.extensions && product.extensions.dtb) || {}),
      metadata,
    },
  };
}

function readSnapshot() {
  try {
    const saved = localStorage.getItem(CART_SNAPSHOT_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function writeSnapshot(items) {
  try {
    localStorage.setItem(CART_SNAPSHOT_KEY, JSON.stringify(items));
  } catch {
    // Snapshot persistence is non-critical.
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null);
  const [cartItems, setCartItems] = useState(readSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const applyServerCart = useCallback((nextCart) => {
    const normalizedItems = normalizeStoreCart(nextCart);
    setCart(nextCart || null);
    setCartItems(normalizedItems);
    setLastSyncedAt(Date.now());
    writeSnapshot(normalizedItems);
    return normalizedItems;
  }, []);

  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const initialized = await initCart();
      applyServerCart(initialized);
      return initialized;
    } catch (err) {
      setError(err?.message || 'Could not load cart.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [applyServerCart]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    initCart()
      .then((serverCart) => {
        if (!mounted) return;
        applyServerCart(serverCart);
      })
      .catch(async (err) => {
        if (!mounted) return;
        try {
          const serverCart = await getCart();
          if (!mounted) return;
          applyServerCart(serverCart);
        } catch {
          if (!mounted) return;
          setError(err?.message || 'Could not initialize cart.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [applyServerCart]);

  const addToCart = useCallback(async (product, quantity = 1) => {
    if (!product?.id) return null;
    setIsMutating(true);
    setError(null);
    const previousItems = cartItems;
    try {
      const variation = buildStoreApiVariation(product.variation_attribute_values);
      const extensions = buildStoreApiExtensions(product);
      const nextCart = await storeAddToCart(product.id, quantity, variation, extensions);
      const normalizedItems = applyServerCart(nextCart);
      const addedItem = normalizedItems.find((item) => String(item.id) === String(product.id)) || { ...product, quantity };
      trackAddToCart({ ...addedItem, quantity });
      return nextCart;
    } catch (err) {
      setCartItems(previousItems);
      setError(err?.message || 'Could not add item to cart.');
      throw err;
    } finally {
      setIsMutating(false);
    }
  }, [applyServerCart, cartItems]);

  const removeFromCart = useCallback(async (productIdOrKey) => {
    const key = String(productIdOrKey || '');
    if (!key) return null;
    const target = cartItems.find((item) => String(item.cartKey || item.key || item.id) === key || String(item.id) === key);
    if (!target?.cartKey && !target?.key) return null;
    setIsMutating(true);
    setError(null);
    const previousItems = cartItems;
    try {
      const nextCart = await removeCartItem(target.cartKey || target.key);
      applyServerCart(nextCart);
      trackRemoveFromCart(target);
      return nextCart;
    } catch (err) {
      setCartItems(previousItems);
      setError(err?.message || 'Could not remove item from cart.');
      throw err;
    } finally {
      setIsMutating(false);
    }
  }, [applyServerCart, cartItems]);

  const updateQuantity = useCallback(async (productIdOrKey, newQuantity) => {
    if (newQuantity < 1) {
      return removeFromCart(productIdOrKey);
    }

    const key = String(productIdOrKey || '');
    const target = cartItems.find((item) => String(item.cartKey || item.key || item.id) === key || String(item.id) === key);
    if (!target?.cartKey && !target?.key) return null;

    setIsMutating(true);
    setError(null);
    const previousItems = cartItems;
    try {
      const nextCart = await updateCartItem(target.cartKey || target.key, newQuantity);
      applyServerCart(nextCart);
      return nextCart;
    } catch (err) {
      setCartItems(previousItems);
      setError(err?.message || 'Could not update cart quantity.');
      throw err;
    } finally {
      setIsMutating(false);
    }
  }, [applyServerCart, cartItems, removeFromCart]);

  const clearCart = useCallback(async () => {
    setIsMutating(true);
    setError(null);
    const previousItems = cartItems;
    try {
      const nextCart = await clearStoreCart();
      applyServerCart(nextCart);
      return nextCart;
    } catch (err) {
      setCartItems(previousItems);
      setError(err?.message || 'Could not clear cart.');
      throw err;
    } finally {
      setIsMutating(false);
    }
  }, [applyServerCart, cartItems]);

  const getCartTotal = useCallback(() => {
    const totalPrice = cart?.totals?.total_price;
    if (totalPrice != null) return parsePriceFromStoreApi(totalPrice);
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart, cartItems]);

  const getCartCount = useCallback(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );

  const value = useMemo(() => ({
    cart,
    cartItems,
    isLoading,
    isMutating,
    error,
    lastSyncedAt,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    refreshCart,
    getCartTotal,
    getCartCount,
  }), [
    cart,
    cartItems,
    isLoading,
    isMutating,
    error,
    lastSyncedAt,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    refreshCart,
    getCartTotal,
    getCartCount,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
