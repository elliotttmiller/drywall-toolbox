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
                <button onClick={() => { setMobileAccountDropdownOpen((o) => !o); setMobileMenuOpen(false); }} className="header-mobile-account-toggle header-icon" aria-label="Account menu" aria-expanded={mobileAccountDropdownOpen}>
                  <User size={22} />
                </button>
              </div>
            </div>
          </div>

          <div className="header-desktop-layout" style={{ display: isTablet ? 'none' : undefined }}>
            <div className="header-left"><Link to="/" className="header-logo-link" aria-label="Drywall Toolbox home"><img src={LogoWhite} alt="Drywall Toolbox Logo" className="logo-image" /></Link></div>
            <div className="header-center">
              <nav className="nav-links header-desktop-nav" aria-label="Primary">
                <div className={`header-mega${shopDropdownOpen ? ' is-open' : ''}`} onMouseEnter={handleDropdownMouseEnter} onMouseLeave={handleDropdownMouseLeave}>
                  <button className={`nav-link header-nav-trigger ${shopActive ? 'active' : ''}`} type="button" aria-expanded={shopDropdownOpen}><span>Shop</span><ChevronDown size={14} className="header-nav-trigger__chevron" /></button>
                </div>
                {PRIMARY_NAV_LINKS.map(({ to, label }) => <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>{label}</Link>)}
              </nav>
            </div>
            <div className="header-right header-desktop-actions">
              <div ref={desktopSearchRef} className="dtb-desktop-search">
                <div className="dtb-desktop-search-pill"><input ref={desktopSearchInputRef} type="text" value={desktopSearchQuery} onChange={(e) => setDesktopSearchQuery(e.target.value)} onFocus={() => setDesktopSearchOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter') handleDesktopViewAll(); }} placeholder="Search products..." className="dtb-desktop-search-input" aria-label="Search products" autoComplete="off" /></div>
              </div>
              {!isLoading && <div ref={accountDropdownRef} className="header-account"><button onClick={() => setAccountDropdownOpen((o) => !o)} aria-label="Account menu" aria-expanded={accountDropdownOpen} className="header-account-toggle header-icon"><User size={20} /></button></div>}
              {!isLoading && isAuthenticated && <NotificationsBell />}
              <div className="cart-area"><button onClick={onCartToggle} className="cart-toggle header-icon" aria-label="Toggle cart"><ShoppingCart size={20} />{getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}</button></div>
            </div>
          </div>
        </div>
        <div className="site-header-bottom-glow" aria-hidden="true" />
      </header>

      <Motion.button className="mobile-cart-fab" onClick={onCartToggle} aria-label="Open cart" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 24 }} whileTap={{ scale: 0.9 }}>
        <ShoppingCart size={22} />
        <span aria-live="polite" aria-atomic="true">{getCartCount() > 0 && <span className="mobile-cart-fab-badge" aria-label={`${getCartCount()} items in cart`}>{getCartCount()}</span>}</span>
      </Motion.button>

      <style>{`
        .site-header {
          position: fixed;
          isolation: isolate;
        }

        .site-header-bottom-glow {
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 1px;
          z-index: 4;
          pointer-events: none;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(226,232,240,0.34) 16%, rgba(248,250,252,0.78) 50%, rgba(226,232,240,0.34) 84%, rgba(255,255,255,0) 100%);
          box-shadow: 0 0 10px rgba(191,219,254,0.22), 0 1px 12px rgba(96,165,250,0.12);
          opacity: 0.72;
        }

        .site-header-bottom-glow::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 12px;
          transform: translateY(-50%);
          background: radial-gradient(ellipse at center, rgba(191,219,254,0.13) 0%, rgba(96,165,250,0.05) 42%, transparent 72%);
          opacity: 0.86;
        }

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
      `}</style>
    </>
  );
}
