import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuthContext } from '../../auth/AuthContext.js';
import { ShoppingCart, Menu, X, ChevronDown, User, LogIn, UserPlus, LogOut, Bell } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
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

const SHOP_FEATURE_LINKS = [
  { to: '/all-products', label: 'All Products', sub: 'Full drywall catalog' },
  { to: '/products', label: 'Shop by Brand', sub: 'TapeTech, Columbia, Level 5, and more' },
  { to: '/parts', label: 'Replacement Parts', sub: 'Parts, kits, and schematics' },
  { to: '/toolset-builder', label: 'Toolset Builder', sub: 'Configure a complete kit' },
];

const SHOP_CATEGORY_LINKS = [
  { to: '/all-products?category=automatic-taping-tools', label: 'Automatic Taping Tools' },
  { to: '/all-products?category=semi-automatic-taping-tools', label: 'Semi-Automatic Taping Tools' },
  { to: '/all-products?category=flat-boxes', label: 'Flat Boxes' },
  { to: '/all-products?category=corner-tools', label: 'Corner Tools' },
  { to: '/all-products?category=handles-extensions', label: 'Handles & Extensions' },
  { to: '/all-products?category=knives-blades', label: 'Knives & Blades' },
  { to: '/all-products?category=mud-pans-pumps', label: 'Mud Pans & Pumps' },
  { to: '/all-products?category=nail-spotters', label: 'Nail Spotters' },
  { to: '/all-products?category=tool-sets-kits', label: 'Tool Sets & Kits' },
  { to: '/all-products?category=parts', label: 'Parts' },
  { to: '/all-products?category=accessories-adapters', label: 'Accessories & Adapters' },
];

export default function Header({ onCartToggle, hasTopTicker = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileAccountDropdownOpen, setMobileAccountDropdownOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [desktopSearchResults, setDesktopSearchResults] = useState([]);
  const [desktopSearchLoading, setDesktopSearchLoading] = useState(false);
  const accountDropdownRef = useRef(null);
  const mobileAccountDropdownRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const desktopSearchRequestIdRef = useRef(0);
  const dropdownCloseTimerRef = useRef(null);
  const prevPathnameRef = useRef(location.pathname);
  const [isTablet, setIsTablet] = useState(() => {
    try { return typeof window !== 'undefined' && window.matchMedia('(min-width: 641px) and (max-width: 1024px)').matches; }
    catch { return false; }
  });

  const isActive = (path) => location.pathname === path;
  const shopActive = isActive('/products') || isActive('/all-products') || isActive('/parts') || isActive('/toolset-builder');

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeMenus = () => {
    setShopDropdownOpen(false);
    setMobileCategoryOpen(false);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
    setMobileAccountDropdownOpen(false);
    setDesktopSearchOpen(false);
  };

  const handleDropdownMouseLeave = () => {
    if (dropdownCloseTimerRef.current) clearTimeout(dropdownCloseTimerRef.current);
    dropdownCloseTimerRef.current = setTimeout(() => setShopDropdownOpen(false), 50);
  };

  const handleDropdownMouseEnter = () => {
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setShopDropdownOpen(true);
  };

  useEffect(() => () => {
    if (dropdownCloseTimerRef.current) clearTimeout(dropdownCloseTimerRef.current);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (prevPathnameRef.current === location.pathname) return;
    prevPathnameRef.current = location.pathname;
    const t = setTimeout(closeMenus, 0);
    return () => clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeMenus(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 641px) and (max-width: 1024px)');
    const handler = (e) => setIsTablet(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const header = document.querySelector('.site-header');
      if (header && !header.contains(e.target)) {
        setShopDropdownOpen(false);
        setDesktopSearchOpen(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) setAccountDropdownOpen(false);
      if (mobileAccountDropdownRef.current && !mobileAccountDropdownRef.current.contains(e.target)) setMobileAccountDropdownOpen(false);
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target)) setDesktopSearchOpen(false);
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
      return undefined;
    }
    const t = setTimeout(async () => {
      setDesktopSearchLoading(true);
      try {
        const found = (await searchProducts(query)).slice(0, 6);
        if (desktopSearchRequestIdRef.current === requestId) setDesktopSearchResults(found);
      } catch (err) {
        if (desktopSearchRequestIdRef.current === requestId) console.error('Desktop search error:', err);
      } finally {
        if (desktopSearchRequestIdRef.current === requestId) setDesktopSearchLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [desktopSearchQuery]);

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

  const closeMobileNav = () => {
    setShopDropdownOpen(false);
    setMobileCategoryOpen(false);
    closeMobileMenu();
  };

  return (
    <>
      <header className={`site-header${hasTopTicker ? ' site-header--with-top-ticker' : ' site-header--no-ticker'}`} role="banner">
        <div className="site-header-inner">
          <div className="header-mobile-layout" style={{ display: isTablet ? 'flex' : undefined }}>
            <div className="header-mobile-slot header-mobile-slot--left">
              <button onClick={toggleMobileMenu} className="header-mobile-toggle header-icon" aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>

            <Link to="/" className="header-mobile-logo" onClick={closeMobileMenu}>
              <img src={LogoWhite} alt="Drywall Toolbox Logo" className="logo-image-mobile" />
            </Link>

            <div className="header-mobile-slot header-mobile-slot--right">
              <div ref={mobileAccountDropdownRef} className="mobile-account-wrap">
                <button
                  onClick={() => { setMobileAccountDropdownOpen((o) => !o); setMobileMenuOpen(false); }}
                  className="header-mobile-account-toggle header-icon"
                  aria-label="Account menu"
                  aria-expanded={mobileAccountDropdownOpen}
                >
                  <User size={22} />
                </button>
                <AnimatePresence>
                  {mobileAccountDropdownOpen && (
                    <Motion.div className="mobile-account-dropdown" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
                      {!isLoading && (isAuthenticated ? (
                        <>
                          <div className="header-account-summary"><div className="header-account-avatar"><User size={15} /></div><div className="header-account-copy"><p className="header-account-name">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'My Account'}</p>{user?.email && <p className="header-account-email">{user.email}</p>}</div></div>
                          <Link to="/dashboard" onClick={() => setMobileAccountDropdownOpen(false)} className="header-account-link"><User size={14} />My Dashboard</Link>
                          <Link to="/notifications" onClick={() => setMobileAccountDropdownOpen(false)} className="header-account-link"><Bell size={14} />Notifications</Link>
                          <div className="header-account-divider" />
                          <button onClick={async () => { setMobileAccountDropdownOpen(false); await logout(); }} className="header-account-link header-account-link--danger"><LogOut size={14} />Sign Out</button>
                        </>
                      ) : (
                        <>
                          <div className="header-account-guest-header"><p className="header-account-guest-title">My Account</p></div>
                          <Link to="/login" onClick={() => setMobileAccountDropdownOpen(false)} className="header-account-link header-account-link--strong"><LogIn size={14} />Sign In</Link>
                          <div className="header-account-divider header-account-divider--inset" />
                          <div className="header-account-guest-body"><Link to="/register" onClick={() => setMobileAccountDropdownOpen(false)} className="header-account-cta"><UserPlus size={13} />Create Account</Link><p className="header-account-note">No account needed to browse or checkout.</p></div>
                        </>
                      ))}
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="header-desktop-layout" style={{ display: isTablet ? 'none' : undefined }}>
            <div className="header-left"><Link to="/" className="header-logo-link" aria-label="Drywall Toolbox home"><img src={LogoWhite} alt="Drywall Toolbox Logo" className="logo-image" /></Link></div>
            <div className="header-center">
              <nav className="nav-links header-desktop-nav" aria-label="Primary">
                <div className={`header-mega${shopDropdownOpen ? ' is-open' : ''}`} onMouseEnter={handleDropdownMouseEnter} onMouseLeave={handleDropdownMouseLeave}>
                  <button className={`nav-link header-nav-trigger ${shopActive ? 'active' : ''}`} type="button" aria-expanded={shopDropdownOpen}><span>Shop</span><ChevronDown size={14} className="header-nav-trigger__chevron" /></button>
                  <div className={`shop-dropdown-menu header-mega-panel${shopDropdownOpen ? ' is-open' : ''}`}>
                    <div className="header-mega-accent" />
                    <div className="header-mega-grid">
                      <div className="header-mega-section"><p className="header-mega-section-title">Shop Navigation</p><div className="header-mega-links">{SHOP_FEATURE_LINKS.map(({ to, label, sub }) => <Link key={to} to={to} onClick={() => setShopDropdownOpen(false)} className="header-mega-link"><span className="header-mega-link-copy"><span className="header-mega-link-title">{label}</span><span className="header-mega-link-sub">{sub}</span></span></Link>)}</div></div>
                      <div className="header-mega-section"><p className="header-mega-section-title">Drywall Industry Categories</p><div className="header-mega-category-grid">{SHOP_CATEGORY_LINKS.map(({ to, label }) => <Link key={to} to={to} onClick={() => setShopDropdownOpen(false)} className="header-mega-category-link">{label}</Link>)}</div></div>
                    </div>
                    <div className="header-mega-footer"><div className="header-mega-footer-actions"><Link to="/all-products" onClick={() => setShopDropdownOpen(false)} className="header-mega-footer-link">View All Products</Link><Link to="/products" onClick={() => setShopDropdownOpen(false)} className="header-mega-footer-link header-mega-footer-link--secondary">Shop by Brand</Link></div></div>
                  </div>
                </div>
                {PRIMARY_NAV_LINKS.map(({ to, label }) => <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>{label}</Link>)}
              </nav>
            </div>
            <div className="header-right header-desktop-actions">
              <div ref={desktopSearchRef} className="dtb-desktop-search">
                <div className="dtb-desktop-search-pill"><input ref={desktopSearchInputRef} type="text" value={desktopSearchQuery} onChange={(e) => setDesktopSearchQuery(e.target.value)} onFocus={() => setDesktopSearchOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter') handleDesktopViewAll(); }} placeholder="Search products..." className="dtb-desktop-search-input" aria-label="Search products" autoComplete="off" /></div>
                {desktopSearchOpen && (desktopSearchLoading || desktopSearchResults.length > 0 || desktopSearchQuery.trim()) && (
                  <div className="dtb-desktop-search-dropdown">
                    {desktopSearchLoading ? <div className="dtb-desktop-search-state">Loading...</div> : desktopSearchResults.length > 0 ? <><div className="dtb-desktop-search-results">{desktopSearchResults.map((product) => <button key={product.id} className="dtb-desktop-search-item" onClick={() => handleDesktopResultClick(product.id)}><div className="dtb-desktop-search-thumb">{product.image ? <img src={product.image} alt={product.name} /> : null}</div><div className="dtb-desktop-search-meta"><span className="dtb-desktop-search-name">{product.name}</span><span className="dtb-desktop-search-price">{typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : 'View product'}</span></div></button>)}</div><button className="dtb-desktop-search-view-all" onClick={handleDesktopViewAll}>View All Results</button></> : desktopSearchQuery.trim() ? <div className="dtb-desktop-search-state">No products found</div> : null}
                  </div>
                )}
              </div>
              {!isLoading && <div ref={accountDropdownRef} className="header-account"><button onClick={() => setAccountDropdownOpen((o) => !o)} aria-label="Account menu" aria-expanded={accountDropdownOpen} className="header-account-toggle header-icon"><User size={20} /></button><div className={`header-account-panel${accountDropdownOpen ? ' is-open' : ''}`}>{isAuthenticated ? <><div className="header-account-summary"><div className="header-account-avatar"><User size={15} /></div><div className="header-account-copy"><p className="header-account-name">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'My Account'}</p>{user?.email && <p className="header-account-email">{user.email}</p>}</div></div><Link to="/dashboard" onClick={() => setAccountDropdownOpen(false)} className="header-account-link"><User size={14} />My Dashboard</Link><Link to="/notifications" onClick={() => setAccountDropdownOpen(false)} className="header-account-link"><Bell size={14} />Notifications</Link><div className="header-account-divider" /><button onClick={async () => { setAccountDropdownOpen(false); await logout(); }} className="header-account-link header-account-link--danger"><LogOut size={14} />Sign Out</button></> : <><div className="header-account-guest-header"><p className="header-account-guest-title">My Account</p></div><Link to="/login" onClick={() => setAccountDropdownOpen(false)} className="header-account-link header-account-link--strong"><LogIn size={14} />Sign In</Link><div className="header-account-divider header-account-divider--inset" /><div className="header-account-guest-body"><Link to="/register" onClick={() => setAccountDropdownOpen(false)} className="header-account-cta"><UserPlus size={13} />Create Account</Link><p className="header-account-note">No account needed to browse or checkout.</p></div></>}</div></div>}
              {!isLoading && isAuthenticated && <NotificationsBell />}
              <div className="cart-area"><button onClick={onCartToggle} className="cart-toggle header-icon" aria-label="Toggle cart"><ShoppingCart size={20} />{getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}</button></div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <Motion.div
              className="header-mobile-menu"
              style={{ display: isTablet ? 'flex' : undefined }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div className="header-mobile-menu-scroll">
                <MobileSearch onClose={closeMobileMenu} />
                <nav className="header-mobile-nav" aria-label="Mobile primary navigation">
                  <div className="header-mobile-nav-group">
                    <button onClick={() => setShopDropdownOpen(!shopDropdownOpen)} className={`nav-link-mobile header-mobile-shop-toggle ${shopActive ? 'active' : ''}`} aria-expanded={shopDropdownOpen}>
                      <span>Shop</span>
                      <ChevronDown size={16} className={`header-mobile-shop-chevron${shopDropdownOpen ? ' is-open' : ''}`} />
                    </button>
                    {shopDropdownOpen && (
                      <div className="header-mobile-shop-links">
                        <p className="header-mobile-shop-section-title">Shop Navigation</p>
                        {SHOP_FEATURE_LINKS.map(({ to, label, sub }) => <Link key={to} to={to} onClick={closeMobileNav} className="header-mobile-feature-link"><span className="header-mobile-feature-link-label">{label}</span><span className="header-mobile-feature-link-sub">{sub}</span></Link>)}
                        <button className="header-mobile-category-toggle" onClick={() => setMobileCategoryOpen((o) => !o)} aria-expanded={mobileCategoryOpen}><span>Browse by Category</span><ChevronDown size={14} className={`header-mobile-shop-chevron${mobileCategoryOpen ? ' is-open' : ''}`} /></button>
                        {mobileCategoryOpen && <div className="header-mobile-category-grid">{SHOP_CATEGORY_LINKS.map(({ to, label }) => <Link key={to} to={to} onClick={closeMobileNav} className="header-mobile-category-item">{label}</Link>)}</div>}
                      </div>
                    )}
                  </div>
                  {PRIMARY_NAV_LINKS.map(({ to, label }) => <Link key={to} to={to} className={`nav-link-mobile ${isActive(to) ? 'active' : ''}`} onClick={closeMobileMenu}>{label}</Link>)}
                </nav>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </header>

      <Motion.button className="mobile-cart-fab" onClick={onCartToggle} aria-label="Open cart" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 24 }} whileTap={{ scale: 0.9 }}>
        <ShoppingCart size={22} />
        <span aria-live="polite" aria-atomic="true">{getCartCount() > 0 && <span className="mobile-cart-fab-badge" aria-label={`${getCartCount()} items in cart`}>{getCartCount()}</span>}</span>
      </Motion.button>

      <style>{`
        .header-mobile-menu {
          position: fixed !important;
          left: 0 !important;
          right: 0 !important;
          top: var(--header-height, 72px) !important;
          bottom: 0 !important;
          z-index: 9998 !important;
          display: flex !important;
          flex-direction: column !important;
          width: 100vw !important;
          max-width: 100vw !important;
          height: calc(100dvh - var(--header-height, 72px)) !important;
          max-height: calc(100dvh - var(--header-height, 72px)) !important;
          overflow: hidden !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
          background: rgba(255, 255, 255, 0.98) !important;
          border-top: 1px solid rgba(15, 23, 42, 0.08) !important;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.10) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
        }

        .header-mobile-menu-scroll {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          width: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior-y: contain !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-y !important;
          padding: 14px 16px calc(96px + env(safe-area-inset-bottom, 0px)) !important;
        }

        .header-mobile-nav {
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
          padding-bottom: 28px !important;
        }

        .header-mobile-shop-links,
        .header-mobile-category-grid {
          max-height: none !important;
          overflow: visible !important;
        }

        .header-mobile-menu .nav-link-mobile,
        .header-mobile-menu .header-mobile-feature-link-label,
        .header-mobile-menu .header-mobile-category-toggle,
        .header-mobile-menu .header-mobile-category-item {
          color: var(--tension-accent, #2563eb) !important;
        }

        .header-mobile-menu .header-mobile-feature-link-sub,
        .header-mobile-menu .header-mobile-shop-section-title {
          color: rgba(37, 99, 235, 0.68) !important;
        }

        @media (max-width: 640px) {
          .header-mobile-menu-scroll {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
      `}</style>
    </>
  );
}
