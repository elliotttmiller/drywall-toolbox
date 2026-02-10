import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingCart, Menu, X } from 'lucide-react';

export default function Header({ onCartToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleToolsClick = (e) => {
    e.preventDefault();
    closeMobileMenu();
    // Navigate to /products without query params to show brand list
    navigate('/products');
  };

  return (
    <header className="site-header" role="banner">
      <div className="site-header-inner">
        {/* Mobile Layout */}
        <div className="flex md:hidden items-center justify-between w-full">
          {/* Cart Icon - Far Left */}
          <button 
            onClick={onCartToggle} 
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors" 
            aria-label="Toggle cart"
          >
            <ShoppingCart size={22} />
            {getCartCount() > 0 && (
              <span className="cart-badge">{getCartCount()}</span>
            )}
          </button>

          {/* Centered Brand with Icon */}
          <Link to="/" className="flex items-center gap-2" onClick={closeMobileMenu}>
            <div className="brand-mark" style={{ width: '20px', height: '20px' }} />
            <span className="text-base font-bold uppercase tracking-wide">Drywall Toolbox</span>
          </Link>

          {/* Menu Icon - Far Right */}
          <button 
            onClick={toggleMobileMenu}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:contents">
          <div className="header-left">
            <nav className="nav-links" aria-label="Primary">
              <Link to="/products" onClick={handleToolsClick} className={`nav-link ${isActive('/products') ? 'active' : ''}`}>Tools</Link>
              <Link to="/parts" className={`nav-link ${isActive('/parts') ? 'active' : ''}`}>Parts</Link>
            </nav>
          </div>

          <div className="header-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="brand-mark" />
              <span className="brand-title">Drywall Toolbox</span>
            </Link>
          </div>

          <div className="header-right">
            <nav className="nav-links" aria-label="Secondary">
              <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`}>About</Link>
              <Link to="/contact" className={`nav-link ${isActive('/contact') ? 'active' : ''}`}>Contact</Link>
            </nav>

            <div className="cart-area">
              <button onClick={onCartToggle} className="cart-toggle" aria-label="Toggle cart">
                <ShoppingCart size={20} />
                {getCartCount() > 0 && (
                  <span className="cart-badge">{getCartCount()}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
          <nav className="flex flex-col p-4 space-y-2">
            <Link 
              to="/products" 
              className={`nav-link-mobile ${isActive('/products') ? 'active' : ''}`}
              onClick={handleToolsClick}
            >
              Tools
            </Link>
            <Link 
              to="/parts" 
              className={`nav-link-mobile ${isActive('/parts') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Parts
            </Link>
            <Link 
              to="/about" 
              className={`nav-link-mobile ${isActive('/about') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              About
            </Link>
            <Link 
              to="/contact" 
              className={`nav-link-mobile ${isActive('/contact') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Contact
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
