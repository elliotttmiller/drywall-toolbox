import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { CartProvider } from './context/CartContext';
import { VeeqoProvider } from './context/VeeqoContext';
import { WooCommerceProvider } from './context/WooCommerceContext';
import { AuthProvider } from './auth/AuthContext.js';

// Layout components load eagerly — they're on every page so there's no benefit
// to lazy loading them. Keeping them in the main bundle is correct.
import Header from './components/Header';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';

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
const About              = lazy(() => import('./pages/About'));
const Contact            = lazy(() => import('./pages/Contact'));
// Admin/settings pages are rarely visited — ideal lazy candidates
const VeeqoSettings      = lazy(() => import('./pages/VeeqoSettings'));
const VeeqoCallback      = lazy(() => import('./pages/VeeqoCallback'));
const WooCommerceSettings = lazy(() => import('./pages/WooCommerceSettings'));
// Auth + account pages — lazy-loaded, isolated from WP admin
const Login              = lazy(() => import('./pages/Login'));
const Register           = lazy(() => import('./pages/Register'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));

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
// Shown while a route chunk is being fetched. Keep it lightweight — no imports.
function PageLoader() {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '40vh',
      fontSize:       '0.9rem',
      color:          '#888',
      letterSpacing:  '0.05em',
    }}>
      Loading…
    </div>
  );
}

// ─── Scroll to top on route change ───────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
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
      <VeeqoProvider>
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
                  Suspense boundary wraps all routes. When React navigates to a
                  new route whose chunk hasn't loaded yet, PageLoader renders
                  until the import() resolves. The boundary is placed here
                  (inside <main>) so Header and Footer remain visible during
                  chunk loading — the UX stays stable.
                */}
                <Suspense fallback={<PageLoader />}>
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
                    <Route path="/cart"                  element={<Cart />} />
                    <Route path="/checkout"              element={<Checkout />} />
                    <Route path="/order/:id"             element={<OrderConfirmation />} />
                    <Route path="/about"                 element={<About />} />
                    <Route path="/contact"               element={<Contact />} />
                    <Route path="/settings/veeqo"        element={<VeeqoSettings />} />
                    <Route path="/veeqo/callback"        element={<VeeqoCallback />} />
                    <Route path="/settings/woocommerce"  element={<WooCommerceSettings />} />
                    {/* Auth + account pages — dev-only, standalone, no WP admin changes */}
                    <Route path="/login"                 element={<Login />} />
                    <Route path="/register"              element={<Register />} />
                    <Route path="/dashboard"             element={<Dashboard />} />
                    {/* Catch-all: any unmatched route renders a 404 page */}
                    <Route path="*"                      element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>

              <Footer />
            </div>

            <CartSidebar isOpen={cartOpen} onClose={closeCart} />
          </Router>
          </CartProvider>
        </WooCommerceProvider>
      </VeeqoProvider>
    </AuthProvider>
  );
}

export default App;
