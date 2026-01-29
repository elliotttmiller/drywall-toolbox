import { useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, ShoppingCart } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    cart: <ShoppingCart className="w-5 h-5" />
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    cart: 'bg-primary-600'
  };

  return (
    <div className="fixed top-20 right-4 z-[60] animate-slideDown">
      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={`${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}
      >
        {icons[type]}
        <span className="flex-1 font-medium">{message}</span>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Close notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
