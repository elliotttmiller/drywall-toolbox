import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import PageTransition from './components/PageTransition';
import LoadingSpinner from './components/LoadingSpinner';
import { CartProvider } from './context/CartContext';
import { WooCommerceProvider } from './context/WooCommerceContext';
import { AuthProvider } from './auth/AuthContext.js';

// Layout components load eagerly — they're on every page so there's no benefit
// to lazy loading them. Keeping them in the main bundle is correct.
import Header from './components/Header';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import ProtectedRoute from './components/ProtectedRoute';

// ─── Lazy page imports ────────────────────────────────────────────────────────
// Each import() becomes its own chunk file. Webpack only loads a chunk when
// the user actually navigates to that route — keeping the initial bundle lean.
const Home               = lazy(() => import('./pages/Home'));
const Products           = lazy(() => import('./pages/Products'));
const AllProducts        = lazy(() => import('./pages/AllProducts'));
const Parts              = lazy(() => import('./pages/Parts'));
const Product            = lazy(() => import('./pages/Product'));
const CategoryPage       = lazy(() => import('./pages/CategoryPage'));
const Schematics         = lazy(() => import('./pages/Schematics'));
const Repairs            = lazy(() => import('./pages/Repairs'));
const Cart               = lazy(() => import('./pages/Cart'));
const Checkout           = lazy(() => import('./pages/Checkout'));
const OrderConfirmation  = lazy(() => import('./pages/OrderConfirmation'));
const Contact            = lazy(() => import('./pages/Contact'));
// Admin/settings pages are rarely visited — ideal lazy candidates
const WooCommerceSettings = lazy(() => import('./pages/WooCommerceSettings'));
// Auth + account pages — lazy-loaded, isolated from WP admin
const Login              = lazy(() => import('./pages/Login'));
const Register           = lazy(() => import('./pages/Register'));
const ForgotPassword     = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword      = lazy(() => import('./pages/ResetPassword'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Orders             = lazy(() => import('./pages/Orders'));
const Rewards            = lazy(() => import('./pages/Rewards'));
const ProMembership      = lazy(() => import('./pages/ProMembership'));
const AccountSettings    = lazy(() => import('./pages/AccountSettings'));
const SavedAddresses     = lazy(() => import('./pages/SavedAddresses'));
const Notifications      = lazy(() => import('./pages/Notifications'));
const Calculators        = lazy(() => import('./pages/Calculators'));
const FAQ                = lazy(() => import('./pages/FAQ'));

// ─── 404 Not Found page ───────────────────────────────────────────────────────
// Rendered for any URL that doesn't match a defined route.
function NotFound() {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '60vh',
      textAlign:      'center',
      padding:        '2rem',
      color:          '#888',
    }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.1rem', margin: '0.75rem 0 1.5rem' }}>
        Page not found
      </p>
      <a href="/" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
        Return to home
      </a>
    </div>
  );
}

// ─── Loading fallback ─────────────────────────────────────────────────────────
// Shown while a route chunk is being fetched inside the PageTransition wrapper.
function PageLoader() {
  return (
    <LoadingSpinner size="md" label="Loading page…" fullPage />
  );
}

// ─── Scroll to top on route change ───────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// ─── All page routes, wrapped with per-route transition ───────────────────────
// Must be rendered inside <Router> so useLocation() is available.
function AppRoutes() {
  const location = useLocation();
  return (
    <PageTransition locationKey={ location.pathname }>
      <Suspense fallback={ <PageLoader /> }>
        <Routes>
          <Route path="/"                      element={<Home />} />
          <Route path="/products"              element={<Products />} />
          <Route path="/products/:slug"        element={<Product />} />
          <Route path="/all-products"          element={<AllProducts />} />
          <Route path="/parts"                 element={<Parts />} />
          <Route path="/product/:partNumber"   element={<Product />} />
          <Route path="/category/:slug"        element={<CategoryPage />} />
          <Route path="/schematics"            element={<Schematics />} />
          <Route path="/repairs"               element={<Repairs />} />
          <Route path="/faq"                   element={<FAQ />} />
          <Route path="/calculators"           element={<Calculators />} />
          <Route path="/cart"                  element={<Cart />} />
          <Route path="/checkout"              element={<Checkout />} />
          <Route path="/order/:id"             element={<OrderConfirmation />} />
          <Route path="/contact"               element={<Contact />} />
          <Route path="/settings/woocommerce"  element={<ProtectedRoute><WooCommerceSettings /></ProtectedRoute>} />
          {/* Auth + account pages — dev-only, standalone, no WP admin changes */}
          <Route path="/login"                 element={<Login />} />
          <Route path="/register"              element={<Register />} />
          <Route path="/forgot-password"       element={<ForgotPassword />} />
          <Route path="/reset-password"        element={<ResetPassword />} />
          <Route path="/dashboard"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/orders"                element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/rewards"               element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
          <Route path="/pro-membership"        element={<ProMembership />} />
          <Route path="/account-settings"      element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
          <Route path="/addresses"             element={<ProtectedRoute><SavedAddresses /></ProtectedRoute>} />
          <Route path="/notifications"         element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          {/* Catch-all: any unmatched route renders a 404 page */}
          <Route path="*"                      element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [cartOpen, setCartOpen] = useState(false);

  const toggleCart = () => setCartOpen(prev => !prev);
  const closeCart  = () => setCartOpen(false);

  // On GitHub Pages the site lives at /drywall-toolbox, so React Router needs
  // the same sub-path as basename. PUBLIC_URL is injected at build time by
  // webpack DefinePlugin from the PUBLIC_URL env var (set to /drywall-toolbox
  // in the GH Actions workflow). In production on a custom domain PUBLIC_URL
  // is '' (empty), which resolves to '/' here — correct for both cases.
  const basename = (process.env.PUBLIC_URL || '').replace(/\/+$/, '') || '/';

  return (
    <AuthProvider>
      <WooCommerceProvider>
          <CartProvider>
          <Router basename={basename}>
            <ScrollToTop />

            {/* Background texture */}
            <div className="machined-bg" />

            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Header onCartToggle={toggleCart} />

              <main style={{ flexGrow: 1 }} className="main-content">
                {/*
                  AppRoutes renders all page routes wrapped in PageTransition,
                  giving every route a consistent smooth fade+lift enter/exit.
                  Suspense (inside AppRoutes) shows PageLoader for lazy chunks.
                  Header and Footer remain visible during all transitions.
                */}
                <AppRoutes />
              </main>

              <Footer />
            </div>

            <CartSidebar isOpen={cartOpen} onClose={closeCart} />
          </Router>
          </CartProvider>
        </WooCommerceProvider>
    </AuthProvider>
  );
}

export default App;
