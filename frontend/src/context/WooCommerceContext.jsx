import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import wooCommerceService from '../services/woocommerce';

const WooCommerceContext = createContext(null);

export function useWooCommerce() {
  const context = useContext(WooCommerceContext);
  if (!context) throw new Error('useWooCommerce must be used within a WooCommerceProvider');
  return context;
}

export function WooCommerceProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState({
    checking: true,
    success: false,
    message: 'Checking server-side WooCommerce proxy…',
  });
  const [syncStatus, setSyncStatus] = useState({ syncing: false, lastSync: null, error: null });
  const [paymentGateways, setPaymentGateways] = useState([]);

  const testConnection = useCallback(async () => {
    const result = await wooCommerceService.testConnection();
    setConnectionStatus({ checking: false, ...result });
    return result;
  }, []);

  const loadPaymentGateways = useCallback(async () => {
    try {
      const gateways = await wooCommerceService.getPaymentGateways();
      setPaymentGateways((Array.isArray(gateways) ? gateways : []).filter((gateway) => gateway?.enabled !== false));
    } catch {
      setPaymentGateways([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await wooCommerceService.testConnection();
      if (cancelled) return;
      setConnectionStatus({ checking: false, ...result });
      if (result.success) await loadPaymentGateways();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPaymentGateways]);

  const syncProducts = useCallback(async () => {
    setSyncStatus({ syncing: true, lastSync: null, error: null });
    try {
      const products = await wooCommerceService.syncProducts();
      setSyncStatus({ syncing: false, lastSync: new Date().toISOString(), error: null });
      return products;
    } catch (error) {
      setSyncStatus({ syncing: false, lastSync: null, error: error?.message || 'Product sync failed.' });
      throw error;
    }
  }, []);

  const checkInventory = useCallback(
    (cartItems) => wooCommerceService.checkInventoryAvailability(cartItems),
    [],
  );

  const getOrder = useCallback(
    (orderId) => wooCommerceService.getOrder(orderId),
    [],
  );

  const unsupportedConfigMutation = useCallback(() => {
    throw new Error('WooCommerce credentials are managed server-side in WordPress configuration.');
  }, []);

  const value = useMemo(() => ({
    isEnabled: connectionStatus.success,
    config: wooCommerceService.config,
    connectionStatus,
    syncStatus,
    paymentGateways,
    updateConfig: unsupportedConfigMutation,
    disconnect: unsupportedConfigMutation,
    testConnection,
    syncProducts,
    checkInventory,
    getOrder,
  }), [
    connectionStatus,
    syncStatus,
    paymentGateways,
    unsupportedConfigMutation,
    testConnection,
    syncProducts,
    checkInventory,
    getOrder,
  ]);

  return <WooCommerceContext.Provider value={value}>{children}</WooCommerceContext.Provider>;
}
