import { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

function ShopMegaSection({ title, children }) {
  return (
    <section className="storefront-shop-mega__section" aria-label={title}>
      <h3 className="storefront-shop-mega__section-title">{title}</h3>
      {children}
    </section>
  );
}

export default function StorefrontShopMegaMenu({
  isOpen,
  isActive,
  onOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
  categoryLinks,
  brandLinks,
}) {
  const triggerRef = useRef(null);
  const panelId = useId();
  const triggerId = useId();

  const closeAndFocusTrigger = () => {
    onClose();
    triggerRef.current?.focus();
  };

  const handlePanelKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeAndFocusTrigger();
  };

  const wrapperClassName = ['header-mega', 'storefront-shop-mega', isOpen ? 'is-open' : ''].filter(Boolean).join(' ');
  const panelClassName = ['shop-dropdown-menu', 'header-mega-panel', 'storefront-shop-mega__panel', isOpen ? 'is-open' : ''].filter(Boolean).join(' ');

  return (
    <div className={wrapperClassName} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        ref={triggerRef}
        id={triggerId}
        className={`nav-link header-nav-trigger storefront-shop-mega__trigger ${isActive ? 'active' : ''}`}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => (isOpen ? onClose() : onOpen())}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          closeAndFocusTrigger();
        }}
      >
        <span>Shop</span>
        <ChevronDown size={14} className="header-nav-trigger__chevron" />
      </button>

      <div
        id={panelId}
        className={panelClassName}
        role="region"
        aria-labelledby={triggerId}
        onKeyDown={handlePanelKeyDown}
      >
        <div className="storefront-shop-mega__accent" />
        <div className="storefront-shop-mega__layout">
          <ShopMegaSection title="Primary Shop Paths">
            <div className="storefront-shop-mega__link-stack">
              <Link to="/products" className="storefront-shop-mega__primary-link" onClick={onNavigate}>
                <span className="storefront-shop-mega__primary-title">All Products</span>
                <span className="storefront-shop-mega__primary-sub">Browse the full contractor catalog</span>
              </Link>
              <Link to="/products/brands" className="storefront-shop-mega__primary-link" onClick={onNavigate}>
                <span className="storefront-shop-mega__primary-title">Shop by Brand</span>
                <span className="storefront-shop-mega__primary-sub">Jump to TapeTech, Columbia Tools, and more</span>
              </Link>
            </div>
          </ShopMegaSection>

          <ShopMegaSection title="Product & Category Discovery">
            <div className="storefront-shop-mega__category-grid">
              {categoryLinks.map(({ slug, to, label }) => (
                <Link key={slug} to={to} className="storefront-shop-mega__category-link" onClick={onNavigate}>
                  {label}
                </Link>
              ))}
            </div>
          </ShopMegaSection>

          <ShopMegaSection title="Brand Shortcuts">
            <div className="storefront-shop-mega__brand-grid">
              {brandLinks.length > 0 ? brandLinks.map(({ slug, to, name }) => (
                <Link key={slug} to={to} className="storefront-shop-mega__brand-link" onClick={onNavigate}>
                  {name}
                </Link>
              )) : (
                <Link to="/products/brands" className="storefront-shop-mega__brand-link" onClick={onNavigate}>
                  Browse All Brands
                </Link>
              )}
            </div>
          </ShopMegaSection>

          <ShopMegaSection title="Parts, Schematics & Service">
            <div className="storefront-shop-mega__link-stack">
              <Link to="/parts" className="storefront-shop-mega__support-link" onClick={onNavigate}>Replacement Parts</Link>
              <Link to="/schematics" className="storefront-shop-mega__support-link" onClick={onNavigate}>Schematics Lookup</Link>
              <Link to="/repairs" className="storefront-shop-mega__support-link" onClick={onNavigate}>Repair Services</Link>
              <Link to="/contact" className="storefront-shop-mega__support-link" onClick={onNavigate}>Contact Support</Link>
            </div>
          </ShopMegaSection>
        </div>

        <div className="storefront-shop-mega__footer">
          <Link to="/products" className="storefront-shop-mega__cta storefront-shop-mega__cta--primary" onClick={onNavigate}>
            View All Products
          </Link>
          <Link to="/repairs" className="storefront-shop-mega__cta storefront-shop-mega__cta--secondary" onClick={onNavigate}>
            Start a Repair
          </Link>
        </div>
      </div>
    </div>
  );
}
