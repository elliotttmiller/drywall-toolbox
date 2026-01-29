import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVeeqo } from '../context/VeeqoContext';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function VeeqoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useVeeqo();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError(`Authorization failed: ${errorParam}`);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      try {
        await handleOAuthCallback(code);
        setStatus('success');
        
        // Redirect to settings after 2 seconds
        setTimeout(() => {
          navigate('/settings/veeqo');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Failed to complete authorization');
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'processing' && (
          <>
            <Loader className="h-16 w-16 text-primary-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connecting to Veeqo
            </h2>
            <p className="text-gray-600">
              Please wait while we complete the authorization...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Successfully Connected!
            </h2>
            <p className="text-gray-600 mb-4">
              Your store is now connected to Veeqo.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to settings...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/settings/veeqo')}
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
