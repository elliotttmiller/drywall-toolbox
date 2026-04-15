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
import SortDropdown from '../components/SortDropdown';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import { ShoppingCart, Filter, Heart, Wrench } from 'lucide-react';
import FilterPanel from '../components/FilterPanel';
import { getProducts } from '../services/catalog';
import { useCart } from '../context/CartContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCardImage from '../components/ProductCardImage';
import SEOHead from '../components/SEOHead';
import { buildBreadcrumbSchema } from '../utils/schema';

// Brands that carry repair-kit / parts items in the catalog
const PARTS_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Asgard',
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
  'Graco':                 'graco',
  'Platinum Drywall Tools': 'platinum',
  'Dura-Stilts':           'dura-stilts',
};
const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries(BRAND_TO_SLUG).map(([name, slug]) => [slug, name])
);

const ITEMS_PER_PAGE = 24;

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
  const [searchQuery, setSearchQuery]   = useState(decodeURIComponent(searchParam));
  const [sortBy, setSortBy]             = useState('popular');
  const [currentPage, setCurrentPage]   = useState(pageParam);
  const [showFilters, setShowFilters]   = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [toast, setToast]               = useState(null);

  // ── Load parts products ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    getProducts().then(list => {
      if (!mounted) return;
      const parts = list.filter(p => p.is_parts);
      setAllParts(parts);
      // Always show every PARTS_BRAND in the filter regardless of whether
      // the catalog has parts for it yet (e.g. Platinum has no products yet).
      const unique = Array.from(new Set(parts.map(p => p.brand).filter(Boolean)));
      const inCatalog = PARTS_BRANDS.filter(b => unique.includes(b));
      const notInCatalog = PARTS_BRANDS.filter(b => !unique.includes(b));
      setBrands([...inCatalog, ...notInCatalog]);
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleBrand = (brand) =>
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );

  const clearFilters = () => {
    setSelectedBrands([]);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const openModal  = (product) => { setModalProduct(product); setIsModalOpen(true); };
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
    if (searchQuery)                p.set('search', encodeURIComponent(searchQuery));
    if (currentPage > 1)            p.set('page', String(currentPage));
    const qs = p.toString();
    navigate(qs ? `/parts?${qs}` : '/parts', { replace: true });
  }, [selectedBrands, searchQuery, currentPage, navigate]);

  // ── Reset to page 1 when filters / search change ──────────────────────────
  // This is an appropriate use case for setState in effect - reset pagination when filters change
  // eslint-disable-next-line
  useEffect(() => { setCurrentPage(1); }, [selectedBrands, searchQuery]);

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
        (p.name  || '').toLowerCase().includes(q) ||
        (p.sku   || '').toLowerCase().includes(q) ||
        (p.upc   || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
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
          <p className="text-gray-600">
            Genuine repair kits, replacement parts, and accessories for professional
            drywall finishing tools.
          </p>
        </div>

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <SearchBar
          placeholder="Search parts by name, SKU, or brand…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                <SortDropdown value={sortBy} onChange={setSortBy} />
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
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-100 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Product grid */}
            {!loading && paginated.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                  {paginated.map(product => (
                    <div
                      key={product.id}
                      className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group border border-gray-100 hover:border-primary-300 flex flex-col h-full"
                    >
                      {/* Image */}
                      <div className="relative bg-gray-50 aspect-square overflow-hidden shrink-0">
                        <button
                          onClick={() => openModal(product)}
                          className="absolute inset-0 w-full h-full"
                        >
                          <ProductCardImage
                            src={product.image}
                            alt={product.name}
                            padding="8px"
                          />
                        </button>

                        {/* Wishlist hint */}
                        <button className="absolute top-2 right-2 p-1.5 bg-white/95 rounded-full hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-md">
                          <Heart size={16} className="text-gray-500 hover:text-red-500 transition-colors" />
                        </button>
                      </div>

                      {/* Info */}
                      <div className="p-3 sm:p-4 flex flex-col grow">
                        <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                          {product.brand}
                        </p>
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors grow">
                          <button
                            onClick={() => openModal(product)}
                            className="block text-left w-full hover:text-primary-600"
                          >
                            {product.name || product.sku}
                          </button>
                        </h3>

                        <div className="flex flex-wrap gap-1.5 mb-3 text-xs text-gray-500">
                          {product.sku && <span>SKU: {product.sku}</span>}
                          {product.upc && <span className="hidden sm:inline">UPC: {product.upc}</span>}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                          <p className="text-base sm:text-lg font-bold text-gray-900 shrink-0">
                            {product.price > 0
                              ? `$${parseFloat(product.price).toFixed(2)}`
                              : <span className="text-sm font-normal text-gray-400">Call for price</span>
                            }
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddToCart(product, 1); }}
                            className="shrink-0 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all hover:scale-110 active:scale-95"
                          >
                            <ShoppingCart size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
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
          <ProductDetail product={modalProduct} onAddToCart={handleAddToCart} onClose={closeModal} />
        )}
      </ProductModal>
    </div>
  );
}
