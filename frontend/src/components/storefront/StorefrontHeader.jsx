import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuthContext } from '../../auth/AuthContext.js';
import { ShoppingCart, Menu, X, ChevronDown, ChevronRight, User, LogIn, UserPlus, LogOut, Bell, Search } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import LogoWhite from '/logo-white.svg';
import NotificationsBell from '../shell/NotificationsBell';
import StorefrontSearchOverlay from './StorefrontSearchOverlay';
import { searchProducts } from '../../services/catalog';

const PRIMARY_NAV_LINKS = [
  { to: '/schematics', label: 'Schematics' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/repairs', label: 'Repairs' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

const SHOP_FEATURE_LINKS = [
  { to: '/products', label: 'All Products', sub: 'Full drywall catalog' },
  { to: '/products/brands', label: 'Shop by Brand', sub: 'TapeTech, Columbia, Level 5, and more' },
  { to: '/parts', label: 'Replacement Parts', sub: 'Parts, kits, and schematics' },
  { to: '/toolset-builder', label: 'Toolset Builder', sub: 'Configure a complete kit' },
];

const SHOP_CATEGORY_LINKS = [
  { to: '/products?display_category=automatic_taping_tools', label: 'Automatic Taping Tools' },
  { to: '/products?display_category=semi_automatic_taping_tools', label: 'Semi-Automatic Taping Tools' },
  { to: '/products?display_category=finishing_boxes', label: 'Flat Boxes' },
  { to: '/products?display_category=corner_tools', label: 'Corner Tools' },
  { to: '/products?display_category=handles_and_extensions', label: 'Handles & Extensions' },
  { to: '/products?display_category=knives_and_blades', label: 'Knives & Blades' },
  { to: '/products?display_category=mud_pans_and_pumps', label: 'Mud Pans & Pumps' },
  { to: '/products?display_category=nail_spotters', label: 'Nail Spotters' },
  { to: '/products?display_category=tool_sets_and_kits', label: 'Tool Sets & Kits' },
  { to: '/products?display_category=parts', label: 'Parts' },
  { to: '/products?display_category=accessories', label: 'Accessories & Adapters' },
];

const DRAWER_NAV_ROWS = [
  { to: '/products/brands', label: 'Brands' },
  { to: '/products', label: 'All Products' },
  { to: '/parts', label: 'Parts' },
  { to: '/products?sort=newest', label: 'New Arrivals' },
  { to: '/schematics', label: 'Schematics' },
  { to: '/repairs', label: 'Repairs' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export default function Header({ onCartToggle, hasTopTicker = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileAccountDropdownOpen, setMobileAccountDropdownOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [desktopSearchResults, setDesktopSearchResults] = useState([]);
  const [desktopSearchLoading, setDesktopSearchLoading] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const accountDropdownRef = useRef(null);
  const mobileAccountDropdownRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const desktopSearchRequestIdRef = useRef(0);
  const searchOverlayRequestIdRef = useRef(0);
  const dropdownCloseTimerRef = useRef(null);
  const prevPathnameRef = useRef(location.pathname);
  const [isTablet, setIsTablet] = useState(() => {
    try { return typeof window !== 'undefined' && window.matchMedia('(min-width: 641px) and (max-width: 1024px)').matches; }
    catch { return false; }
  });

  const isActive = (path) => location.pathname === path;
  const shopActive = location.pathname.startsWith('/products') || isActive('/parts') || isActive('/toolset-builder');

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeMenus = () => {
    setShopDropdownOpen(false);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
    setMobileAccountDropdownOpen(false);
    setDesktopSearchOpen(false);
  };

  const closeSearchOverlay = () => {
    setSearchOverlayOpen(false);
    setMobileSearchQuery('');
    setSearchSuggestions([]);
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
    const t = setTimeout(() => { closeMenus(); closeSearchOverlay(); }, 0);
    return () => clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') { closeMenus(); closeSearchOverlay(); } };
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

  useEffect(() => {
    const query = mobileSearchQuery.trim();
    const requestId = searchOverlayRequestIdRef.current + 1;
    searchOverlayRequestIdRef.current = requestId;
    if (!query) {
      setSearchSuggestions([]);
      setSearchLoading(false);
      return undefined;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const found = (await searchProducts(query)).slice(0, 6);
        if (searchOverlayRequestIdRef.current === requestId) setSearchSuggestions(found);
      } catch (err) {
        if (searchOverlayRequestIdRef.current === requestId) console.error('Search overlay error:', err);
      } finally {
        if (searchOverlayRequestIdRef.current === requestId) setSearchLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [mobileSearchQuery]);

  const handleDesktopResultClick = (productId) => {
    navigate(`/product/${productId}`);
    setDesktopSearchOpen(false);
    setDesktopSearchQuery('');
    setDesktopSearchResults([]);
  };

  const handleDesktopViewAll = () => {
    const q = desktopSearchQuery.trim();
    navigate(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    setDesktopSearchOpen(false);
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
                    <div className="header-mega-footer"><div className="header-mega-footer-actions"><Link to="/products" onClick={() => setShopDropdownOpen(false)} className="header-mega-footer-link">View All Products</Link><Link to="/products/brands" onClick={() => setShopDropdownOpen(false)} className="header-mega-footer-link header-mega-footer-link--secondary">Shop by Brand</Link></div></div>
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

        {/* Mobile search dock — always visible below the nav bar on mobile */}
        <div className="header-mobile-search-dock">
          <button
            type="button"
            className="header-search-dock-btn"
            onClick={() => setSearchOverlayOpen(true)}
            aria-label="Open search"
          >
            <Search size={15} aria-hidden="true" />
            <span>Search products, brands, SKU…</span>
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <Motion.div
              className="header-mobile-menu"
              style={{ display: isTablet ? 'flex' : undefined }}
              initial={{ opacity: 0, x: '-100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* Backdrop */}
              <button
                type="button"
                className="header-mobile-menu-backdrop"
                onClick={closeMobileMenu}
                aria-label="Close navigation"
              />
              <div className="header-mobile-menu-panel">
                <div className="header-mobile-menu-top">
                  <Link to="/" className="header-drawer-logo" onClick={closeMobileMenu}>
                    <img src={LogoWhite} alt="Drywall Toolbox Logo" style={{ height: 28, width: 'auto' }} />
                  </Link>
                  <button type="button" onClick={closeMobileMenu} className="header-drawer-close" aria-label="Close menu">
                    <X size={20} />
                  </button>
                </div>
                <nav className="header-drawer-nav" aria-label="Mobile navigation">
                  {DRAWER_NAV_ROWS.map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`header-drawer-row${isActive(to) ? ' active' : ''}`}
                      onClick={closeMobileMenu}
                    >
                      <span className="header-drawer-row__label">{label}</span>
                      <ChevronRight size={16} className="header-drawer-row__chevron" aria-hidden="true" />
                    </Link>
                  ))}
                </nav>
                <div className="header-drawer-account">
                  {!isLoading && (isAuthenticated ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Link to="/dashboard" onClick={closeMobileMenu} className="header-drawer-account-link"><User size={14} />My Dashboard</Link>
                      <button onClick={async () => { closeMobileMenu(); await logout(); }} className="header-drawer-account-link header-drawer-account-link--danger"><LogOut size={14} />Sign Out</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to="/login" onClick={closeMobileMenu} className="header-drawer-cta-btn header-drawer-cta-btn--ghost"><LogIn size={14} />Sign In</Link>
                      <Link to="/register" onClick={closeMobileMenu} className="header-drawer-cta-btn header-drawer-cta-btn--primary"><UserPlus size={14} />Register</Link>
                    </div>
                  ))}
                </div>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </header>

      <Motion.button className="mobile-cart-fab" onClick={onCartToggle} aria-label="Open cart" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 24 }} whileTap={{ scale: 0.9 }}>
        <ShoppingCart size={22} />
        <span aria-live="polite" aria-atomic="true">{getCartCount() > 0 && <span className="mobile-cart-fab-badge" aria-label={`${getCartCount()} items in cart`}>{getCartCount()}</span>}</span>
      </Motion.button>

      {/* Full-screen search overlay */}
      <StorefrontSearchOverlay
        isOpen={searchOverlayOpen}
        query={mobileSearchQuery}
        setQuery={setMobileSearchQuery}
        onClose={closeSearchOverlay}
        loading={searchLoading}
        suggestions={searchSuggestions}
      />

      <style>{`
        /* ── Mobile search dock ── */
        .header-mobile-search-dock {
          display: none;
          padding: 8px 12px 10px;
          background: var(--dtb-shell);
        }

        .header-search-dock-btn {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 0 14px;
          height: 40px;
          border-radius: 20px;
          border: none;
          background: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.62);
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 140ms ease;
        }

        .header-search-dock-btn:active {
          background: rgba(255,255,255,0.16);
        }

        @media (max-width: 767px) {
          .header-mobile-search-dock {
            display: block;
          }
        }

        /* On tablet, also show the search dock */
        @media (min-width: 641px) and (max-width: 1024px) {
          .header-mobile-search-dock {
            display: block;
          }
        }

        /* ── Dark mobile drawer ── */
        .header-mobile-menu {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9998 !important;
          display: flex !important;
          pointer-events: auto !important;
        }

        .header-mobile-menu-backdrop {
          position: absolute !important;
          inset: 0 !important;
          background: rgba(2, 6, 23, 0.60) !important;
          border: none !important;
          cursor: pointer !important;
          width: 100% !important;
          height: 100% !important;
        }

        .header-mobile-menu-panel {
          position: relative !important;
          width: min(85vw, 360px) !important;
          height: 100% !important;
          background: var(--dtb-shell, #0a1020) !important;
          color: white !important;
          display: flex !important;
          flex-direction: column !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          z-index: 1 !important;
          flex-shrink: 0 !important;
        }

        .header-mobile-menu-top {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px !important;
          border-bottom: 1px solid rgba(255,255,255,0.10) !important;
          flex-shrink: 0 !important;
        }

        .header-drawer-logo {
          display: flex;
          align-items: center;
        }

        .header-drawer-close {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          border: none !important;
          background: rgba(255,255,255,0.10) !important;
          color: rgba(255,255,255,0.80) !important;
          cursor: pointer !important;
          padding: 0 !important;
          flex-shrink: 0 !important;
        }

        .header-drawer-nav {
          flex: 1 1 auto !important;
          display: flex !important;
          flex-direction: column !important;
          padding: 8px 0 !important;
        }

        .header-drawer-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 0 20px !important;
          height: 56px !important;
          color: rgba(255,255,255,0.88) !important;
          text-decoration: none !important;
          font-size: 1.05rem !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          transition: background 120ms ease, color 120ms ease !important;
        }

        .header-drawer-row:active,
        .header-drawer-row.active {
          background: rgba(37, 99, 235, 0.18) !important;
          color: #93c5fd !important;
        }

        .header-drawer-row__chevron {
          color: rgba(255,255,255,0.38) !important;
          flex-shrink: 0 !important;
        }

        .header-drawer-account {
          padding: 16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px) !important;
          border-top: 1px solid rgba(255,255,255,0.10) !important;
          flex-shrink: 0 !important;
        }

        .header-drawer-account-link {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 10px 0 !important;
          color: rgba(255,255,255,0.72) !important;
          text-decoration: none !important;
          font-size: 0.9rem !important;
          font-weight: 500 !important;
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          font-family: inherit !important;
          width: 100% !important;
          text-align: left !important;
        }

        .header-drawer-account-link--danger {
          color: #f87171 !important;
        }

        .header-drawer-cta-btn {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 10px 16px !important;
          border-radius: 10px !important;
          font-size: 0.88rem !important;
          font-weight: 600 !important;
          text-decoration: none !important;
          cursor: pointer !important;
          border: none !important;
          font-family: inherit !important;
          flex: 1 !important;
          justify-content: center !important;
        }

        .header-drawer-cta-btn--ghost {
          background: rgba(255,255,255,0.10) !important;
          color: rgba(255,255,255,0.80) !important;
        }

        .header-drawer-cta-btn--primary {
          background: #2563eb !important;
          color: white !important;
        }
      `}</style>
    </>
  );
}