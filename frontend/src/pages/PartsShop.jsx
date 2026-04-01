/**
 * frontend/src/pages/PartsShop.jsx
 *
 * Replacement Parts shop — shows only the repair kits / parts items from
 * the WooCommerce catalog (products whose `is_parts` flag is true).
 *
 * Includes:
 *   • Brand filter chips (TapeTech, Columbia, Asgard, Level5, Graco)
 *   • Full-text search (name, SKU, UPC, brand)
 *   • Sort dropdown (popular, price ↑, price ↓)
 *   • Responsive product grid (2–4 columns)
 *   • Pagination (24 per page)
 *   • Quick-view product detail modal
 *   • Add-to-cart with toast notification
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import SearchBar from '../components/SearchBar';
import SortDropdown from '../components/SortDropdown';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import { X, ShoppingCart, Filter, Heart, Wrench } from 'lucide-react';
import { getProducts } from '../services/catalog';
import { useCart } from '../context/CartContext';

// Brands that carry repair-kit / parts items in the catalog
const PARTS_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Asgard',
  'Level5',
  'Graco',
];

const ITEMS_PER_PAGE = 24;

export default function PartsShop() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // Read URL params for deep-linking
  const urlParams   = new URLSearchParams(location.search);
  const searchParam = urlParams.get('search') || '';
  const brandParam  = urlParams.get('brand')  || '';
  const pageParam   = parseInt(urlParams.get('page') || '1', 10);

  const [allParts, setAllParts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedBrands, setSelectedBrands] = useState(
    brandParam ? brandParam.split(',').map(b => b.trim()).filter(b => PARTS_BRANDS.includes(b)) : []
  );
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
    setLoading(true);
    getProducts().then(list => {
      if (!mounted) return;
      setAllParts(list.filter(p => p.is_parts));
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // ── Escape key closes modal ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Sync state → URL (brand, search, page) ────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (selectedBrands.length > 0) p.set('brand', selectedBrands.join(','));
    if (searchQuery)                p.set('search', encodeURIComponent(searchQuery));
    if (currentPage > 1)            p.set('page', String(currentPage));
    const qs = p.toString();
    navigate(qs ? `/parts-shop?${qs}` : '/parts-shop', { replace: true });
  }, [selectedBrands, searchQuery, currentPage, navigate]);

  // ── Reset to page 1 when filters / search change ──────────────────────────
  useEffect(() => { setCurrentPage(1); }, [selectedBrands, searchQuery, sortBy]);

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
  const closeModal = ()        => { setIsModalOpen(false); setModalProduct(null); };

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

  // ── Available brands from loaded parts (respect PARTS_BRANDS order) ───────
  const availableBrands = PARTS_BRANDS.filter(b => allParts.some(p => p.brand === b));

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <div className="container mx-auto px-4 py-8 pt-12">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Wrench size={28} className="text-primary-600" />
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

          {/* ── Left: brand filter sidebar ───────────────────────────────── */}
          <aside
            className={[
              'lg:w-56 shrink-0',
              showFilters ? 'block' : 'hidden lg:block',
            ].join(' ')}
          >
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Brand
                </h2>
                {selectedBrands.length > 0 && (
                  <button
                    onClick={() => setSelectedBrands([])}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              <ul className="space-y-1">
                {availableBrands.map(brand => {
                  const active = selectedBrands.includes(brand);
                  const count  = allParts.filter(p => p.brand === brand).length;
                  return (
                    <li key={brand}>
                      <button
                        onClick={() => toggleBrand(brand)}
                        className={[
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                          active
                            ? 'bg-primary-600 text-white font-semibold'
                            : 'text-gray-700 hover:bg-gray-100',
                        ].join(' ')}
                      >
                        <span>{brand}</span>
                        <span className={[
                          'text-xs font-medium rounded-full px-1.5 py-0.5',
                          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
                        ].join(' ')}>
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {(selectedBrands.length > 0 || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="mt-4 w-full text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </aside>

          {/* ── Right: product grid ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Sort bar + mobile filter toggle */}
            <div className="flex flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <SortDropdown value={sortBy} onChange={setSortBy} />
                <span className="hidden sm:inline text-sm text-gray-500">
                  {loading ? 'Loading…' : `${sorted.length.toLocaleString()} part${sorted.length !== 1 ? 's' : ''}`}
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
                          className="absolute inset-0 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors w-full h-full"
                        >
                          {product.image && product.image !== '/product-placeholder.jpg' ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="object-contain w-full h-full p-2 sm:p-3"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/product-placeholder.jpg';
                              }}
                            />
                          ) : (
                            <div className="text-gray-200">
                              <Wrench size={40} />
                            </div>
                          )}
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
      {isModalOpen && modalProduct && (
        <div className="fixed inset-0 z-1100 flex items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <button
            onClick={closeModal}
            className="fixed top-4 right-4 sm:absolute sm:top-4 sm:right-4 z-1120 p-2.5 sm:p-2 bg-white rounded-full shadow-xl hover:bg-gray-100 transition-colors border border-gray-200"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
          <div className="relative z-10 w-full h-full sm:h-auto max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-6xl mx-auto">
            <div onClick={(e) => e.stopPropagation()} className="h-full overflow-x-hidden">
              <ProductDetail product={modalProduct} onAddToCart={handleAddToCart} onClose={closeModal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
