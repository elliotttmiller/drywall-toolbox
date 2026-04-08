/**
 * ProductCardImage
 *
 * A drop-in image component for every product card across the site.
 * Provides three visual states:
 *
 *   1. Skeleton shimmer  — shown instantly while the image is downloading.
 *      A subtle shimmer animation fills the placeholder so the card feels
 *      "alive" rather than blank. Uses CSS-only animation so it costs zero
 *      JS on the main thread.
 *
 *   2. Fade-in          — once the browser fires `onLoad`, the image eases
 *      in from opacity 0 → 1 over 350ms with a slight upward drift
 *      (translateY 6px → 0). The easing curve is cubic-bezier(0.22,1,0.36,1)
 *      — an "ease out expo" that starts fast and decelerates naturally,
 *      making the reveal feel smooth and physical rather than mechanical.
 *
 *   3. Error fallback   — on network or 404 error the src swaps to
 *      /no-image-placeholder.webp and the fade-in still plays so there
 *      is never a jarring jump.
 *
 * Usage:
 *   <ProductCardImage src={product.image} alt={product.name} />
 *
 * Props:
 *   src       {string}   — image URL (may be empty / undefined)
 *   alt       {string}   — alt text
 *   padding   {string}   — inner padding on the img (default "8px")
 *   className {string}   — extra classes forwarded to the <img>
 *   width     {number}   — intrinsic width for CLS prevention (default 400)
 *   height    {number}   — intrinsic height for CLS prevention (default 400)
 *   eager     {boolean}  — loading="eager" + fetchpriority="high" for hero/LCP images
 */
import { useState } from 'react';

const PLACEHOLDER = '/no-image-placeholder.webp';

// Easing curve: fast start, decelerate to rest — feels natural and physical.
const EASE_OUT_EXPO = 'cubic-bezier(0.22, 1, 0.36, 1)';

export default function ProductCardImage({
  src,
  alt = '',
  padding = '8px',
  className = '',
  width = 400,
  height = 400,
  eager = false,
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const effectiveSrc = (!src || errored) ? PLACEHOLDER : src;

  return (
    // Wrapper fills the parent container completely (caller controls size/aspect-ratio)
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* ── Skeleton shimmer ──────────────────────────────────────────────
          Visible until the image fires onLoad. The shimmer is a CSS gradient
          animation that sweeps left-to-right — gives a "content loading"
          feel without any JS timers. Fades out once the image is ready.     */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #f1f5f9 25%, #e8eef5 50%, #f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: loaded ? 'none' : 'dtb-shimmer 1.4s ease-in-out infinite',
          opacity: loaded ? 0 : 1,
          transition: `opacity 200ms ${EASE_OUT_EXPO}`,
          borderRadius: 'inherit',
          zIndex: 0,
        }}
      />

      {/* ── Product image ─────────────────────────────────────────────────
          Starts fully transparent and translates up slightly. On onLoad the
          state flips to `loaded` and the CSS transition carries it to its
          final position. The delay (50ms) gives the shimmer a tiny head
          start so the transition handoff never shows a blank frame.         */}
      <img
        src={effectiveSrc}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? 'eager' : 'lazy'}
        fetchpriority={eager ? 'high' : 'auto'}
        decoding="async"
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          padding,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(6px)',
          transition: loaded
            ? `opacity 350ms ${EASE_OUT_EXPO}, transform 350ms ${EASE_OUT_EXPO}`
            : 'none',
          transitionDelay: loaded ? '50ms' : '0ms',
          zIndex: 1,
        }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setErrored(true);
          // placeholder always loads, so trigger loaded state for it too
          setLoaded(true);
        }}
      />
    </div>
  );
}
