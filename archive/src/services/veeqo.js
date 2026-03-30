/**
 * Veeqo API Service
 * Handles authentication and API calls to Veeqo for inventory and order management
 * Documentation: https://developers.veeqo.com/
 */

const VEEQO_API_BASE = 'https://api.veeqo.com';
const VEEQO_AUTH_URL = 'https://app.veeqo.com/oauth/authorize';
const VEEQO_TOKEN_URL = 'https://api.veeqo.com/oauth/token';

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
        clientId: import.meta.env.VITE_VEEQO_CLIENT_ID || '',
        clientSecret: import.meta.env.VITE_VEEQO_CLIENT_SECRET || '',
        redirectUri: import.meta.env.VITE_VEEQO_REDIRECT_URI || `${window.location.origin}/veeqo/callback`,
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
   * Check inventory availability for cart items
   */
  async checkInventoryAvailability(cartItems) {
    if (!this.isEnabled()) {
      return { available: true, items: [] };
    }

    try {
      const inventoryChecks = await Promise.all(
        cartItems.map(async (item) => {
          try {
            const inventory = await this.getInventory(item.id);
            const totalAvailable = inventory.reduce((sum, loc) => sum + (loc.available || 0), 0);
            
            return {
              productId: item.id,
              productName: item.name,
              requested: item.quantity,
              available: totalAvailable,
              inStock: totalAvailable >= item.quantity
            };
          } catch (error) {
            console.warn(`Could not check inventory for ${item.name}:`, error);
            return {
              productId: item.id,
              productName: item.name,
              requested: item.quantity,
              available: null,
              inStock: true // Assume in stock if check fails
            };
          }
        })
      );

      const outOfStock = inventoryChecks.filter(check => !check.inStock);
      
      return {
        available: outOfStock.length === 0,
        items: inventoryChecks,
        outOfStock
      };
    } catch (error) {
      console.error('Failed to check inventory availability:', error);
      // Return available=true to not block checkout if Veeqo is down
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
}

// Export singleton instance
export const veeqoService = new VeeqoService();
export default veeqoService;
