import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import PageTransition from './components/routing/PageTransition';
import LoadingSpinner from './components/shared/LoadingSpinner';
import { CartProvider } from './context/CartContext';
import { WooCommerceProvider } from './context/WooCommerceContext';
import { WorkflowTransitionProvider } from './context/WorkflowTransitionContext.jsx';
import { AuthProvider } from './auth/AuthContext.js';
import AppErrorBoundary from './components/system/AppErrorBoundary.jsx';
import Header from './components/shell/Header';
import Footer from './components/shell/Footer';
import CartSidebar from './components/shell/CartSidebar';
import ProtectedRoute from './components/routing/ProtectedRoute';
import { isRewardsEnabled } from './utils/featureFlags.js';
import { initializeWebpackPublicPath } from './setWebpackPublicPath.js';

const APP_BASE = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

initializeWebpackPublicPath();

function toAppHref(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${ path }`;
  return `${ APP_BASE }${ normalized }` || '/';
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
const RepairStatus = lazyWithReload(() => import('./pages/RepairStatus'));
const Cart = lazyWithReload(() => import('./pages/Cart'));
const Checkout = lazyWithReload(() => import('./pages/Checkout'));
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
// const ToolsetBuilder = lazy(() => import('./pages/ToolsetBuilder')); // DISABLED: temporarily hide Toolset Builder
const TechnicalSpecificationsPreview = lazyWithReload(() => import('./pages/TechnicalSpecificationsPreview'));

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem', color: '#888' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.1rem', margin: '0.75rem 0 1.5rem' }}>Page not found</p>
      <a href={toAppHref('/')} style={{ color: '#3b82f6', textDecoration: 'underline' }}>Return to home</a>
    </div>
  );
}

function PageLoader() {
  return <LoadingSpinner size="md" label="Loading page…" fullPage />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function RedirectToProducts() {
  const { search } = useLocation();
  return <Navigate to={`/products${search || ''}`} replace />;
}

function AppRoutes() {
  const location = useLocation();
  const rewardsEnabled = isRewardsEnabled();
  const productSelectorElement = <Products title="Products" isPartsFilter={0} />;
  return (
    <PageTransition locationKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/repairs/status/:id" element={<RepairStatus />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/calculators" element={<Calculators />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/returns" element={<ReturnPortal />} />
          <Route path="/policies" element={<StorePolicies />} />
          {/* <Route path="/toolset-builder" element={<ToolsetBuilder />} /> */}
          <Route path="/preview/technical-specifications" element={<TechnicalSpecificationsPreview />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderConfirmation />} />
          <Route path="/order-tracking/:id" element={<OrderTracking />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/settings/woocommerce" element={<ProtectedRoute><WooCommerceSettings /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/orders" element={<Navigate to="/dashboard?tab=orders" replace />} />
          <Route path="/rewards" element={<Navigate to={rewardsEnabled ? "/dashboard?tab=rewards" : "/dashboard"} replace />} />
          <Route path="/account-settings" element={<Navigate to="/dashboard?tab=settings" replace />} />
          <Route path="/addresses" element={<Navigate to="/dashboard?tab=addresses" replace />} />
          <Route path="/notifications" element={<Navigate to="/dashboard?tab=settings" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}

function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const toggleCart = () => setCartOpen(prev => !prev);
  const closeCart = () => setCartOpen(false);
  const basename = (process.env.PUBLIC_URL || '').replace(/\/+$/, '') || '/';

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <WooCommerceProvider>
          <CartProvider>
            <WorkflowTransitionProvider>
              <Router basename={basename}>
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
  return (
    <>
      <ScrollToTop />
      <div className="machined-bg" />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Temporarily disabled top shipping ticker (kept for quick re-enable)
        {isHomePage && (
          <div className="site-top-ticker">
            <ShippingTicker items={[{ text: 'FREE SHIPPING ON ALL ORDERS $75+ (CONTIGUOUS USA ONLY)' }, { text: 'Expert Support - Real Pros' }, { text: 'Professional Repair Services' }]} duration={33} className="dtb-desktop-shipping-bar dtb-top-shipping-bar" />
          </div>
        )}
        */}
        <Header onCartToggle={toggleCart} cartOpen={cartOpen} hasTopTicker={false} />
        <main style={{ flexGrow: 1 }} className="main-content"><AppRoutes /></main>
        <Footer />
      </div>
      <CartSidebar isOpen={cartOpen} onClose={closeCart} />
    </>
  );
}

export default App;
