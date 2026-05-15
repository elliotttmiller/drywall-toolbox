import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Filter, ShoppingCart } from 'lucide-react';
import SEOHead from '../components/shared/SEOHead';
import BackButton from '../components/shared/BackButton';
import SearchBar from '../components/catalog/SearchBar';
import Dropdown from '../components/ui/Dropdown';
import FilterPanel from '../components/catalog/FilterPanel';
import Pagination from '../components/catalog/Pagination';
import ProductShoppingCard from '../components/ui/ProductShoppingCard';
import ProductModal from '../components/product/ProductModal';
import ProductDetail from '../components/product/ProductDetail';
import Toast from '../components/ui/Toast';
import { ProductSkeletonGrid } from '../components/catalog/ProductShoppingCardSkeleton';
import { SORT_OPTIONS } from '../constants/sortOptions';
import { useCatalogFacets } from '../hooks/useCatalogFacets';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { useCart } from '../context/CartContext';
import { buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { getVariationSelectionMap } from '../utils/variationSelection';
import {
  buildCatalogUrl,
  parseCatalogQuery,
} from '../utils/catalogUrlState.js';

function toCardProduct(dto) {
  const card = dto?.cardProduct || null;
  const categoryKey = dto?.category?.key || '';
  const displayCategoryKey = dto?.displayCategory?.slug || dto?.displayCategory?.key || '';
  const price =
    dto?.price?.current ??
    dto?.price?.value ??
    dto?.price?.min ??
    card?.price ??
    0;

  const mapped = {
    ...dto,
    brand: dto?.brand?.label || dto?.brandLabel || '',
    category: categoryKey,
    display_category: displayCategoryKey,
    display_category_label: dto?.displayCategory?.label || displayCategoryKey,
    image: card?.image || dto?.media?.image || '',
    images: dto?.media?.images || [],
    price: typeof price === 'number' ? price : parseFloat(String(price || 0)),
    stock_status: card?.stockStatus || dto?.inventory?.stockStatus || 'instock',
    is_variable: dto?.type === 'variable',
    is_parts: Boolean(dto?.isParts),
    min_price: dto?.price?.min ?? null,
  };

  mapped.cardProduct = card
    ? {
        ...card,
        parent_id: card?.parentId || null,
        stock_status: card?.stockStatus || mapped.stock_status,
        image: card?.image || mapped.image,
        price: card?.price ?? mapped.price,
        brand: mapped.brand,
      }
    : null;

  return mapped;
}

export default function ProductsCatalogPlatform() {
  const location = useLocation();
  const navigate = useNavigate();
  const { brandSlug, categorySlug } = useParams();
  const { addToCart } = useCart();

  const [showFilters, setShowFilters] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const pathParams = useMemo(
    () => ({ brandSlug, categorySlug }),
    [brandSlug, categorySlug]
  );
  const query = useMemo(
    () => parseCatalogQuery(new URLSearchParams(location.search), pathParams),
    [location.search, pathParams]
  );

  const { facets, loading: facetsLoading } = useCatalogFacets();
  const { items, pagination, loading: itemsLoading } = useCatalogProducts({
    ...query,
    isParts: 0,
  });

  const brands = useMemo(
    () => (Array.isArray(facets?.brands) ? facets.brands.map((b) => b.label) : []),
    [facets]
  );
  const categories = useMemo(
    () =>
      Array.isArray(facets?.categories)
        ? facets.categories.map((c) => ({ id: c.key, name: c.label }))
        : [],
    [facets]
  );

  const selectedBrand = query.brands?.[0] || '';
  const selectedBrandFacet = useMemo(
    () =>
      Array.isArray(facets?.brands)
        ? facets.brands.find((b) => b.label === selectedBrand)
        : null,
    [facets, selectedBrand]
  );

  const brandCategoryCards = useMemo(() => {
    if (!selectedBrandFacet?.key) return [];
    const byBrand = facets?.displayCategoriesByBrand?.[selectedBrandFacet.key];
    if (!Array.isArray(byBrand)) return [];
    return [...byBrand]
      .map((cat) => ({
        key: cat.key,
        slug: cat.slug || cat.key,
        name: cat.label || cat.key,
        count: cat.productCount || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [facets, selectedBrandFacet]);

  const mappedProducts = useMemo(
    () => (Array.isArray(items) ? items.map(toCardProduct) : []),
    [items]
  );

  const setQuery = useCallback(
    (patch, options = {}) => {
      const next = {
        ...query,
        ...patch,
      };
      if (options.resetPage !== false) {
        next.page = patch.page ?? 1;
      }
      const url = buildCatalogUrl(next, pathParams);
      navigate(url, { replace: options.replace ?? false });
    },
    [navigate, pathParams, query]
  );

  const loading = facetsLoading || itemsLoading;
  const page = Number(pagination?.page || query.page || 1);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const total = Number(pagination?.total || mappedProducts.length || 0);
  const perPage = Number(pagination?.perPage || query.perPage || 24);
  const pageStart = (page - 1) * perPage;

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  const openModal = (product, cardProduct = null) => {
    const initialResolvedVariation = cardProduct?.parent_id ? cardProduct : null;
    setModalProduct({
      product,
      initialResolvedVariation,
      initialSelectedAttrs: initialResolvedVariation
        ? getVariationSelectionMap(initialResolvedVariation)
        : {},
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  const toggleBrand = (brand) => {
    const nextBrand = selectedBrand === brand ? '' : brand;
    setQuery({
      brands: nextBrand ? [nextBrand] : [],
      displayCategory: '',
      category: '',
      search: query.search || '',
      sort: query.sort || 'popular',
      perPage: query.perPage || 24,
    });
  };

  const toggleCategory = (category) => {
    setQuery({ category: query.category === category ? '' : category });
  };

  const resetToBrandList = () => {
    navigate('/products');
  };

  const resetToCategoryCards = () => {
    setQuery({ displayCategory: '' });
  };

  const getCardDisplayProduct = useCallback((product) => {
    return product?.cardProduct || product;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title="Products"
        description="Shop professional drywall tools from TapeTech, Columbia, Asgard, Graco, SurPro and more. Automatic taping tools, finishing tools, mud boxes, and replacement parts."
        canonical="https://drywalltoolbox.com/products"
        schema={buildSiteLinksSearchBoxSchema()}
      />
      <div className="container mx-auto px-4 py-4 pt-6">
        {selectedBrand && (
          <div className="mb-6">
            <BackButton
              onClick={query.displayCategory ? resetToCategoryCards : resetToBrandList}
              label={query.displayCategory ? selectedBrand : 'Brands'}
            />
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Browse our extensive collection of professional drywall tools</p>
        </div>

        {selectedBrand && (
          <SearchBar
            placeholder="Search products by name, SKU, or brand..."
            value={query.search || ''}
            onChange={(e) => {
              const next = e.target.value;
              setQuery({ search: next }, { replace: true });
            }}
          />
        )}

        {!selectedBrand ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => setQuery({ brands: [brand], displayCategory: '', category: '' })}
                className="dtb-brand-card"
                aria-label={`Shop ${brand}`}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)',
                    letterSpacing: '-0.02em',
                    color: '#1f2937',
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {brand}
                </span>
              </button>
            ))}
          </div>
        ) : !query.displayCategory && brandCategoryCards.length > 1 ? (
          <div className="categories-grid">
            {brandCategoryCards.map((cat, index) => (
              <button
                key={cat.key}
                className="category-card category-card--no-image"
                style={{ animationDelay: `${(index + 1) * 0.07}s` }}
                onClick={() => setQuery({ displayCategory: cat.slug })}
                aria-label={`Browse ${cat.name}`}
              >
                <div className="category-card-scrim" />
                <div className="category-card-content">
                  <div className="category-card-text">
                    <h3 className="category-name">{cat.name}</h3>
                    <span className="category-count">{cat.count} product{cat.count !== 1 ? 's' : ''}</span>
                  </div>
                  <ChevronRight className="category-card-chevron" size={18} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <FilterPanel
              isOpen={showFilters}
              onClose={() => setShowFilters(false)}
              categories={categories}
              brands={brands}
              maxPrice={0}
              selectedBrands={selectedBrand ? [selectedBrand] : []}
              selectedCategories={query.category ? [query.category] : []}
              priceRange={[0, 0]}
              onBrandChange={toggleBrand}
              onCategoryChange={toggleCategory}
              onPriceChange={() => {}}
              onClearFilters={() => {
                if (selectedBrand) {
                  setQuery({ category: '', displayCategory: '', search: '', sort: 'popular' });
                  return;
                }
                navigate('/products');
              }}
              resultsCount={total}
            />

            <div className="flex-1">
              <div className="flex flex-row justify-between items-center gap-4 mb-6">
                <Dropdown
                  value={query.sort}
                  onChange={(value) => setQuery({ sort: value })}
                  options={SORT_OPTIONS}
                />
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 hover:bg-gray-50 font-medium text-sm transition-colors"
                  aria-label="Toggle Filters"
                >
                  <Filter size={18} />
                  <span>Filters</span>
                </button>
              </div>

              {loading ? (
                <ProductSkeletonGrid count={24} />
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                    {mappedProducts.map((product, index) => {
                      const cardProduct = getCardDisplayProduct(product);
                      return (
                        <ProductShoppingCard
                          key={product.id}
                          product={product}
                          cardProduct={cardProduct}
                          hasSelectedVariation={Boolean(product.is_variable && cardProduct?.parent_id)}
                          onOpenModal={() => openModal(product, cardProduct)}
                          onAddToCart={() => openModal(product, cardProduct)}
                          index={index}
                        />
                      );
                    })}
                  </div>

                  {mappedProducts.length > 0 && (
                    <>
                      <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(next) => {
                          setQuery({ page: next }, { resetPage: false });
                          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-8"
                      />
                      <p className="text-center text-sm text-gray-400 mt-2">
                        Showing {pageStart + 1}–{Math.min(pageStart + mappedProducts.length, total)} of {total.toLocaleString()} results
                      </p>
                    </>
                  )}

                  {mappedProducts.length === 0 && (
                    <div className="text-center py-16">
                      <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-gray-300" />
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">No products found</h2>
                      <p className="text-gray-600 mb-6">Try adjusting your filters to see more products.</p>
                      <button
                        onClick={() => navigate('/products')}
                        className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct?.product || modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            key={`${modalProduct.product?.id || modalProduct.id}:${modalProduct.initialResolvedVariation?.id || 'parent'}`}
            product={modalProduct.product || modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialVariations={[]}
            initialResolvedVariation={modalProduct.initialResolvedVariation}
            initialSelectedAttrs={modalProduct.initialSelectedAttrs}
          />
        )}
      </ProductModal>
    </div>
  );
}
