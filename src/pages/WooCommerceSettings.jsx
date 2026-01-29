import { useState } from 'react';
import { useWooCommerce } from '../context/WooCommerceContext';
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Link as LinkIcon,
  Unlink,
  Save,
  Database,
  AlertCircle,
  CreditCard,
  ShoppingBag
} from 'lucide-react';

export default function WooCommerceSettings() {
  const { 
    isEnabled, 
    config, 
    syncStatus,
    paymentGateways,
    updateConfig, 
    testConnection,
    disconnect,
    syncProducts 
  } = useWooCommerce();

  const [formData, setFormData] = useState({
    storeUrl: config.storeUrl || '',
    consumerKey: config.consumerKey || '',
    consumerSecret: config.consumerSecret || '',
    enabled: config.enabled || false
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');

    try {
      updateConfig(formData);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);

    try {
      const result = await testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect from WooCommerce?')) {
      disconnect();
      setSaveMessage('Disconnected from WooCommerce');
      setConnectionStatus(null);
    }
  };

  const handleSync = async () => {
    try {
      setSaveMessage('Syncing products...');
      await syncProducts();
      setSaveMessage('Products synced successfully!');
    } catch (error) {
      setSaveMessage(`Sync error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="h-8 w-8 text-primary-600" />
            <h1 className="text-4xl font-bold text-gray-900">WooCommerce Integration</h1>
          </div>
          <p className="text-gray-600">
            Connect your WooCommerce store for seamless product, order, and payment management
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Connection Status</h2>
          
          <div className="flex items-center gap-4 mb-4">
            {isEnabled ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="flex-grow">
                  <p className="font-semibold text-green-700">Connected to WooCommerce</p>
                  <p className="text-sm text-gray-600">Integration is active</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Unlink size={18} />
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-gray-400" />
                <div className="flex-grow">
                  <p className="font-semibold text-gray-700">Not Connected</p>
                  <p className="text-sm text-gray-600">Configure credentials to enable integration</p>
                </div>
              </>
            )}
          </div>

          {/* Test Connection */}
          {formData.storeUrl && formData.consumerKey && formData.consumerSecret && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Test API Connection</p>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <LinkIcon size={18} className={testing ? 'animate-spin' : ''} />
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              
              {connectionStatus && (
                <div className={`p-3 rounded-lg ${
                  connectionStatus.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionStatus.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <p className={`text-sm font-semibold ${
                      connectionStatus.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {connectionStatus.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sync Status */}
          {isEnabled && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Product Sync</p>
                  {syncStatus.lastSync && (
                    <p className="text-xs text-gray-500">
                      Last synced: {new Date(syncStatus.lastSync).toLocaleString()}
                    </p>
                  )}
                  {syncStatus.error && (
                    <p className="text-xs text-red-600 mt-1">Error: {syncStatus.error}</p>
                  )}
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncStatus.syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={18} className={syncStatus.syncing ? 'animate-spin' : ''} />
                  {syncStatus.syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>
          )}

          {/* Payment Gateways */}
          {isEnabled && paymentGateways.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Active Payment Gateways</p>
              <div className="flex flex-wrap gap-2">
                {paymentGateways.map(gateway => (
                  <div key={gateway.id} className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                    <CreditCard size={14} />
                    {gateway.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration</h2>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Setting Up WooCommerce API</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Log in to your WordPress admin dashboard</li>
                  <li>Go to WooCommerce → Settings → Advanced → REST API</li>
                  <li>Click "Add Key" and generate API credentials</li>
                  <li>Set permissions to "Read/Write"</li>
                  <li>Copy the Consumer Key and Consumer Secret below</li>
                </ol>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable Integration */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="enabled" className="font-semibold text-gray-900">
                Enable WooCommerce Integration
              </label>
            </div>

            {/* Store URL */}
            <div>
              <label htmlFor="storeUrl" className="block text-sm font-semibold text-gray-700 mb-2">
                Store URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                id="storeUrl"
                value={formData.storeUrl}
                onChange={(e) => setFormData({ ...formData, storeUrl: e.target.value })}
                placeholder="https://your-store.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your WooCommerce store URL (e.g., https://mystore.com)
              </p>
            </div>

            {/* Consumer Key */}
            <div>
              <label htmlFor="consumerKey" className="block text-sm font-semibold text-gray-700 mb-2">
                Consumer Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="consumerKey"
                value={formData.consumerKey}
                onChange={(e) => setFormData({ ...formData, consumerKey: e.target.value })}
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Consumer Secret */}
            <div>
              <label htmlFor="consumerSecret" className="block text-sm font-semibold text-gray-700 mb-2">
                Consumer Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="consumerSecret"
                value={formData.consumerSecret}
                onChange={(e) => setFormData({ ...formData, consumerSecret: e.target.value })}
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-semibold"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>

              {saveMessage && (
                <p className={`text-sm font-semibold ${
                  saveMessage.toLowerCase().includes('error') 
                    ? 'text-red-600' 
                    : 'text-green-600'
                }`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Features Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Integration Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <ShoppingBag className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Product Synchronization</p>
                <p className="text-sm text-gray-600">Sync products from WooCommerce catalog</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Database className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Order Management</p>
                <p className="text-sm text-gray-600">Create and track orders automatically</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CreditCard className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Payment Processing</p>
                <p className="text-sm text-gray-600">Process payments through configured gateways</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Stock Management</p>
                <p className="text-sm text-gray-600">Real-time inventory tracking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
