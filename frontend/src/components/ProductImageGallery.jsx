import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

// Sits above the product modal (10002) and its backdrop (10001)
const LIGHTBOX_Z_INDEX = 10010;

// Directional slide variants — enter from the side, exit to the opposite side
const slideVariants = {
  enter: (dir) => ({ x: dir >= 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }),
};

const slideTransition = {
  x: { type: 'spring', stiffness: 380, damping: 38, mass: 0.8 },
  opacity: { duration: 0.18 },
};

// Shared className for the lightbox prev/next nav buttons
const LB_NAV_BTN_CLASS = 'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/[0.22] text-white transition-all hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

export default function ProductImageGallery({ product }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [imgLoaded, setImgLoaded] = useState({});
  const [lightbox, setLightbox] = useState({ open: false, index: 0, dir: 0 });

  const thumbsRef = useRef(null);
  const galleryRef = useRef(null);
  // Refs for latest values — avoids stale closures in event handlers
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const lightboxRef = useRef(lightbox);
  lightboxRef.current = lightbox;
  // Touch swipe refs
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const lbTouchStartX = useRef(null);
  const lbTouchStartTime = useRef(null);
  // Focus management for lightbox
  const lbCloseBtnRef = useRef(null);
  const lbPrevFocusRef = useRef(null);

  // ── Images normalisation ──────────────────────────────────────────────────
  const images = (() => {
    const arr = Array.isArray(product?.images) && product.images.length
      ? product.images
      : product?.image ? [product.image] : [];
    return arr.length ? arr : ['/no-image-placeholder.webp'];
  })();
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const hasMultiple = images.length > 1;

  // ── Reset on product change (during render, avoids effect warning) ────────
  const productKey = `${product?.id ?? ''}|${product?.sku ?? ''}`;
  const [lastKey, setLastKey] = useState(productKey);
  if (productKey !== lastKey) {
    setLastKey(productKey);
    setCurrentIndex(0);
    setDirection(0);
    setImgLoaded({});
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  const scrollThumb = useCallback((idx) => {
    const el = thumbsRef.current?.children[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  const goTo = useCallback((idx, dir) => {
    setDirection(dir);
    setCurrentIndex(idx);
    scrollThumb(idx);
  }, [scrollThumb]);

  const prev = useCallback(() => {
    const len = imagesRef.current.length;
    goTo((currentIndexRef.current - 1 + len) % len, -1);
  }, [goTo]);

  const next = useCallback(() => {
    const len = imagesRef.current.length;
    goTo((currentIndexRef.current + 1) % len, 1);
  }, [goTo]);

  // ── Lightbox helpers ──────────────────────────────────────────────────────
  const openLb = useCallback((idx) => {
    lbPrevFocusRef.current = document.activeElement;
    setLightbox({ open: true, index: idx, dir: 0 });
  }, []);
  const closeLb = useCallback(() => {
    setLightbox(lb => ({ ...lb, open: false }));
    // Restore focus after exit animation (~220 ms)
    setTimeout(() => {
      if (lbPrevFocusRef.current && typeof lbPrevFocusRef.current.focus === 'function') {
        lbPrevFocusRef.current.focus({ preventScroll: true });
      }
      lbPrevFocusRef.current = null;
    }, 280);
  }, []);
  const lbPrev = useCallback(() => {
    const len = imagesRef.current.length;
    setLightbox(lb => ({ ...lb, dir: -1, index: (lb.index - 1 + len) % len }));
  }, []);
  const lbNext = useCallback(() => {
    const len = imagesRef.current.length;
    setLightbox(lb => ({ ...lb, dir: 1, index: (lb.index + 1) % len }));
  }, []);

  // ── Keyboard navigation (stable — uses refs for current values) ───────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      const lb = lightboxRef.current;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lb.open ? lbPrev() : (imagesRef.current.length > 1 && prev());
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        lb.open ? lbNext() : (imagesRef.current.length > 1 && next());
      } else if (e.key === 'Escape' && lb.open) {
        // Stop here so ProductModal's Escape handler doesn't also close the modal
        e.stopImmediatePropagation();
        closeLb();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next, lbPrev, lbNext, closeLb]);

  // ── Body scroll lock while lightbox is open ──────────────────────────────
  useEffect(() => {
    if (!lightbox.open) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [lightbox.open]);

  // ── Focus the close button when lightbox opens ───────────────────────────
  useEffect(() => {
    if (lightbox.open && lbCloseBtnRef.current) {
      lbCloseBtnRef.current.focus({ preventScroll: true });
    }
  }, [lightbox.open]);

  // ── Preload the next/prev images so swiping feels instant ────────────────
  useEffect(() => {
    if (images.length <= 1) return;
    const len = images.length;
    const toPreload = [
      images[(currentIndex + 1) % len],
      images[(currentIndex - 1 + len) % len],
    ];
    toPreload.forEach((src) => {
      if (!src) return;
      const img = new Image();
      img.src = src;
    });
  }, [currentIndex, images]);

  // ── Non-passive touchmove to prevent vertical scroll during horizontal swipe
  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (touchStartX.current === null) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - (touchStartY.current ?? 0));
      if (dx > dy && dx > 6) {
        e.preventDefault();
        isDragging.current = true;
      }
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  // ── Gallery touch handlers ────────────────────────────────────────────────
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };
  const onGalleryClick = () => {
    if (!isDragging.current) openLb(currentIndexRef.current);
  };

  // ── Lightbox touch handlers ───────────────────────────────────────────────
  const onLbTouchStart = (e) => {
    lbTouchStartX.current = e.touches[0].clientX;
    lbTouchStartTime.current = Date.now();
  };
  const onLbTouchEnd = (e) => {
    if (lbTouchStartX.current === null || lbTouchStartTime.current === null) return;
    const diff = lbTouchStartX.current - e.changedTouches[0].clientX;
    const elapsed = Date.now() - lbTouchStartTime.current;
    // Trigger on distance >40 px OR fast flick >0.3 px/ms over at least 10 px
    const velocity = Math.abs(diff) / Math.max(elapsed, 1);
    if (Math.abs(diff) > 40 || (velocity > 0.3 && Math.abs(diff) > 10)) {
      diff > 0 ? lbNext() : lbPrev();
    }
    lbTouchStartX.current = null;
    lbTouchStartTime.current = null;
  };

  return (
    <>
      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Main image container */}
        <div
          ref={galleryRef}
          className="relative w-full rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group cursor-zoom-in select-none"
          style={{ aspectRatio: '1 / 1' }}
          onClick={onGalleryClick}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="button"
          tabIndex={0}
          aria-label="Tap to view fullscreen"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(currentIndex); } }}
        >
          {/* Per-image skeleton loader */}
          {!imgLoaded[currentIndex] && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse z-0" />
          )}

          {/* Slide-animated image */}
          <AnimatePresence initial={false} custom={direction}>
            <motion.img
              key={currentIndex}
              src={images[currentIndex]}
              alt={`${product?.name || 'Product'} — image ${currentIndex + 1} of ${images.length}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
              fetchpriority={currentIndex === 0 ? 'high' : undefined}
              decoding="async"
              draggable={false}
              className={`absolute inset-0 w-full h-full object-contain p-3 sm:p-4 transition-opacity duration-150 ${imgLoaded[currentIndex] ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(prev => ({ ...prev, [currentIndex]: true }))}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/no-image-placeholder.webp';
                setImgLoaded(prev => ({ ...prev, [currentIndex]: true }));
              }}
            />
          </AnimatePresence>

          {/* Expand / zoom-in button — always visible on touch devices, hover-only on pointer devices */}
          <button
            className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 shadow-sm opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
            onClick={(e) => { e.stopPropagation(); openLb(currentIndex); }}
            aria-label="Expand image to fullscreen"
            tabIndex={0}
          >
            <ZoomIn size={14} className="text-gray-600" />
          </button>

          {/* Prev / Next arrows */}
          {hasMultiple && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/95 shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
                aria-label="Previous image"
              >
                <ChevronLeft size={17} className="text-gray-700" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/95 shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
                aria-label="Next image"
              >
                <ChevronRight size={17} className="text-gray-700" />
              </button>

              {/* "1 / N" counter pill */}
              <div
                className="absolute bottom-3 right-3 z-10 flex items-center px-2.5 py-1 rounded-full bg-black/40 text-white text-xs font-medium tabular-nums backdrop-blur-sm pointer-events-none"
                aria-label={`Image ${currentIndex + 1} of ${images.length}`}
              >
                {currentIndex + 1} / {images.length}
              </div>

              {/* Dot indicators (up to 8 images) */}
              {images.length <= 8 && (
                <div className="absolute bottom-3 left-3 right-16 flex items-center gap-1.5 z-10 pointer-events-none">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i === currentIndex
                          ? 'w-4 h-1.5 bg-white shadow-sm'
                          : 'w-1.5 h-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Thumbnail strip (2+ images) ─────────────────────────────── */}
        {hasMultiple && (
          <div ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > currentIndex ? 1 : -1)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === currentIndex ? 'true' : undefined}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                  i === currentIndex
                    ? 'border-blue-600 ring-2 ring-blue-100 scale-[1.04]'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${i + 1}`}
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain bg-white p-1"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/no-image-placeholder.webp'; }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Fullscreen Lightbox (React portal → renders outside modal stacking context) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {lightbox.open && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center"
              style={{ zIndex: LIGHTBOX_Z_INDEX }}
              role="dialog"
              aria-modal="true"
              aria-label={`Full-screen image — ${product?.name || 'Product'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/96"
                onClick={closeLb}
                aria-hidden="true"
              />

              {/* Inner — spring-scale entrance */}
              <motion.div
                className="relative flex items-center justify-center w-full h-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.88, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }}
                onTouchStart={onLbTouchStart}
                onTouchEnd={onLbTouchEnd}
              >
                {/* Slide-animated lightbox image */}
                <AnimatePresence initial={false} custom={lightbox.dir}>
                  <motion.img
                    key={lightbox.index}
                    src={images[lightbox.index]}
                    alt={`${product?.name || 'Product'} — image ${lightbox.index + 1} of ${images.length}`}
                    custom={lightbox.dir}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={slideTransition}
                    className="max-w-[90vw] max-h-[78vh] w-auto h-auto object-contain select-none"
                    draggable={false}
                    style={{ pointerEvents: 'none' }}
                  />
                </AnimatePresence>

                {/* Close button — receives focus when lightbox opens */}
                <button
                  ref={lbCloseBtnRef}
                  onClick={closeLb}
                  className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  aria-label="Close fullscreen image"
                >
                  <X size={20} />
                </button>

                {/* Lightbox prev / next arrows */}
                {hasMultiple && (
                  <>
                    <button
                      onClick={lbPrev}
                      className={`${LB_NAV_BTN_CLASS} left-3 sm:left-5`}
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={lbNext}
                      className={`${LB_NAV_BTN_CLASS} right-3 sm:right-5`}
                      aria-label="Next image"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}

                {/* Bottom bar: counter + thumbnail strip */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 pb-6 pointer-events-none">
                  {/* "1 / N" counter */}
                  <div
                    className="px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium tabular-nums backdrop-blur-sm pointer-events-auto"
                    aria-label={`Image ${lightbox.index + 1} of ${images.length}`}
                  >
                    {lightbox.index + 1} / {images.length}
                  </div>

                  {/* Thumbnail strip inside lightbox */}
                  {hasMultiple && (
                    <div
                      className="flex gap-2 overflow-x-auto px-4 pointer-events-auto"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox(lb => ({ ...lb, dir: i > lb.index ? 1 : -1, index: i }))}
                          aria-label={`View image ${i + 1}`}
                          className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                            i === lightbox.index
                              ? 'border-white scale-[1.08] opacity-100'
                              : 'border-white/20 opacity-50 hover:opacity-80 hover:border-white/50'
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Thumbnail ${i + 1}`}
                            className="w-full h-full object-contain bg-black/30 p-0.5"
                            draggable={false}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

