import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';

export default function ProductImageGallery({ product }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Get all images or fallback to single image
  const images = product?.images || (product?.image ? [product.image] : []);
  const hasMultipleImages = images.length > 1;

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const goToNextImage = () => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const goToPreviousImage = () => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  // Touch handlers for mobile swipe
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNextImage();
    } else if (isRightSwipe) {
      goToPreviousImage();
    }
  };

  // Keyboard arrow navigation for desktop users — only fires when no form element is focused
  useEffect(() => {
    if (!hasMultipleImages) return;
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentImageIndex(prev => (prev + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultipleImages, images.length]);

  const currentImage = images[currentImageIndex] || '/no-image-placeholder.webp';

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Main Image Display */}
      <div className="relative bg-gray-50 rounded-lg p-4 sm:p-6 flex items-center justify-center">
        <div 
          className="w-full h-75 sm:h-100 lg:h-125 flex items-center justify-center relative"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {currentImage ? (
            <img
              src={currentImage}
              alt={`${product?.name || 'Product'} - Image ${currentImageIndex + 1}`}
              className="max-w-full max-h-full w-auto h-auto object-contain transition-opacity duration-300"
              onError={(e) => { 
                e.currentTarget.onerror = null; 
                e.currentTarget.src = '/no-image-placeholder.webp'; 
              }}
            />
          ) : (
            <div className="text-gray-300 flex justify-center">
              <ShoppingCart size={80} className="sm:w-28 sm:h-28 lg:w-32 lg:h-32" strokeWidth={1} />
            </div>
          )}
        </div>

        {/* Navigation Arrows - Only show if multiple images */}
        {hasMultipleImages && (
          <>
            {/* Previous Arrow */}
            <button
              onClick={goToPreviousImage}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 sm:p-2.5 rounded-full shadow-lg transition-all hover:scale-110 z-10"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} className="sm:w-6 sm:h-6 text-gray-800" />
            </button>

            {/* Next Arrow */}
            <button
              onClick={goToNextImage}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 sm:p-2.5 rounded-full shadow-lg transition-all hover:scale-110 z-10"
              aria-label="Next image"
            >
              <ChevronRight size={20} className="sm:w-6 sm:h-6 text-gray-800" />
            </button>

            {/* Image Counter - Mobile */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
              {currentImageIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail Strip - Only show if multiple images */}
      {hasMultipleImages && (
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                index === currentImageIndex
                  ? 'border-blue-600 ring-2 ring-blue-200 scale-105'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={img}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { 
                  e.currentTarget.onerror = null; 
                  e.currentTarget.src = '/no-image-placeholder.webp'; 
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
