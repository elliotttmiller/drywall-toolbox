import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { VeeqoProvider } from './context/VeeqoContext';
import { WooCommerceProvider } from './context/WooCommerceContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import About from './pages/About';
import Contact from './pages/Contact';
import Product from './pages/Product';
import VeeqoSettings from './pages/VeeqoSettings';
import VeeqoCallback from './pages/VeeqoCallback';
import WooCommerceSettings from './pages/WooCommerceSettings';

function App() {
  return (
    <VeeqoProvider>
      <WooCommerceProvider>
        <CartProvider>
          <Router>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="grow">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/product/:partNumber" element={<Product />} />
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
          </Router>
        </CartProvider>
      </WooCommerceProvider>
    </VeeqoProvider>
  );
}

export default App;
