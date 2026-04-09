import { createContext, useContext, useState } from 'react';
import veeqoService from '../services/veeqo';

const VeeqoContext = createContext();


export function useVeeqo() {
  const context = useContext(VeeqoContext);
  if (!context) {
    throw new Error('useVeeqo must be used within a VeeqoProvider');
  }
  return context;
}

export function VeeqoProvider({ children }) {
  const [isEnabled, setIsEnabled] = useState(() => veeqoService.isEnabled());
  const [isConnected, setIsConnected] = useState(() => !!veeqoService.accessToken);
  const [config, setConfig] = useState(veeqoService.config);
  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSync: null,
    error: null
  });

  const updateConfig = (newConfig) => {
    veeqoService.saveConfig(newConfig);
    setConfig(newConfig);
    setIsEnabled(veeqoService.isEnabled());
  };

  const connect = () => {
    try {
      veeqoService.initiateOAuth();
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      throw error;
    }
  };

  const disconnect = () => {
    veeqoService.disconnect();
    setIsConnected(false);
    setIsEnabled(false);
    setConfig(veeqoService.config);
  };

  const handleOAuthCallback = async (code) => {
    try {
      await veeqoService.exchangeCodeForToken(code);
      setIsConnected(true);
      return true;
    } catch (error) {
      console.error('OAuth callback failed:', error);
      throw error;
    }
  };

  const syncProducts = async () => {
    if (!isEnabled) {
      throw new Error('Veeqo integration not enabled');
    }

    setSyncStatus({ syncing: true, lastSync: null, error: null });
    
    try {
      const products = await veeqoService.syncProducts();
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

  /**
   * Check inventory for an array of cart items via the server-side proxy.
   * Always resolves (never throws) — WooCommerce enforces stock server-side.
   */
  const checkInventory = async (cartItems) => {
    try {
      return await veeqoService.checkInventoryAvailability(cartItems);
    } catch (error) {
      console.warn('Inventory check failed (non-fatal):', error);
      return { available: true, items: [], error: error.message };
    }
  };

  const value = {
    isEnabled,
    isConnected,
    config,
    syncStatus,
    updateConfig,
    connect,
    disconnect,
    handleOAuthCallback,
    syncProducts,
    checkInventory,
  };

  return <VeeqoContext.Provider value={value}>{children}</VeeqoContext.Provider>;
}
