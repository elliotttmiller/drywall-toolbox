import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Filter, LayoutGrid, List, ShoppingCart } from 'lucide-react';
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
import { ProductSkeletonGrid, SelectorSkeletonGrid } from '../components/catalog/ProductShoppingCardSkeleton';
import ProductsBrandSelector from '../components/catalog/ProductsBrandSelector.jsx';
import ProductsCategorySelector from '../components/catalog/ProductsCategorySelector.jsx';
import LoadingCardTransition from '../components/shared/LoadingCardTransition.jsx';
import { SORT_OPTIONS } from '../constants/sortOptions';
import { useCatalogFacets } from '../hooks/useCatalogFacets';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { useCart } from '../context/CartContext';
import { useWorkflowTransition } from '../context/WorkflowTransitionContext.jsx';
import { buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { getVariationSelectionMap } from '../utils/variationSelection';
import { getBrandLogo } from '../utils/brandAssets.js';
import {
  brandToSlug,
  buildCatalogUrl,
  canonicalBrandLabel,
  parseCatalogQuery,
} from '../utils/catalogUrlState.js';
import { dedupeCatalogBrandEntries, normalizeDisplayCategorySlug } from '../utils/catalogFacets.js';
import { searchProducts } from '../services/catalog.js';
import { fetchCatalogProducts } from '../services/catalogPlatformCache.js';

// Canonical display category labels for the customer-facing filter UI.
// Mirrors CategoryNormalizer::DISPLAY_CATEGORY_LABELS on the backend.
const DISPLAY_CATEGORY_LABELS = {
  automatic_tapers:      'Automatic Tapers',
  nail_spotters:         'Nail Spotters',
  finishing_boxes:       'Finishing Boxes',
  handles:               'Handles & Extensions',
  pumps:                 'Mud Pans & Pumps',
  corner_tools:          'Corner Tools',
  accessories:           'Accessories',
  smoothing_blades:      'Smoothing Blades',
  toolsets:              'Tool Sets & Kits',
  parts:                 'Parts',
  stilts:                'Stilts',
  semi_automatic_tapers: 'Semi-Automatic Tapers',
  predator_family:       'Predator Family',
};

// Alias map: normalized raw slug → canonical slug.
// Mirrors CategoryNormalizer::DISPLAY_CATEGORY_ALIASES on the backend.
// Keys are lowercased with spaces/hyphens collapsed to underscores.
const DISPLAY_CATEGORY_ALIASES = {
  automatic_taping_tools:    'automatic_tapers',
  automatic_tapers:          'automatic_tapers',
  automatic_taper:           'automatic_tapers',
  taper:                     'automatic_tapers',
  nail_spotters:             'nail_spotters',
  nail_spotter:              'nail_spotters',
  nailspotter:               'nail_spotters',
  nailspotters:              'nail_spotters',
  spotter:                   'nail_spotters',
  finishing_boxes:           'finishing_boxes',
  finishing_box:             'finishing_boxes',
  flat_box:                  'finishing_boxes',
  flatbox:                   'finishing_boxes',
  drywall_box:               'finishing_boxes',
  handles:                   'handles',
  handle:                    'handles',
  handles_and_extensions:    'handles',
  pumps:                     'pumps',
  pump:                      'pumps',
  mud_pans_and_pumps:        'pumps',
  corner_tools:              'corner_tools',
  corner_tool:               'corner_tools',
  corner_finisher:           'corner_tools',
  accessories:               'accessories',
  smoothing_blades:          'smoothing_blades',
  smoothing_blade:           'smoothing_blades',
  toolsets:                  'toolsets',
  toolset:                   'toolsets',
  tool_sets_and_kits:        'toolsets',
  parts:                     'parts',
  replacement_parts:         'parts',
  stilts:                    'stilts',
  semi_automatic_tapers:     'semi_automatic_tapers',
  predator_family:           'predator_family',
  predator:                  'predator_family',
};

/**
 * Resolve a raw display category slug/key to its canonical slug.
 * Handles inconsistently stored meta values from legacy imports.
 */
function canonicalDisplayCategoryId(raw = '') {
  const normalized = normalizeDisplayCategorySlug(raw); // lowercase + underscores
  return DISPLAY_CATEGORY_ALIASES[normalized] || normalized;
}
import { normalizeCatalogDisplayName } from '../utils/catalogDtoAdapters.js';

function toCardProduct(dto) {
  const card = dto?.cardProduct || null;
  const categoryKey = dto?.category?.key || '';
  const displayCategoryKey = dto?.displayCategory?.slug || dto?.displayCategory?.key || '';
  const effectivePrice = dto?.price?.effective ?? dto?.price?.current ?? dto?.price?.value;
  const regularPrice = dto?.price?.regular ?? card?.regularPrice ?? card?.regular_price ?? null;
  const salePrice = dto?.price?.sale ?? card?.salePrice ?? card?.sale_price ?? null;
  const price = effectivePrice ?? dto?.price?.min ?? card?.price ?? 0;

  const mapped = {
    ...dto,
    brand: dto?.brand?.label || dto?.brandLabel || '',
    category: categoryKey,
    display_category: displayCategoryKey,
    display_category_label: dto?.displayCategory?.label || displayCategoryKey,
    image: dto?.media?.image || card?.image || '',
    images: dto?.media?.images || [],
    price: typeof price === 'number' ? price : parseFloat(String(price || 0)),
    regular_price: regularPrice,
    sale_price: salePrice,
    compare_at_price: regularPrice,
    stock_status: dto?.inventory?.stockStatus || card?.stockStatus || 'instock',
    name: normalizeCatalogDisplayName(dto?.name || '', {
      sku: dto?.sku || '',
      brand: dto?.brand?.label || dto?.brandLabel || '',
    }),
    is_variable: dto?.type === 'variable',
    is_parts: Boolean(dto?.isParts),
    min_price: dto?.price?.min ?? null,
    min_regular_price: dto?.price?.minRegular ?? dto?.price?.min_regular ?? null,
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
        regular_price: card?.regularPrice ?? card?.regular_price ?? mapped.regular_price,
        sale_price: card?.salePrice ?? card?.sale_price ?? mapped.sale_price,
        compare_at_price: card?.regularPrice ?? card?.regular_price ?? mapped.compare_at_price,
        brand: mapped.brand,
        name: normalizeCatalogDisplayName(card?.name || mapped.name || '', {
          sku: card?.sku || '',
          parentSku: dto?.sku || '',
          brand: mapped.brand,
        }),
        parentName: mapped.name,
        variation_label: card?.variationLabel || card?.variation_label || '',
      }
    : null;

  return mapped;
}

function canonicalCategoryKey(category = {}) {
  const raw = category?.slug || category?.key || category?.label || category?.name || '';
  return canonicalDisplayCategoryId(raw);
}

function mergeCategoryEntries(items = []) {
  const merged = new Map();

  (Array.isArray(items) ? items : []).forEach((cat) => {
    const id = canonicalCategoryKey(cat);
    if (!id) return;

    const existing = merged.get(id);
    // Use the canonical label if available, else fall back to the entry's label.
    const canonicalLabel = DISPLAY_CATEGORY_LABELS[id];
    const slug = cat?.slug || String(id).replace(/_/g, '-');
    merged.set(id, {
      id: slug,
      key: cat?.key || existing?.key || id,
      slug,
      name: canonicalLabel || cat?.label || cat?.name || existing?.name || formatCategoryLabel(id),
      count: (existing?.count || 0) + Number(cat?.productCount || cat?.count || 0),
      image: existing?.image || cat?.image || '',
    });
  });

  return Array.from(merged.values())
    .filter((cat) => cat.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeDisplayCategories(displayCategoriesByBrand = {}) {
  const allCategories = [];
  Object.values(displayCategoriesByBrand || {}).forEach((items) => {
    if (Array.isArray(items)) allCategories.push(...items);
  });
  return mergeCategoryEntries(allCategories);
}

function getDisplayCategoriesForBrand(displayCategoriesByBrand = {}, brandFacet = null, selectedBrand = '', routeBrandSlug = '') {
  if (!displayCategoriesByBrand || typeof displayCategoriesByBrand !== 'object') return [];

  const selectedLabel = canonicalBrandLabel(selectedBrand);
  const candidates = [
    brandFacet?.key,
    brandFacet?.slug,
    routeBrandSlug,
    selectedBrand,
    selectedLabel,
    brandToSlug(selectedBrand),
    brandToSlug(selectedLabel),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const direct = displayCategoriesByBrand[candidate];
    if (Array.isArray(direct)) return direct;

    const slug = brandToSlug(candidate);
    if (slug && Array.isArray(displayCategoriesByBrand[slug])) return displayCategoriesByBrand[slug];
  }

  const scopedEntries = Object.values(displayCategoriesByBrand).filter(Array.isArray);
  return scopedEntries.length === 1 ? scopedEntries[0] : [];
}

function toBrandFacet(rawBrand = {}) {
  const label = canonicalBrandLabel(rawBrand.label || rawBrand.name || rawBrand.key || rawBrand.slug || '');
  const slug = brandToSlug(label);
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

export default function ProductsCatalogPlatform({ forceProductGrid = false, title = 'Products', isPartsFilter = 0 } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { brandSlug, categorySlug } = useParams();
  const { addToCart } = useCart();
  const { runWorkflow } = useWorkflowTransition();

  const [showFilters, setShowFilters] = useState(false);
  const [displayMode, setDisplayMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    const saved = window.localStorage.getItem('dtb-catalog-display-mode');
    return saved === 'grid' || saved === 'list' ? saved : 'grid';
  });
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const pathParams = useMemo(() => ({ brandSlug, categorySlug }), [brandSlug, categorySlug]);
  const query = useMemo(() => parseCatalogQuery(new URLSearchParams(location.search), pathParams), [location.search, pathParams]);
  const selectedBrand = query.brands?.[0] || '';
  const [searchInput, setSearchInput] = useState(() => query.search || '');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  const searchRequestIdRef = useRef(0);
  const committedSearchRef = useRef(query.search || '');

  const isBrandSelectorRoute = location.pathname === '/products/brands';
  const isBrandCategorySelectorRoute = Boolean(brandSlug) && !categorySlug && location.pathname.startsWith('/products/brands/');
  const isSelectorRoute = !forceProductGrid && (isBrandSelectorRoute || isBrandCategorySelectorRoute);
  const productsEnabled = !isSelectorRoute || Boolean(query.search);

  const effectivePartsFilter = isPartsFilter === 0 && Boolean(query.search) ? null : isPartsFilter;
  const scopedFacets = effectivePartsFilter === null ? { brand: selectedBrand } : { isParts: effectivePartsFilter, brand: selectedBrand };
  const productQuery = effectivePartsFilter === null ? query : { ...query, isParts: effectivePartsFilter };

  const { facets, loading: facetsLoading, error: facetsError } = useCatalogFacets(scopedFacets);
  const { items, pagination, loading: itemsLoading, error: productsError } = useCatalogProducts(productQuery, { enabled: productsEnabled });

  const brandFacets = useMemo(
    () => dedupeCatalogBrandEntries(
      Array.isArray(facets?.brands) ? facets.brands.map(toBrandFacet).filter((brand) => brand.label) : []
    ),
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
    if (selectedBrand) {
      const byBrand = getDisplayCategoriesForBrand(facets.displayCategoriesByBrand, selectedBrandFacet, selectedBrand, brandSlug);
      if (!Array.isArray(byBrand)) return [];
      return mergeCategoryEntries(byBrand);
    }
    return mergeDisplayCategories(facets.displayCategoriesByBrand);
  }, [brandSlug, facets, selectedBrand, selectedBrandFacet]);

  const brandCategoryCards = useMemo(() => {
    if (!selectedBrand) return [];
    const byBrand = getDisplayCategoriesForBrand(facets?.displayCategoriesByBrand, selectedBrandFacet, selectedBrand, brandSlug);
    if (!Array.isArray(byBrand)) return [];
    return mergeCategoryEntries(byBrand);
  }, [brandSlug, facets, selectedBrand, selectedBrandFacet]);

  const selectedCategoryLabel = useMemo(() => {
    if (!query.displayCategory) return '';
    const match = [...filterCategories, ...brandCategoryCards].find((cat) => cat.slug === query.displayCategory || cat.key === query.displayCategory || cat.id === query.displayCategory);
    return match?.name || formatCategoryLabel(query.displayCategory);
  }, [brandCategoryCards, filterCategories, query.displayCategory]);

  const categoryScopeLabel = selectedBrandFacet?.label || selectedBrand;
  const pageHeading = selectedCategoryLabel
    ? `${categoryScopeLabel ? `${categoryScopeLabel} ` : ''}${selectedCategoryLabel}`
    : title;
  const isCategoryProductRoute = Boolean(selectedCategoryLabel);
  const isPartsPage = isPartsFilter === 1;
  const page = Number(pagination?.page || query.page || 1);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const total = Number(pagination?.total || mappedProducts.length || 0);
  const perPage = Number(pagination?.perPage || query.perPage || 24);
  const pageStart = (page - 1) * perPage;
  const desktopHeading = isCategoryProductRoute ? pageHeading : title;
  const unifiedHeadingTitle = isCategoryProductRoute ? selectedCategoryLabel : desktopHeading;
  const unifiedHeadingMeta = isCategoryProductRoute
    ? `${categoryScopeLabel || 'All brands'}${total > 0 ? ` · ${total.toLocaleString()} product${total === 1 ? '' : 's'}` : ''}`
    : `${isPartsPage ? 'Replacement parts and service components' : 'All brands and categories'}${total > 0 ? ` · ${total.toLocaleString()} product${total === 1 ? '' : 's'}` : ''}`;
  const canonicalUrl = isPartsPage ? 'https://drywalltoolbox.com/parts' : 'https://drywalltoolbox.com/products';
  const seoDescription = isPartsPage
    ? 'Shop professional drywall replacement parts, service kits, and repair components from leading brands.'
    : 'Shop professional drywall tools and accessories from leading drywall brands.';

  const setQuery = useCallback((patch, options = {}) => {
    const next = { ...query, ...patch };
    if (options.resetPage !== false) next.page = patch.page ?? 1;
    navigate(buildCatalogUrl(next, pathParams), { replace: options.replace ?? false });
  }, [navigate, pathParams, query]);

  const commitSearch = useCallback((rawValue, { replace = true } = {}) => {
    const search = String(rawValue || '').trim();
    committedSearchRef.current = search;
    setQuery(
      search
        ? { search, displayCategory: '', category: '' }
        : { search: '' },
      { replace },
    );
  }, [setQuery]);

  useEffect(() => {
    if (query.search === committedSearchRef.current) return;
    committedSearchRef.current = query.search || '';
    setSearchInput(query.search || '');
  }, [query.search]);

  useEffect(() => {
    const pendingSearch = searchInput.trim();
    if (pendingSearch === query.search) return undefined;

    // 420 ms debounce — fast enough for responsive feel, slow enough to avoid
    // hammering the catalog platform with per-keystroke API requests.
    const timer = window.setTimeout(() => commitSearch(pendingSearch), 420);
    return () => window.clearTimeout(timer);
  }, [commitSearch, query.search, searchInput]);

  useEffect(() => {
    const search = searchInput.trim();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (search.length < 2) {
      setSearchSuggestions([]);
      setSearchSuggestionsLoading(false);
      return undefined;
    }

    // 280 ms debounce for suggestions — slightly faster than the commit debounce
    // so the dropdown appears before the grid begins loading.
    const timer = window.setTimeout(async () => {
      setSearchSuggestionsLoading(true);
      try {
        // Primary: catalog platform — same data source as the product grid.
        // Scoped to the active brand when one is selected.
        const platformData = await fetchCatalogProducts({
          search,
          ...(selectedBrand ? { brands: [selectedBrand] } : {}),
          perPage: 6,
          page: 1,
        });
        const platformItems = Array.isArray(platformData?.items)
          ? platformData.items.slice(0, 6)
          : [];
        if (searchRequestIdRef.current === requestId) {
          setSearchSuggestions(platformItems.map(toCardProduct).filter(Boolean));
        }
      } catch {
        // Fallback: legacy catalog cache (works even when the backend is down).
        try {
          const legacyResults = await searchProducts(search);
          const canonicalBrand = canonicalBrandLabel(selectedBrand);
          const scoped = canonicalBrand
            ? legacyResults.filter((p) => canonicalBrandLabel(p?.brand || '') === canonicalBrand)
            : legacyResults;
          if (searchRequestIdRef.current === requestId) {
            setSearchSuggestions(scoped.slice(0, 6));
          }
        } catch {
          if (searchRequestIdRef.current === requestId) setSearchSuggestions([]);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) setSearchSuggestionsLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchInput, selectedBrand]);

  const handleAddToCart = async (product, quantity = 1) => {
    try {
      await runWorkflow(
        {
          label: 'Adding to cart…',
          sublabel: product?.name || 'Updating your cart securely.',
          blocking: false,
        },
        () => addToCart(product, quantity),
      );
      setToast({ message: `${product.name} added to cart!`, type: 'cart' });
    } catch (err) {
      setToast({ message: err?.message || 'Could not add item to cart. Please try again.', type: 'error' });
    }
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

  const toggleDisplayCategory = (displayCategory) => {
    const next = query.displayCategory === displayCategory ? '' : displayCategory;
    // When activating a category filter, clear any active search — the backend
    // ANDs display_category + search together which returns zero results.
    setQuery({ displayCategory: next, category: '', ...(next ? { search: '' } : {}) });
  };
  const resetToBrandList = () => navigate('/products/brands');
  const resetToCategoryCards = () => navigate(`/products/brands/${brandToSlug(selectedBrand)}`);
  const getCardDisplayProduct = useCallback((product) => product?.cardProduct || null, []);

  const showBrandLanding = !forceProductGrid && isBrandSelectorRoute && !query.search;
  const showCategoryLanding = !forceProductGrid && isBrandCategorySelectorRoute && !query.search;
  const showProductGrid = !showBrandLanding && !showCategoryLanding;

  const handleDisplayModeChange = useCallback((mode) => {
    setDisplayMode(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dtb-catalog-display-mode', mode);
    }
  }, []);

  const productGridContent = (
    <>
      <div className={`dtb-product-grid dtb-product-grid--${displayMode}${mappedProducts.length === 1 ? ' dtb-product-grid--single' : ''}`}>
        {mappedProducts.map((product, index) => {
          const cardProduct = getCardDisplayProduct(product);
          return <ProductShoppingCard key={product.id} product={product} cardProduct={cardProduct} variant={displayMode} hasSelectedVariation={Boolean(product.is_variable && cardProduct?.parent_id)} onOpenModal={() => openModal(product, cardProduct)} onAddToCart={() => handleAddToCart(cardProduct || product, 1)} index={index} />;
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
  );

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead title={pageHeading} description={seoDescription} canonical={canonicalUrl} schema={buildSiteLinksSearchBoxSchema()} />
      <div className="container mx-auto px-4 py-4 pt-6">
        {!showCategoryLanding && !showBrandLanding && (
          <div className="mb-5 sm:mb-8">
            <div className={`dtb-listing-heading${isCategoryProductRoute ? '' : ' dtb-listing-heading--standard'}`}>
              {isCategoryProductRoute && (
                <button
                  type="button"
                  onClick={selectedBrand ? (query.displayCategory ? resetToCategoryCards : resetToBrandList) : () => navigate('/products')}
                  className="dtb-listing-heading__back-pill sm:hidden"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  <span>{categoryScopeLabel || 'Products'}</span>
                </button>
              )}
              {isCategoryProductRoute ? (
                <div className="dtb-listing-heading__title-row hidden sm:flex">
                  <div className="dtb-listing-heading__nav-col shrink-0 lg:w-80">
                    <BackButton
                      onClick={selectedBrand ? (query.displayCategory ? resetToCategoryCards : resetToBrandList) : () => navigate('/products')}
                      label={selectedBrand ? (query.displayCategory ? selectedBrand : 'Brands') : 'Products'}
                      className="dtb-product-nav-back"
                    />
                  </div>
                  <div className="dtb-listing-heading__title-group flex-1">
                    <h1 className="dtb-listing-heading__title">{unifiedHeadingTitle}</h1>
                    <p className="dtb-listing-heading__meta">{unifiedHeadingMeta}</p>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="dtb-listing-heading__title">{unifiedHeadingTitle}</h1>
                  <p className="dtb-listing-heading__meta">{unifiedHeadingMeta}</p>
                </>
              )}
            </div>
          </div>
        )}

        {facetsError && brandFacets.length === 0 && (
          <CatalogError title="Unable to load catalog brands" message="The product brand selector depends on /wp-json/dtb/v1/catalog/facets. The request failed or returned an invalid response." details={facetsError?.message || String(facetsError)} onRetry={() => window.location.reload()} />
        )}

        {productsError && !itemsLoading && mappedProducts.length === 0 && showProductGrid && (
          <CatalogError title="Unable to load products" message="The product grid depends on /wp-json/dtb/v1/catalog/products. Check the live backend endpoint and WordPress error logs." details={productsError?.message || String(productsError)} onRetry={() => window.location.reload()} />
        )}

        {showBrandLanding ? (
          <LoadingCardTransition
            loading={facetsLoading}
            skeleton={<SelectorSkeletonGrid mode="brands" />}
            label="Loading product brands"
          >
            <ProductsBrandSelector
              brands={brandFacets}
              onSelectBrand={(brand) => navigate(`/products/brands/${brand.slug || brandToSlug(brand.label)}`)}
            />
          </LoadingCardTransition>
        ) : showCategoryLanding ? (
          <LoadingCardTransition
            loading={facetsLoading}
            skeleton={<SelectorSkeletonGrid mode="categories" />}
            label="Loading product categories"
          >
            <ProductsCategorySelector
              brand={selectedBrandFacet?.label || selectedBrand}
              brandLogo={selectedBrandFacet?.logo || getBrandLogo(selectedBrand)}
              categories={brandCategoryCards}
              onBack={resetToBrandList}
              onSelectCategory={(cat) => navigate(`/products/brands/${selectedBrandFacet?.slug || brandToSlug(selectedBrand)}/categories/${cat.slug}`)}
            />
          </LoadingCardTransition>
        ) : (
          <>
            <div className="dtb-listing-search">
              <SearchBar
                placeholder={isPartsPage ? 'Search parts by name, SKU, or brand...' : 'Search products by name, SKU, or brand...'}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                suggestions={searchSuggestions}
                loading={searchSuggestionsLoading}
                onSubmit={(value) => commitSearch(value, { replace: false })}
                onClear={() => {
                  setSearchInput('');
                  setSearchSuggestions([]);
                  commitSearch('');
                }}
                onSelectSuggestion={(product) => navigate(product?.slug ? `/products/${product.slug}` : `/product/${product?.id}`)}
              />
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
                  <button onClick={() => setShowFilters(!showFilters)} className="dtb-listing-toolbar__pill" aria-label="Toggle filters">
                    <Filter size={18} />
                    <span>Filters</span>
                  </button>
                  <div className="dtb-listing-toolbar__sort">
                    <Dropdown value={query.sort} onChange={(value) => setQuery({ sort: value })} options={SORT_OPTIONS} />
                  </div>
                  <div className="dtb-listing-toolbar__view-toggle" role="group" aria-label="Product display mode">
                    <button
                      type="button"
                      className={`dtb-listing-toolbar__view-button${displayMode === 'list' ? ' is-active' : ''}`}
                      onClick={() => handleDisplayModeChange('list')}
                      aria-pressed={displayMode === 'list'}
                    >
                      <List size={16} />
                      <span>List</span>
                    </button>
                    <button
                      type="button"
                      className={`dtb-listing-toolbar__view-button${displayMode === 'grid' ? ' is-active' : ''}`}
                      onClick={() => handleDisplayModeChange('grid')}
                      aria-pressed={displayMode === 'grid'}
                    >
                      <LayoutGrid size={16} />
                      <span>Grid</span>
                    </button>
                  </div>
                  {!itemsLoading && (
                    <div className="dtb-listing-toolbar__count" aria-live="polite">
                      {`${total.toLocaleString()} result${total === 1 ? '' : 's'}`}
                    </div>
                  )}
                </div>

                <LoadingCardTransition
                  loading={itemsLoading}
                  skeleton={<ProductSkeletonGrid count={24} variant={displayMode} />}
                  label="Loading catalog products"
                >
                  {productGridContent}
                </LoadingCardTransition>
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
