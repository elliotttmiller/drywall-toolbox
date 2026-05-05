import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import ProductModal from '../components/ProductModal';
import ProductCard from '../components/ProductCard';
import BackButton from '../components/BackButton';
import SearchBar from '../components/SearchBar';
import Toast from '../components/Toast';
import SortDropdown from '../components/SortDropdown';
import FilterPanel from '../components/FilterPanel';
import Pagination from '../components/Pagination';
import { ProductSkeletonGrid } from '../components/ProductSkeletonCard';
import { getProducts } from '../services/catalog';
import { getProductVariations } from '../services/api';
import { useCart } from '../context/CartContext';
import {
  ShoppingCart,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { findMatchingVariation, fetchVariationsBatched } from '../utils/variationSelection';

// products will be loaded from WooCommerce REST API at runtime
const categories = [
  { id: 'taping',    name: 'Automatic Taping Tools' },
  { id: 'finishing', name: 'Finishing Tools' },
  { id: 'corner',    name: 'Corner Tools' },
  { id: 'mudboxes',  name: 'Mud Boxes & Pumps' },
  { id: 'sanding',   name: 'Sanding Tools' },
  { id: 'parts',     name: 'Parts' },
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
  'Level 5'
];

const MAX_PRICE = 3000;
const ITEMS_PER_PAGE = 24;

export default function AllProducts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // Initialize search query from URL param for deep-linking (e.g. from MobileSearch)
  const urlParams = new URLSearchParams(location.search);
  const searchParam = urlParams.get('search');
  const pageParam = parseInt(urlParams.get('page') || '1', 10);

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState(searchParam ? decodeURIComponent(searchParam) : '');
  const [priceRange, setPriceRange] = useState([0, MAX_PRICE]);
  const [loadingVariationIds, setLoadingVariationIds] = useState({});
  const [sortBy, setSortBy] = useState('popular');
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [showFilters, setShowFilters] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalSelectedAttrs, setModalSelectedAttrs] = useState({});
  const [modalResolvedVariation, setModalResolvedVariation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [cardVariants, setCardVariants] = useState({});
  const [cardVariationMap, setCardVariationMap] = useState({});
  const cardVariationMapRef = useRef({});

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

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

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  // load products once — catalog service fetches from WC REST API
  useEffect(() => {
    let mounted = true;
    getProducts().then(list => {
      if (!mounted) return;
      setProducts(list);
      // Always show every ALLOWED_BRAND in the selector regardless of whether
      // the catalog has products for it yet (e.g. Platinum has no products yet).
      const fromCatalog = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
      const inCatalog = fromCatalog.filter(b => ALLOWED_BRANDS.includes(b));
      const notInCatalog = ALLOWED_BRANDS.filter(b => !inCatalog.includes(b));
      setBrands([...inCatalog, ...notInCatalog]);
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Sync searchQuery to URL for shareable links
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentSearchParam = params.get('search') || '';
    const currentPageParam   = params.get('page')   || '';
    const expectedSearchParam = searchQuery ? encodeURIComponent(searchQuery) : '';
    const expectedPageParam   = currentPage > 1 ? String(currentPage) : '';

    if (currentSearchParam !== expectedSearchParam || currentPageParam !== expectedPageParam) {
      const newParams = new URLSearchParams();
      if (searchQuery)    newParams.set('search', searchQuery);
      if (currentPage > 1) newParams.set('page', String(currentPage));
      const newSearch = newParams.toString();
      navigate(newSearch ? `/all-products?${newSearch}` : '/all-products', { replace: true });
    }
  }, [searchQuery, currentPage, navigate, location.search]);

  // Reset to page 1 when filters or search change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrentPage(1); }, [selectedBrands, selectedCategories, priceRange, searchQuery, sortBy]);

  const filteredProducts = (products || []).filter(product => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) return false;
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

  const totalPages  = Math.max(1, Math.ceil(sortedProducts.length / ITEMS_PER_PAGE));
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * ITEMS_PER_PAGE;
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
        title="All Products"
        description="Browse our complete collection of professional drywall tools and equipment from top brands including TapeTech, Columbia, Asgard, and more."
        canonical="https://drywalltoolbox.com/all-products"
        schema={buildSiteLinksSearchBoxSchema()}
      />
      <div className="container mx-auto px-4 py-8 pt-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">All Products</h1>
          <p className="text-gray-600">Browse our complete collection of professional drywall tools from all brands</p>
        </div>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search products by name, SKU, or brand..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

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
            }}
            resultsCount={sortedProducts.length}
          />

          {/* Products Grid */}
          <div className="flex-1">
            {/* Sort Bar */}
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
