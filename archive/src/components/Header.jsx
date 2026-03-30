import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingCart, Menu, X, ChevronDown } from 'lucide-react';
import Logo from '/logo2.svg';
import MobileSearch from './MobileSearch';

export default function Header({ onCartToggle }) {
  const location = useLocation();
  const { getCartCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia('(min-width: 641px) and (max-width: 1024px)').matches;
    } catch {
      return false;
    }
  });

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    // Match tablet-sized screens (between 641px and 1024px)
    const mq = window.matchMedia('(min-width: 641px) and (max-width: 1024px)');
    const handler = (e) => setIsTablet(e.matches);
    // Listen for changes
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else {
      // Safari fallback
      mq.addListener(handler);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, []);

  return (
    <header className="site-header" role="banner">
      <div className="site-header-inner">
  {/* Mobile Layout */}
  <div className="flex md:hidden items-center justify-between w-full header-mobile-layout" style={{ display: isTablet ? 'flex' : undefined }}>
          {/* Menu Icon - Far Left */}
          <button 
            onClick={toggleMobileMenu}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors header-icon"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Centered Logo */}
          <Link to="/" className="flex items-center justify-center" onClick={closeMobileMenu}>
            <img src={Logo} alt="Drywall Toolbox Logo" className="logo-image-mobile" />
          </Link>

          {/* Cart Icon - Far Right */}
          <button 
            onClick={onCartToggle} 
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors header-icon" 
            aria-label="Toggle cart"
          >
            <ShoppingCart size={22} />
            {getCartCount() > 0 && (
              <span className="cart-badge">{getCartCount()}</span>
            )}
          </button>
        </div>

  {/* Desktop Layout */}
  <div className="hidden md:contents header-desktop-layout" style={{ display: isTablet ? 'none' : undefined }}>
          <div className="header-left">
            <nav className="nav-links" aria-label="Primary">
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                  onMouseEnter={() => setShopDropdownOpen(true)}
                  onMouseLeave={() => setShopDropdownOpen(false)}
                  className={`nav-link flex items-center gap-1 ${isActive('/products') ? 'active' : ''}`}
                  style={{ color: isActive('/products') ? 'var(--color-primary-600)' : 'black', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 'inherit' }}
                >
                  Shop
                  <ChevronDown size={16} style={{ transition: 'transform 200ms ease-out', transform: shopDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                
                {shopDropdownOpen && (
                  <div 
                    onMouseEnter={() => setShopDropdownOpen(true)}
                    onMouseLeave={() => setShopDropdownOpen(false)}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      backgroundColor: 'white',
                      border: '1px solid var(--machined-border)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      minWidth: '160px',
                      zIndex: 1000,
                      animation: 'dropdownSlideIn 200ms ease-out'
                    }}
                    className="shop-dropdown-menu"
                  >
                    <Link 
                      to="/all-products" 
                      onClick={() => setShopDropdownOpen(false)}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        color: 'black',
                        textDecoration: 'none',
                        transition: 'background-color 150ms ease-out',
                        borderRadius: '6px 6px 0 0'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--alloy-base)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      All Products
                    </Link>
                    <Link 
                      to="/products" 
                      onClick={() => setShopDropdownOpen(false)}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        color: 'black',
                        textDecoration: 'none',
                        transition: 'background-color 150ms ease-out'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--alloy-base)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      Brands
                    </Link>
                  </div>
                )}
              </div>
              <Link to="/parts" className={`nav-link ${isActive('/parts') ? 'active' : ''}`} style={{ color: isActive('/parts') ? 'var(--color-primary-600)' : 'black' }}>Parts</Link>
              <Link to="/repairs" className={`nav-link ${isActive('/repairs') ? 'active' : ''}`} style={{ color: isActive('/repairs') ? 'var(--color-primary-600)' : 'black' }}>Repairs</Link>
            </nav>
          </div>

          <div className="header-center">
            <Link to="/" className="flex items-center justify-center">
              <img src={Logo} alt="Drywall Toolbox Logo" className="logo-image" />
            </Link>
          </div>

          <div className="header-right">
            <nav className="nav-links" aria-label="Secondary">
              <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`} style={{ color: isActive('/about') ? 'var(--color-primary-600)' : 'black' }}>About</Link>
              <Link to="/contact" className={`nav-link ${isActive('/contact') ? 'active' : ''}`} style={{ color: isActive('/contact') ? 'var(--color-primary-600)' : 'black' }}>Contact</Link>
            </nav>

            <div className="cart-area">
              <button onClick={onCartToggle} className="cart-toggle header-icon" aria-label="Toggle cart">
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
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg header-mobile-menu" style={{ display: isTablet ? 'block' : undefined }}>
          <MobileSearch onClose={closeMobileMenu} />
          <nav className="flex flex-col p-4 space-y-2">
            <div>
              <button 
                onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                className={`nav-link-mobile ${isActive('/products') ? 'active' : ''}`}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  padding: '14px 20px', 
                  fontSize: 'inherit', 
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left'
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>Shop</span>
                <ChevronDown size={16} style={{ 
                  transition: 'transform 200ms ease-out', 
                  transform: shopDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                  flexShrink: 0,
                  marginLeft: '8px'
                }} />
              </button>
              
              {shopDropdownOpen && (
                <div style={{ paddingLeft: '16px', borderLeft: '2px solid var(--alloy-mid)', marginTop: '0px' }}>
                  <Link 
                    to="/all-products" 
                    onClick={() => { setShopDropdownOpen(false); closeMobileMenu(); }}
                    className="nav-link-mobile block py-2 text-sm"
                  >
                    All Products
                  </Link>
                  <Link 
                    to="/products" 
                    onClick={() => { setShopDropdownOpen(false); closeMobileMenu(); }}
                    className="nav-link-mobile block py-2 text-sm"
                  >
                    Brands
                  </Link>
                </div>
              )}
            </div>
            <Link 
              to="/parts" 
              className={`nav-link-mobile ${isActive('/parts') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Parts
            </Link>
            <Link 
              to="/repairs" 
              className={`nav-link-mobile ${isActive('/repairs') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Repairs
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

      <style>{`
        @keyframes dropdownSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </header>
  );
}
