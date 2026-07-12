import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Database,
  ExternalLink,
  RefreshCw,
  Server,
  ShieldCheck,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { useWooCommerce } from '../context/WooCommerceContext';
import SEOHead from '../components/shared/SEOHead';

export default function WooCommerceSettings() {
  const {
    isEnabled,
    connectionStatus,
    syncStatus,
    paymentGateways,
    testConnection,
    syncProducts,
  } = useWooCommerce();
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  const runConnectionTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      const result = await testConnection();
      setMessage(result.message);
    } finally {
      setTesting(false);
    }
  };

  const runCatalogRead = async () => {
    setMessage('Reading the current catalog through the server-side proxy…');
    try {
      const products = await syncProducts();
      setMessage(`Server-side proxy returned ${products.length} catalog products.`);
    } catch (error) {
      setMessage(error?.message || 'Catalog read failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 page-wrapper">
      <SEOHead noindex title="WooCommerce Integration Status" />
      <div className="container mx-auto px-4 max-w-4xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="h-8 w-8 text-primary-600" />
            <h1 className="text-4xl font-bold text-gray-900">WooCommerce Integration</h1>
          </div>
          <p className="text-gray-600">
            Read-only storefront diagnostics for the server-managed WooCommerce connection.
          </p>
        </header>

        <section className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              {connectionStatus.checking ? (
                <RefreshCw className="h-6 w-6 text-gray-500 animate-spin" />
              ) : isEnabled ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connection status</h2>
                <p className={isEnabled ? 'text-green-700' : 'text-red-700'}>
                  {connectionStatus.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={runConnectionTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={18} className={testing ? 'animate-spin' : ''} />
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Server-managed credentials</h2>
              <p className="text-gray-700 mb-3">
                WooCommerce consumer credentials and application passwords are configured only in the
                WordPress server environment. They are not accepted by this page, stored in browser
                storage, returned by a public endpoint, or compiled into JavaScript.
              </p>
              <p className="text-sm text-gray-600">
                Credential rotation and integration configuration are performed in secured wp-admin and
                hosting configuration, not in the customer-facing SPA.
              </p>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <Database className="h-5 w-5 text-primary-600" />
              <h2 className="font-bold text-gray-900">Catalog proxy</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Product reads use the credential-free `drywall/v1` server proxy.
            </p>
            <button
              type="button"
              onClick={runCatalogRead}
              disabled={syncStatus.syncing || !isEnabled}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={18} className={syncStatus.syncing ? 'animate-spin' : ''} />
              {syncStatus.syncing ? 'Reading…' : 'Verify catalog read'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <Server className="h-5 w-5 text-primary-600" />
              <h2 className="font-bold text-gray-900">Order boundary</h2>
            </div>
            <p className="text-sm text-gray-600">
              Storefront orders are created only through the DTB checkout session, confirmation, and
              finalization contract. Raw browser writes to WooCommerce admin REST APIs are disabled.
            </p>
          </div>
        </section>

        {paymentGateways.length > 0 && (
          <section className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="h-5 w-5 text-primary-600" />
              <h2 className="text-xl font-bold text-gray-900">Available payment methods</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {paymentGateways.map((gateway) => (
                <span key={gateway.id} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                  {gateway.title || gateway.label || gateway.id}
                </span>
              ))}
            </div>
          </section>
        )}

        {(message || syncStatus.error) && (
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm text-gray-700">{syncStatus.error || message}</p>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-600 flex items-center gap-2">
          <ExternalLink size={16} />
          Administrative WooCommerce configuration remains in secured WordPress wp-admin.
        </div>
      </div>
    </div>
  );
}
