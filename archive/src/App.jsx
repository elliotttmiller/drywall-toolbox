import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { CartProvider } from './context/CartContext';
import { VeeqoProvider } from './context/VeeqoContext';
import { WooCommerceProvider } from './context/WooCommerceContext';

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
const Product            = lazy(() => import('./pages/Product'));
const CategoryPage       = lazy(() => import('./pages/CategoryPage'));
const Parts              = lazy(() => import('./pages/Parts'));
const Repairs            = lazy(() => import('./pages/Repairs'));
const Cart               = lazy(() => import('./pages/Cart'));
const Checkout           = lazy(() => import('./pages/Checkout'));
const About              = lazy(() => import('./pages/About'));
const Contact            = lazy(() => import('./pages/Contact'));
// Admin/settings pages are rarely visited — ideal lazy candidates
const VeeqoSettings      = lazy(() => import('./pages/VeeqoSettings'));
const VeeqoCallback      = lazy(() => import('./pages/VeeqoCallback'));
const WooCommerceSettings = lazy(() => import('./pages/WooCommerceSettings'));

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

  // Support deployment to a sub-path (e.g. GitHub Pages).
  // In production PUBLIC_URL is injected by webpack DefinePlugin.
  const basename = process.env.PUBLIC_URL || '/';

  return (
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
                    <Route path="/products/:id"          element={<Product />} />
                    <Route path="/all-products"          element={<AllProducts />} />
                    <Route path="/product/:partNumber"   element={<Product />} />
                    <Route path="/category/:slug"        element={<CategoryPage />} />
                    <Route path="/parts"                 element={<Parts />} />
                    <Route path="/repairs"               element={<Repairs />} />
                    <Route path="/cart"                  element={<Cart />} />
                    <Route path="/checkout"              element={<Checkout />} />
                    <Route path="/about"                 element={<About />} />
                    <Route path="/contact"               element={<Contact />} />
                    <Route path="/settings/veeqo"        element={<VeeqoSettings />} />
                    <Route path="/veeqo/callback"        element={<VeeqoCallback />} />
                    <Route path="/settings/woocommerce"  element={<WooCommerceSettings />} />
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
  );
}

export default App;
