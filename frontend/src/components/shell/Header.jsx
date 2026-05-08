import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuthContext } from '../../auth/AuthContext.js';
import { ShoppingCart, Menu, X, ChevronDown, User, LogIn, UserPlus, LogOut, Search, Wrench, Layers, Settings, Star } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import LogoBlack from '/logo-black.svg';
import LogoWhite from '/logo-white.svg';
import MobileSearch from './MobileSearch';
import NotificationsBell from './NotificationsBell';
import { searchProducts } from '../../services/catalog';

const PRIMARY_NAV_LINKS = [
  { to: '/schematics', label: 'Schematics' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/repairs', label: 'Repairs' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

const SHOP_MENU_LINKS = [
  { to: '/all-products', label: 'All Products' },
  { to: '/products', label: 'Brands' },
  { to: '/parts', label: 'Replacement Parts' },
  { to: '/toolset-builder', label: 'Toolset Builder' },
];

// Mega menu shop items organized by column
const MEGA_MENU_ITEMS = [
  {
    heading: 'Browse',
    items: [
      { to: '/all-products', label: 'All Products', sub: 'Full catalog', icon: Layers },
      { to: '/products', label: 'Shop by Brand', sub: 'TapeTech, Columbia…', icon: Star },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { to: '/parts', label: 'Replacement Parts', sub: 'Parts, kits & schematics', icon: Settings },
      { to: '/toolset-builder', label: 'Toolset Builder', sub: 'Configure your kit', icon: Wrench },
    ],
  },
];

export default function Header({ onCartToggle, hasTopTicker = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [desktopSearchResults, setDesktopSearchResults] = useState([]);
  const [desktopSearchLoading, setDesktopSearchLoading] = useState(false);
  const accountDropdownRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const desktopSearchRequestIdRef = useRef(0);
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
    setDesktopSearchOpen(false);
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
      setDesktopSearchOpen(false);
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
        setDesktopSearchOpen(false);
      }
      // Close account dropdown if clicking outside its container
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setAccountDropdownOpen(false);
      }
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target)) {
        setDesktopSearchOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const query = desktopSearchQuery.trim();
    const requestId = desktopSearchRequestIdRef.current + 1;
    desktopSearchRequestIdRef.current = requestId;

    if (!query) {
      setDesktopSearchResults([]);
      setDesktopSearchLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      setDesktopSearchLoading(true);
      try {
        const found = (await searchProducts(query)).slice(0, 6);
        if (desktopSearchRequestIdRef.current === requestId) {
          setDesktopSearchResults(found);
        }
      } catch (err) {
        if (desktopSearchRequestIdRef.current === requestId) {
          console.error('Desktop search error:', err);
        }
      } finally {
        if (desktopSearchRequestIdRef.current === requestId) {
          setDesktopSearchLoading(false);
        }
      }
    }, 180);

    return () => clearTimeout(t);
  }, [desktopSearchQuery]);

  const openDesktopSearch = () => {
    setDesktopSearchOpen(true);
    setTimeout(() => desktopSearchInputRef.current?.focus(), 50);
  };

  const handleDesktopResultClick = (productId) => {
    navigate(`/product/${productId}`);
    setDesktopSearchOpen(false);
    setDesktopSearchQuery('');
    setDesktopSearchResults([]);
  };

  const handleDesktopViewAll = () => {
    const q = desktopSearchQuery.trim();
    navigate(`/all-products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    setDesktopSearchOpen(false);
  };

  const shopActive = isActive('/products') || isActive('/all-products') || isActive('/parts') || isActive('/toolset-builder');

  return (
    <>
      <header className={`site-header${hasTopTicker ? ' site-header--with-top-ticker' : ' site-header--no-ticker'}`} role="banner">
        <div className="site-header-inner">
          <div className="header-mobile-layout" style={{ display: isTablet ? 'flex' : undefined }}>
            <div className="header-mobile-slot header-mobile-slot--left">
              <button
                onClick={toggleMobileMenu}
                className="header-mobile-toggle header-icon"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>

            <Link to="/" className="header-mobile-logo" onClick={closeMobileMenu}>
              <img src={LogoWhite} alt="Drywall Toolbox Logo" className="logo-image-mobile" />
            </Link>

            <div className="header-mobile-slot header-mobile-slot--right">
              {!isLoading && isAuthenticated && <NotificationsBell />}
              <button
                onClick={onCartToggle}
                className="cart-toggle header-icon"
                aria-label="Toggle cart"
              >
                <ShoppingCart size={22} />
                {getCartCount() > 0 && (
                  <span className="cart-badge">{getCartCount()}</span>
                )}
              </button>
            </div>
          </div>

          <div className="header-desktop-layout" style={{ display: isTablet ? 'none' : undefined }}>
            <div className="header-left">
              <Link to="/" className="header-logo-link" aria-label="Drywall Toolbox home">
                <img src={LogoWhite} alt="Drywall Toolbox Logo" className="logo-image" />
              </Link>
            </div>

            <div className="header-center">
              <nav className="nav-links header-desktop-nav" aria-label="Primary">
                <div
                  className={`header-mega${shopDropdownOpen ? ' is-open' : ''}`}
                  onMouseEnter={handleDropdownMouseEnter}
                  onMouseLeave={handleDropdownMouseLeave}
                >
                  <button
                    className={`nav-link header-nav-trigger ${shopActive ? 'active' : ''}`}
                    type="button"
                    aria-expanded={shopDropdownOpen}
                  >
                    <span>Shop</span>
                    <ChevronDown size={14} className="header-nav-trigger__chevron" />
                  </button>

                  <div className={`shop-dropdown-menu header-mega-panel${shopDropdownOpen ? ' is-open' : ''}`}>
                    <div className="header-mega-accent" />

                    <div className="header-mega-grid">
                      {MEGA_MENU_ITEMS.map((col) => (
                        <div key={col.heading} className="header-mega-section">
                          <p className="header-mega-section-title">{col.heading}</p>
                          <div className="header-mega-links">
                            {col.items.map(({ to, label, sub, icon: Icon }) => (
                              <Link
                                key={to}
                                to={to}
                                onClick={() => setShopDropdownOpen(false)}
                                className="header-mega-link"
                              >
                                <div className="header-mega-link-icon">
                                  <Icon size={14} />
                                </div>
                                <span className="header-mega-link-copy">
                                  <span className="header-mega-link-title">{label}</span>
                                  <span className="header-mega-link-sub">{sub}</span>
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="header-mega-footer">
                      <Link
                        to="/all-products"
                        onClick={() => setShopDropdownOpen(false)}
                        className="header-mega-footer-link"
                      >
                        View All Products
                      </Link>
                    </div>
                  </div>
                </div>

                {PRIMARY_NAV_LINKS.map(({ to, label }) => (
                  <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="header-right header-desktop-actions">
              <div ref={desktopSearchRef} className={`dtb-desktop-search ${desktopSearchOpen ? 'is-open' : ''}`}>
                <button
                  onClick={() => (desktopSearchOpen ? setDesktopSearchOpen(false) : openDesktopSearch())}
                  className="dtb-search-btn header-icon"
                  aria-label="Search products"
                  title="Search products"
                >
                  <Search size={16} />
                </button>

                <div className="dtb-desktop-search-input-wrap">
                  <input
                    ref={desktopSearchInputRef}
                    type="text"
                    value={desktopSearchQuery}
                    onChange={(e) => setDesktopSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="dtb-desktop-search-input"
                  />
                </div>

                {desktopSearchOpen && (
                  <div className="dtb-desktop-search-dropdown">
                    {desktopSearchLoading ? (
                      <div className="dtb-desktop-search-state">Loading...</div>
                    ) : desktopSearchResults.length > 0 ? (
                      <>
                        <div className="dtb-desktop-search-results">
                          {desktopSearchResults.map((product) => (
                            <button
                              key={product.id}
                              className="dtb-desktop-search-item"
                              onClick={() => handleDesktopResultClick(product.id)}
                            >
                              <div className="dtb-desktop-search-thumb">
                                {product.image ? <img src={product.image} alt={product.name} /> : null}
                              </div>
                              <div className="dtb-desktop-search-meta">
                                <span className="dtb-desktop-search-name">{product.name}</span>
                                <span className="dtb-desktop-search-price">
                                  {typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : 'View product'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button className="dtb-desktop-search-view-all" onClick={handleDesktopViewAll}>
                          View All Results
                        </button>
                      </>
                    ) : desktopSearchQuery.trim() ? (
                      <div className="dtb-desktop-search-state">No products found</div>
                    ) : (
                      <div className="dtb-desktop-search-state">Start typing to search...</div>
                    )}
                  </div>
                )}
              </div>

              {!isLoading && (
                <div ref={accountDropdownRef} className="header-account">
                  <button
                    onClick={() => setAccountDropdownOpen((o) => !o)}
                    aria-label="Account menu"
                    aria-expanded={accountDropdownOpen}
                    className="header-account-toggle header-icon"
                  >
                    <User size={20} />
                  </button>

                  <div className={`header-account-panel${accountDropdownOpen ? ' is-open' : ''}`}>
                    {isAuthenticated ? (
                      <>
                        <div className="header-account-summary">
                          <div className="header-account-avatar">
                            <User size={15} />
                          </div>
                          <div className="header-account-copy">
                            <p className="header-account-name">
                              {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'My Account'}
                            </p>
                            {user?.email && (
                              <p className="header-account-email">{user.email}</p>
                            )}
                          </div>
                        </div>
                        <Link
                          to="/dashboard"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="header-account-link"
                        >
                          <User size={14} />
                          My Dashboard
                        </Link>
                        <div className="header-account-divider" />
                        <button
                          onClick={async () => { setAccountDropdownOpen(false); await logout(); }}
                          className="header-account-link header-account-link--danger"
                        >
                          <LogOut size={14} />
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="header-account-guest-header">
                          <p className="header-account-guest-title">My Account</p>
                        </div>
                        <Link
                          to="/login"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="header-account-link header-account-link--strong"
                        >
                          <LogIn size={14} />
                          Sign In
                        </Link>
                        <div className="header-account-divider header-account-divider--inset" />
                        <div className="header-account-guest-body">
                          <Link
                            to="/register"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="header-account-cta"
                          >
                            <UserPlus size={13} />
                            Create Account
                          </Link>
                          <p className="header-account-note">
                            No account needed to browse or checkout.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!isLoading && isAuthenticated && <NotificationsBell />}

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

        <AnimatePresence>
          {mobileMenuOpen && (
            <Motion.div
              className="header-mobile-menu"
              style={{ display: isTablet ? 'block' : undefined }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <MobileSearch onClose={closeMobileMenu} />
              <nav className="header-mobile-nav">
                <div className="header-mobile-nav-group">
                  <button
                    onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                    className={`nav-link-mobile header-mobile-shop-toggle ${shopActive ? 'active' : ''}`}
                  >
                    <span>Shop</span>
                    <ChevronDown size={16} className={`header-mobile-shop-chevron${shopDropdownOpen ? ' is-open' : ''}`} />
                  </button>

                  {shopDropdownOpen && (
                    <div className="header-mobile-shop-links">
                      {SHOP_MENU_LINKS.map(({ to, label }) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => { setShopDropdownOpen(false); closeMobileMenu(); }}
                          className={`nav-link-mobile header-mobile-sub-link ${isActive(to) ? 'active' : ''}`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {PRIMARY_NAV_LINKS.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`nav-link-mobile ${isActive(to) ? 'active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    {label}
                  </Link>
                ))}

                <div className="mobile-nav-account">
                  {!isLoading && (
                    isAuthenticated ? (
                      <Link
                        to="/dashboard"
                        onClick={closeMobileMenu}
                        className="mobile-nav-user-card"
                      >
                        <div className="mobile-nav-avatar">
                          <User size={17} style={{ color: 'white' }} />
                        </div>
                        <div className="mobile-nav-user-copy">
                          <span className="mobile-nav-user-name">
                            {user?.first_name && user?.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user?.email ? user.email.split('@')[0] : 'My Account'}
                          </span>
                          {user?.email && (
                            <span className="mobile-nav-user-email">{user.email}</span>
                          )}
                        </div>
                      </Link>
                    ) : (
                      <div className="mobile-nav-guest">
                        <Link
                          to="/login"
                          onClick={closeMobileMenu}
                          className="mobile-nav-guest-btn mobile-nav-guest-btn--signin"
                        >
                          <LogIn size={15} />
                          Sign In
                        </Link>
                        <Link
                          to="/register"
                          onClick={closeMobileMenu}
                          className="mobile-nav-guest-btn mobile-nav-guest-btn--register"
                        >
                          <UserPlus size={15} />
                          Create Account
                        </Link>
                      </div>
                    )
                  )}
                </div>
              </nav>
            </Motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
