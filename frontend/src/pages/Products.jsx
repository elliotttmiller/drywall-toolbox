import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import ProductModal from '../components/ProductModal';
import ProductCard from '../components/ProductCard';
import BackButton from '../components/BackButton';
import SearchBar from '../components/SearchBar';
import SortDropdown from '../components/SortDropdown';
import FilterPanel from '../components/FilterPanel';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import { ProductSkeletonGrid } from '../components/ProductSkeletonCard';
import { ChevronRight } from 'lucide-react';
import { getProducts } from '../services/catalog';
import { getProductVariations } from '../services/api';
import { useCart } from '../context/CartContext';
import {
  ShoppingCart,
  Filter,
} from 'lucide-react';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo.svg';
import duraStiltsLogo from '/brands/Dura-Stilts/dura-stilts-logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import SEOHead from '../components/SEOHead';
import { buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { findMatchingVariation, fetchVariationsBatched } from '../utils/variationSelection';
import '../styles/tool-selector.css';

// products will be loaded from WooCommerce REST API at runtime
// brands list will be derived from loaded products
const categories = [
  { id: 'taping', name: 'Automatic Taping' },
  { id: 'finishing', name: 'Finishing Tools' },
  { id: 'corner', name: 'Corner Tools' },
  { id: 'mudboxes', name: 'Mud Boxes & Pumps' },
  { id: 'sanding', name: 'Sanding Tools' }
];

// Allowed brands to display
const ALLOWED_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Asgard',
  'SurPro',
  'Graco',
  'Platinum Drywall Tools',
  'Dura-Stilts',
  'Level5'
];

const MAX_PRICE = 3000;
const ITEMS_PER_PAGE = 24;

// Brand name ↔ URL slug maps so navigation produces readable URLs like
// /products?brand=columbia-taping-tools
const BRAND_TO_SLUG = {
  'TapeTech':              'tapetech',
  'Columbia Taping Tools': 'columbia-taping-tools',
  'Asgard':                'asgard',
  'SurPro':                'surpro',
  'Graco':                 'graco',
  'Platinum Drywall Tools': 'platinum',
  'Dura-Stilts':           'dura-stilts',
  'Level5':                'level5',
};
const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries(BRAND_TO_SLUG).map(([name, slug]) => [slug, name])
);

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo,
  'Platinum Drywall Tools': platinumLogo,
  'Dura-Stilts': duraStiltsLogo,
  'Level5': level5Logo,
};

export default function Products() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // initialize selected brands from ?brand= param (supports comma-separated)
  const params = new URLSearchParams(location.search);
  const brandParam = params.get('brand');
  const searchParam = params.get('search');
  const pageParam = parseInt(params.get('page') || '1', 10);
  const initialSelectedBrands = brandParam
    ? brandParam
        .split(',')
        .map(b => b.trim())
        .map(b => SLUG_TO_BRAND[b] || b)  // Convert slug to full name, keep unknown names as-is for backward-compat
        .filter(Boolean)
        .filter(brand => ALLOWED_BRANDS.includes(brand))
    : [];

  const [selectedBrands, setSelectedBrands] = useState(initialSelectedBrands);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  // selectedDisplayCategory: WC leaf category name used for the brand→category drill-down.
  // null  → show category cards for the selected brand
  // string → show product grid filtered to that WC leaf category (e.g. "Finishing Boxes")
  const [selectedDisplayCategory, setSelectedDisplayCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParam ? decodeURIComponent(searchParam) : '');
  const [priceRange, setPriceRange] = useState([0, MAX_PRICE]);
  const [sortBy, setSortBy] = useState('popular');
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [showFilters, setShowFilters] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalSelectedAttrs, setModalSelectedAttrs] = useState({});
  const [modalResolvedVariation, setModalResolvedVariation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // Per-card variant selection map: { [productId]: { [attrName]: value } }
  const [cardVariants, setCardVariants] = useState({});
  // Cached variations per variable parent product ID
  const [cardVariationMap, setCardVariationMap] = useState({});
  const [loadingVariationIds, setLoadingVariationIds] = useState({});
  const cardVariationMapRef = useRef({});

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  // Update a single chip selection for a product card
  const handleVariantSelect = useCallback((productId, attrName, value) => {
    setCardVariants(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [attrName]: value },
    }));
  }, []);

  const openModal = (product, resolvedVariation = null) => {
    setModalProduct(product);
    setModalSelectedAttrs(cardVariants[product.id] || {});
    setModalResolvedVariation(resolvedVariation?.id && resolvedVariation.id !== product.id ? resolvedVariation : null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
    setModalSelectedAttrs({});
    setModalResolvedVariation(null);
  };

  // close on escape
  // Depend on the current page's variable-product ID set instead of the
  // freshly sliced pageProducts array to avoid duplicate fetch bursts.

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  const toggleBrand = (brand) => {
    const newBrands = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand];
    setSelectedBrands(newBrands);
  };

  const resetToBrandList = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedDisplayCategory(null);
    setPriceRange([0, MAX_PRICE]);
    navigate('/products');
  };

  const resetToCategoryCards = () => {
    setSelectedDisplayCategory(null);
    setSelectedCategories([]);
    navigate(`/products?brand=${encodeURIComponent(BRAND_TO_SLUG[selectedBrands[0]] || selectedBrands[0])}`);
  };

  // load products once — catalog service fetches from WC REST API
  useEffect(() => {
    let mounted = true;
    getProducts().then(list => {
      if (!mounted) return;
      setProducts(list);
      // Always show every ALLOWED_BRAND in the selector regardless of whether
      // the catalog has products for it yet (e.g. Platinum has no products yet).
      // Brands that DO appear in the catalog are sorted alphabetically first;
      // any catalog-absent brands are appended in ALLOWED_BRANDS order.
      const fromCatalog = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
      const inCatalog = fromCatalog.filter(b => ALLOWED_BRANDS.includes(b));
      const notInCatalog = ALLOWED_BRANDS.filter(b => !inCatalog.includes(b));
      setBrands([...inCatalog, ...notInCatalog]);
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Watch for URL changes to update state (brands and search)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const brandParam = params.get('brand');
    const brandsFromUrl = brandParam
      ? brandParam.split(',').map(b => decodeURIComponent(b.trim())).filter(Boolean).filter(brand => ALLOWED_BRANDS.includes(brand))
      : [];

    // Compare as sorted sets to avoid order issues (create copies to avoid mutation)
    const urlBrandsSet = [...brandsFromUrl].sort().join(',');
    const currentBrandsSet = [...selectedBrands].sort().join(',');

    if (urlBrandsSet !== currentBrandsSet) {
      // Defer the state update to avoid synchronous setState inside an effect
      // which can cause cascading renders. Scheduling the update asynchronously
      // ensures the effect completes before the state change occurs.
      const t = setTimeout(() => setSelectedBrands(brandsFromUrl), 0);
      return () => clearTimeout(t);
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state (brands + search + page) to URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentBrandParam  = params.get('brand')  || '';
    const currentSearchParam = params.get('search') || '';
    const currentPageParam   = params.get('page')   || '';

    const expectedBrandParam  = selectedBrands.length > 0
      ? selectedBrands.map(b => encodeURIComponent(b)).join(',')
      : '';
    const expectedSearchParam = searchQuery ? encodeURIComponent(searchQuery) : '';
    const expectedPageParam   = currentPage > 1 ? String(currentPage) : '';

    // Only navigate if URL needs to change
    if (
      currentBrandParam  !== expectedBrandParam  ||
      currentSearchParam !== expectedSearchParam ||
      currentPageParam   !== expectedPageParam
    ) {
      const newParams = new URLSearchParams();
      if (selectedBrands.length > 0) newParams.set('brand', expectedBrandParam);
      if (searchQuery)                newParams.set('search', expectedSearchParam);
      if (currentPage > 1)            newParams.set('page', expectedPageParam);
      const newSearch = newParams.toString();
      navigate(newSearch ? `/products?${newSearch}` : '/products', { replace: true });
    }
  }, [selectedBrands, searchQuery, currentPage, navigate, location.search]);

  // Reset to page 1 when filters / search change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrentPage(1); }, [selectedBrands, selectedCategories, priceRange, searchQuery, sortBy]);

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const nonPartsProducts = (products || []).filter(product => !product.is_parts);

  const filteredProducts = nonPartsProducts.filter(product => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) return false;
    // WC leaf-category drill-down (category cards layer)
    if (selectedDisplayCategory && product.display_category !== selectedDisplayCategory) return false;
    // price may not be set on all products; ignore if missing
    if (product.price && (product.price < priceRange[0] || product.price > priceRange[1])) return false;
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = product.name && product.name.toLowerCase().includes(query);
      const matchesSku = product.sku && product.sku.toLowerCase().includes(query);
      const matchesUpc = product.upc && product.upc.toLowerCase().includes(query);
      const matchesBrand = product.brand && product.brand.toLowerCase().includes(query);
      if (!matchesName && !matchesSku && !matchesUpc && !matchesBrand) return false;
    }
    return true;
  });

  // Unique WC leaf category cards for the currently selected brand(s).
  // Only computed when we're in the brand→category intermediate view.
  const brandCategoryCards = (() => {
    if (selectedBrands.length === 0) return [];
    const brandProducts = nonPartsProducts.filter(p => selectedBrands.includes(p.brand));
    const seen = new Set();
    const cards = [];
    for (const p of brandProducts) {
      const dc = p.display_category;
      if (dc && !seen.has(dc)) {
        seen.add(dc);
        cards.push({ name: dc, image: p.image });
      }
    }
    return cards.sort((a, b) => a.name.localeCompare(b.name));
  })();

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': {
        return a.price - b.price;
      }
      case 'price-high': {
        return b.price - a.price;
      }
      case 'rating': {
        return b.rating - a.rating;
      }
      case 'popular':
      default: {
        // Popular sorting: prioritize main products over small parts
        // 1. Sort by badge priority (Best Seller > Popular > New > no badge)
        const badgePriority = { 'Best Seller': 0, 'Popular': 1, 'New': 2 };
        const aBadgePriority = badgePriority[a.badge] ?? 3;
        const bBadgePriority = badgePriority[b.badge] ?? 3;
        if (aBadgePriority !== bBadgePriority) {
          return aBadgePriority - bBadgePriority;
        }

        // 2. Sort by number of reviews (more reviews = more popular)
        const aReviews = a.reviews || 0;
        const bReviews = b.reviews || 0;
        if (aReviews !== bReviews) {
          return bReviews - aReviews;
        }

        // 3. Sort by rating (higher rating = more popular)
        const aRating = a.rating || 0;
        const bRating = b.rating || 0;
        if (aRating !== bRating) {
          return bRating - aRating;
        }

        // 4. Prioritize main products over parts (products with price > $50 are likely main tools)
        const aIsMainTool = (a.price || 0) > 50;
        const bIsMainTool = (b.price || 0) > 50;
        if (aIsMainTool !== bIsMainTool) {
          return aIsMainTool ? -1 : 1;
        }

        // 5. Sort by price (higher price main products first, lower price parts)
        return (b.price || 0) - (a.price || 0);
      }
    }
  });

  const totalPages   = Math.max(1, Math.ceil(sortedProducts.length / ITEMS_PER_PAGE));
  const safePage     = Math.min(currentPage, totalPages);
  const pageStart    = (safePage - 1) * ITEMS_PER_PAGE;
  const pageProducts = sortedProducts.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const pageVariableIdsKey = pageProducts
    .filter((p) => p.is_variable && p.id)
    .map((p) => String(p.id))
    .join(',');

  useEffect(() => {
    cardVariationMapRef.current = cardVariationMap;
  }, [cardVariationMap]);

  useEffect(() => {
    const variableIds = pageProducts
      .filter((p) => p.is_variable && p.id && !cardVariationMapRef.current[p.id])
      .map((p) => p.id);
    if (variableIds.length === 0) return;

    setLoadingVariationIds((prev) => {
      const next = { ...prev };
      variableIds.forEach((id) => { next[id] = true; });
      return next;
    });

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations).then((pairs) => {
      if (!mounted) return;
      const next = {};
      pairs.forEach(([id, vars]) => {
        next[id] = vars;
      });
      setCardVariationMap((prev) => ({ ...prev, ...next }));
      setLoadingVariationIds((prev) => {
        const next = { ...prev };
        variableIds.forEach((id) => { delete next[id]; });
        return next;
      });
    }).catch(() => {
      if (mounted) {
        setLoadingVariationIds((prev) => {
          const next = { ...prev };
          variableIds.forEach((id) => { delete next[id]; });
          return next;
        });
      }
    });

    return () => { mounted = false; };
  }, [pageVariableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCardDisplayProduct = useCallback((product) => {
    if (!product?.is_variable) return product;
    const selectedAttrs = cardVariants[product.id] || {};
    const selectedVariation = findMatchingVariation(cardVariationMap[product.id] || [], selectedAttrs);
    return selectedVariation || product;
  }, [cardVariationMap, cardVariants]);

  const goToPage = (n) => {
    setCurrentPage(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title="Products"
        description="Shop professional drywall tools from TapeTech, Columbia, Asgard, Graco, SurPro and more. Automatic taping tools, finishing tools, mud boxes, and replacement parts."
        canonical="https://drywalltoolbox.com/products"
        schema={buildSiteLinksSearchBoxSchema()}
      />
      <div className="container mx-auto px-4 py-4 pt-6">
        {/* Back to Brands button - shows when brand is selected (moved above header) */}
        {/* Back button — context-aware:
              • Showing product grid with category drill-down → back to category cards
              • Showing category cards → back to brand grid               */}
        {selectedBrands.length > 0 && (
          <div className="mb-6">
            <BackButton
              onClick={selectedDisplayCategory ? resetToCategoryCards : resetToBrandList}
              label={selectedDisplayCategory ? selectedBrands[0] || 'Categories' : 'Brands'}
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Browse our extensive collection of professional drywall tools</p>
        </div>

        {/* Search Bar - Only shown when brand is selected */}
        {selectedBrands.length > 0 && (
          <SearchBar
            placeholder="Search products by name, SKU, or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        )}

        {selectedBrands.length === 0 ? (
          /* ── Brand grid ───────────────────────────────────────────────── */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => {
                  const brandSlug = BRAND_TO_SLUG[brand] || brand;
                  navigate(`/products?brand=${encodeURIComponent(brandSlug)}`);
                  setSelectedBrands([brand]);
                  setSelectedDisplayCategory(null);
                }}
                className="dtb-brand-card"
                aria-label={`Shop ${brand}`}
              >
                {brandLogos[brand] ? (
                  <img
                    src={brandLogos[brand]}
                    alt={`${brand} logo`}
                    style={{
                      height: ['Columbia Taping Tools', 'Graco'].includes(brand)
                        ? 'clamp(5.5rem, 16vw, 8rem)'
                        : 'clamp(4rem, 12vw, 6rem)',
                      width: 'auto',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <span style={{
                    fontWeight: 700,
                    fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)',
                    letterSpacing: '-0.02em',
                    color: '#1f2937',
                    textAlign: 'center',
                    lineHeight: 1.2
                  }}>
                    {brand}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : !selectedDisplayCategory && brandCategoryCards.length > 1 ? (
          /* ── Category cards (brand → category drill-down) ─────────────── */
          <div>
            {/* Brand logo / header */}
            <div className="flex items-center justify-center mb-8">
              {brandLogos[selectedBrands[0]] && (
                <img
                  src={brandLogos[selectedBrands[0]]}
                  alt={`${selectedBrands[0]} logo`}
                  style={{
                    // Columbia and Graco logos are wide/horizontal so need more height to remain visible
                    height: ['Columbia Taping Tools', 'Graco'].includes(selectedBrands[0])
                      ? 'clamp(4.5rem, 15vw, 7rem)'
                      : 'clamp(3.75rem, 13vw, 6rem)',
                    width: 'auto',
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>
            <div className="categories-grid">
              {brandCategoryCards.map((cat, index) => {
                // Count products for this category
                const count = nonPartsProducts.filter(
                  p => selectedBrands.includes(p.brand) && p.display_category === cat.name
                ).length;
                return (
                  <button
                    key={cat.name}
                    className={`category-card${cat.image ? '' : ' category-card--no-image'}`}
                    style={{ animationDelay: `${(index + 1) * 0.07}s` }}
                    onClick={() => {
                      setSelectedDisplayCategory(cat.name);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    aria-label={`Browse ${cat.name}`}
                  >
                    {cat.image && (
                      <img src={cat.image} alt={cat.name} className="category-card-img" />
                    )}
                    <div className="category-card-scrim" />
                    <div className="category-card-content">
                      <div className="category-card-text">
                        <h3 className="category-name">{cat.name}</h3>
                        <span className="category-count">{count} product{count !== 1 ? 's' : ''}</span>
                      </div>
                      <ChevronRight className="category-card-chevron" size={18} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filter Panel - Modern Mobile-First Design */}
            <FilterPanel
              isOpen={showFilters}
              onClose={() => setShowFilters(false)}
              categories={categories}
              brands={brands}
              maxPrice={MAX_PRICE}
              selectedBrands={selectedBrands}
              selectedCategories={selectedCategories}
              priceRange={priceRange}
              onBrandChange={toggleBrand}
              onCategoryChange={toggleCategory}
              onPriceChange={setPriceRange}
              onClearFilters={() => {
                setSelectedBrands([]);
                setSelectedCategories([]);
                setPriceRange([0, MAX_PRICE]);
                navigate('/products');
              }}
              resultsCount={sortedProducts.length}
            />

          {/* Products Grid */}
          <div className="flex-1">
            {/* Sort and Results */}
            <div className="flex flex-row justify-between items-center gap-4 mb-6">
              <SortDropdown
                value={sortBy}
                onChange={(value) => setSortBy(value)}
              />
              {/* Mobile Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 hover:bg-gray-50 font-medium text-sm transition-colors"
                aria-label="Toggle Filters"
              >
                <Filter size={18} />
                <span>Filters</span>
              </button>
            </div>

            {/* Loading State — skeleton grid matches real card layout exactly */}
            {loading ? (
              <ProductSkeletonGrid count={24} />
            ) : (
            <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              {pageProducts.map((product, index) => {
                  const cardProduct = getCardDisplayProduct(product);
                  const hasSelectedVariation = cardProduct.id !== product.id;
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      cardProduct={cardProduct}
                      hasSelectedVariation={hasSelectedVariation}
                      cardVariants={cardVariants[product.id] || {}}
                      onVariantSelect={(attrName, value) => handleVariantSelect(product.id, attrName, value)}
                      isVariationLoading={Boolean(loadingVariationIds[product.id])}
                      onOpenModal={() => openModal(product, hasSelectedVariation ? cardProduct : null)}
                      onAddToCart={() => handleAddToCart(cardProduct, 1)}
                      index={index}
                    />
                  );
              })}
            </div>

            {/* Pagination + results summary */}
            {sortedProducts.length > 0 && (
              <>
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  className="mt-8"
                />
                <p className="text-center text-sm text-gray-400 mt-2">
                  Showing {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, sortedProducts.length)} of{' '}
                  {sortedProducts.length.toLocaleString()} results
                </p>
              </>
            )}

            {/* Empty State */}
            {sortedProducts.length === 0 && (
              <div className="text-center py-16">
                <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-gray-300" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">No products found</h2>
                <p className="text-gray-600 mb-6">Try adjusting your filters to see more products.</p>
                <button
                  onClick={() => {
                    setSelectedBrands([]);
                    setSelectedCategories([]);
                    setPriceRange([0, MAX_PRICE]);
                    navigate('/products');
                  }}
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

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Product Detail Modal */}
      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            key={`${modalProduct.id}:${modalResolvedVariation?.id || 0}`}
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialSelectedAttrs={modalSelectedAttrs}
            initialResolvedVariation={modalResolvedVariation}
            initialVariations={cardVariationMap[modalProduct.id] || []}
          />
        )}
      </ProductModal>
    </div>
  );
}
