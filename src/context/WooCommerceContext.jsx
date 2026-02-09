import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import wooCommerceService from '../services/woocommerce';

const WooCommerceContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useWooCommerce() {
  const context = useContext(WooCommerceContext);
  if (!context) {
    throw new Error('useWooCommerce must be used within a WooCommerceProvider');
  }
  return context;
}

export function WooCommerceProvider({ children }) {
  const [isEnabled, setIsEnabled] = useState(() => wooCommerceService.isEnabled());
  const [config, setConfig] = useState(wooCommerceService.config);
  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSync: null,
    error: null
  });
  const [paymentGateways, setPaymentGateways] = useState([]);

  const loadPaymentGateways = useCallback(async () => {
    try {
      const gateways = await wooCommerceService.getPaymentGateways();
      setPaymentGateways(gateways.filter(g => g.enabled));
    } catch (error) {
      console.error('Failed to load payment gateways:', error);
    }
  }, []);

  useEffect(() => {
    // Load payment gateways if enabled on mount
    // This is async data fetching, which is a standard pattern for useEffect
    async function fetchPaymentGateways() {
      if (wooCommerceService.isEnabled()) {
        try {
          const gateways = await wooCommerceService.getPaymentGateways();
          setPaymentGateways(gateways.filter(g => g.enabled));
        } catch (error) {
          console.error('Failed to load payment gateways:', error);
        }
      }
    }
    
    fetchPaymentGateways();
  }, []);

  const updateConfig = (newConfig) => {
    wooCommerceService.saveConfig(newConfig);
    setConfig(newConfig);
    setIsEnabled(wooCommerceService.isEnabled());
    
    if (newConfig.enabled) {
      loadPaymentGateways();
    }
  };

  const testConnection = async () => {
    try {
      return await wooCommerceService.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return { success: false, message: error.message };
    }
  };

  const disconnect = () => {
    wooCommerceService.disconnect();
    setIsEnabled(false);
    setConfig(wooCommerceService.config);
    setPaymentGateways([]);
  };

  const syncProducts = async () => {
    if (!isEnabled) {
      throw new Error('WooCommerce integration not enabled');
    }

    setSyncStatus({ syncing: true, lastSync: null, error: null });
    
    try {
      const products = await wooCommerceService.syncProducts();
      setSyncStatus({
        syncing: false,
        lastSync: new Date().toISOString(),
        error: null
      });
      return products;
    } catch (error) {
      setSyncStatus({
        syncing: false,
        lastSync: null,
        error: error.message
      });
      throw error;
    }
  };

  const checkInventory = async (cartItems) => {
    if (!isEnabled) {
      return { available: true, items: [] };
    }

    try {
      return await wooCommerceService.checkInventoryAvailability(cartItems);
    } catch (error) {
      console.error('Inventory check failed:', error);
      return { available: true, items: [], error: error.message };
    }
  };

  const createOrder = async (cartItems, customerInfo, paymentMethod = 'stripe') => {
    if (!isEnabled) {
      return null;
    }

    try {
      return await wooCommerceService.syncCartToOrder(cartItems, customerInfo, paymentMethod);
    } catch (error) {
      console.error('Order creation failed:', error);
      throw error;
    }
  };

  const markOrderPaid = async (orderId, transactionId) => {
    if (!isEnabled) {
      return null;
    }

    try {
      return await wooCommerceService.markOrderPaid(orderId, transactionId);
    } catch (error) {
      console.error('Failed to mark order as paid:', error);
      throw error;
    }
  };

  const getOrder = async (orderId) => {
    if (!isEnabled) {
      return null;
    }

    try {
      return await wooCommerceService.getOrder(orderId);
    } catch (error) {
      console.error('Failed to get order:', error);
      throw error;
    }
  };

  const value = {
    isEnabled,
    config,
    syncStatus,
    paymentGateways,
    updateConfig,
    testConnection,
    disconnect,
    syncProducts,
    checkInventory,
    createOrder,
    markOrderPaid,
    getOrder
  };

  return <WooCommerceContext.Provider value={value}>{children}</WooCommerceContext.Provider>;
}
