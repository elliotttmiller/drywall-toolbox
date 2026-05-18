import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { brandToSlug } from '../../utils/catalogUrlState.js';
import { buildDisplayCategoryUrl, normalizeCatalogCategoryEntry } from '../../utils/catalogFacets.js';
import ProductCardImage from '../product/ProductCardImage.jsx';
import ProductModal from '../product/ProductModal.jsx';
import ProductDetail from '../product/ProductDetail.jsx';
import { useCart } from '../../context/CartContext.jsx';

function formatPrice(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? `$${numeric.toFixed(2)}` : '';
}

export default function StorefrontSearchOverlay({
  isOpen,
  query,
  setQuery,
  onClose,
  onViewAll,
  loading,
  recent = [],
  brands = [],
  categories = [],
  suggestions = [],
}) {
  const { addToCart } = useCart();
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasQuery = useMemo(() => query.trim().length > 0, [query]);
  const normalizedCategories = useMemo(
    () => categories
      .map((category) => normalizeCatalogCategoryEntry(category))
      .filter((category) => category.label && category.slug),
    [categories]
  );

  const closeQuickView = useCallback(() => {
    setIsModalOpen(false);
    setModalProduct(null);
  }, []);

  const closeSearch = useCallback(() => {
    closeQuickView();
    onClose?.();
  }, [closeQuickView, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isModalOpen) closeQuickView();
        else onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose, isModalOpen, closeQuickView]);

  const openQuickView = useCallback((product, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!product?.id) return;
    setModalProduct(product);
    setIsModalOpen(true);
  }, []);

  const handleAddToCart = useCallback((product, quantity = 1) => {
    addToCart(product, quantity);
  }, [addToCart]);

  if (!isOpen) return null;

  return (
    <>
      <div className="storefront-search-overlay" data-open={isOpen ? 'true' : 'false'} role="dialog" aria-modal="true" aria-label="Search products">
        <button type="button" className="storefront-mobile-drawer__backdrop" onClick={closeSearch} aria-label="Close search" />
        <div className="storefront-search-overlay__sheet">
          <div className="storefront-search-overlay__panel">
            {hasQuery ? (
              <div className="storefront-search-overlay__topline">
                <p className="storefront-search-overlay__panel-label">Search results</p>
                <button type="button" className="storefront-search-overlay__view-all-inline" onClick={onViewAll}>
                  View all results for "{query.trim()}"
                </button>
              </div>
            ) : null}

            <div className={`storefront-search-overlay__body${hasQuery ? '' : ' is-browsing'}`}>
              {!hasQuery ? (
                <section className="storefront-search-overlay__empty-state">
                  {normalizedCategories.length > 0 ? (
                    <div className="storefront-search-overlay__section">
                      <h3 className="storefront-search-overlay__section-title">Popular categories</h3>
                      <div className="storefront-search-overlay__chip-list">
                        {normalizedCategories.map((category) => (
                          <Link key={category.slug} to={buildDisplayCategoryUrl(category.slug)} onClick={closeSearch} className="storefront-search-overlay__chip">
                            {category.label}
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
                          <Link key={brand} to={`/products/brands/${brandToSlug(brand)}`} onClick={closeSearch} className="storefront-search-overlay__chip">
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
                          <button key={item} type="button" onClick={() => setQuery(item)} className="storefront-search-overlay__chip" aria-label={`Search for ${item}`}>
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
                ) : suggestions.length > 0 ? (
                  <section className="storefront-search-overlay__results">
                    {suggestions.map((product) => {
                      const price = formatPrice(product.price);
                      return (
                        <button key={product.id} type="button" onClick={(event) => openQuickView(product, event)} className="storefront-search-overlay__result" aria-label={`Quick view ${product.name}`}>
                          <div className="storefront-search-overlay__result-thumb">
                            <ProductCardImage product={product} alt={product.name} padding="8px" fit="contain" width={144} height={144} className="storefront-search-overlay__result-thumb-image" />
                          </div>
                          <div className="storefront-search-overlay__result-copy">
                            <span className="storefront-search-overlay__result-brand">{product.brand || 'Product'}</span>
                            <strong className="storefront-search-overlay__result-name">{product.name}</strong>
                            {price ? <span className="storefront-search-overlay__result-price">{price}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                    <button type="button" onClick={onViewAll} className="storefront-search-overlay__view-all">
                      View all results
                    </button>
                  </section>
                ) : (
                  <section className="storefront-search-overlay__results">
                    <div className="storefront-search-overlay__empty-message">
                      No products matched "{query.trim()}". Try a brand, SKU, or broader term.
                    </div>
                    <button type="button" onClick={onViewAll} className="storefront-search-overlay__view-all">
                      Browse all products
                    </button>
                  </section>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct} onClose={closeQuickView}>
        {modalProduct ? (
          <ProductDetail product={modalProduct} onAddToCart={handleAddToCart} onClose={closeQuickView} initialVariations={[]} />
        ) : null}
      </ProductModal>
    </>
  );
}
