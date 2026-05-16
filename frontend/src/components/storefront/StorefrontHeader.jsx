import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuthContext } from '../../auth/AuthContext.js';
import { ShoppingCart, Menu, X, ChevronDown, ChevronRight, User, LogIn, UserPlus, LogOut, Bell, Search } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import LogoWhite from '/logo-white.svg';
import NotificationsBell from '../shell/NotificationsBell';
import StorefrontSearchOverlay from './StorefrontSearchOverlay';
import StorefrontMobileDrawer from './StorefrontMobileDrawer';
import AccountHubSheet from '../account/AccountHubSheet.jsx';
import { searchProducts } from '../../services/catalog';
import { BRAND_TO_SLUG, sortBrandsBy } from '../../utils/catalogUrlState.js';

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
  { to: '/products', label: 'All Products' },
  { to: '/parts', label: 'Parts' },
  { to: '/products?sort=newest', label: 'New Arrivals' },
  { to: '/schematics', label: 'Schematics' },
  { to: '/repairs', label: 'Repairs' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export default function Header({ onCartToggle, cartOpen = false, hasTopTicker = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [accountHubOpen, setAccountHubOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [desktopSearchResults, setDesktopSearchResults] = useState([]);
  const [desktopSearchLoading, setDesktopSearchLoading] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const accountDropdownRef = useRef(null);
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
  const isProductDetailRoute = /^\/products\/(?!brands(?:\/|$))/.test(location.pathname);
  const hideMobileCartFab = mobileMenuOpen || searchOverlayOpen || cartOpen || accountHubOpen || isProductDetailRoute;
  const drawerBrands = useMemo(
    () => sortBrandsBy(Object.entries(BRAND_TO_SLUG).map(([name, slug]) => ({ name, slug }))),
    []
  );

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeMenus = () => {
    setShopDropdownOpen(false);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
    setDesktopSearchOpen(false);
  };

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false);
    setMobileSearchQuery('');
    setSearchSuggestions([]);
  }, []);

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
    if (mobileMenuOpen) return;
    // Keep the Brands accordion reset between drawer sessions.
    setBrandsExpanded(false);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (prevPathnameRef.current === location.pathname) return;
    prevPathnameRef.current = location.pathname;
    const t = setTimeout(() => { closeMenus(); closeSearchOverlay(); }, 0);
    return () => clearTimeout(t);
  }, [location.pathname, closeSearchOverlay]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') { closeMenus(); closeSearchOverlay(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSearchOverlay]);

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

  const handleMobileAccountClick = () => {
    setMobileMenuOpen(false);
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setAccountHubOpen(true);
  };

  const handleDrawerBrandNavigate = (slug) => {
    setBrandsExpanded(false);
    setMobileMenuOpen(false);
    navigate(`/products/brands/${slug}`);
  };

  const handleDrawerBrandsLanding = () => {
    setBrandsExpanded(false);
    setMobileMenuOpen(false);
    navigate('/products/brands');
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
              <button
                onClick={handleMobileAccountClick}
                className="header-mobile-account-toggle header-icon"
                aria-label={isAuthenticated ? 'Open account hub' : 'Sign in'}
              >
                <User size={22} />
              </button>
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

        <StorefrontMobileDrawer isOpen={mobileMenuOpen} onClose={closeMobileMenu}>
          <div className="storefront-mobile-drawer__top">
            <Link to="/" className="storefront-mobile-drawer__logo" onClick={closeMobileMenu}>
              <img src={LogoWhite} alt="Drywall Toolbox Logo" style={{ height: 28, width: 'auto' }} />
            </Link>
            <button type="button" onClick={closeMobileMenu} className="storefront-mobile-drawer__close" aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
          <div className="storefront-mobile-drawer__search">
            <button
              type="button"
              className="storefront-mobile-drawer__search-button"
              onClick={() => {
                setMobileMenuOpen(false);
                setSearchOverlayOpen(true);
              }}
            >
              <Search size={16} />
              <span>Search products, brands, SKU…</span>
            </button>
          </div>
          <nav className="storefront-mobile-drawer__nav" aria-label="Mobile navigation">
            <div className="storefront-mobile-drawer__row-wrap">
              <div className="storefront-mobile-drawer__row">
                <button type="button" className="storefront-mobile-drawer__row-label" onClick={handleDrawerBrandsLanding}>
                  Brands
                </button>
                <button
                  type="button"
                  className={`storefront-mobile-drawer__row-toggle${brandsExpanded ? ' is-expanded' : ''}`}
                  onClick={() => setBrandsExpanded((open) => !open)}
                  aria-label={`${brandsExpanded ? 'Collapse' : 'Expand'} brands`}
                  aria-expanded={brandsExpanded}
                  aria-controls="storefront-mobile-drawer-brands"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
              <div
                id="storefront-mobile-drawer-brands"
                className={`storefront-mobile-drawer__brands${brandsExpanded ? ' is-expanded' : ''}`}
              >
                {drawerBrands.map((brand) => (
                  <button
                    key={brand.slug}
                    type="button"
                    className="storefront-mobile-drawer__brand-link"
                    onClick={() => handleDrawerBrandNavigate(brand.slug)}
                  >
                    {brand.name}
                  </button>
                ))}
              </div>
            </div>
            {DRAWER_NAV_ROWS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`storefront-mobile-drawer__row-link${isActive(to) ? ' is-active' : ''}`}
                onClick={closeMobileMenu}
              >
                <span>{label}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className="storefront-mobile-drawer__account">
            {!isLoading && (isAuthenticated ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to="/dashboard" onClick={closeMobileMenu} className="storefront-mobile-drawer__account-link"><User size={14} />My Dashboard</Link>
                <button onClick={async () => { closeMobileMenu(); await logout(); }} className="storefront-mobile-drawer__account-link storefront-mobile-drawer__account-link--danger"><LogOut size={14} />Sign Out</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/login" onClick={closeMobileMenu} className="storefront-mobile-drawer__account-cta storefront-mobile-drawer__account-cta--ghost"><LogIn size={14} />Sign In</Link>
                <Link to="/register" onClick={closeMobileMenu} className="storefront-mobile-drawer__account-cta storefront-mobile-drawer__account-cta--primary"><UserPlus size={14} />Register</Link>
              </div>
            ))}
          </div>
        </StorefrontMobileDrawer>
      </header>

      <Motion.button className={`mobile-cart-fab${hideMobileCartFab ? ' mobile-cart-fab--hidden' : ''}`} onClick={onCartToggle} aria-label="Open cart" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: hideMobileCartFab ? 0 : 1 }} transition={{ type: 'spring', stiffness: 340, damping: 24 }} whileTap={{ scale: 0.9 }}>
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
        brands={drawerBrands.map((brand) => brand.name)}
        categories={['Automatic Taping Tools', 'Finishing Boxes', 'Corner Tools', 'Parts']}
        suggestions={searchSuggestions}
      />

      <AccountHubSheet
        isOpen={accountHubOpen}
        onClose={() => setAccountHubOpen(false)}
        user={user}
        onLogout={logout}
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

      `}</style>
    </>
  );
}
