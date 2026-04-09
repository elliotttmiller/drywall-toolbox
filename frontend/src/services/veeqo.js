/**
 * Veeqo API Service
 *
 * All Veeqo API calls are made server-side via WordPress REST endpoints so
 * the Veeqo API key (DTB_VEEQO_API_KEY) is never exposed to the browser.
 *
 * PUBLIC PROXY METHODS (no authentication required from the browser):
 *   getShippingRates(destination, items)  → POST /wp-json/dtb/v1/veeqo/shipping-rates
 *   submitRepairRequest(formData)         → POST /wp-json/dtb/v1/repair-request
 *   checkInventoryAvailability(cartItems) → GET  /wp-json/dtb/v1/veeqo/inventory
 *
 * Documentation: https://developers.veeqo.com/
 */

// Server-side proxy base (Veeqo API key kept on the WordPress server).
const DTB_PROXY_BASE =
  ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' ) + '/wp-json/dtb/v1';

class VeeqoService {
  /**
   * Fetch real-time shipping rates for a destination address and item list.
   *
   * The rate calculation runs on the WordPress server via dtb-veeqo.php and
   * returns tiered domestic / international rates (or a prepaid-label option
   * for repair service orders).
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
    return data.rates || [];
  }

  /**
   * Submit a repair service request.
   *
   * Creates a WooCommerce order (status: pending) for the repair, optionally
   * syncs it to Veeqo, and sends a confirmation email — all server-side.
   *
   * @param {Object} formData  All fields from the 5-step repair form.
   * @returns {Promise<{ success: boolean, wc_order_id: number, wc_order_number: string, message: string }>}
   */
  async submitRepairRequest( formData ) {
    const url = `${ DTB_PROXY_BASE }/repair-request`;
    const res = await fetch( url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify( formData ),
    } );

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if ( !res.ok ) {
      throw new Error( data.message || `Repair request failed (${ res.status }).` );
    }

    return data;
  }

  /**
   * Check inventory availability for cart items via the server-side proxy.
   *
   * Routes through GET /wp-json/dtb/v1/veeqo/inventory (JWT-authenticated).
   * Falls back to available=true on any error so checkout is never blocked by
   * a Veeqo API outage — WooCommerce enforces stock limits server-side anyway.
   *
   * @param {Array<{ id: number, sku: string, name: string, quantity: number }>} cartItems
   * @returns {Promise<{ available: boolean, items: Array, outOfStock: Array }>}
   */
  async checkInventoryAvailability( cartItems ) {
    try {
      const url = `${ DTB_PROXY_BASE }/veeqo/inventory`;
      const res = await fetch( url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      } );

      if ( !res.ok ) {
        // Non-fatal: WooCommerce enforces stock on the server.
        return { available: true, items: [], error: `HTTP ${ res.status }` };
      }

      const data = await res.json();
      const inventory = data.inventory || [];

      // Build a sku→available map from the server response.
      const stockBySku = {};
      for ( const entry of inventory ) {
        if ( entry.sku ) stockBySku[ entry.sku ] = entry.available ?? 0;
      }

      const checks = cartItems.map( ( item ) => {
        const available = stockBySku[ item.sku ] ?? null;
        return {
          productId:   item.id,
          productName: item.name,
          sku:         item.sku || '',
          requested:   item.quantity,
          available,
          inStock:     available === null || available >= item.quantity,
        };
      } );

      const outOfStock = checks.filter( ( c ) => !c.inStock );
      return { available: outOfStock.length === 0, items: checks, outOfStock };
    } catch ( error ) {
      console.warn( 'Inventory check failed (non-fatal):', error.message );
      return { available: true, items: [], error: error.message };
    }
  }
}

// Export singleton instance
export const veeqoService = new VeeqoService();
export default veeqoService;
