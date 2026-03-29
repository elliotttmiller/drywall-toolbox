import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Shopify Storefront API endpoint for client-side cart operations.
 * The public token is injected via window.__shopifyConfig (set in root.jsx).
 */
function getShopifyConfig() {
  if (typeof window !== 'undefined' && window.__shopifyConfig) {
    return window.__shopifyConfig;
  }
  return {
    storeDomain: import.meta.env.PUBLIC_STORE_DOMAIN || '',
    publicStorefrontToken: import.meta.env.PUBLIC_STOREFRONT_API_TOKEN || '',
    apiVersion: import.meta.env.PUBLIC_STOREFRONT_API_VERSION || '2024-10',
  };
}

async function storefrontFetch(query, variables = {}) {
  const config = getShopifyConfig();
  if (!config.storeDomain || !config.publicStorefrontToken) {
    throw new Error('Shopify storefront not configured');
  }
  const url = `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.publicStorefrontToken,
    },
    body: JSON.stringify({query, variables}),
  });
  if (!res.ok) throw new Error(`Storefront API error: ${res.status}`);
  const {data, errors} = await res.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data;
}

// Cart fragments / queries
const CART_FIELDS = `#graphql
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    lines(first: 100) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            sku
            price { amount currencyCode }
            image { url altText }
            product { title handle vendor }
          }
        }
        cost {
          totalAmount { amount currencyCode }
          amountPerQuantity { amount currencyCode }
        }
      }
    }
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
    }
  }
`;

const CART_CREATE = `#graphql
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_ADD = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_UPDATE = `#graphql
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_REMOVE = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FIELDS}
`;

const CART_QUERY_GQL = `#graphql
  query Cart($cartId: ID!) {
    cart(id: $cartId) { ...CartFields }
  }
  ${CART_FIELDS}
`;

// Cart ID cookie key
const CART_COOKIE_KEY = 'shopify_cart_id';

function getCartId() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_COOKIE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCartId(cartId) {
  if (typeof document === 'undefined') return;
  if (cartId) {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${CART_COOKIE_KEY}=${encodeURIComponent(cartId)}; expires=${expires}; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${CART_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

/**
 * Normalize a Shopify cart into the internal cart shape used by existing components.
 */
function normalizeCart(shopifyCart) {
  if (!shopifyCart) return {cartItems: [], checkoutUrl: null, cartId: null};
  
  const cartItems = (shopifyCart.lines?.nodes || []).map((line) => {
    const variant = line.merchandise;
    const product = variant?.product || {};
    return {
      id: variant?.id || line.id,
      lineId: line.id,
      name: product?.title || variant?.title || '',
      brand: product?.vendor || '',
      price: parseFloat(variant?.price?.amount || '0'),
      image: variant?.image?.url || '/product-placeholder.jpg',
      part_number: variant?.sku || product?.handle || '',
      sku: variant?.sku || '',
      quantity: line.quantity,
      variantId: variant?.id,
      handle: product?.handle,
    };
  });

  return {
    cartItems,
    checkoutUrl: shopifyCart.checkoutUrl || null,
    cartId: shopifyCart.id,
    totalQuantity: shopifyCart.totalQuantity || 0,
    cost: shopifyCart.cost || null,
  };
}

const CartContext = createContext();

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({children}) {
  const [cart, setCart] = useState({cartItems: [], checkoutUrl: null, cartId: null});
  const [loading, setLoading] = useState(false);

  // Load cart from Shopify on mount
  useEffect(() => {
    const cartId = getCartId();
    if (!cartId) return;
    
    setLoading(true);
    storefrontFetch(CART_QUERY_GQL, {cartId})
      .then((data) => {
        if (data?.cart) {
          setCart(normalizeCart(data.cart));
        } else {
          // Cart no longer valid, clear cookie
          setCartId(null);
        }
      })
      .catch((err) => {
        console.warn('Failed to load cart:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const addToCart = useCallback(async (product, quantity = 1) => {
    const variantId = product.variantId || product.id;
    if (!variantId) {
      console.error('Cannot add to cart: no variantId on product', product);
      return;
    }

    setLoading(true);
    try {
      const cartId = getCartId();
      let data;

      if (cartId) {
        data = await storefrontFetch(CART_LINES_ADD, {
          cartId,
          lines: [{merchandiseId: variantId, quantity}],
        });
        const updated = data?.cartLinesAdd?.cart;
        if (updated) {
          setCart(normalizeCart(updated));
        }
      } else {
        data = await storefrontFetch(CART_CREATE, {
          input: {
            lines: [{merchandiseId: variantId, quantity}],
          },
        });
        const newCart = data?.cartCreate?.cart;
        if (newCart) {
          setCartId(newCart.id);
          setCart(normalizeCart(newCart));
        }
      }
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFromCart = useCallback(async (productId) => {
    const cartId = getCartId();
    if (!cartId) return;

    // Find the line ID for this product
    const line = cart.cartItems.find(
      (item) => item.id === productId || item.variantId === productId || item.lineId === productId
    );
    if (!line) return;

    setLoading(true);
    try {
      const data = await storefrontFetch(CART_LINES_REMOVE, {
        cartId,
        lineIds: [line.lineId],
      });
      const updated = data?.cartLinesRemove?.cart;
      if (updated) setCart(normalizeCart(updated));
    } catch (err) {
      console.error('Failed to remove from cart:', err);
    } finally {
      setLoading(false);
    }
  }, [cart.cartItems]);

  const updateQuantity = useCallback(async (productId, newQuantity) => {
    if (newQuantity < 1) {
      return removeFromCart(productId);
    }

    const cartId = getCartId();
    if (!cartId) return;

    const line = cart.cartItems.find(
      (item) => item.id === productId || item.variantId === productId || item.lineId === productId
    );
    if (!line) return;

    setLoading(true);
    try {
      const data = await storefrontFetch(CART_LINES_UPDATE, {
        cartId,
        lines: [{id: line.lineId, quantity: newQuantity}],
      });
      const updated = data?.cartLinesUpdate?.cart;
      if (updated) setCart(normalizeCart(updated));
    } catch (err) {
      console.error('Failed to update cart quantity:', err);
    } finally {
      setLoading(false);
    }
  }, [cart.cartItems, removeFromCart]);

  const clearCart = useCallback(() => {
    setCartId(null);
    setCart({cartItems: [], checkoutUrl: null, cartId: null});
  }, []);

  const getCartTotal = useCallback(() => {
    return cart.cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart.cartItems]);

  const getCartCount = useCallback(() => {
    return cart.cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cart.cartItems]);

  /**
   * Redirect to Shopify's hosted checkout.
   * Replaces the custom Checkout.jsx page.
   */
  const redirectToCheckout = useCallback(() => {
    if (cart.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    }
  }, [cart.checkoutUrl]);

  const value = {
    cartItems: cart.cartItems,
    checkoutUrl: cart.checkoutUrl,
    cartId: cart.cartId,
    loading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    redirectToCheckout,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
