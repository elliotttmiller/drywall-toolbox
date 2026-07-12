/**
 * Veeqo API Service
 *
 * All Veeqo API calls are made server-side via WordPress REST endpoints so
 * the Veeqo API key (DTB_VEEQO_API_KEY) is never exposed to the browser.
 *
 * PUBLIC PROXY METHODS (no authentication required from the browser):
 *   getShippingRates(destination, items)  → POST /wp-json/dtb/v1/veeqo/shipping-rates
 *   submitRepairRequest(formData)         → POST /wp-json/dtb/v1/repairs/submit
 *   checkInventoryAvailability(cartItems) → POST /wp-json/dtb/v1/veeqo/cart-availability
 *
 * Inventory source-of-truth contract:
 *   Veeqo owns inventory/fulfillment data; WooCommerce stores the checkout-safe
 *   stock projection. The storefront must never fetch the bulk Veeqo inventory
 *   endpoint directly.
 */
 
import { FREE_SHIP_THRESHOLD } from '../constants/shipping.js';
import { submitRepair } from '../api/repairs.js';

// Server-side proxy base (Veeqo API key kept on the WordPress server).
const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : '';
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const envApiBase = ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' );
const resolvedApiBase = envApiBase || ( /github\.io$/i.test( runtimeHost ) ? 'https://drywalltoolbox.com' : runtimeOrigin );

const DTB_PROXY_BASE = `${ resolvedApiBase.replace( /\/+$/, '' ) }/wp-json/dtb/v1`;
const FREE_SHIPPING_EXCLUDED_STATES = new Set( [ 'AK', 'ALASKA', 'HI', 'HAWAII' ] );

function normalizeStateCode( value = '' ) {
  return String( value || '' ).trim().toUpperCase().replace( /\./g, '' );
}

function isContiguousUsDestination( destination = {} ) {
  const country = String( destination.country || 'US' ).trim().toUpperCase();
  const state = normalizeStateCode( destination.state );
  return ( country === 'US' || country === 'USA' || country === 'UNITED STATES' )
    && ! FREE_SHIPPING_EXCLUDED_STATES.has( state );
}

function calculateItemsSubtotal( items = [] ) {
  return ( Array.isArray( items ) ? items : [] ).reduce( ( total, item ) => {
    const price = Number( item?.price || 0 );
    const quantity = Math.max( 1, Number( item?.quantity || 1 ) );
    return total + ( Number.isFinite( price ) ? price * quantity : 0 );
  }, 0 );
}

function isStandardGroundRate( rate = {} ) {
  const haystack = `${ rate.id || '' } ${ rate.name || '' } ${ rate.service || '' } ${ rate.method || '' }`.toLowerCase();
  if ( /express|expedited|overnight|next\s*day|2\s*day|two\s*day|priority/.test( haystack ) ) {
    return false;
  }
  return /standard|ground|economy|free|default/.test( haystack );
}

function normalizeFreeShippingRates( rates = [], destination = {}, items = [] ) {
  const subtotal = calculateItemsSubtotal( items );
  const qualifiesForFreeStandard = subtotal >= FREE_SHIP_THRESHOLD && isContiguousUsDestination( destination );

  if ( ! qualifiesForFreeStandard || ! Array.isArray( rates ) ) {
    return Array.isArray( rates ) ? rates : [];
  }

  return rates.map( ( rate ) => {
    if ( ! isStandardGroundRate( rate ) ) return rate;
    return {
      ...rate,
      price: 0,
      original_price: rate.price,
      free_shipping_applied: true,
      name: rate.name || 'Standard Shipping',
    };
  } );
}

function normalizeAvailabilityItem( item = {} ) {
  return {
    id: item.id || item.product_id || item.productId || null,
    product_id: item.product_id || item.productId || item.id || null,
    sku: String( item.sku || item.sku_code || '' ).trim(),
    name: item.name || item.productName || '',
    quantity: Math.max( 1, Number( item.quantity || item.qty || 1 ) ),
  };
}

class VeeqoService {
  /**
   * Fetch shipping rates for a destination address and item list.
   *
   * The rate calculation runs on the WordPress server via dtb/v1. Current
   * checkout rates are DTB tiered/normalized rates; post-order label/carrier
   * and tracking workflows are owned by Veeqo.
   *
   * @param {{ address: string, city: string, state: string, zip: string, country: string }} destination
   * @param {Array<{ id: number, sku: string, name: string, quantity: number, price: number, weight: number, category: string }>} items
   * @returns {Promise<Array<{ id: string, name: string, price: number, currency: string }>>}
   */
  async getShippingRates( destination, items ) {
    const url = `${ DTB_PROXY_BASE }/veeqo/shipping-rates`;
    const res = await fetch( url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify( { destination, items } ),
    } );

    if ( !res.ok ) {
      let msg = `Shipping rates error ${ res.status }`;
      try { const e = await res.json(); if ( e.message ) msg = e.message; } catch { /**/ }
      throw new Error( msg );
    }

    const data = await res.json();
    return normalizeFreeShippingRates( data.rates || [], destination, items );
  }

  /**
   * Submit a repair service request.
   *
   * Routes the storefront repair form through the canonical repair-service
   * workflow so the request is created in WP-Admin and queued for WooCommerce.
   *
   * @param {Object} formData  All fields from the 5-step repair form.
   * @returns {Promise<{ success: boolean, repair_id: number, public_token: string, status: string, message: string }>}
   */
  async submitRepairRequest( formData ) {
    return submitRepair( formData );
  }

  /**
   * Check inventory availability for cart items via the server-side proxy.
   *
   * Routes through POST /wp-json/dtb/v1/veeqo/cart-availability. The endpoint
   * checks the WooCommerce stock projection that is synchronized from Veeqo and
   * never exposes the full Veeqo inventory feed to the browser.
   *
   * Falls back to available=true on any error so checkout is never blocked by
   * an availability-check outage; WooCommerce still enforces stock server-side.
   *
   * @param {Array<{ id: number, sku: string, name: string, quantity: number }>} cartItems
   * @returns {Promise<{ available: boolean, items: Array, outOfStock: Array }>}
   */
  async checkInventoryAvailability( cartItems ) {
    try {
      const items = ( Array.isArray( cartItems ) ? cartItems : [] )
        .map( normalizeAvailabilityItem )
        .filter( ( item ) => item.sku );

      if ( items.length === 0 ) {
        return { available: true, items: [], outOfStock: [] };
      }

      const url = `${ DTB_PROXY_BASE }/veeqo/cart-availability`;
      const res = await fetch( url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { items } ),
      } );

      if ( !res.ok ) {
        return { available: true, items: [], outOfStock: [], error: `HTTP ${ res.status }` };
      }

      const data = await res.json();
      return {
        available: Boolean( data.available ),
        items: Array.isArray( data.items ) ? data.items : [],
        outOfStock: Array.isArray( data.outOfStock ) ? data.outOfStock : [],
        source: data.source || 'cart-availability',
      };
    } catch ( error ) {
      console.warn( 'Inventory check failed (non-fatal):', error.message );
      return { available: true, items: [], outOfStock: [], error: error.message };
    }
  }
}

// Export singleton instance
export const veeqoService = new VeeqoService();
export default veeqoService;
