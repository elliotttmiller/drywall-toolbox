import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import BackButton from '../components/BackButton';
import SearchBar from '../components/SearchBar';
import SortDropdown from '../components/SortDropdown';
import FilterPanel from '../components/FilterPanel';
import Toast from '../components/Toast';
import { X } from 'lucide-react';
import { loadProducts } from '../data/products';
import { useCart } from '../context/CartContext';
import { 
  ShoppingCart, 
  Filter, 
  Heart
} from 'lucide-react';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';

// products will be loaded from CSV at runtime
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
  'Graco'
];

const MAX_PRICE = 3000;

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo
};

export default function Products() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // initialize selected brands from ?brand= param (supports comma-separated)
  const params = new URLSearchParams(location.search);
  const brandParam = params.get('brand');
  const searchParam = params.get('search');
  const initialSelectedBrands = brandParam 
    ? brandParam.split(',').map(b => b.trim()).filter(Boolean).filter(brand => ALLOWED_BRANDS.includes(brand))
    : [];

  const [selectedBrands, setSelectedBrands] = useState(initialSelectedBrands);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
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

  const resetToBrandList = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setPriceRange([0, MAX_PRICE]);
    navigate('/products');
  };

  // load products once
  useEffect(() => {
    let mounted = true;
    loadProducts().then(list => {
      if (!mounted) return;
      setProducts(list);
      const unique = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
      const filteredBrands = unique.filter(brand => ALLOWED_BRANDS.includes(brand));
      setBrands(filteredBrands);
    }).catch(() => {});
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

  // Sync state (brands + search) to URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentBrandParam = params.get('brand') || '';
    const currentSearchParam = params.get('search') || '';

    const expectedBrandParam = selectedBrands.length > 0 
      ? selectedBrands.map(b => encodeURIComponent(b)).join(',')
      : '';
    const expectedSearchParam = searchQuery ? encodeURIComponent(searchQuery) : '';

    // Only navigate if URL needs to change
    if (currentBrandParam !== expectedBrandParam || currentSearchParam !== expectedSearchParam) {
      const newParams = new URLSearchParams();
      if (selectedBrands.length > 0) newParams.set('brand', expectedBrandParam);
      if (searchQuery) newParams.set('search', expectedSearchParam);
      const newSearch = newParams.toString();
      navigate(newSearch ? `/products?${newSearch}` : '/products', { replace: true });
    }
  }, [selectedBrands, searchQuery, navigate, location.search]);

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

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
      <div className="container mx-auto px-4 py-4 pt-6">
        {/* Back to Brands button - shows when brand is selected (moved above header) */}
        {selectedBrands.length > 0 && (
          <div className="mb-6">
            <BackButton 
              onClick={resetToBrandList}
              label="Brands"
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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => {
                  navigate(`/products?brand=${encodeURIComponent(brand)}`);
                  setSelectedBrands([brand]);
                }}
                style={{
                  background: 'white',
                  borderRadius: '0.5rem',
                  padding: 'clamp(1rem, 4vw, 1.5rem)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: '1px solid rgb(229, 231, 235)',
                  transition: 'all 0.3s ease-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '1 / 1',
                  cursor: 'pointer'
                }}
                className="brand-card-products"
                onMouseEnter={(e) => {
                  if (window.innerWidth > 768) {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (window.innerWidth > 768) {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                  }
                }}
              >
                <img 
                  src={brandLogos[brand]} 
                  alt={`${brand} logo`}
                  style={{
                    height: 'clamp(4rem, 12vw, 6rem)',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </button>
            ))}
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
                    navigate('/products');
                  }}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              </div>
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
