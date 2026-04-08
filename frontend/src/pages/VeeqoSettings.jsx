import { useState } from 'react';
import { useVeeqo } from '../context/VeeqoContext';
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Link as LinkIcon,
  Unlink,
  Save,
  Database,
  AlertCircle
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function VeeqoSettings() {
  const { 
    isConnected, 
    config, 
    syncStatus,
    updateConfig, 
    connect, 
    disconnect,
    syncProducts 
  } = useVeeqo();

  const [formData, setFormData] = useState({
    clientId: config.clientId || '',
    clientSecret: config.clientSecret || '',
    redirectUri: config.redirectUri || `${window.location.origin}/veeqo/callback`,
    enabled: config.enabled || false
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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

  const handleConnect = () => {
    try {
      connect();
    } catch (error) {
      setSaveMessage(`Connection error: ${error.message}`);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect from Veeqo?')) {
      disconnect();
      setSaveMessage('Disconnected from Veeqo');
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
    <div className="min-h-screen bg-gray-50 py-8 page-wrapper">
      <SEOHead noindex title="Veeqo Integration Settings" />
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary-600" />
            <h1 className="text-4xl font-bold text-gray-900">Veeqo Integration</h1>
          </div>
          <p className="text-gray-600">
            Connect your store to Veeqo for automated inventory and order management
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Connection Status</h2>
          
          <div className="flex items-center gap-4 mb-4">
            {isConnected ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="grow">
                  <p className="font-semibold text-green-700">Connected to Veeqo</p>
                  <p className="text-sm text-gray-600">Your store is synced with Veeqo</p>
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
                <div className="grow">
                  <p className="font-semibold text-gray-700">Not Connected</p>
                  <p className="text-sm text-gray-600">Configure and connect to enable integration</p>
                </div>
                {formData.clientId && (
                  <button
                    onClick={handleConnect}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <LinkIcon size={18} />
                    Connect
                  </button>
                )}
              </>
            )}
          </div>

          {/* Sync Status */}
          {isConnected && (
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
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration</h2>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Getting Started with Veeqo</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Sign up for a Veeqo account at <a href="https://www.veeqo.com" target="_blank" rel="noopener noreferrer" className="underline">veeqo.com</a></li>
                  <li>Contact Veeqo support to register your app and get credentials</li>
                  <li>Enter your Client ID and Client Secret below</li>
                  <li>Click "Connect" to authorize the integration</li>
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
                Enable Veeqo Integration
              </label>
            </div>

            {/* Client ID */}
            <div>
              <label htmlFor="clientId" className="block text-sm font-semibold text-gray-700 mb-2">
                Client ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="Your Veeqo Client ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Client Secret */}
            <div>
              <label htmlFor="clientSecret" className="block text-sm font-semibold text-gray-700 mb-2">
                Client Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="clientSecret"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="Your Veeqo Client Secret"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Redirect URI */}
            <div>
              <label htmlFor="redirectUri" className="block text-sm font-semibold text-gray-700 mb-2">
                Redirect URI
              </label>
              <input
                type="text"
                id="redirectUri"
                value={formData.redirectUri}
                onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                This URL must be registered with Veeqo
              </p>
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
              <Database className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Real-time Inventory Sync</p>
                <p className="text-sm text-gray-600">Keep stock levels updated across all channels</p>
              </div>
            </div>
            <div className="flex gap-3">
              <RefreshCw className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Automated Order Management</p>
                <p className="text-sm text-gray-600">Orders automatically sync to Veeqo</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Inventory Validation</p>
                <p className="text-sm text-gray-600">Check stock before checkout</p>
              </div>
            </div>
            <div className="flex gap-3">
              <LinkIcon className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Multi-channel Support</p>
                <p className="text-sm text-gray-600">Centralize inventory across platforms</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
