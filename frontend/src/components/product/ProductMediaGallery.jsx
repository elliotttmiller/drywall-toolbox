/**
 * frontend/src/components/product/ProductMediaGallery.jsx
 *
 * Variation-aware media gallery.  Renders the selected variation's image
 * when available, falling back to the parent product gallery.
 *
 * Props:
 *   product           — parent product object
 *   selectedVariation — currently selected variation (or null)
 */

import { useState } from 'react';
import { PLACEHOLDER_IMAGE } from '../../constants/images.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function getImages(product, selectedVariation) {
  // Prefer the selected variation's image when it exists.
  if (selectedVariation?.image?.src) {
    const variationImg = {
      src: selectedVariation.image.src,
      alt: selectedVariation.image.alt || product?.name || '',
      id:  selectedVariation.image.id ?? 'variation',
    };
    // Prepend variation image to the parent gallery so the user can still
    // swipe through the full set.
    const parentGallery = Array.isArray(product?.images) ? product.images : [];
    return [variationImg, ...parentGallery.filter((img) => img.src !== variationImg.src)];
  }

  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images;
  }

  if (product?.image) {
    return [{ src: product.image, alt: product.name || '', id: 'primary' }];
  }

  return [];
}

export default function ProductMediaGallery({ product, selectedVariation }) {
  const images = getImages(product, selectedVariation);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset gallery to first image when variation changes using the
  // setState-during-render pattern (accepted pattern for derived state resets).
  const [prevVarId, setPrevVarId] = useState(selectedVariation?.id);
  if (prevVarId !== selectedVariation?.id) {
    setPrevVarId(selectedVariation?.id);
    setActiveIndex(0);
  }

  const activeImage = images[activeIndex] ?? null;
  const src = activeImage?.src || PLACEHOLDER_IMAGE;
  const alt = activeImage?.alt || product?.name || 'Product image';

  const prev = () => setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="product-media-gallery" aria-label="Product images">
      {/* Main image */}
      <div className="product-media-gallery__main" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc' }}>
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block', padding: '8px' }}
          loading="lazy"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              style={navBtnStyle('left')}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              style={navBtnStyle('right')}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          style={{
            display: 'flex', gap: '8px', marginTop: '12px',
            overflowX: 'auto', paddingBottom: '4px',
          }}
          role="list"
          aria-label="Image thumbnails"
        >
          {images.map((img, idx) => (
            <button
              key={img.id ?? idx}
              role="listitem"
              onClick={() => setActiveIndex(idx)}
              aria-label={`View image ${idx + 1}`}
              aria-pressed={idx === activeIndex}
              style={{
                flex: '0 0 64px', height: '64px', padding: '4px',
                border: idx === activeIndex ? '2px solid var(--primary-600)' : '2px solid #e2e8f0',
                borderRadius: '8px', background: '#f8fafc',
                cursor: 'pointer', overflow: 'hidden',
              }}
            >
              <img
                src={img.src || PLACEHOLDER_IMAGE}
                alt={img.alt || `Image ${idx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function navBtnStyle(side) {
  return {
    position: 'absolute',
    top: '50%',
    [side]: '8px',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid #e2e8f0',
    borderRadius: '50%',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    zIndex: 2,
  };
}
