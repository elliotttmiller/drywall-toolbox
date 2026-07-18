import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { navigateDocument } from '../../utils/documentNavigation.js';

const MOBILE_QUERY = '(max-width: 767px)';
const SURFACE_MESSAGE_TYPE = 'dtb:express-checkout-surface';
const SURFACE_TIMEOUT_MS = 8000;
const MIN_SURFACE_HEIGHT = 52;
const MAX_SURFACE_HEIGHT = 128;

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const update = (event) => setIsMobile(event.matches);
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return isMobile;
}

function getCartSignature(cartItems) {
  return cartItems
    .map((item) => `${String(item?.cartKey || item?.key || item?.id || '')}:${Number(item?.quantity) || 1}`)
    .join('|');
}

function buildSurfaceUrl(surfaceId, cartSignature) {
  if (typeof window === 'undefined') return '';
  const basePath = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const checkoutPath = `${basePath}/checkout/`.replace(/\/{2,}/g, '/');
  const url = new URL(checkoutPath, window.location.origin);
  url.searchParams.set('dtb_woo_checkout', '1');
  url.searchParams.set('dtb_express_surface', '1');
  url.searchParams.set('dtb_surface_id', surfaceId);
  url.searchParams.set('dtb_cart_version', cartSignature || 'empty');
  return url.toString();
}

function isOrderConfirmationUrl(url) {
  return /\/checkout\/order-received\//i.test(url.pathname);
}

export default function MobileExpressCheckout({
  cartItems = [],
  variant = 'card',
  onAvailabilityChange,
}) {
  const isMobile = useMobileViewport();
  const iframeRef = useRef(null);
  const timeoutRef = useRef(null);
  const reactId = useId();
  const surfaceId = useMemo(
    () => `dtb-express-${reactId.replace(/[^a-z0-9_-]/gi, '') || 'surface'}`,
    [reactId]
  );
  const cartSignature = useMemo(() => getCartSignature(cartItems), [cartItems]);
  const surfaceUrl = useMemo(
    () => (isMobile && cartItems.length > 0 ? buildSurfaceUrl(surfaceId, cartSignature) : ''),
    [cartItems.length, cartSignature, isMobile, surfaceId]
  );

  const [surfaceState, setSurfaceState] = useState({
    url: '',
    status: 'loading',
    height: MIN_SURFACE_HEIGHT,
  });

  const status = surfaceState.url === surfaceUrl ? surfaceState.status : 'loading';
  const surfaceHeight = surfaceState.url === surfaceUrl ? surfaceState.height : MIN_SURFACE_HEIGHT;

  const clearAvailabilityTimeout = useCallback(() => {
    if (!timeoutRef.current || typeof window === 'undefined') return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (!surfaceUrl || typeof window === 'undefined') return undefined;

    clearAvailabilityTimeout();
    onAvailabilityChange?.(null);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setSurfaceState({ url: surfaceUrl, status: 'unavailable', height: MIN_SURFACE_HEIGHT });
      onAvailabilityChange?.(false);
    }, SURFACE_TIMEOUT_MS);

    return clearAvailabilityTimeout;
  }, [clearAvailabilityTimeout, onAvailabilityChange, surfaceUrl]);

  useEffect(() => {
    if (!surfaceUrl || typeof window === 'undefined') return undefined;

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const payload = event.data;
      if (!payload || payload.type !== SURFACE_MESSAGE_TYPE || payload.surfaceId !== surfaceId) return;

      if (payload.state === 'ready') {
        clearAvailabilityTimeout();
        const reportedHeight = Number(payload.height);
        const height = Number.isFinite(reportedHeight)
          ? Math.min(MAX_SURFACE_HEIGHT, Math.max(MIN_SURFACE_HEIGHT, Math.ceil(reportedHeight)))
          : MIN_SURFACE_HEIGHT;
        setSurfaceState({ url: surfaceUrl, status: 'ready', height });
        onAvailabilityChange?.(true);
        return;
      }

      if (payload.state === 'unavailable') {
        clearAvailabilityTimeout();
        setSurfaceState({ url: surfaceUrl, status: 'unavailable', height: MIN_SURFACE_HEIGHT });
        onAvailabilityChange?.(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearAvailabilityTimeout, onAvailabilityChange, surfaceId, surfaceUrl]);

  const handleFrameLoad = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || typeof window === 'undefined') return;

    try {
      const currentUrl = new URL(frameWindow.location.href);
      if (currentUrl.origin === window.location.origin && isOrderConfirmationUrl(currentUrl)) {
        navigateDocument(currentUrl.toString(), { replace: true });
      }
    } catch {
      // Stripe-controlled cross-origin authentication can temporarily make the
      // frame location unreadable. The official gateway owns that flow.
    }
  };

  if (!surfaceUrl || status === 'unavailable') return null;

  return (
    <section
      className={`dtb-mobile-express dtb-mobile-express--${variant}`}
      data-status={status}
      aria-label="Express checkout"
      aria-busy={status === 'loading' ? 'true' : 'false'}
    >
      <div className="dtb-mobile-express__heading-row">
        <h3 className="dtb-mobile-express__heading">Express checkout</h3>
        <span className="dtb-mobile-express__secure">Secure wallets</span>
      </div>

      <div className="dtb-mobile-express__surface-shell">
        <div className="dtb-mobile-express__skeleton" aria-hidden="true">
          <span />
          <span />
        </div>
        <iframe
          ref={iframeRef}
          className="dtb-mobile-express__frame"
          src={surfaceUrl}
          title="Apple Pay and Google Pay express checkout"
          allow="payment *"
          loading="eager"
          referrerPolicy="same-origin"
          scrolling="no"
          onLoad={handleFrameLoad}
          style={{ height: `${surfaceHeight}px` }}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {status === 'ready'
          ? 'Eligible express checkout methods are ready.'
          : 'Checking Apple Pay and Google Pay availability.'}
      </p>

      <div className="dtb-mobile-express__divider" aria-hidden="true">
        <span />
        <strong>or</strong>
        <span />
      </div>
    </section>
  );
}
