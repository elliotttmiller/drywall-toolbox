import { useRef } from 'react';

export default function StorefrontRail({ label, className = '', children }) {
  const railRef = useRef(null);

  const onKeyDown = (event) => {
    if (!railRef.current) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const amount = Math.max(180, railRef.current.clientWidth * 0.85);
    railRef.current.scrollBy({
      left: event.key === 'ArrowRight' ? amount : -amount,
      behavior: 'smooth',
    });
  };

  return (
    <div
      ref={railRef}
      className={`storefront-rail ${className}`.trim()}
      role="region"
      aria-label={label || 'Product rail'}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
