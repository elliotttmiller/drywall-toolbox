/**
 * Credential-free WooCommerce facade.
 *
 * This compatibility service preserves the provider API while routing all
 * browser operations through DTB REST or WooCommerce Store API contracts.
 * WooCommerce administrative credentials are server-only and are never stored
 * in localStorage or compiled into the frontend bundle.
 */

import { apiClient } from '../api/client.js';

class WooCommerceService {
  constructor() {
    this.clearLegacyBrowserCredentials();
    this.config = Object.freeze({
      enabled: true,
      mode: 'server_proxy',
      storeUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });
  }

  clearLegacyBrowserCredentials() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('woocommerce_config');
      window.sessionStorage.removeItem('woocommerce_config');
    } catch {
      // Storage can be unavailable in private browsing or hardened browsers.
    }
  }

  isEnabled() {
    return true;
  }

  saveConfig() {
    throw new Error('WooCommerce credentials are managed server-side and cannot be changed from the storefront.');
  }

  disconnect() {
    throw new Error('The server-side WooCommerce integration cannot be disconnected from the storefront.');
  }

  async testConnection() {
    try {
      await apiClient('/wp-json/drywall/v1/products?per_page=1&status=publish');
      return { success: true, message: 'Server-side WooCommerce proxy is reachable.' };
    } catch (error) {
      return { success: false, message: error?.message || 'WooCommerce proxy is unavailable.' };
    }
  }

  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient(`/wp-json/drywall/v1/products${query ? `?${query}` : ''}`);
  }

  async getProduct(productId) {
    return apiClient(`/wp-json/drywall/v1/products/${encodeURIComponent(productId)}`);
  }

  async createProduct() {
    throw new Error('Product mutations are restricted to authenticated server-side admin workflows.');
  }

  async updateProduct() {
    throw new Error('Product mutations are restricted to authenticated server-side admin workflows.');
  }

  async deleteProduct() {
    throw new Error('Product mutations are restricted to authenticated server-side admin workflows.');
  }

  async getOrders(params = {}) {
    const safeParams = {
      page: params.page || 1,
      per_page: params.per_page || 20,
      ...(params.status ? { status: params.status } : {}),
      ...(params.orderby ? { orderby: params.orderby } : {}),
      ...(params.order ? { order: params.order } : {}),
    };
    return apiClient(`/wp-json/drywall/v1/orders?${new URLSearchParams(safeParams).toString()}`);
  }

  async getOrder(orderId) {
    return apiClient(`/wp-json/drywall/v1/orders/${encodeURIComponent(orderId)}`);
  }

  async getPaymentGateways() {
    const capabilities = await apiClient('/wp-json/dtb/v1/checkout/capabilities');
    const gateways = Array.isArray(capabilities?.gateways) ? capabilities.gateways : [];
    return gateways.flatMap((gateway) => {
      if (Array.isArray(gateway?.payment_methods)) return gateway.payment_methods;
      return gateway?.id ? [gateway] : [];
    });
  }

  async getPaymentGateway(gatewayId) {
    const gateways = await this.getPaymentGateways();
    return gateways.find((gateway) => String(gateway?.id) === String(gatewayId)) || null;
  }

  async getShippingMethods() {
    throw new Error('Checkout shipping methods are calculated through the DTB shipping-rate endpoint.');
  }

  async getShippingZones() {
    throw new Error('Shipping-zone administration is restricted to WooCommerce wp-admin.');
  }

  async calculateShipping(orderData = {}) {
    return apiClient('/wp-json/dtb/v1/veeqo/shipping-rates', {
      method: 'POST',
      body: JSON.stringify({
        destination: orderData.destination || orderData.shipping || {},
        items: Array.isArray(orderData.items) ? orderData.items : (orderData.line_items || []),
      }),
    });
  }

  async getCustomer(customerId) {
    return apiClient(`/wp-json/drywall/v1/customers/${encodeURIComponent(customerId)}`);
  }

  async getCustomers() {
    throw new Error('Customer-list access is restricted to authenticated wp-admin workflows.');
  }

  async createCustomer(customerData) {
    return apiClient('/wp-json/drywall/v1/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  async syncProducts() {
    const products = await this.getProducts({ per_page: 100, status: 'publish' });
    return Array.isArray(products) ? products : (products?.products || []);
  }

  async getProductStock(productId) {
    const product = await this.getProduct(productId);
    return {
      inStock: product?.stock_status === 'instock',
      quantity: product?.stock_quantity ?? null,
      manageStock: Boolean(product?.manage_stock),
    };
  }

  async checkInventoryAvailability(cartItems = []) {
    const items = cartItems.map((item) => ({
      product_id: Number(item?.product_id || item?.parent_id || item?.id || 0),
      variation_id: Number(item?.variation_id || (item?.parent_id ? item?.id : 0) || 0),
      quantity: Math.max(1, Number(item?.quantity || 1)),
      sku: String(item?.sku || ''),
    }));

    return apiClient('/wp-json/dtb/v1/veeqo/cart-availability', {
      method: 'POST',
      headers: {
        'X-DTB-Cart-Session': this.getCartSessionToken(),
      },
      body: JSON.stringify({ items }),
    });
  }

  getCartSessionToken() {
    if (typeof window === 'undefined') return 'server-render';
    const key = 'dtb:cart-availability-session:v1';
    try {
      let token = window.sessionStorage.getItem(key);
      if (!token) {
        const cryptoApi = globalThis.crypto;
        if (typeof cryptoApi?.randomUUID === 'function') {
          token = cryptoApi.randomUUID();
        } else if (typeof cryptoApi?.getRandomValues === 'function') {
          const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
          token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        } else {
          return 'browser-session';
        }
        window.sessionStorage.setItem(key, token);
      }
      return token;
    } catch {
      return 'browser-session';
    }
  }
}

export const wooCommerceService = new WooCommerceService();
export default wooCommerceService;
