import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import BackButton from '../components/BackButton';
import SearchBar from '../components/SearchBar';
import Toast from '../components/Toast';
import SortDropdown from '../components/SortDropdown';
import FilterPanel from '../components/FilterPanel';
import { X } from 'lucide-react';
import { loadProducts } from '../data/products';
import { getProducts as wcGetProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import { 
  ShoppingCart, 
  Filter, 
  SlidersHorizontal,
  Heart
} from 'lucide-react';

// products will be loaded from CSV at runtime
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
  'Graco'
];

const MAX_PRICE = 3000;

export default function AllProducts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // Initialize search query from URL param for deep-linking (e.g. from MobileSearch)
  const urlParams = new URLSearchParams(location.search);
  const searchParam = urlParams.get('search');

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState(searchParam ? decodeURIComponent(searchParam) : '');
  const [priceRange, setPriceRange] = useState([0, MAX_PRICE]);
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  const openModal = (product) => {
    setModalProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  // close on escape
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

  // load products once — prefer WooCommerce API, fall back to CSV
  useEffect(() => {
    let mounted = true;
    const loader = process.env.REACT_APP_WC_BASE_URL
      ? wcGetProducts()
      : loadProducts();
    loader.then(list => {
      if (!mounted) return;
      setProducts(list);
      const unique = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
      const filteredBrands = unique.filter(brand => ALLOWED_BRANDS.includes(brand));
      setBrands(filteredBrands);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Sync searchQuery to URL for shareable links
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentSearchParam = params.get('search') || '';
    const expectedSearchParam = searchQuery ? encodeURIComponent(searchQuery) : '';

    if (currentSearchParam !== expectedSearchParam) {
      const newParams = new URLSearchParams();
      if (searchQuery) newParams.set('search', searchQuery);
      const newSearch = newParams.toString();
      navigate(newSearch ? `/all-products?${newSearch}` : '/all-products', { replace: true });
    }
  }, [searchQuery, navigate, location.search]);

  const filteredProducts = (products || []).filter(product => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) return false;
    // price may not exist in CSV; ignore if missing
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
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
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

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              {sortedProducts.map(product => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group border border-gray-100 hover:border-primary-300 flex flex-col h-full"
                >
                  {/* Product Image Container */}
                  <div className="relative bg-gray-50 aspect-square overflow-hidden shrink-0">
                    <button 
                      onClick={() => openModal(product)} 
                      className="absolute inset-0 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors w-full h-full"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="object-contain w-full h-full p-2 sm:p-3"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/product-placeholder.jpg'; }}
                        />
                      ) : (
                        <div className="text-gray-300"><ShoppingCart size={40} /></div>
                      )}
                    </button>
                    
                    {/* Badge */}
                    {product.badge && (
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-semibold text-white ${
                        product.badge === 'Best Seller' ? 'bg-accent-500' :
                        product.badge === 'Popular' ? 'bg-primary-600' :
                        product.badge === 'New' ? 'bg-green-500' :
                        'bg-red-500'
                      }`}>
                        {product.badge}
                      </div>
                    )}
                    
                    {/* Wishlist Button */}
                    <button className="absolute top-2 right-2 p-1.5 bg-white/95 rounded-full hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-md">
                      <Heart size={16} className="text-gray-500 hover:text-red-500 transition-colors" />
                    </button>
                  </div>

                  {/* Product Info - Grows to fill available space */}
                  <div className="p-3 sm:p-4 flex flex-col grow">
                    {/* Brand */}
                    <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">{product.brand}</p>
                    
                    {/* Title */}
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors grow">
                      <button onClick={() => openModal(product)} className="block text-left w-full hover:text-primary-600">
                        {product.name || product.part_number}
                      </button>
                    </h3>
                    
                    {/* SKU/UPC - Mobile optimized */}
                    <div className="flex flex-wrap gap-2 mb-3 text-xs text-gray-500">
                      {product.sku && (
                        <span className="truncate">SKU: {product.sku}</span>
                      )}
                      {product.upc && (
                        <span className="truncate">UPC: {product.upc}</span>
                      )}
                    </div>

                    {/* Price and Add to Cart */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                      <p className="text-lg sm:text-xl font-bold text-gray-900 shrink-0">
                        ${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || 0).toFixed(2)}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product, 1);
                        }}
                        className="shrink-0 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all hover:scale-110 active:scale-95"

                      >
                        <ShoppingCart size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

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
      {isModalOpen && modalProduct && (
        <div className="fixed inset-0 z-1100 flex items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          {/* Close Button - Direct child of fixed modal wrapper to avoid stacking context issues */}
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
