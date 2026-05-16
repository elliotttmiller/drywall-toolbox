import { useEffect, useRef } from 'react';

export default function StorefrontMobileDrawer({ isOpen, onClose, labelledBy = 'storefront-drawer-title', children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="storefront-mobile-drawer" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" className="storefront-mobile-drawer__backdrop" onClick={onClose} aria-label="Close menu" />
      <div className="storefront-mobile-drawer__panel">
        <button ref={closeRef} type="button" onClick={onClose} className="sr-only">Close</button>
        {children}
      </div>
    </div>
  );
}
