import { useEffect, useState } from 'react';

const CROSSFADE_DURATION_MS = 460;
const SKELETON_REMOVAL_BUFFER_MS = 80;

/**
 * Keeps the outgoing skeleton and incoming content mounted together long enough
 * to perform a true opacity crossfade. Once the transition completes, the
 * skeleton is removed so it cannot influence layout, accessibility, or input.
 */
export default function LoadingCardTransition({
  loading,
  skeleton,
  children,
  className = '',
  label = 'Loading content',
}) {
  const [ready, setReady] = useState(() => !loading);
  const [showSkeleton, setShowSkeleton] = useState(() => Boolean(loading));

  useEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    let removalTimer = 0;

    if (loading) {
      firstFrame = window.requestAnimationFrame(() => {
        setShowSkeleton(true);
        setReady(false);
      });
    } else {
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setReady(true);
        });
      });

      removalTimer = window.setTimeout(() => {
        setShowSkeleton(false);
      }, CROSSFADE_DURATION_MS + SKELETON_REMOVAL_BUFFER_MS);
    }

    return () => {
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (removalTimer) window.clearTimeout(removalTimer);
    };
  }, [loading]);

  const skeletonVisible = loading || showSkeleton;
  const contentReady = !loading && ready;
  const classes = [
    'dtb-card-loading-transition',
    skeletonVisible ? 'dtb-card-loading-transition--layered' : '',
    contentReady ? 'ready' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} aria-busy={loading ? 'true' : 'false'}>
      {skeletonVisible ? (
        <div className="dtb-card-loading-transition__skeleton" aria-hidden="true">
          {skeleton}
        </div>
      ) : null}

      <div
        className="dtb-card-loading-transition__content"
        aria-hidden={contentReady ? undefined : 'true'}
        inert={!contentReady}
      >
        {children}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {loading ? label : ''}
      </span>
    </div>
  );
}
