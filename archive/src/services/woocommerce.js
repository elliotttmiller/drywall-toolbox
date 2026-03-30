/**
 * WooCommerce API Service
 * Handles authentication and API calls to WooCommerce for products, orders, and payment processing
 * Documentation: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */

class WooCommerceService {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load WooCommerce configuration
   */
  loadConfig() {
    try {
      const config = localStorage.getItem('woocommerce_config');
      return config ? JSON.parse(config) : {
        storeUrl: import.meta.env.VITE_WOOCOMMERCE_STORE_URL || '',
        consumerKey: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY || '',
        consumerSecret: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET || '',
        version: 'wc/v3',
        enabled: false
      };
    } catch (error) {
      console.error('Failed to load WooCommerce config:', error);
      return { enabled: false };
    }
  }

  /**
   * Save WooCommerce configuration
   */
  saveConfig(config) {
    try {
      localStorage.setItem('woocommerce_config', JSON.stringify(config));
      this.config = config;
    } catch (error) {
      console.error('Failed to save WooCommerce config:', error);
    }
  }

  /**
   * Check if WooCommerce integration is enabled and configured
   */
  isEnabled() {
    return this.config.enabled && this.config.storeUrl && this.config.consumerKey && this.config.consumerSecret;
  }

  /**
   * Get base API URL
   */
  getBaseUrl() {
    const url = this.config.storeUrl.replace(/\/$/, '');
    return `${url}/wp-json/${this.config.version}`;
  }

  /**
   * Create basic auth header
   */
  getAuthHeader() {
    const credentials = btoa(`${this.config.consumerKey}:${this.config.consumerSecret}`);
    return `Basic ${credentials}`;
  }

  /**
   * Make authenticated API request to WooCommerce
   */
  async apiRequest(endpoint, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('WooCommerce integration not enabled or configured');
    }

    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          `WooCommerce API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('WooCommerce API request failed:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.apiRequest('/products?per_page=1');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all products
   */
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.apiRequest(`/products?${queryString}`);
  }

  /**
   * Get product by ID
   */
  async getProduct(productId) {
    return this.apiRequest(`/products/${productId}`);
  }

  /**
   * Create product
   */
  async createProduct(productData) {
    return this.apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  /**
   * Update product
   */
  async updateProduct(productId, productData) {
    return this.apiRequest(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  }

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    return this.apiRequest(`/products/${productId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all orders
   */
  async getOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.apiRequest(`/orders?${queryString}`);
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId) {
    return this.apiRequest(`/orders/${orderId}`);
  }

  /**
   * Create order in WooCommerce
   */
  async createOrder(orderData) {
    return this.apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  /**
   * Update order
   */
  async updateOrder(orderId, orderData) {
    return this.apiRequest(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(orderData)
    });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status) {
    return this.updateOrder(orderId, { status });
  }

  /**
   * Get payment gateways
   */
  async getPaymentGateways() {
    return this.apiRequest('/payment_gateways');
  }

  /**
   * Get payment gateway by ID
   */
  async getPaymentGateway(gatewayId) {
    return this.apiRequest(`/payment_gateways/${gatewayId}`);
  }

  /**
   * Get shipping methods
   */
  async getShippingMethods() {
    return this.apiRequest('/shipping_methods');
  }

  /**
   * Get shipping zones
   */
  async getShippingZones() {
    return this.apiRequest('/shipping/zones');
  }

  /**
   * Calculate shipping for order
   */
  async calculateShipping(orderData) {
    // This typically requires a custom endpoint or plugin
    // For now, return a basic calculation
    const flatRate = 25;
    const freeShippingThreshold = 500;
    const subtotal = orderData.line_items.reduce(
      (sum, item) => sum + (item.price * item.quantity), 
      0
    );
    
    return {
      total: subtotal >= freeShippingThreshold ? 0 : flatRate,
      method: subtotal >= freeShippingThreshold ? 'Free Shipping' : 'Flat Rate'
    };
  }

  /**
   * Get customers
   */
  async getCustomers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.apiRequest(`/customers?${queryString}`);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId) {
    return this.apiRequest(`/customers/${customerId}`);
  }

  /**
   * Create customer
   */
  async createCustomer(customerData) {
    return this.apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData)
    });
  }

  /**
   * Sync cart to WooCommerce order
   */
  async syncCartToOrder(cartItems, customerInfo, paymentMethod = 'stripe') {
    if (!this.isEnabled()) {
      console.log('WooCommerce integration not enabled, skipping order sync');
      return null;
    }

    try {
      // Calculate shipping
      const shipping = await this.calculateShipping({
        line_items: cartItems.map(item => ({
          price: item.price,
          quantity: item.quantity
        }))
      });

      // Build order data
      const orderData = {
        payment_method: paymentMethod,
        payment_method_title: this.getPaymentMethodTitle(paymentMethod),
        set_paid: false, // Will be set to true after payment confirmation
        billing: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address_1: customerInfo.address,
          city: customerInfo.city,
          state: customerInfo.state,
          postcode: customerInfo.zip,
          country: customerInfo.country || 'US',
          email: customerInfo.email,
          phone: customerInfo.phone
        },
        shipping: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address_1: customerInfo.address,
          city: customerInfo.city,
          state: customerInfo.state,
          postcode: customerInfo.zip,
          country: customerInfo.country || 'US'
        },
        line_items: cartItems.map(item => ({
          product_id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        shipping_lines: [
          {
            method_id: shipping.method.toLowerCase().replace(/\s+/g, '_'),
            method_title: shipping.method,
            total: shipping.total.toString()
          }
        ]
      };

      const order = await this.createOrder(orderData);
      console.log('Order synced to WooCommerce:', order);
      return order;
    } catch (error) {
      console.error('Failed to sync order to WooCommerce:', error);
      throw error;
    }
  }

  /**
   * Get payment method title
   */
  getPaymentMethodTitle(method) {
    const methods = {
      stripe: 'Credit Card (Stripe)',
      paypal: 'PayPal',
      cod: 'Cash on Delivery',
      bacs: 'Direct Bank Transfer'
    };
    return methods[method] || method;
  }

  /**
   * Mark order as paid
   */
  async markOrderPaid(orderId, transactionId = null) {
    const updateData = {
      set_paid: true,
      status: 'processing'
    };

    if (transactionId) {
      updateData.transaction_id = transactionId;
    }

    return this.updateOrder(orderId, updateData);
  }

  /**
   * Sync products from WooCommerce
   */
  async syncProducts() {
    if (!this.isEnabled()) {
      throw new Error('WooCommerce integration not enabled');
    }

    try {
      const products = await this.getProducts({ per_page: 100 });
      console.log(`Synced ${products.length} products from WooCommerce`);
      return products;
    } catch (error) {
      console.error('Failed to sync products from WooCommerce:', error);
      throw error;
    }
  }

  /**
   * Get product stock status
   */
  async getProductStock(productId) {
    try {
      const product = await this.getProduct(productId);
      return {
        inStock: product.stock_status === 'instock',
        quantity: product.stock_quantity,
        manageStock: product.manage_stock
      };
    } catch (error) {
      console.error(`Failed to get stock for product ${productId}:`, error);
      return { inStock: true, quantity: null, manageStock: false };
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
            const stock = await this.getProductStock(item.id);
            const inStock = !stock.manageStock || 
                          (stock.inStock && (!stock.quantity || stock.quantity >= item.quantity));
            
            return {
              productId: item.id,
              productName: item.name,
              requested: item.quantity,
              available: stock.quantity,
              inStock
            };
          } catch (error) {
            console.warn(`Could not check inventory for ${item.name}:`, error);
            return {
              productId: item.id,
              productName: item.name,
              requested: item.quantity,
              available: null,
              inStock: true
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
      return { available: true, items: [], error: error.message };
    }
  }

  /**
   * Disconnect from WooCommerce
   */
  disconnect() {
    this.saveConfig({ ...this.config, enabled: false });
  }
}

// Export singleton instance
export const wooCommerceService = new WooCommerceService();
export default wooCommerceService;
