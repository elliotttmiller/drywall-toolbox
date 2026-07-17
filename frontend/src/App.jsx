import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, useLayoutEffect, lazy, Suspense, useCallback, useRef } from 'react';
import PageTransition from './components/routing/PageTransition';
import { CartProvider } from './context/CartContext';
import { WooCommerceProvider } from './context/WooCommerceContext';
import { WorkflowTransitionProvider } from './context/WorkflowTransitionContext.jsx';
import { AuthProvider, useAuthContext } from './auth/AuthContext.js';
import AppErrorBoundary from './components/system/AppErrorBoundary.jsx';
import CustomerErrorPage from './components/errors/CustomerErrorPage.jsx';
import Header from './components/shell/Header';
import Footer from './components/shell/Footer';
import CartSidebar from './components/shell/CartSidebar';
import ProtectedRoute from './components/routing/ProtectedRoute';
import HomepageSignupCTA from './components/cta/HomepageSignupCTA.jsx';
import MobileInstallNudge from './components/pwa/MobileInstallNudge.jsx';
import SmartBackButton from './components/navigation/SmartBackButton.jsx';
import { isRewardsEnabled } from './utils/featureFlags.js';
import { initializeWebpackPublicPath } from './setWebpackPublicPath.js';

const HOMEPAGE_SIGNUP_CTA_SEEN_KEY = 'dtb:homepage-signup-cta-seen:v1';
const HOMEPAGE_SIGNUP_CTA_DELAY_MS = 900;

initializeWebpackPublicPath();

function getLocalStorageFlag(key) {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setLocalStorageFlag(key) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Local storage can be unavailable in private browsing or strict modes.
  }
}

function lazyWithReload(importer) {
  return lazy(() => importer().catch((error) => {
    const message = String(error?.message || '');
    const isChunkLoadFailure =
      /ChunkLoadError/i.test(message) ||
      /Loading chunk [\w-]+ failed/i.test(message) ||
      /Failed to fetch dynamically imported module/i.test(message);

    if (isChunkLoadFailure && typeof window !== 'undefined') {
      const retryKey = `dtb:lazy-retry:${ window.location.pathname }`;
      const hasRetried = window.sessionStorage.getItem(retryKey) === '1';

      if (!hasRetried) {
        window.sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return new Promise(() => {});
      }

      window.sessionStorage.removeItem(retryKey);
    }

    throw error;
  }));
}

const Home = lazyWithReload(() => import('./pages/Home'));
const Products = lazyWithReload(() => import('./pages/Products'));
const Parts = lazyWithReload(() => import('./pages/Parts'));
const Product = lazyWithReload(() => import('./pages/Product'));
const ProductDetailPage = lazyWithReload(() => import('./pages/ProductDetailPage'));
const CategoryPage = lazyWithReload(() => import('./pages/CategoryPage'));
const Schematics = lazyWithReload(() => import('./pages/Schematics'));
const Repairs = lazyWithReload(() => import('./pages/Repairs'));
const RepairStart = lazyWithReload(() => import('./pages/RepairStart'));
const RepairPackages = lazyWithReload(() => import('./pages/RepairPackages'));
const RepairTrack = lazyWithReload(() => import('./pages/RepairTrack'));
const RepairStatus = lazyWithReload(() => import('./pages/RepairStatus'));
const ReturnStatus = lazyWithReload(() => import('./pages/ReturnStatus'));
const SupportStatus = lazyWithReload(() => import('./pages/SupportStatus'));
const Cart = lazyWithReload(() => import('./pages/Cart'));
const Checkout = lazyWithReload(() => import('./pages/WooNativeCheckout'));
const CheckoutReturn = lazyWithReload(() => import('./pages/CheckoutReturn'));
const OrderConfirmation = lazyWithReload(() => import('./pages/OrderConfirmation'));
const OrderTracking = lazyWithReload(() => import('./pages/OrderTracking'));
const Contact = lazyWithReload(() => import('./pages/Contact'));
const WooCommerceSettings = lazyWithReload(() => import('./pages/WooCommerceSettings'));
const Login = lazyWithReload(() => import('./pages/Login'));
const Register = lazyWithReload(() => import('./pages/Register'));
const ForgotPassword = lazyWithReload(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithReload(() => import('./pages/ResetPassword'));
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Calculators = lazyWithReload(() => import('./pages/Calculators'));
const FAQ = lazyWithReload(() => import('./pages/FAQ'));
const ShippingPolicy = lazyWithReload(() => import('./pages/ShippingPolicy'));
const ReturnPortal = lazyWithReload(() => import('./pages/ReturnPortal'));
const StorePolicies = lazyWithReload(() => import('./pages/StorePolicies'));
const ReturnPolicy = lazyWithReload(() => import('./pages/ReturnPolicy'));
// const ToolsetBuilder = lazy(() => import('./pages/ToolsetBuilder')); // DISABLED: temporarily hide Toolset Builder
const TechnicalSpecificationsPreview = lazyWithReload(() => import('./pages/TechnicalSpecificationsPreview'));

function RouteChunkFallback() {
  return (
    <div className="dtb-route-chunk-fallback" role="status" aria-live="polite" aria-label="Loading page">
      <span className="dtb-route-chunk-fallback__spinner" aria-hidden="true" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();
  const lastRouteRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) {
      return undefined;
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    if (lastRouteRef.current === routeKey) return undefined;
    lastRouteRef.current = routeKey;

    let cancelled = false;
    const timeoutIds = [];
    const frameIds = [];

    const scrollNestedContainers = () => {
      document.querySelectorAll('[data-route-scroll-container], [data-scroll-container], .overflow-y-auto, .overflow-auto').forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        const style = window.getComputedStyle(element);
        if (!/(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`)) return;
        element.scrollTop = 0;
      });
    };

    const scrollToRouteStart = () => {
      if (cancelled) return;

      if (location.hash) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) {
          target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
          return;
        }
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      scrollNestedContainers();
    };

    const scheduleFrame = () => {
      const frameId = window.requestAnimationFrame(scrollToRouteStart);
      frameIds.push(frameId);
    };

    scrollToRouteStart();
    scheduleFrame();
    timeoutIds.push(window.setTimeout(scrollToRouteStart, 60));
    timeoutIds.push(window.setTimeout(scheduleFrame, 140));
    timeoutIds.push(window.setTimeout(scrollToRouteStart, 320));
    timeoutIds.push(window.setTimeout(scrollToRouteStart, 650));

    return () => {
      cancelled = true;
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [location.pathname, location.search, location.hash, location.key]);

  return null;
}

function RedirectToProducts() {
  const { search } = useLocation();
  return <Navigate to={`/products${search || ''}`} replace />;
}

function getRouteBackConfig(pathname) {
  if (pathname.startsWith('/repairs/status/')) return { fallbackTo: '/dashboard?tab=repairs', label: 'Back to repairs' };
  if (pathname.startsWith('/order-tracking/')) return null;
  if (pathname.startsWith('/order/')) {
    return {
      fallbackTo: '/dashboard?tab=orders',
      label: 'Back to orders',
      scope: 'orders',
    };
  }
  return null;
}

function RouteBackBar() {
  const location = useLocation();
  const config = getRouteBackConfig(location.pathname);
  if (!config) return null;

  return (
    <div className={`dtb-route-back-bar${config.scope ? ` dtb-route-back-bar--${config.scope}` : ''}`}>
      <SmartBackButton
        fallbackTo={config.fallbackTo}
        label={config.label}
        className={config.scope ? `dtb-route-back-button dtb-route-back-button--${config.scope}` : 'dtb-route-back-button'}
      />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const rewardsEnabled = isRewardsEnabled();
  const productSelectorElement = <Products title="Products" isPartsFilter={0} />;
  const routes = (
    <Suspense fallback={<RouteChunkFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products forceProductGrid title="Products" isPartsFilter={0} />} />
        <Route path="/products/brands" element={productSelectorElement} />
        <Route path="/products/brands/:brandSlug" element={productSelectorElement} />
        <Route path="/products/brands/:brandSlug/categories/:categorySlug" element={productSelectorElement} />
        <Route path="/products/:slug/variations/:variationId" element={<ProductDetailPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/all-products" element={<RedirectToProducts />} />
        <Route path="/parts" element={<Parts />} />
        <Route path="/product/:partNumber" element={<Product />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/schematics" element={<Schematics />} />
        <Route path="/repairs" element={<Repairs />} />
        <Route path="/repairs/start" element={<RepairStart />} />
        <Route path="/repairs/packages" element={<RepairPackages />} />
        <Route path="/repairs/track" element={<RepairTrack />} />
        <Route path="/repairs/status/:id" element={<RepairStatus />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/calculators" element={<Calculators />} />
        <Route path="/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/returns" element={<ReturnPortal />} />
        <Route path="/returns/status/:id" element={<ReturnStatus />} />
        <Route path="/return-policy" element={<ReturnPolicy />} />
        <Route path="/policies" element={<StorePolicies />} />
        {/* <Route path="/toolset-builder" element={<ToolsetBuilder />} /> */}
        <Route path="/preview/technical-specifications" element={<TechnicalSpecificationsPreview />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/complete" element={<CheckoutReturn fallbackState="complete" />} />
        <Route path="/checkout/payment-failed" element={<CheckoutReturn fallbackState="failed" />} />
        <Route path="/checkout/payment-cancelled" element={<CheckoutReturn fallbackState="cancelled" />} />
        <Route path="/checkout/order-received/:id" element={<CheckoutReturn fallbackState="complete" />} />
        <Route path="/order/:id" element={<OrderConfirmation />} />
        <Route path="/order-tracking/:id" element={<OrderTracking />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/support/status/:id" element={<SupportStatus />} />
        <Route path="/settings/woocommerce" element={<ProtectedRoute><WooCommerceSettings /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/repairs/:id" element={<ProtectedRoute><RepairStatus /></ProtectedRoute>} />
        <Route path="/orders" element={<Navigate to="/dashboard?tab=orders" replace />} />
        <Route path="/rewards" element={<Navigate to={rewardsEnabled ? "/dashboard?tab=rewards" : "/dashboard"} replace />} />
        <Route path="/account-settings" element={<Navigate to="/dashboard?tab=settings" replace />} />
        <Route path="/addresses" element={<Navigate to="/dashboard?tab=addresses" replace />} />
        <Route path="/notifications" element={<Navigate to="/dashboard?tab=settings" replace />} />
        <Route path="/error/:code" element={<CustomerErrorPage />} />
        <Route path="*" element={<CustomerErrorPage code={404} />} />
      </Routes>
    </Suspense>
  );

  if (location.pathname === '/checkout') return routes;

  return (
    <PageTransition locationKey={`${location.pathname}${location.search}`}>
      {routes}
    </PageTransition>
  );
}

function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const toggleCart = useCallback(() => setCartOpen(prev => !prev), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const basename = (process.env.PUBLIC_URL || '').replace(/\/+$/, '') || '/';

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <WooCommerceProvider>
          <CartProvider>
            <WorkflowTransitionProvider>
              <Router basename={basename}>
                <ScrollToTop />
                <AppShell cartOpen={cartOpen} toggleCart={toggleCart} closeCart={closeCart} />
              </Router>
            </WorkflowTransitionProvider>
          </CartProvider>
        </WooCommerceProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

function AppShell({ cartOpen, toggleCart, closeCart }) {
  const location = useLocation();
  const { user } = useAuthContext();
  const routeKey = `${location.pathname}${location.search}${location.hash}`;
  const previousRouteKeyRef = useRef(routeKey);

  const isHome = location.pathname === '/';
  const minimalChrome = location.pathname === '/checkout';

  useEffect(() => {
    if (previousRouteKeyRef.current === routeKey) return;
    previousRouteKeyRef.current = routeKey;
    if (cartOpen) closeCart();
  }, [cartOpen, closeCart, routeKey]);

  return (
    <>
      {!minimalChrome && <Header onCartToggle={toggleCart} onMobileMenuOpen={closeCart} />}
      <main className={!isHome && !minimalChrome ? 'main-content' : minimalChrome ? '' : 'main-content home-main'}>
        <RouteBackBar />
        <AppRoutes />
      </main>
      {!minimalChrome && <Footer />}
      {!minimalChrome && <CartSidebar isOpen={cartOpen} onClose={closeCart} />}
      <MobileInstallNudge />
      {!minimalChrome && !user && <HomepageSignupCtaController />}
    </>
  );
}

function HomepageSignupCtaController() {
  const navigate = useNavigate();
  const [showSignupCta, setShowSignupCta] = useState(false);

  useEffect(() => {
    if (getLocalStorageFlag(HOMEPAGE_SIGNUP_CTA_SEEN_KEY)) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowSignupCta(true);
    }, HOMEPAGE_SIGNUP_CTA_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setLocalStorageFlag(HOMEPAGE_SIGNUP_CTA_SEEN_KEY);
    setShowSignupCta(false);
  }, []);

  const handleRegister = useCallback(() => {
    setLocalStorageFlag(HOMEPAGE_SIGNUP_CTA_SEEN_KEY);
    setShowSignupCta(false);
    navigate('/register', { state: { returnTo: '/' } });
  }, [navigate]);

  return (
    <HomepageSignupCTA
      isVisible={showSignupCta}
      onClose={handleClose}
      onRegister={handleRegister}
    />
  );
}

export default App;
