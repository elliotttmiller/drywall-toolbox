import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import '../styles/header-responsive.css';

export default function Header({ onCartToggle }) {
  const location = useLocation();
  const { getCartCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="site-header" role="banner">
      <div className="site-header-inner">
        <div className="header-left">
          <Link to="/" className="brand-icon" aria-label="Home" onClick={closeMobileMenu}>
            <div className="brand-mark" />
          </Link>

          <nav className="nav-links nav-left desktop-nav" aria-label="Primary">
            <Link to="/products" className={`nav-link ${isActive('/products') ? 'active' : ''}`}>Tools</Link>
            <Link to="/parts" className={`nav-link ${isActive('/parts') ? 'active' : ''}`}>Parts</Link>
          </nav>
        </div>

        <div className="header-center">
          <Link to="/" className="brand-title" onClick={closeMobileMenu}>Drywall Toolbox</Link>
        </div>

        <div className="header-right">
          <nav className="nav-links nav-right desktop-nav" aria-label="Secondary">
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

          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-menu-toggle" 
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav" aria-label="Mobile Navigation">
            <Link 
              to="/products" 
              className={`mobile-nav-link ${isActive('/products') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Tools
            </Link>
            <Link 
              to="/parts" 
              className={`mobile-nav-link ${isActive('/parts') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Parts
            </Link>
            <Link 
              to="/about" 
              className={`mobile-nav-link ${isActive('/about') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              About
            </Link>
            <Link 
              to="/contact" 
              className={`mobile-nav-link ${isActive('/contact') ? 'active' : ''}`}
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
