import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { VeeqoProvider } from './context/VeeqoContext';
import { WooCommerceProvider } from './context/WooCommerceContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import Home from './pages/Home';
import Products from './pages/Products';
import AllProducts from './pages/AllProducts';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import About from './pages/About';
import Contact from './pages/Contact';
import Product from './pages/Product';
import CategoryPage from './pages/CategoryPage';
import Parts from './pages/Parts';
import Repairs from './pages/Repairs';
import VeeqoSettings from './pages/VeeqoSettings';
import VeeqoCallback from './pages/VeeqoCallback';
import WooCommerceSettings from './pages/WooCommerceSettings';

// Component to scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  const [cartOpen, setCartOpen] = useState(false);

  const toggleCart = () => setCartOpen(!cartOpen);
  const closeCart = () => setCartOpen(false);

  // Use PUBLIC_URL for Router basename to support GitHub Pages deployment
  const basename = process.env.PUBLIC_URL || '/';

  return (
    <VeeqoProvider>
      <WooCommerceProvider>
        <CartProvider>
          <Router basename={basename}>
            <ScrollToTop />
            {/* Background Texture */}
            <div className="machined-bg"></div>
            
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Header onCartToggle={toggleCart} />
              <main style={{ flexGrow: 1 }} className="main-content">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<Product />} />
                  <Route path="/all-products" element={<AllProducts />} />
                  <Route path="/product/:partNumber" element={<Product />} />
                  <Route path="/category/:slug" element={<CategoryPage />} />
                  <Route path="/parts" element={<Parts />} />
                  <Route path="/repairs" element={<Repairs />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/settings/veeqo" element={<VeeqoSettings />} />
                  <Route path="/veeqo/callback" element={<VeeqoCallback />} />
                  <Route path="/settings/woocommerce" element={<WooCommerceSettings />} />
                </Routes>
              </main>
              <Footer />
            </div>

            {/* Cart Sidebar Overlay */}
            <CartSidebar isOpen={cartOpen} onClose={closeCart} />
          </Router>
        </CartProvider>
      </WooCommerceProvider>
    </VeeqoProvider>
  );
}

export default App;
