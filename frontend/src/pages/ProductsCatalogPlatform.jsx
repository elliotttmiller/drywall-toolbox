import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Filter, ShoppingCart } from 'lucide-react';
import SEOHead from '../components/shared/SEOHead';
import BackButton from '../components/shared/BackButton';
import SearchBar from '../components/catalog/SearchBar';
import Dropdown from '../components/ui/Dropdown';
import FilterPanel from '../components/catalog/FilterPanel';
import Pagination from '../components/catalog/Pagination';
import ProductShoppingCard from '../components/ui/ProductShoppingCard';
import ProductModal from '../components/product/ProductModal';
import ProductDetailPlatform from '../components/product/ProductDetailPlatform';
import Toast from '../components/ui/Toast';
import { ProductSkeletonGrid } from '../components/catalog/ProductShoppingCardSkeleton';
import ProductsBrandSelector from '../components/catalog/ProductsBrandSelector.jsx';
import ProductsCategorySelector from '../components/catalog/ProductsCategorySelector.jsx';
import { SORT_OPTIONS } from '../constants/sortOptions';
import { useCatalogFacets } from '../hooks/useCatalogFacets';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { useCart } from '../context/CartContext';
import { buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { getVariationSelectionMap } from '../utils/variationSelection';
import { getBrandLogo } from '../utils/brandAssets.js';
import {
  brandToSlug,
  buildCatalogUrl,
  canonicalBrandLabel,
  parseCatalogQuery,
} from '../utils/catalogUrlState.js';

function toCardProduct(dto) {
  const card = dto?.cardProduct || null;
  const categoryKey = dto?.category?.key || '';
  const displayCategoryKey = dto?.displayCategory?.slug || dto?.displayCategory?.key || '';
  const price = dto?.price?.current ?? dto?.price?.value ?? dto?.price?.min ?? card?.price ?? 0;

  const mapped = {
    ...dto,
    brand: dto?.brand?.label || dto?.brandLabel || '',
    category: categoryKey,
    display_category: displayCategoryKey,
    display_category_label: dto?.displayCategory?.label || displayCategoryKey,
    image: dto?.media?.image || card?.image || '',
    images: dto?.media?.images || [],
    price: typeof price === 'number' ? price : parseFloat(String(price || 0)),
    stock_status: dto?.inventory?.stockStatus || card?.stockStatus || 'instock',
    is_variable: dto?.type === 'variable',
    is_parts: Boolean(dto?.isParts),
    min_price: dto?.price?.min ?? null,
    variation_attributes: dto?.variationAttributes || dto?.attributes || [],
  };

  mapped.cardProduct = card
    ? {
        ...card,
        parent_id: card?.parentId || card?.parent_id || null,
        stock_status: card?.stockStatus || card?.stock_status || mapped.stock_status,
        image: card?.image || mapped.image,
        images: card?.images || mapped.images,
        image_thumbnail: card?.imageThumbnail || card?.image_thumbnail || mapped.image_thumbnail,
        image_srcset: card?.imageSrcset || card?.image_srcset || mapped.image_srcset,
        price: card?.price ?? mapped.price,
        brand: mapped.brand,
        parentName: mapped.name,
        variation_label: card?.variationLabel || card?.variation_label || '',
      }
    : null;

  return mapped;
}

function mergeDisplayCategories(displayCategoriesByBrand = {}) {
  const merged = new Map();
  Object.values(displayCategoriesByBrand || {}).forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((cat) => {
      const id = cat?.slug || cat?.key;
      if (!id) return;
      const existing = merged.get(id);
      merged.set(id, {
        id,
        key: cat.key || id,
        slug: id,
        name: cat.label || cat.key || id,
        count: (existing?.count || 0) + (cat.productCount || 0),
        image: existing?.image || cat.image || '',
      });
    });
  });

  return Array.from(merged.values())
    .filter((cat) => cat.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toBrandFacet(rawBrand = {}) {
  const label = canonicalBrandLabel(rawBrand.label || rawBrand.name || rawBrand.key || rawBrand.slug || '');
  const slug = rawBrand.slug || rawBrand.key || brandToSlug(label);
  return {
    key: rawBrand.key || slug,
    label,
    slug,
    logo: rawBrand.logo || rawBrand.image || rawBrand.imageUrl || getBrandLogo(label || slug),
    productCount: rawBrand.productCount || rawBrand.count || 0,
  };
}

function formatCategoryLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CatalogError({ title, message, details, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-900">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <p className="text-sm mb-3">{message}</p>
      {details && <pre className="text-xs whitespace-pre-wrap bg-white/70 rounded-lg p-3 mb-4 overflow-auto">{details}</pre>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
          Reload catalog
        </button>
      )}
    </div>
  );
}

function SelectorSkeleton({ mode = 'brands' }) {
  const count = mode === 'categories' ? 8 : 6;
  return (
    <div className={mode === 'categories' ? 'product-categories-grid' : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6'}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={mode === 'categories' ? 'product-category-card product-category-card--no-image animate-pulse' : 'product-brand-selector-card animate-pulse'}>
          {mode === 'brands' && <div className="h-16 w-28 rounded-xl bg-gray-100" />}
        </div>
      ))}
    </div>
  );
}

export default function ProductsCatalogPlatform({ forceProductGrid = false, title = 'Products', isPartsFilter = 0 } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { brandSlug, categorySlug } = useParams();
  const { addToCart } = useCart();

  const [showFilters, setShowFilters] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const pathParams = useMemo(() => ({ brandSlug, categorySlug }), [brandSlug, categorySlug]);
  const query = useMemo(() => parseCatalogQuery(new URLSearchParams(location.search), pathParams), [location.search, pathParams]);
  const selectedBrand = query.brands?.[0] || '';

  const isBrandSelectorRoute = location.pathname === '/products/brands';
  const isBrandCategorySelectorRoute = Boolean(brandSlug) && !categorySlug && location.pathname.startsWith('/products/brands/');
  const isSelectorRoute = !forceProductGrid && (isBrandSelectorRoute || isBrandCategorySelectorRoute);
  const productsEnabled = !isSelectorRoute || Boolean(query.search);

  const scopedFacets = isPartsFilter === null ? { brand: selectedBrand } : { isParts: isPartsFilter, brand: selectedBrand };
  const productQuery = isPartsFilter === null ? query : { ...query, isParts: isPartsFilter };

  const { facets, loading: facetsLoading, error: facetsError } = useCatalogFacets(scopedFacets);
  const { items, pagination, loading: itemsLoading, error: productsError } = useCatalogProducts(productQuery, { enabled: productsEnabled });

  const brandFacets = useMemo(
    () => (Array.isArray(facets?.brands) ? facets.brands.map(toBrandFacet).filter((brand) => brand.label) : []),
    [facets]
  );
  const brands = useMemo(() => brandFacets.map((brand) => brand.label), [brandFacets]);

  const selectedBrandFacet = useMemo(() => {
    if (!selectedBrand) return null;
    const selectedSlug = brandToSlug(selectedBrand);
    const selectedLabel = canonicalBrandLabel(selectedBrand);
    return brandFacets.find((brand) => brand.label === selectedLabel || brand.slug === selectedSlug || brand.key === selectedSlug) || null;
  }, [brandFacets, selectedBrand]);

  const mappedProducts = useMemo(() => (Array.isArray(items) ? items.map(toCardProduct) : []), [items]);

  const filterCategories = useMemo(() => {
    if (!facets) return [];
    if (selectedBrandFacet?.key) {
      const byBrand = facets.displayCategoriesByBrand?.[selectedBrandFacet.key] || facets.displayCategoriesByBrand?.[selectedBrandFacet.slug];
      if (!Array.isArray(byBrand)) return [];
      return byBrand
        .filter((cat) => (cat.productCount || 0) > 0)
        .map((cat) => ({ id: cat.slug || cat.key, key: cat.key, slug: cat.slug || cat.key, name: cat.label || cat.key, count: cat.productCount || 0, image: cat.image || '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return mergeDisplayCategories(facets.displayCategoriesByBrand);
  }, [facets, selectedBrandFacet]);

  const brandCategoryCards = useMemo(() => {
    if (!selectedBrandFacet?.key) return [];
    const byBrand = facets?.displayCategoriesByBrand?.[selectedBrandFacet.key] || facets?.displayCategoriesByBrand?.[selectedBrandFacet.slug];
    if (!Array.isArray(byBrand)) return [];
    return [...byBrand]
      .filter((cat) => (cat.productCount || 0) > 0)
      .map((cat) => ({ key: cat.key, slug: cat.slug || cat.key, name: cat.label || cat.key, count: cat.productCount || 0, image: cat.image || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [facets, selectedBrandFacet]);

  const selectedCategoryLabel = useMemo(() => {
    if (!query.displayCategory) return '';
    const match = [...filterCategories, ...brandCategoryCards].find((cat) => cat.slug === query.displayCategory || cat.key === query.displayCategory || cat.id === query.displayCategory);
    return match?.name || formatCategoryLabel(query.displayCategory);
  }, [brandCategoryCards, filterCategories, query.displayCategory]);

  const pageHeading = selectedBrand && selectedCategoryLabel
    ? `${selectedBrandFacet?.label || selectedBrand} ${selectedCategoryLabel}`
    : title;
  const pageSubheading = selectedBrand && selectedCategoryLabel
    ? `Browse ${selectedCategoryLabel.toLowerCase()} from ${selectedBrandFacet?.label || selectedBrand}.`
    : 'Browse our extensive collection of professional drywall tools';
  const isCategoryProductRoute = Boolean(selectedBrand && selectedCategoryLabel);
  const isPartsPage = isPartsFilter === 1;
  const desktopHeading = isCategoryProductRoute ? pageHeading : title;
  const desktopSubheading = isCategoryProductRoute
    ? pageSubheading
    : (isPartsPage
      ? 'Genuine replacement parts, kits, and service components from trusted drywall brands.'
      : pageSubheading);
  const canonicalUrl = isPartsPage ? 'https://drywalltoolbox.com/parts' : 'https://drywalltoolbox.com/products';
  const seoDescription = isPartsPage
    ? 'Shop professional drywall replacement parts, service kits, and repair components from leading brands.'
    : 'Shop professional drywall tools, parts, accessories, and replacement components from leading drywall brands.';

  const setQuery = useCallback((patch, options = {}) => {
    const next = { ...query, ...patch };
    if (options.resetPage !== false) next.page = patch.page ?? 1;
    navigate(buildCatalogUrl(next, pathParams), { replace: options.replace ?? false });
  }, [navigate, pathParams, query]);

  const page = Number(pagination?.page || query.page || 1);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const total = Number(pagination?.total || mappedProducts.length || 0);
  const perPage = Number(pagination?.perPage || query.perPage || 24);
  const pageStart = (page - 1) * perPage;

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    setToast({ message: `${product.name} added to cart!`, type: 'cart' });
  };

  const openModal = (product, cardProduct = null) => {
    const initialResolvedVariation = cardProduct?.parent_id ? cardProduct : null;
    setModalProduct({ product, initialResolvedVariation, initialSelectedAttrs: initialResolvedVariation ? getVariationSelectionMap(initialResolvedVariation) : {} });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  const toggleBrand = (brand) => {
    const canonical = canonicalBrandLabel(brand);
    const nextBrand = canonicalBrandLabel(selectedBrand) === canonical ? '' : canonical;
    setQuery({ brands: nextBrand ? [nextBrand] : [], displayCategory: '', category: '', search: query.search || '', sort: query.sort || 'popular', perPage: query.perPage || 24 });
  };

  const toggleDisplayCategory = (displayCategory) => setQuery({ displayCategory: query.displayCategory === displayCategory ? '' : displayCategory, category: '' });
  const resetToBrandList = () => navigate('/products/brands');
  const resetToCategoryCards = () => navigate(`/products/brands/${brandToSlug(selectedBrand)}`);
  const getCardDisplayProduct = useCallback((product) => product?.cardProduct || product, []);

  const showBrandLanding = !forceProductGrid && isBrandSelectorRoute && !query.search;
  const showCategoryLanding = !forceProductGrid && isBrandCategorySelectorRoute && !query.search;
  const showProductGrid = !showBrandLanding && !showCategoryLanding;

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead title={pageHeading} description={seoDescription} canonical={canonicalUrl} schema={buildSiteLinksSearchBoxSchema()} />
      <div className="container mx-auto px-4 py-4 pt-6">
        {!showCategoryLanding && selectedBrand && (
          <div className="mb-4 hidden sm:block">
            <BackButton onClick={query.displayCategory ? resetToCategoryCards : resetToBrandList} label={query.displayCategory ? selectedBrand : 'Brands'} />
          </div>
        )}

        {!showCategoryLanding && (
          <div className="mb-5 sm:mb-8">
            {isCategoryProductRoute ? (
              <div className="dtb-listing-heading dtb-listing-heading--category">
                <button
                  type="button"
                  onClick={query.displayCategory ? resetToCategoryCards : resetToBrandList}
                  className="dtb-listing-heading__back-pill sm:hidden"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  <span>{selectedBrandFacet?.label || selectedBrand}</span>
                </button>
                <span className="dtb-listing-heading__eyebrow">Products</span>
                <h1 className="dtb-listing-heading__title">{selectedCategoryLabel}</h1>
                <p className="dtb-listing-heading__meta">
                  {(selectedBrandFacet?.label || selectedBrand)}
                  {total > 0 ? ` · ${total.toLocaleString()} product${total === 1 ? '' : 's'}` : ''}
                </p>
              </div>
            ) : (
              <div className="dtb-listing-heading dtb-listing-heading--standard">
                <h1 className="dtb-listing-heading__desktop-title">{desktopHeading}</h1>
                <p className="dtb-listing-heading__desktop-subtitle">{desktopSubheading}</p>
              </div>
            )}
          </div>
        )}

        {facetsError && brandFacets.length === 0 && (
          <CatalogError title="Unable to load catalog brands" message="The product brand selector depends on /wp-json/dtb/v1/catalog/facets. The request failed or returned an invalid response." details={facetsError?.message || String(facetsError)} onRetry={() => window.location.reload()} />
        )}

        {productsError && !itemsLoading && mappedProducts.length === 0 && showProductGrid && (
          <CatalogError title="Unable to load products" message="The product grid depends on /wp-json/dtb/v1/catalog/products. Check the live backend endpoint and WordPress error logs." details={productsError?.message || String(productsError)} onRetry={() => window.location.reload()} />
        )}

        {showBrandLanding ? (
          facetsLoading ? <SelectorSkeleton mode="brands" /> : (
            <ProductsBrandSelector
              brands={brandFacets}
              onSelectBrand={(brand) => navigate(`/products/brands/${brand.slug || brandToSlug(brand.label)}`)}
            />
          )
        ) : showCategoryLanding ? (
          facetsLoading ? <SelectorSkeleton mode="categories" /> : (
            <ProductsCategorySelector
              brand={selectedBrandFacet?.label || selectedBrand}
              brandLogo={selectedBrandFacet?.logo || getBrandLogo(selectedBrand)}
              categories={brandCategoryCards}
              onBack={resetToBrandList}
              onSelectCategory={(cat) => navigate(`/products/brands/${selectedBrandFacet?.slug || brandToSlug(selectedBrand)}/categories/${cat.slug}`)}
            />
          )
        ) : (
          <>
            <div className="dtb-listing-search">
              <SearchBar placeholder={isPartsPage ? 'Search parts by name, SKU, or brand...' : 'Search products by name, SKU, or brand...'} value={query.search || ''} onChange={(e) => setQuery({ search: e.target.value }, { replace: true })} />
            </div>
            <div className="flex flex-col lg:flex-row gap-8">
              <FilterPanel
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                categories={filterCategories}
                brands={brands}
                maxPrice={0}
                selectedBrands={selectedBrand ? [canonicalBrandLabel(selectedBrand)] : []}
                selectedCategories={query.displayCategory ? [query.displayCategory] : []}
                priceRange={[0, 0]}
                onBrandChange={toggleBrand}
                onCategoryChange={toggleDisplayCategory}
                onPriceChange={() => {}}
                onClearFilters={() => selectedBrand ? setQuery({ category: '', displayCategory: '', search: '', sort: 'popular' }) : navigate(isPartsPage ? '/parts' : '/products')}
                resultsCount={total}
              />

              <div className="flex-1">
                <div className="dtb-listing-toolbar mb-5 sm:mb-6">
                  <button onClick={() => setShowFilters(!showFilters)} className="dtb-listing-toolbar__pill lg:hidden" aria-label="Toggle filters and sort">
                    <Filter size={18} />
                    <span>Filter &amp; Sort</span>
                  </button>
                  <div className="dtb-listing-toolbar__sort">
                    <Dropdown value={query.sort} onChange={(value) => setQuery({ sort: value })} options={SORT_OPTIONS} />
                  </div>
                  <div className="dtb-listing-toolbar__count" aria-live="polite">
                    {itemsLoading ? 'Loading…' : `${total.toLocaleString()} result${total === 1 ? '' : 's'}`}
                  </div>
                  <button onClick={() => setShowFilters(!showFilters)} className="dtb-listing-toolbar__pill hidden lg:inline-flex" aria-label="Toggle filters">
                    <Filter size={18} />
                    <span>Filters</span>
                  </button>
                </div>

                {itemsLoading ? <ProductSkeletonGrid count={24} /> : (
                  <>
                    <div className={`dtb-product-grid${mappedProducts.length === 1 ? ' dtb-product-grid--single' : ''}`}>
                      {mappedProducts.map((product, index) => {
                        const cardProduct = getCardDisplayProduct(product);
                        return <ProductShoppingCard key={product.id} product={product} cardProduct={cardProduct} variant="grid" hasSelectedVariation={Boolean(product.is_variable && cardProduct?.parent_id)} onOpenModal={() => openModal(product, cardProduct)} onAddToCart={() => openModal(product, cardProduct)} index={index} />;
                      })}
                    </div>

                    {mappedProducts.length > 0 && (
                      <>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={(next) => { setQuery({ page: next }, { resetPage: false }); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-8" />
                        <p className="text-center text-sm text-gray-400 mt-2">Showing {pageStart + 1}–{Math.min(pageStart + mappedProducts.length, total)} of {total.toLocaleString()} results</p>
                      </>
                    )}

                    {mappedProducts.length === 0 && !productsError && (
                      <div className="text-center py-16">
                        <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-gray-300" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">No products found</h2>
                        <p className="text-gray-600 mb-6">Try adjusting your filters to see more products.</p>
                        <button onClick={() => navigate(isPartsPage ? '/parts' : '/products')} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">Clear Filters</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct?.product || modalProduct} onClose={closeModal}>
        {modalProduct && <ProductDetailPlatform key={`${modalProduct.product?.id || modalProduct.id}:${modalProduct.initialResolvedVariation?.id || 'parent'}`} product={modalProduct.product || modalProduct} onAddToCart={handleAddToCart} onClose={closeModal} initialResolvedVariation={modalProduct.initialResolvedVariation} initialSelectedAttrs={modalProduct.initialSelectedAttrs} />}
      </ProductModal>
    </div>
  );
}
