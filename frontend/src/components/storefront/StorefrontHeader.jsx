import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuthContext } from '../../auth/AuthContext.js';
import { ShoppingCart, Menu, X, ChevronDown, ChevronRight, User, LogIn, UserPlus, LogOut, Bell, Search } from 'lucide-react';
import LogoWhite from '/logo-white.svg';
import NotificationsBell from '../shell/NotificationsBell';
import StorefrontSearchOverlay from './StorefrontSearchOverlay';
import StorefrontMobileDrawer from './StorefrontMobileDrawer';
import AccountHubSheet from '../account/AccountHubSheet.jsx';
import { searchProducts } from '../../services/catalog';
import StorefrontSearchDock from './StorefrontSearchDock';
import { useCatalogFacets } from '../../hooks/useCatalogFacets.js';
import {
  buildDisplayCategoryUrl,
  mapCatalogBrands,
  mergeCatalogDisplayCategories,
} from '../../utils/catalogFacets.js';

const PRIMARY_NAV_LINKS = [
  { to: '/schematics', label: 'Schematics' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/repairs', label: 'Repairs' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

const MAX_DRAWER_CATEGORIES = 12;

const DRAWER_NAV_ROWS = [
  { to: '/products?sort=newest', label: 'New Arrivals' },
  { to: '/toolset-builder', label: 'Toolset Builder' },
  { to: '/repairs', label: 'Repairs' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

function MobileDrawerChevron({ expanded = false, className = '' }) {
  return (
    <ChevronRight
      size={18}
      strokeWidth={2.35}
      className={`storefront-mobile-drawer__chevron${expanded ? ' is-expanded' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}

const buildProductsBrandRoute = (slug) => `/products/brands/${slug}`;
const buildPartsBrandRoute = (slug) => `/parts?brand=${encodeURIComponent(slug)}`;
const buildSchematicsBrandRoute = (slug) => `/schematics?brand=${encodeURIComponent(slug)}`;

export default function Header({ onCartToggle, hasTopTicker = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [schematicsExpanded, setSchematicsExpanded] = useState(false);
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
  const { facets } = useCatalogFacets();
  const accountDropdownRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
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
  const drawerBrands = useMemo(() => mapCatalogBrands(facets?.brands), [facets]);
  const drawerCategoryLinks = useMemo(() => mergeCatalogDisplayCategories(facets?.displayCategoriesByBrand || {})
    .slice(0, MAX_DRAWER_CATEGORIES)
    .map((category) => ({
      ...category,
      to: buildDisplayCategoryUrl(category.slug),
    })), [facets]);
  const desktopShopTabs = useMemo(() => ([
    {
      id: 'products',
      title: 'All Products',
      subtitle: 'Browse by category',
      landingTo: '/products',
      landingLabel: 'View all products',
      items: drawerCategoryLinks.map(({ slug, to, label }) => ({ key: slug, to, label })),
    },
    {
      id: 'brands',
      title: 'Brands',
      subtitle: 'Shop by brand',
      landingTo: '/products/brands',
      landingLabel: 'Shop all brands',
      items: drawerBrands.map(({ slug, name }) => ({ key: `brand-${slug}`, to: buildProductsBrandRoute(slug), label: name })),
    },
    {
      id: 'parts',
      title: 'Parts',
      subtitle: 'Replacement parts by brand',
      landingTo: '/parts',
      landingLabel: 'Browse all parts',
      items: drawerBrands.map(({ slug, name }) => ({ key: `parts-${slug}`, to: buildPartsBrandRoute(slug), label: name })),
    },
    {
      id: 'schematics',
      title: 'Schematics',
      subtitle: 'Documentation by brand',
      landingTo: '/schematics',
      landingLabel: 'Browse all schematics',
      items: drawerBrands.map(({ slug, name }) => ({ key: `schematics-${slug}`, to: buildSchematicsBrandRoute(slug), label: name })),
    },
  ]), [drawerBrands, drawerCategoryLinks]);

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

  const resetDrawerExpansions = useCallback(() => {
    setProductsExpanded(false);
    setBrandsExpanded(false);
    setPartsExpanded(false);
    setSchematicsExpanded(false);
  }, []);

  const handleDropdownMouseLeave = useCallback(() => {
    if (dropdownCloseTimerRef.current) clearTimeout(dropdownCloseTimerRef.current);
    dropdownCloseTimerRef.current = setTimeout(() => setShopDropdownOpen(false), 50);
  }, []);

  const handleDropdownMouseEnter = () => {
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setShopDropdownOpen(true);
  };

  const handleDropdownBlurCapture = useCallback((event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) handleDropdownMouseLeave();
  }, [handleDropdownMouseLeave]);

  useEffect(() => () => {
    if (dropdownCloseTimerRef.current) clearTimeout(dropdownCloseTimerRef.current);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) return;
    resetDrawerExpansions();
  }, [mobileMenuOpen, resetDrawerExpansions]);

  useEffect(() => {
    if (prevPathnameRef.current === location.pathname) return;
    prevPathnameRef.current = location.pathname;
    const t = setTimeout(() => { closeMenus(); closeSearchOverlay(); resetDrawerExpansions(); }, 0);
    return () => clearTimeout(t);
  }, [location.pathname, closeSearchOverlay, resetDrawerExpansions]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') { closeMenus(); closeSearchOverlay(); resetDrawerExpansions(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSearchOverlay, resetDrawerExpansions]);

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
    const root = document.documentElement;
    const header = document.querySelector('.site-header');
    if (!root || !header) return undefined;

    const updateHeaderHeight = () => {
      const { bottom } = header.getBoundingClientRect();
      root.style.setProperty('--header-height', `${Math.ceil(bottom)}px`);
    };

    updateHeaderHeight();

    const rafId = window.requestAnimationFrame(updateHeaderHeight);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateHeaderHeight())
      : null;

    resizeObserver?.observe(header);
    window.addEventListener('resize', updateHeaderHeight);
    window.addEventListener('orientationchange', updateHeaderHeight);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
      window.removeEventListener('orientationchange', updateHeaderHeight);
    };
  }, [hasTopTicker, mobileMenuOpen, isTablet]);

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

  const navigateShopDestination = useCallback((to, { closeMobile = false } = {}) => {
    resetDrawerExpansions();
    setShopDropdownOpen(false);
    if (closeMobile) setMobileMenuOpen(false);
    navigate(to);
  }, [navigate, resetDrawerExpansions]);

  const closeDrawerAndNavigate = (to) => navigateShopDestination(to, { closeMobile: true });

  const handleDrawerBrandNavigate = (slug) => closeDrawerAndNavigate(buildProductsBrandRoute(slug));
  const handleDrawerPartsBrandNavigate = (slug) => closeDrawerAndNavigate(buildPartsBrandRoute(slug));
  const handleDrawerSchematicsBrandNavigate = (slug) => closeDrawerAndNavigate(buildSchematicsBrandRoute(slug));
  const handleDrawerBrandsLanding = () => closeDrawerAndNavigate('/products/brands');
  const handleDrawerPartsLanding = () => closeDrawerAndNavigate('/parts');
  const handleDrawerSchematicsLanding = () => closeDrawerAndNavigate('/schematics');
  const handleDrawerProductsLanding = () => closeDrawerAndNavigate('/products');
  const handleDrawerProductCategoryNavigate = (to) => closeDrawerAndNavigate(to);

  const handleMobileViewAll = useCallback(() => {
    const q = mobileSearchQuery.trim();
    navigate(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    closeSearchOverlay();
  }, [mobileSearchQuery, navigate, closeSearchOverlay]);

  const renderDrawerListSection = ({ id, label, expanded, onToggle, onLanding, items, onItemNavigate }) => (
    <div className="storefront-mobile-drawer__row-wrap" key={id}>
      <div className="storefront-mobile-drawer__row">
        <button type="button" className="storefront-mobile-drawer__row-label" onClick={onLanding}>
          {label}
        </button>
        <button
          type="button"
          className="storefront-mobile-drawer__row-toggle"
          onClick={onToggle}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label.toLowerCase()}`}
          aria-expanded={expanded}
          aria-controls={`storefront-mobile-drawer-${id}`}
        >
          <MobileDrawerChevron expanded={expanded} />
        </button>
      </div>
      <div
        id={`storefront-mobile-drawer-${id}`}
        className={`storefront-mobile-drawer__brands${expanded ? ' is-expanded' : ''}`}
      >
        {items.map((item) => (
          <button
            key={`${id}-${item.slug || item.to || item.name || item.label}`}
            type="button"
            className="storefront-mobile-drawer__brand-link"
            onClick={() => onItemNavigate(item)}
          >
            {item.name || item.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderDrawerBrandSection = ({ id, label, expanded, onToggle, onLanding, onBrandNavigate }) => renderDrawerListSection({
    id,
    label,
    expanded,
    onToggle,
    onLanding,
    items: drawerBrands,
    onItemNavigate: (brand) => onBrandNavigate(brand.slug),
  });

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
                <User size={20} />
              </button>
              <button
                type="button"
                onClick={onCartToggle}
                className="header-mobile-cart-toggle cart-toggle header-icon"
                aria-label="Open cart"
              >
                <ShoppingCart size={20} />
                {getCartCount() > 0 ? (
                  <span className="cart-badge" aria-label={`${getCartCount()} items in cart`}>
                    {getCartCount()}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <div className="header-desktop-layout" style={{ display: isTablet ? 'none' : undefined }}>
            <div className="header-left"><Link to="/" className="header-logo-link" aria-label="Drywall Toolbox home"><img src={LogoWhite} alt="Drywall Toolbox Logo" className="logo-image" /></Link></div>
            <div className="header-center">
              <nav className="nav-links header-desktop-nav" aria-label="Primary">
                <div
                  className={`header-mega${shopDropdownOpen ? ' is-open' : ''}`}
                  onMouseEnter={handleDropdownMouseEnter}
                  onMouseLeave={handleDropdownMouseLeave}
                  onFocusCapture={handleDropdownMouseEnter}
                  onBlurCapture={handleDropdownBlurCapture}
                >
                  <button
                    className={`nav-link header-nav-trigger ${shopActive ? 'active' : ''}`}
                    type="button"
                    onClick={() => setShopDropdownOpen((open) => !open)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setShopDropdownOpen(false);
                      }
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setShopDropdownOpen(true);
                      }
                    }}
                    aria-expanded={shopDropdownOpen}
                    aria-haspopup="true"
                  >
                    <span>Shop</span>
                    <ChevronDown size={14} className="header-nav-trigger__chevron" />
                  </button>
                  <div className={`shop-dropdown-menu header-mega-panel${shopDropdownOpen ? ' is-open' : ''}`}>
                    <div className="header-mega-accent" />
                    <div className="header-mega-grid header-mega-grid--shop">
                      {desktopShopTabs.map((tab) => (
                        <div key={tab.id} className="header-mega-section header-mega-section--shop-tab">
                          <p className="header-mega-section-title">{tab.title}</p>
                          <div className="header-mega-links">
                            <button type="button" className="header-mega-link header-mega-link--cta" onClick={() => navigateShopDestination(tab.landingTo)}>
                              <span className="header-mega-link-copy">
                                <span className="header-mega-link-title">{tab.landingLabel}</span>
                                <span className="header-mega-link-sub">{tab.subtitle}</span>
                              </span>
                            </button>
                          </div>
                          <div className="header-mega-category-grid header-mega-category-grid--tab">
                            {tab.items.map(({ key, to, label }) => (
                              <button key={key} type="button" onClick={() => navigateShopDestination(to)} className="header-mega-category-link">
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="header-mega-footer"><div className="header-mega-footer-actions">{DRAWER_NAV_ROWS.map(({ to, label }) => <button key={to} type="button" onClick={() => navigateShopDestination(to)} className="header-mega-footer-link header-mega-footer-link--secondary">{label}</button>)}</div></div>
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
              {!isLoading && <div ref={accountDropdownRef} className="header-account"><button onClick={() => { if (isAuthenticated) { setAccountHubOpen(true); } else { setAccountDropdownOpen((o) => !o); } }} aria-label={isAuthenticated ? 'Open account hub' : 'Account menu'} aria-expanded={!isAuthenticated && accountDropdownOpen} className="header-account-toggle header-icon"><User size={20} /></button>{!isAuthenticated && <div className={`header-account-panel${accountDropdownOpen ? ' is-open' : ''}`}><div className="header-account-guest-header"><p className="header-account-guest-title">My Account</p></div><Link to="/login" onClick={() => setAccountDropdownOpen(false)} className="header-account-link header-account-link--strong"><LogIn size={14} />Sign In</Link><div className="header-account-divider header-account-divider--inset" /><div className="header-account-guest-body"><Link to="/register" onClick={() => setAccountDropdownOpen(false)} className="header-account-cta"><UserPlus size={13} />Create Account</Link><p className="header-account-note">No account needed to browse or checkout.</p></div></div>}</div>}
              {!isLoading && isAuthenticated && <NotificationsBell />}
              <div className="cart-area"><button onClick={onCartToggle} className="cart-toggle header-icon" aria-label="Toggle cart"><ShoppingCart size={20} />{getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}</button></div>
            </div>
          </div>
        </div>

        <div className="header-mobile-search-dock">
          <StorefrontSearchDock
            inputRef={mobileSearchInputRef}
            value={mobileSearchQuery}
            active={searchOverlayOpen}
            onChange={(event) => {
              if (!searchOverlayOpen) setSearchOverlayOpen(true);
              setMobileSearchQuery(event.target.value);
            }}
            onFocus={() => {
              setMobileMenuOpen(false);
              setSearchOverlayOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleMobileViewAll();
              }
            }}
            endAdornment={searchOverlayOpen ? (
              <button
                type="button"
                className="storefront-search-dock__clear"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeSearchOverlay();
                }}
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            ) : null}
          />
        </div>

      </header>

      <StorefrontMobileDrawer isOpen={mobileMenuOpen} onClose={closeMobileMenu}>
        <nav className="storefront-mobile-drawer__nav" aria-label="Mobile navigation">
          {renderDrawerListSection({
            id: 'products',
            label: 'All Products',
            expanded: productsExpanded,
            onToggle: () => setProductsExpanded((open) => !open),
            onLanding: handleDrawerProductsLanding,
            items: drawerCategoryLinks,
            onItemNavigate: (category) => handleDrawerProductCategoryNavigate(category.to),
          })}
          {renderDrawerBrandSection({
            id: 'brands',
            label: 'Brands',
            expanded: brandsExpanded,
            onToggle: () => setBrandsExpanded((open) => !open),
            onLanding: handleDrawerBrandsLanding,
            onBrandNavigate: handleDrawerBrandNavigate,
          })}
          {renderDrawerBrandSection({
            id: 'parts',
            label: 'Parts',
            expanded: partsExpanded,
            onToggle: () => setPartsExpanded((open) => !open),
            onLanding: handleDrawerPartsLanding,
            onBrandNavigate: handleDrawerPartsBrandNavigate,
          })}
          {renderDrawerBrandSection({
            id: 'schematics',
            label: 'Schematics',
            expanded: schematicsExpanded,
            onToggle: () => setSchematicsExpanded((open) => !open),
            onLanding: handleDrawerSchematicsLanding,
            onBrandNavigate: handleDrawerSchematicsBrandNavigate,
          })}
          {DRAWER_NAV_ROWS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`storefront-mobile-drawer__row-link${isActive(to) ? ' is-active' : ''}`}
              onClick={closeMobileMenu}
            >
              <span>{label}</span>
              <MobileDrawerChevron />
            </Link>
          ))}
        </nav>
        <div className="storefront-mobile-drawer__account">
          {!isLoading && (isAuthenticated ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" onClick={handleMobileAccountClick} className="storefront-mobile-drawer__account-link"><User size={14} />My Account</button>
              <button type="button" onClick={async () => { closeMobileMenu(); await logout(); }} className="storefront-mobile-drawer__account-link storefront-mobile-drawer__account-link--danger"><LogOut size={14} />Sign Out</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login" onClick={closeMobileMenu} className="storefront-mobile-drawer__account-cta storefront-mobile-drawer__account-cta--ghost"><LogIn size={14} />Sign In</Link>
              <Link to="/register" onClick={closeMobileMenu} className="storefront-mobile-drawer__account-cta storefront-mobile-drawer__account-cta--primary"><UserPlus size={14} />Register</Link>
            </div>
          ))}
        </div>
      </StorefrontMobileDrawer>

      <StorefrontSearchOverlay
        isOpen={searchOverlayOpen}
        query={mobileSearchQuery}
        setQuery={setMobileSearchQuery}
        onClose={closeSearchOverlay}
        onViewAll={handleMobileViewAll}
        loading={searchLoading}
        brands={drawerBrands.map((brand) => brand.name)}
        categories={drawerCategoryLinks}
        suggestions={searchSuggestions}
      />

      <AccountHubSheet
        isOpen={accountHubOpen}
        onClose={() => setAccountHubOpen(false)}
        user={user}
        onLogout={logout}
      />

      <style>{`
        .header-mobile-search-dock {
          display: none;
          width: 100%;
          padding: 8px 12px 12px;
          background: transparent;
          border-top: 1px solid rgba(96, 165, 250, 0.08);
        }

        @media (max-width: 767px) {
          .header-mobile-search-dock {
            display: block;
          }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .header-mobile-search-dock {
            display: block;
          }
        }

      `}</style>
    </>
  );
}
