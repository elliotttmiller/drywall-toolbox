/**
 * Veeqo API Service
 * Handles authentication and API calls to Veeqo for inventory and order management
 * Documentation: https://developers.veeqo.com/
 *
 * PUBLIC METHODS (routed through server-side proxy — API key stays on the server):
 *   getShippingRates(destination, items)  → POST /wp-json/dtb/v1/veeqo/shipping-rates
 *   submitRepairRequest(formData)         → POST /wp-json/dtb/v1/repair-request
 *
 * ADMIN METHODS (direct Veeqo API — require OAuth access token, admin-only):
 *   getProducts(), getOrder(), syncCartToOrder(), etc.
 */

const VEEQO_API_BASE = 'https://api.veeqo.com';
const VEEQO_AUTH_URL = 'https://app.veeqo.com/oauth/authorize';
const VEEQO_TOKEN_URL = 'https://api.veeqo.com/oauth/token';

// Server-side proxy base (API key kept on the WordPress server).
const DTB_PROXY_BASE =
  ( process.env.REACT_APP_API_BASE_URL || '' ).replace( /\/+$/, '' ) + '/wp-json/dtb/v1';

class VeeqoService {
  constructor() {
    this.accessToken = this.loadAccessToken();
    this.config = this.loadConfig();
  }

  /**
   * Load access token from localStorage
   */
  loadAccessToken() {
    try {
      return localStorage.getItem('veeqo_access_token');
    } catch (error) {
      console.error('Failed to load Veeqo access token:', error);
      return null;
    }
  }

  /**
   * Save access token to localStorage
   */
  saveAccessToken(token) {
    try {
      localStorage.setItem('veeqo_access_token', token);
      this.accessToken = token;
    } catch (error) {
      console.error('Failed to save Veeqo access token:', error);
    }
  }

  /**
   * Load Veeqo configuration
   */
  loadConfig() {
    try {
      const config = localStorage.getItem('veeqo_config');
      return config ? JSON.parse(config) : {
        clientId: process.env.REACT_APP_VEEQO_CLIENT_ID || '',
        clientSecret: process.env.REACT_APP_VEEQO_CLIENT_SECRET || '',
        redirectUri: process.env.REACT_APP_VEEQO_REDIRECT_URI || `${window.location.origin}/veeqo/callback`,
        enabled: false
      };
    } catch (error) {
      console.error('Failed to load Veeqo config:', error);
      return { enabled: false };
    }
  }

  /**
   * Save Veeqo configuration
   */
  saveConfig(config) {
    try {
      localStorage.setItem('veeqo_config', JSON.stringify(config));
      this.config = config;
    } catch (error) {
      console.error('Failed to save Veeqo config:', error);
    }
  }

  /**
   * Check if Veeqo integration is enabled and configured
   */
  isEnabled() {
    return this.config.enabled && (this.accessToken || this.config.clientId);
  }

  /**
   * Initiate OAuth authorization flow
   */
  initiateOAuth() {
    if (!this.config.clientId) {
      throw new Error('Veeqo Client ID not configured');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: ''
    });

    window.location.href = `${VEEQO_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(VEEQO_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code
        })
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.saveAccessToken(data.access_token);
      
      return data;
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated API request to Veeqo
   */
  async apiRequest(endpoint, options = {}) {
    if (!this.accessToken) {
      throw new Error('No Veeqo access token available');
    }

    const url = `${VEEQO_API_BASE}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          this.saveAccessToken(null);
          throw new Error('Veeqo authentication expired. Please reconnect.');
        }
        throw new Error(`Veeqo API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Veeqo API request failed:', error);
      throw error;
    }
  }

  /**
   * Get all products from Veeqo
   */
  async getProducts(page = 1, perPage = 100) {
    return this.apiRequest(`/products?page=${page}&per_page=${perPage}`);
  }

  /**
   * Get product by ID
   */
  async getProduct(productId) {
    return this.apiRequest(`/products/${productId}`);
  }

  /**
   * Get inventory levels for a product
   */
  async getInventory(productId) {
    return this.apiRequest(`/products/${productId}/inventory`);
  }

  /**
   * Get all warehouses
   */
  async getWarehouses() {
    return this.apiRequest('/warehouses');
  }

  /**
   * Create order in Veeqo
   */
  async createOrder(orderData) {
    return this.apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId) {
    return this.apiRequest(`/orders/${orderId}`);
  }

  /**
   * Get all orders
   */
  async getOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.apiRequest(`/orders?${queryString}`);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status) {
    return this.apiRequest(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  /**
   * Sync local cart with Veeqo order
   */
  async syncCartToOrder(cartItems, customerInfo) {
    if (!this.isEnabled()) {
      console.log('Veeqo integration not enabled, skipping order sync');
      return null;
    }

    try {
      const orderData = {
        channel_id: null, // Use default channel
        customer: {
          email: customerInfo.email,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: customerInfo.phone
        },
        deliver_to: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address1: customerInfo.address,
          city: customerInfo.city,
          state: customerInfo.state,
          zip: customerInfo.zip,
          country: customerInfo.country || 'US',
          phone: customerInfo.phone
        },
        line_items: cartItems.map(item => ({
          sellable_id: item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        })),
        notes: 'Order from Drywall Toolbox website'
      };

      const order = await this.createOrder(orderData);
      console.log('Order synced to Veeqo:', order);
      return order;
    } catch (error) {
      console.error('Failed to sync order to Veeqo:', error);
      throw error;
    }
  }

  /**
   * Check inventory availability for cart items via the server-side proxy.
   *
   * Routes through GET /wp-json/dtb/v1/veeqo/inventory (JWT-authenticated).
   * Falls back to available=true on any error so checkout is never blocked by
   * a Veeqo API outage — WooCommerce enforces stock limits server-side anyway.
   *
   * @param {Array<{ id: number, name: string, quantity: number }>} cartItems
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

  /**
   * Sync products from Veeqo to local database
   */
  async syncProducts() {
    if (!this.isEnabled()) {
      throw new Error('Veeqo integration not enabled');
    }

    try {
      const products = await this.getProducts();
      console.log(`Synced ${products.length} products from Veeqo`);
      return products;
    } catch (error) {
      console.error('Failed to sync products from Veeqo:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Veeqo
   */
  disconnect() {
    this.saveAccessToken(null);
    this.saveConfig({ ...this.config, enabled: false });
  }

  // ─── Public server-side proxy methods ─────────────────────────────────────
  // These route through the WordPress server so the Veeqo API key is never
  // exposed in browser requests.  They work even when the admin OAuth flow
  // has not been completed (DTB_VEEQO_API_KEY in wp-config.php is sufficient).

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
}

// Export singleton instance
export const veeqoService = new VeeqoService();
export default veeqoService;
