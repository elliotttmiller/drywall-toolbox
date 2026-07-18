import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { navigateDocument } from '../../utils/documentNavigation.js';

const SURFACE_MESSAGE_TYPE = 'dtb:woopayments-express-surface';
const SURFACE_TIMEOUT_MS = 8000;
const MIN_SURFACE_HEIGHT = 54;
const MAX_SURFACE_HEIGHT = 180;

function getBaseCheckoutPath() {
  const basePath = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  return `${basePath}/checkout/`;
}

function getCartSignature(cartItems = []) {
  return cartItems
    .map((item) => `${String(item?.cartKey || item?.key || item?.id || '')}:${Number(item?.quantity) || 1}`)
    .join('|');
}

function getNumericId(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function buildSurfaceUrl({ context, surfaceId, cartSignature, productId, variationId, quantity }) {
  if (typeof window === 'undefined') return '';

  const url = new URL(getBaseCheckoutPath(), window.location.origin);
  url.searchParams.set('dtb_wcpay_express_surface', '1');
  url.searchParams.set('dtb_surface_id', surfaceId);
  url.searchParams.set('dtb_context', context);

  if (context === 'product') {
    if (!productId) return '';
    url.searchParams.set('product_id', String(productId));
    if (variationId) url.searchParams.set('variation_id', String(variationId));
    url.searchParams.set('quantity', String(Math.max(1, Number(quantity) || 1)));
    url.searchParams.set('dtb_product_version', `${productId}:${variationId || 'parent'}:${Math.max(1, Number(quantity) || 1)}`);
  } else {
    if (!cartSignature) return '';
    url.searchParams.set('dtb_cart_version', cartSignature);
  }

  return url.toString();
}

function isOrderConfirmationUrl(url) {
  return /\/checkout\/order-received\//i.test(url.pathname);
}

export default function WooPaymentsExpressCheckout({
  context = 'cart',
  cartItems = [],
  product = null,
  selectedVariation = null,
  quantity = 1,
  disabled = false,
  className = '',
  onAvailabilityChange,
}) {
  const iframeRef = useRef(null);
  const timeoutRef = useRef(null);
  const reactId = useId();
  const surfaceId = useMemo(
    () => `dtb-wcpay-${reactId.replace(/[^a-z0-9_-]/gi, '') || 'surface'}`,
    [reactId]
  );
  const normalizedContext = context === 'drawer' || context === 'product' ? context : 'cart';
  const cartSignature = useMemo(() => getCartSignature(cartItems), [cartItems]);
  const productId = useMemo(
    () => getNumericId(product?.id, selectedVariation?.parent_id),
    [product?.id, selectedVariation?.parent_id]
  );
  const variationId = useMemo(
    () => getNumericId(selectedVariation?.id),
    [selectedVariation?.id]
  );
  const normalizedQuantity = Math.max(1, Number(quantity) || 1);
  const productSignature = productId ? `${productId}:${variationId || 'parent'}:${normalizedQuantity}` : '';

  const surfaceUrl = useMemo(() => {
    if (disabled) return '';
    return buildSurfaceUrl({
      context: normalizedContext,
      surfaceId,
      cartSignature,
      productId,
      variationId,
      quantity: normalizedQuantity,
    });
  }, [cartSignature, disabled, normalizedContext, normalizedQuantity, productId, surfaceId, variationId]);

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
      // Provider-owned wallet authentication can temporarily navigate cross-origin.
      // DTB does not inspect or control that payment flow.
    }
  };

  if (!surfaceUrl || status === 'unavailable') return null;

  const classes = [
    'dtb-wcpay-express',
    `dtb-wcpay-express--${normalizedContext}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <section
      className={classes}
      data-status={status}
      data-cart-version={normalizedContext === 'product' ? undefined : cartSignature}
      data-product-version={normalizedContext === 'product' ? productSignature : undefined}
      aria-label="Express checkout"
      aria-busy={status === 'loading' ? 'true' : 'false'}
    >
      <div className="dtb-wcpay-express__heading-row">
        <h3 className="dtb-wcpay-express__heading">Express checkout</h3>
        <span className="dtb-wcpay-express__secure">WooPayments</span>
      </div>

      <div className="dtb-wcpay-express__surface-shell">
        <div className="dtb-wcpay-express__skeleton" aria-hidden="true">
          <span />
          <span />
        </div>
        <iframe
          ref={iframeRef}
          className="dtb-wcpay-express__frame"
          src={surfaceUrl}
          title="WooPayments express checkout"
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
          : 'Checking express checkout availability.'}
      </p>

      <div className="dtb-wcpay-express__divider" aria-hidden="true">
        <span />
        <strong>or</strong>
        <span />
      </div>
    </section>
  );
}
