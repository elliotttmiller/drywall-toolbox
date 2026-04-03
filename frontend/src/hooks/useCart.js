/**
 * frontend/src/hooks/useCart.js
 *
 * Initialises the WooCommerce Store API cart session on mount.
 * Cart state is always derived from the API response — never reconstructed
 * manually.
 *
 * Returns:
 *   { cart, isLoading, isUpdating, error,
 *     addItem, updateItem, removeItem, applyCoupon, removeCoupon }
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initCart,
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  applyCoupon  as apiApplyCoupon,
  removeCoupon as apiRemoveCoupon,
} from '../api/cart.js';

export function useCart() {
  const [ cart,       setCart       ] = useState( null );
  const [ isLoading,  setIsLoading  ] = useState( true );
  const [ isUpdating, setIsUpdating ] = useState( false );
  const [ error,      setError      ] = useState( null );

  // Initialise cart session on mount.
  useEffect( () => {
    let cancelled = false;
    setIsLoading( true );
    initCart()
      .then( ( data ) => { if ( ! cancelled ) setCart( data ); } )
      .catch( ( err ) => { if ( ! cancelled ) setError( err.message || 'Failed to load cart.' ); } )
      .finally( () => { if ( ! cancelled ) setIsLoading( false ); } );
    return () => { cancelled = true; };
  }, [] );

  const withUpdate = useCallback( async ( fn ) => {
    setIsUpdating( true );
    setError( null );
    try {
      const updated = await fn();
      setCart( updated );
      return updated;
    } catch ( err ) {
      setError( err.message || 'Cart update failed.' );
      throw err;
    } finally {
      setIsUpdating( false );
    }
  }, [] );

  const addItem = useCallback(
    ( productId, qty = 1, variation = {} ) =>
      withUpdate( () => addToCart( productId, qty, variation ) ),
    [ withUpdate ]
  );

  const updateItem = useCallback(
    ( key, qty ) => withUpdate( () => updateCartItem( key, qty ) ),
    [ withUpdate ]
  );

  const removeItem = useCallback(
    ( key ) => withUpdate( () => removeCartItem( key ) ),
    [ withUpdate ]
  );

  const applyCoupon_ = useCallback(
    ( code ) => withUpdate( () => apiApplyCoupon( code ) ),
    [ withUpdate ]
  );

  const removeCoupon_ = useCallback(
    ( code ) => withUpdate( () => apiRemoveCoupon( code ) ),
    [ withUpdate ]
  );

  return {
    cart,
    isLoading,
    isUpdating,
    error,
    addItem,
    updateItem,
    removeItem,
    applyCoupon: applyCoupon_,
    removeCoupon: removeCoupon_,
  };
}

export default useCart;
