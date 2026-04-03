import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductImageGallery({ product }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const touchStartX = useRef(null);

  // Normalise images array: prefer product.images[], fall back to product.image
  const images = (() => {
    const arr = Array.isArray(product?.images) && product.images.length
      ? product.images
      : product?.image
        ? [product.image]
        : [];
    return arr.length ? arr : ['/no-image-placeholder.webp'];
  })();

  const hasMultiple = images.length > 1;

  // Reset when product changes
  useEffect(() => {
    setCurrentIndex(0);
    setLoaded(false);
  }, [product?.id, product?.sku]);

  const prev = () => {
    setLoaded(false);
    setCurrentIndex(i => (i - 1 + images.length) % images.length);
  };
  const next = () => {
    setLoaded(false);
    setCurrentIndex(i => (i + 1) % images.length);
  };
  const goTo = (i) => {
    if (i === currentIndex) return;
    setLoaded(false);
    setCurrentIndex(i);
  };

  // Touch swipe
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  // Keyboard navigation (desktop)
  useEffect(() => {
    if (!hasMultiple) return;
    const handler = (e) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLoaded(false);
        setCurrentIndex(i => (i - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLoaded(false);
        setCurrentIndex(i => (i + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasMultiple, images.length]);

  const src = images[currentIndex] || '/no-image-placeholder.webp';

  return (
    <div className="flex flex-col gap-3">
      {/* ── Main image ───────────────────────────────────────────── */}
      <div
        className="relative w-full rounded-2xl overflow-hidden bg-gray-50 border border-gray-100"
        style={{ aspectRatio: '4 / 3' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Loading skeleton */}
        {!loaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
        )}

        {/* Image */}
        <img
          key={src}
          src={src}
          alt={`${product?.name || 'Product'} — Image ${currentIndex + 1}`}
          className={`absolute inset-0 w-full h-full object-contain p-4 sm:p-6 transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/no-image-placeholder.webp';
            setLoaded(true);
          }}
        />

        {/* Prev / Next arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
              aria-label="Previous image"
            >
              <ChevronLeft size={17} className="text-gray-700" />
            </button>
            <button
              onClick={next}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
              aria-label="Next image"
            >
              <ChevronRight size={17} className="text-gray-700" />
            </button>

            {/* Dot / pill indicators */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-1.5 z-10 pointer-events-none">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentIndex
                      ? 'w-4 h-1.5 bg-blue-600'
                      : 'w-1.5 h-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Thumbnail strip (only when 2+ images) ────────────────── */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`View image ${i + 1}`}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === currentIndex
                  ? 'border-blue-600 ring-2 ring-blue-100 scale-[1.04]'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <img
                src={img}
                alt={`Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/no-image-placeholder.webp'; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

