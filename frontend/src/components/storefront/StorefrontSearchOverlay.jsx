import { Link } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { ArrowRight, X } from 'lucide-react';
import StorefrontSearchDock from './StorefrontSearchDock';
import { brandToSlug } from '../../utils/catalogUrlState.js';

const QUICK_LINKS = [
  { to: '/products', label: 'All Products' },
  { to: '/parts', label: 'Parts' },
  { to: '/products/brands', label: 'Brands' },
  { to: '/schematics', label: 'Schematics' },
];

function formatPrice(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? `$${numeric.toFixed(2)}` : 'View product';
}

export default function StorefrontSearchOverlay({
  isOpen,
  query,
  setQuery,
  onClose,
  loading,
  recent = [],
  brands = [],
  categories = [],
  suggestions = [],
}) {
  const hasQuery = useMemo(() => query.trim().length > 0, [query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="storefront-search-overlay" role="dialog" aria-modal="true" aria-label="Search products">
      <button type="button" className="storefront-mobile-drawer__backdrop" onClick={onClose} aria-label="Close search" />
      <div className="storefront-search-overlay__sheet">
        <div className="storefront-search-overlay__topbar">
          <StorefrontSearchDock value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="storefront-search-overlay__close" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="storefront-search-overlay__body">
          {!hasQuery ? (
            <section className="storefront-search-overlay__empty-state">
              <div className="storefront-search-overlay__section">
                <h3 className="storefront-search-overlay__section-title">Quick links</h3>
                <div className="storefront-search-overlay__quick-links">
                  {QUICK_LINKS.map((item) => (
                    <Link key={item.to} to={item.to} onClick={onClose} className="storefront-search-overlay__quick-link">
                      <span>{item.label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>

              {categories.length > 0 ? (
                <div className="storefront-search-overlay__section">
                  <h3 className="storefront-search-overlay__section-title">Popular categories</h3>
                  <div className="storefront-search-overlay__chip-list">
                    {categories.map((category) => (
                      <Link
                        key={category}
                        to={`/products?display_category=${encodeURIComponent(category.toLowerCase().replace(/[^\w]+/g, '_'))}`}
                        onClick={onClose}
                        className="storefront-search-overlay__chip"
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {brands.length > 0 ? (
                <div className="storefront-search-overlay__section">
                  <h3 className="storefront-search-overlay__section-title">Popular brands</h3>
                  <div className="storefront-search-overlay__chip-list">
                    {brands.map((brand) => (
                      <Link
                        key={brand}
                        to={`/products/brands/${brandToSlug(brand)}`}
                        onClick={onClose}
                        className="storefront-search-overlay__chip"
                      >
                        {brand}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {recent.length > 0 ? (
                <div className="storefront-search-overlay__section">
                  <h3 className="storefront-search-overlay__section-title">Recent searches</h3>
                  <div className="storefront-search-overlay__chip-list">
                    {recent.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQuery(item)}
                        className="storefront-search-overlay__chip"
                        aria-label={`Search for ${item}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {hasQuery ? (
            loading ? (
              <section className="storefront-search-overlay__results">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="storefront-search-overlay__skeleton-row">
                    <div className="storefront-search-overlay__skeleton-thumb storefront-skeleton" />
                    <div className="storefront-search-overlay__skeleton-copy">
                      <div className="storefront-skeleton" style={{ height: 10, width: '42%', borderRadius: 999 }} />
                      <div className="storefront-skeleton" style={{ height: 12, width: '78%', borderRadius: 999 }} />
                      <div className="storefront-skeleton" style={{ height: 11, width: '30%', borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <section className="storefront-search-overlay__results">
                {suggestions.map((product) => (
                  <Link key={product.id} to={`/products/${product.slug || product.id}`} onClick={onClose} className="storefront-search-overlay__result">
                    <div className="storefront-search-overlay__result-thumb">
                      {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : null}
                    </div>
                    <div className="storefront-search-overlay__result-copy">
                      <span className="storefront-search-overlay__result-brand">{product.brand || 'Product'}</span>
                      <strong className="storefront-search-overlay__result-name">{product.name}</strong>
                      <span className="storefront-search-overlay__result-price">{formatPrice(product.price)}</span>
                    </div>
                  </Link>
                ))}
                <Link to={`/products?search=${encodeURIComponent(query.trim())}`} onClick={onClose} className="storefront-search-overlay__view-all">
                  View all results
                </Link>
              </section>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
