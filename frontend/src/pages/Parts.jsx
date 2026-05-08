/**
 * frontend/src/pages/Parts.jsx
 *
 * Replacement Parts shop — shows only the repair kits / parts items from
 * the WooCommerce catalog (products whose `is_parts` flag is true).
 *
 * Includes:
 *   • Brand filter chips (TapeTech, Columbia, Asgard, Graco)
 *   • Full-text search (name, SKU, UPC, brand)
 *   • Sort dropdown (popular, price ↑, price ↓)
 *   • Responsive product grid (2–4 columns)
 *   • Pagination (24 per page)
 *   • Quick-view product detail modal
 *   • Add-to-cart with toast notification
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import ProductModal from '../components/ProductModal';
import SearchBar from '../components/SearchBar';
import Dropdown from '../components/ui/Dropdown';
import { SORT_OPTIONS } from '../constants/sortOptions';
import Toast from '../components/ui/Toast';
import Pagination from '../components/Pagination';
import { Filter, Wrench } from 'lucide-react';
import FilterPanel from '../components/FilterPanel';
import { getProducts } from '../services/catalog';
import { getProductVariations } from '../services/api';
import { fetchVariationsBatched } from '../utils/variationSelection';
import { useCart } from '../context/CartContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductShoppingCard from '../components/ui/ProductShoppingCard';
import { ProductSkeletonGrid } from '../components/ProductSkeletonCard';
import SEOHead from '../components/SEOHead';
import { buildBreadcrumbSchema } from '../utils/schema';

// Brands that carry parts in the production WooCommerce catalog
const PARTS_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Asgard',
  'Level 5',
  'Graco',
  'Platinum Drywall Tools',
  'Dura-Stilts',
];

// Brand name ↔ URL slug maps so navigation produces readable URLs like
// /parts?brand=columbia-taping-tools&search=handle
const BRAND_TO_SLUG = {
  'TapeTech':              'tapetech',
  'Columbia Taping Tools': 'columbia-taping-tools',
  'Asgard':                'asgard',
  'Level 5':               'level-5',
  'Graco':                 'graco',
  'Platinum Drywall Tools': 'platinum',
  'Dura-Stilts':           'dura-stilts',
};
const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries(BRAND_TO_SLUG).map(([name, slug]) => [slug, name])
);

const ITEMS_PER_PAGE = 24;


// Strict production-catalog parts taxonomy guard:
// only include products whose canonical leaf category is "Parts".
const PARTS_LEAF_NAMES = new Set([
  'parts',
]);

const PARTS_SLUG_PREFIXES = [
  'parts',
];

function isStrictPartProduct(product) {
  if (!product?.is_parts) return false;

  // Fast path when normalized category is already explicitly "parts".
  if (String(product.category || '').toLowerCase() === 'parts') return true;

  // Fallback: inspect raw WC categories for a true parts leaf/prefix.
  const categories = Array.isArray(product.categories) ? product.categories : [];
  return categories.some((cat) => {
    const name = String(cat?.name || '').toLowerCase().trim();
    const slug = String(cat?.slug || '').toLowerCase().trim();
    return PARTS_LEAF_NAMES.has(name) || PARTS_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
  });
}

export default function Parts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // Read URL params for deep-linking
  const urlParams   = new URLSearchParams(location.search);
  const searchParam = urlParams.get('search') || '';
  const brandParam  = urlParams.get('brand')  || '';
  const pageParam   = parseInt(urlParams.get('page') || '1', 10);

  const [allParts, setAllParts]         = useState([]);
  const [brands, setBrands]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedBrands, setSelectedBrands] = useState(() => {
    // Decode brand slugs from URL params back to full brand names
    if (!brandParam) return [];
    return brandParam
      .split(',')
      .map(slug => slug.trim())
      .map(slug => SLUG_TO_BRAND[slug] || slug)  // Convert slug to full name, keep unknown names as-is for backward-compat
      .filter(b => PARTS_BRANDS.includes(b));
  });
  const [searchQuery, setSearchQuery]   = useState(searchParam);
  const [sortBy, setSortBy]             = useState('popular');
  const [currentPage, setCurrentPage]   = useState(pageParam);
  const [showFilters, setShowFilters]   = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [toast, setToast]               = useState(null);
  const [cardVariationMap, setCardVariationMap] = useState({});

  // ── Load parts products ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    getProducts().then(list => {
      if (!mounted) return;

      const parts = list.filter(isStrictPartProduct);

      // Simple / already-resolved variation products show immediately.
      // Variable parents are placeholders until their variations are loaded.
      const simpleParts    = parts.filter(p => !p.is_variable);
      const variableParents = parts.filter(p => p.is_variable);

      // Show whatever we have right away so the page isn't blank.
      setAllParts([...simpleParts, ...variableParents]);

      // Always show every PARTS_BRAND in the filter regardless of whether
      // the catalog has parts for it yet (e.g. Platinum has no products yet).
      const unique = Array.from(new Set(parts.map(p => p.brand).filter(Boolean)));
      const inCatalog    = PARTS_BRANDS.filter(b =>  unique.includes(b));
      const notInCatalog = PARTS_BRANDS.filter(b => !unique.includes(b));
      setBrands([...inCatalog, ...notInCatalog]);
      setLoading(false);

      // ── Expand variable parents into individual variation cards ────────────
      // WooCommerce's /products endpoint never returns variation-type children;
      // they must be fetched separately.  We replace each variable parent with
      // its individual variation children so that every part SKU is searchable
      // and directly add-to-cart-able on this page.
      if (variableParents.length === 0) return;

      const variableIds = variableParents.map(p => p.id);

      fetchVariationsBatched(variableIds, getProductVariations)
        .then(pairs => {
          if (!mounted) return;

          // Build a lookup: parentId → parent product (for brand/category fallback)
          const parentById = Object.fromEntries(
            variableParents.map(p => [String(p.id), p])
          );

          // Flatten all fetched variations, inheriting parent meta where needed.
          const fetchedVariations = pairs.flatMap(([parentId, vars]) => {
            const parent = parentById[String(parentId)];
            return (Array.isArray(vars) ? vars : []).map(v => ({
              ...v,
              is_parts:   true,
              brand:      v.brand      || parent?.brand      || '',
              categories: v.categories?.length
                ? v.categories
                : (parent?.categories || []),
            }));
          });

          if (fetchedVariations.length === 0) return;

          setAllParts(prev => {
            // Drop variable parents whose variations have arrived; keep any
            // whose fetch yielded nothing (so the page isn't left empty).
            const expandedParentIds = new Set(
              pairs
                .filter(([, vars]) => Array.isArray(vars) && vars.length > 0)
                .map(([id]) => String(id))
            );
            const withoutExpandedParents = prev.filter(
              p => !(p.is_variable && expandedParentIds.has(String(p.id)))
            );
            // Deduplicate by id in case a variation was already in the list.
            const existingIds = new Set(withoutExpandedParents.map(p => p.id));
            const newVars = fetchedVariations.filter(v => !existingIds.has(v.id));
            return [...withoutExpandedParents, ...newVars];
          });

          // Cache variations for the modal so ProductDetail gets initialVariations
          // without a cold fetch (covers variable parents still visible during loading).
          const varMap = {};
          pairs.forEach(([parentId, vars]) => {
            if (Array.isArray(vars) && vars.length > 0) varMap[String(parentId)] = vars;
          });
          if (Object.keys(varMap).length > 0) {
            setCardVariationMap(prev => ({ ...prev, ...varMap }));
          }
        })
        .catch(() => { /* variations are non-critical; parents stay visible */ });
    }).catch(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleBrand = (brand) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
    setCurrentPage(1); // Reset page when brand filter changes
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSearchQuery('');
    setCurrentPage(1); // Reset page when filters are cleared
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset page when search query changes
  };

  const openModal  = useCallback((product) => { setModalProduct(product); setIsModalOpen(true); }, []);
  const closeModal = useCallback(() => { setIsModalOpen(false); setModalProduct(null); }, []);

  // ── Escape key closes modal ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  // ── Sync state → URL (brand, search, page) ────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (selectedBrands.length > 0) {
      const brandSlugs = selectedBrands.map(b => BRAND_TO_SLUG[b] || b);
      p.set('brand', brandSlugs.join(','));
    }
  // Removed the useEffect for resetting the page
    if (currentPage > 1)            p.set('page', String(currentPage));
    const qs = p.toString();
    navigate(qs ? `/parts?${qs}` : '/parts', { replace: true });
  }, [selectedBrands, searchQuery, currentPage, navigate]);

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    setToast({ message: `${product.name} added to cart!`, type: 'cart' });
  };

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = allParts.filter(p => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (p.name        || '').toLowerCase().includes(q) ||
        (p.sku         || '').toLowerCase().includes(q) ||
        (p.part_number || '').toLowerCase().includes(q) ||
        (p.upc         || '').toLowerCase().includes(q) ||
        (p.brand       || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-low')  return (a.price || 0) - (b.price || 0);
    if (sortBy === 'price-high') return (b.price || 0) - (a.price || 0);
    return 0;
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * ITEMS_PER_PAGE;
  const paginated   = sorted.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const goToPage = (n) => {
    setCurrentPage(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title="Replacement Parts"
        description="Genuine repair kits, replacement parts, and accessories for professional drywall finishing tools. Shop TapeTech, Columbia, Asgard, Graco, and other parts."
        canonical="https://drywalltoolbox.com/parts"
        schema={buildBreadcrumbSchema([
          { label: 'Home',  path: '/'      },
          { label: 'Parts', path: '/parts' },
        ])}
      />
      <div className="container mx-auto px-4 py-8 pt-12">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-gray-900">Replacement Parts</h1>
          </div>
        <SearchBar
          placeholder="Search parts by name, SKU, or brand…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Filter Panel ─────────────────────────────────────────────── */}
          <FilterPanel
            isOpen={showFilters}
            onClose={() => setShowFilters(false)}
            categories={[]}
            brands={brands}
            maxPrice={0}
            selectedBrands={selectedBrands}
            selectedCategories={[]}
            priceRange={[0, 0]}
            onBrandChange={toggleBrand}
            onCategoryChange={() => {}}
            onPriceChange={() => {}}
            onClearFilters={clearFilters}
            resultsCount={sorted.length}
          />

          {/* ── Right: product grid ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Sort bar + mobile filter toggle */}
            <div className="flex flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Dropdown value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
                <span className="hidden sm:inline text-sm text-gray-500">
                  {loading
                    ? <LoadingSpinner size="sm" label="Loading parts" />
                    : `${sorted.length.toLocaleString()} part${sorted.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                <Filter size={16} />
                <span>
                  Brands
                  {selectedBrands.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-bold">
                      {selectedBrands.length}
                    </span>
                  )}
                </span>
              </button>
            </div>

            {/* Loading skeleton */}
            {loading && <ProductSkeletonGrid count={24} />}

            {/* Product grid */}
            {!loading && paginated.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                  {paginated.map((product, index) => (
                    <ProductShoppingCard
                      key={product.id}
                      product={product}
                      cardProduct={product}
                      hasSelectedVariation={false}
                      onOpenModal={() => openModal(product)}
                      onAddToCart={() => handleAddToCart(product, 1)}
                      index={index}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  className="mt-8"
                />

                {/* Results summary */}
                <p className="text-center text-sm text-gray-400 mt-2">
                  Showing {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, sorted.length)} of{' '}
                  {sorted.length.toLocaleString()} results
                </p>
              </>
            )}

            {/* Empty state */}
            {!loading && paginated.length === 0 && (
              <div className="text-center py-16">
                <Wrench className="h-20 w-20 mx-auto mb-6 text-gray-200" />
                <h2 className="text-2xl font-bold text-gray-900 mb-3">No parts found</h2>
                <p className="text-gray-500 mb-6">Try adjusting your search or brand filter.</p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Product detail modal */}
      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            key={modalProduct.id}
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialVariations={cardVariationMap[String(modalProduct.id)] || []}
          />
        )}
      </ProductModal>
      </div>
    </div>
  );
}
