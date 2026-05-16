import { useEffect, useRef } from 'react';

export default function StorefrontMobileDrawer({ isOpen, onClose, labelledBy = 'storefront-drawer-title', children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Defer focus so the CSS transition has begun
      const focusTimeout = setTimeout(() => closeRef.current?.focus(), 20);
      return () => {
        clearTimeout(focusTimeout);
        document.body.style.overflow = previousOverflow;
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className="storefront-mobile-drawer"
      data-open={isOpen ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label="Mobile navigation"
    >
      <button
        type="button"
        className="storefront-mobile-drawer__backdrop"
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={isOpen ? 0 : -1}
      />
      <div className="storefront-mobile-drawer__panel">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="sr-only"
          tabIndex={isOpen ? 0 : -1}
        >
          Close
        </button>
        {children}
      </div>
    </div>
  );
}
