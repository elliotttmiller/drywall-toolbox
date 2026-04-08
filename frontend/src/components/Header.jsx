import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { useAuthContext } from '../auth/AuthContext.js';
import { ShoppingCart, Menu, X, ChevronDown, User, LogIn, UserPlus, LogOut } from 'lucide-react';
import Logo from '/logo2.svg';
import MobileSearch from './MobileSearch';

export default function Header({ onCartToggle }) {
  const location = useLocation();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef(null);
  const [isTablet, setIsTablet] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia('(min-width: 641px) and (max-width: 1024px)').matches;
    } catch {
      return false;
    }
  });
  
  // Ref for dropdown close timer (prevents flickering on fast mouse movement)
  const dropdownCloseTimerRef = useRef(null);
  // Tracks the previous pathname so the navigation-close effect can run
  // asynchronously and avoid the react-hooks/set-state-in-effect lint error.
  const prevPathnameRef = useRef(location.pathname);

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeMenus = () => {
    setShopDropdownOpen(false);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
  };

  // Handle dropdown close with small delay to prevent flicker
  const handleDropdownMouseLeave = () => {
    // Clear any existing timer
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
    }
    // Set new timer (50ms delay is imperceptible but prevents flicker)
    dropdownCloseTimerRef.current = setTimeout(() => {
      setShopDropdownOpen(false);
    }, 50);
  };

  const handleDropdownMouseEnter = () => {
    // Cancel any pending close when mouse enters
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setShopDropdownOpen(true);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dropdownCloseTimerRef.current) {
        clearTimeout(dropdownCloseTimerRef.current);
      }
    };
  }, []);

  // Close dropdowns on navigation.
  // setState calls are deferred via setTimeout so they run asynchronously,
  // satisfying the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (prevPathnameRef.current === location.pathname) return;
    prevPathnameRef.current = location.pathname;
    const t = setTimeout(() => {
      setShopDropdownOpen(false);
      setMobileMenuOpen(false);
      setAccountDropdownOpen(false);
    }, 0);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Handle keyboard shortcuts (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMenus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Handle clicking outside the header to close menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close shop dropdown if clicking outside the header
      const header = document.querySelector('.site-header');
      if (header && !header.contains(e.target)) {
        setShopDropdownOpen(false);
      }
      // Close account dropdown if clicking outside its container
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setAccountDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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
              <div 
                style={{ position: 'relative' }}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                <button 
                  className={`nav-link flex items-center gap-1 ${isActive('/products') ? 'active' : ''}`}
                  style={{ color: isActive('/products') ? 'var(--color-primary-600)' : 'black', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 'inherit' }}
                >
                  Shop
                  <ChevronDown size={16} style={{ transition: 'transform 200ms ease-out', transform: shopDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                
                {/* Always render dropdown, control visibility with opacity/pointer-events */}
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    backgroundColor: 'white',
                    border: '1px solid var(--machined-border)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    minWidth: '200px',
                    width: 'max-content',
                    zIndex: 10000,
                    marginTop: '4px',
                    opacity: shopDropdownOpen ? 1 : 0,
                    visibility: shopDropdownOpen ? 'visible' : 'hidden',
                    pointerEvents: shopDropdownOpen ? 'auto' : 'none',
                    transition: 'opacity 150ms ease-out, visibility 150ms ease-out',
                    animation: shopDropdownOpen ? 'dropdownSlideIn 200ms ease-out' : 'none'
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
                    <Link 
                      to="/parts" 
                      onClick={() => setShopDropdownOpen(false)}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        color: 'black',
                        textDecoration: 'none',
                        transition: 'background-color 150ms ease-out',
                        borderRadius: '0 0 6px 6px'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--alloy-base)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      Replacement Parts
                    </Link>
                  </div>
              </div>
              <Link to="/schematics" className={`nav-link ${isActive('/schematics') ? 'active' : ''}`} style={{ color: isActive('/schematics') ? 'var(--color-primary-600)' : 'black' }}>Schematics</Link>
              <Link to="/repairs" className={`nav-link ${isActive('/repairs') ? 'active' : ''}`} style={{ color: isActive('/repairs') ? 'var(--color-primary-600)' : 'black' }}>Repairs</Link>
              <Link to="/calculators" className={`nav-link ${isActive('/calculators') ? 'active' : ''}`} style={{ color: isActive('/calculators') ? 'var(--color-primary-600)' : 'black' }}>Calculators</Link>
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

            {/* ── Desktop account icon + dropdown ─────────────────────────── */}
            {!isLoading && (
              <div ref={accountDropdownRef} style={{ position: 'relative' }}>

                {/* Trigger — circle icon button */}
                <button
                  onClick={() => setAccountDropdownOpen((o) => !o)}
                  aria-label="Account menu"
                  aria-expanded={accountDropdownOpen}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    width:          '36px',
                    height:         '36px',
                    borderRadius:   '50%',
                    border:         isAuthenticated ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                    background:     isAuthenticated ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : 'white',
                    cursor:         'pointer',
                    padding:        0,
                    flexShrink:     0,
                    transition:     'box-shadow 150ms',
                    boxShadow:      accountDropdownOpen ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
                  }}
                  onMouseEnter={(e) => { if (!accountDropdownOpen) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                  onMouseLeave={(e) => { if (!accountDropdownOpen) e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <User size={16} style={{ color: isAuthenticated ? 'white' : '#475569' }} />
                </button>

                {/* Dropdown panel — always rendered, CSS-driven open/close */}
                <div
                  style={{
                    position:        'absolute',
                    top:             'calc(100% + 10px)',
                    right:           0,
                    width:           '224px',
                    background:      'white',
                    border:          '1px solid rgba(15,23,42,0.09)',
                    borderRadius:    '10px',
                    boxShadow:       '0 8px 28px rgba(15,23,42,0.13), 0 2px 8px rgba(15,23,42,0.06)',
                    zIndex:          10001,
                    overflow:        'hidden',
                    opacity:         accountDropdownOpen ? 1 : 0,
                    visibility:      accountDropdownOpen ? 'visible' : 'hidden',
                    pointerEvents:   accountDropdownOpen ? 'auto' : 'none',
                    transform:       accountDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                    transformOrigin: 'top right',
                    transition:      'opacity 160ms ease-out, transform 160ms ease-out, visibility 160ms',
                  }}
                >
                  {isAuthenticated ? (
                    /* ── Logged-in state ── */
                    <>
                      {/* Identity header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px 12px', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={15} style={{ color: 'white' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.825rem', color: '#0f172a', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'My Account'}
                          </p>
                          {user?.email && (
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Dashboard */}
                      <Link
                        to="/dashboard"
                        onClick={() => setAccountDropdownOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', color: '#0f172a', textDecoration: 'none', fontSize: '0.845rem', fontWeight: 500, transition: 'background 130ms' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <User size={14} style={{ opacity: 0.45, flexShrink: 0 }} />
                        My Dashboard
                      </Link>

                      <div style={{ height: '1px', background: 'rgba(15,23,42,0.07)', margin: '2px 0' }} />

                      {/* Sign out */}
                      <button
                        onClick={async () => { setAccountDropdownOpen(false); await logout(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.845rem', fontWeight: 600, color: '#dc2626', transition: 'background 130ms' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <LogOut size={14} style={{ flexShrink: 0 }} />
                        Sign Out
                      </button>
                    </>
                  ) : (
                    /* ── Guest state ── */
                    <>
                      {/* Label */}
                      <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94a3b8' }}>
                          My Account
                        </p>
                      </div>

                      {/* Sign In */}
                      <Link
                        to="/login"
                        onClick={() => setAccountDropdownOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', color: '#0f172a', textDecoration: 'none', fontSize: '0.845rem', fontWeight: 600, transition: 'background 130ms' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogIn size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                        Sign In
                      </Link>

                      <div style={{ height: '1px', background: 'rgba(15,23,42,0.07)', margin: '2px 16px' }} />

                      {/* Create Account */}
                      <div style={{ padding: '10px 12px 12px' }}>
                        <Link
                          to="/register"
                          onClick={() => setAccountDropdownOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px 14px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', borderRadius: '6px', color: 'white', textDecoration: 'none', fontSize: '0.825rem', fontWeight: 700, transition: 'opacity 130ms' }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          <UserPlus size={13} />
                          Create Account
                        </Link>
                        <p style={{ margin: '8px 0 0', fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                          No account needed to browse or checkout.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

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
                  <Link 
                    to="/parts" 
                    onClick={() => { setShopDropdownOpen(false); closeMobileMenu(); }}
                    className="nav-link-mobile block py-2 text-sm"
                  >
                    Replacement Parts
                  </Link>
                </div>
              )}
            </div>
            <Link 
              to="/repairs" 
              className={`nav-link-mobile ${isActive('/repairs') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Repairs
            </Link>
            <Link
              to="/calculators"
              className={`nav-link-mobile ${isActive('/calculators') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Calculators
            </Link>
            <Link 
              to="/schematics" 
              className={`nav-link-mobile ${isActive('/schematics') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Schematics
            </Link>
            <Link 
              to="/contact" 
              className={`nav-link-mobile ${isActive('/contact') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Contact
            </Link>
            <Link 
              to="/about" 
              className={`nav-link-mobile ${isActive('/about') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              About
            </Link>

            {/* ── Account / Auth — bottom of mobile menu ─────────────────── */}
            <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--machined-border)' }}>
              {!isLoading && (
                isAuthenticated ? (
                  /* ── Logged-in ── */
                  <>
                    {/* Identity row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', marginBottom: '4px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={16} style={{ color: 'white' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', lineHeight: 1.2 }}>
                          {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'My Account'}
                        </p>
                        {user?.email && (
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <Link
                      to="/dashboard"
                      className={`nav-link-mobile ${isActive('/dashboard') ? 'active' : ''}`}
                      onClick={closeMobileMenu}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <User size={16} style={{ flexShrink: 0, opacity: 0.55 }} />
                      My Dashboard
                    </Link>

                    <button
                      onClick={async () => { await logout(); closeMobileMenu(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: '#dc2626', fontWeight: 600, borderRadius: '6px', transition: 'background 150ms' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <LogOut size={16} style={{ flexShrink: 0 }} />
                      Sign Out
                    </button>
                  </>
                ) : (
                  /* ── Guest ── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 20px 8px' }}>
                    <Link
                      to="/login"
                      onClick={closeMobileMenu}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', border: '1.5px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', background: 'white', transition: 'background 150ms' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <LogIn size={16} />
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={closeMobileMenu}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', borderRadius: '6px', color: 'white', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', transition: 'opacity 150ms' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <UserPlus size={16} />
                      Create Account
                    </Link>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                      No account needed to browse or checkout.
                    </p>
                  </div>
                )
              )}
            </div>
          </nav>
        </div>
      )}

      <style>{`
        @keyframes dropdownSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes accountDropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
}
