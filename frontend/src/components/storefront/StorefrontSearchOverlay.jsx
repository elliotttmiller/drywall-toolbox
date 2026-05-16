import { Link } from 'react-router-dom';
import StorefrontSearchDock from './StorefrontSearchDock';
import StorefrontSkeletons from './StorefrontSkeletons';

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
  if (!isOpen) return null;

  return (
    <div className="storefront-search-overlay" role="dialog" aria-modal="true" aria-label="Search products">
      <button type="button" className="storefront-mobile-drawer__backdrop" onClick={onClose} aria-label="Close search" />
      <div className="storefront-search-overlay__sheet">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--dtb-border)' }}>
          <StorefrontSearchDock value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div style={{ padding: '16px', display: 'grid', gap: '16px' }}>
          {!query && recent.length > 0 ? (
            <section>
              <h3 style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>Recent</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recent.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuery(item)}
                    className="storefront-surface"
                    style={{ padding: '6px 10px' }}
                    aria-label={`Search for ${item}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {!query && (brands.length > 0 || categories.length > 0) ? (
            <section style={{ display: 'grid', gap: '10px' }}>
              {brands.length > 0 ? <p style={{ margin: 0, color: 'var(--dtb-muted)' }}>Popular brands: {brands.join(', ')}</p> : null}
              {categories.length > 0 ? <p style={{ margin: 0, color: 'var(--dtb-muted)' }}>Popular categories: {categories.join(', ')}</p> : null}
            </section>
          ) : null}

          {loading ? <StorefrontSkeletons count={3} /> : (
            <section style={{ display: 'grid', gap: '8px' }}>
              {suggestions.map((product) => (
                <Link key={product.id} to={`/products/${product.slug || product.id}`} onClick={onClose} className="storefront-surface" style={{ padding: '10px 12px', textDecoration: 'none' }}>
                  <strong>{product.name}</strong>
                  <div style={{ color: 'var(--dtb-muted)', fontSize: '0.85rem' }}>{product.brand || 'Product'}</div>
                </Link>
              ))}
              {query ? (
                <Link to={`/products?search=${encodeURIComponent(query.trim())}`} onClick={onClose} className="storefront-surface" style={{ padding: '10px 12px', textAlign: 'center', textDecoration: 'none' }}>
                  View all results
                </Link>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
