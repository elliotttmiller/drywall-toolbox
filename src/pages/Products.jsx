import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Filter, 
  SlidersHorizontal,
  Star,
  Heart,
  ChevronDown
} from 'lucide-react';

const products = [
  {
    id: 1,
    name: 'TapeTech 7" Flat Box',
    brand: 'TapeTech',
    category: 'finishing',
    price: 289.99,
    rating: 4.8,
    reviews: 124,
    badge: 'Best Seller',
    image: '/product-placeholder.jpg'
  },
  {
    id: 2,
    name: 'Level5 10" Flat Box',
    brand: 'Level5',
    category: 'finishing',
    price: 319.99,
    rating: 4.9,
    reviews: 98,
    badge: 'Popular',
    image: '/product-placeholder.jpg'
  },
  {
    id: 3,
    name: 'Columbia Automatic Taper',
    brand: 'Columbia',
    category: 'taping',
    price: 549.99,
    rating: 4.7,
    reviews: 76,
    badge: 'New',
    image: '/product-placeholder.jpg'
  },
  {
    id: 4,
    name: 'Delko Banjo Taper',
    brand: 'Delko',
    category: 'taping',
    price: 189.99,
    rating: 4.6,
    reviews: 145,
    image: '/product-placeholder.jpg'
  },
  {
    id: 5,
    name: 'Kraft Corner Bead Roller',
    brand: 'Kraft',
    category: 'corner',
    price: 79.99,
    rating: 4.5,
    reviews: 89,
    image: '/product-placeholder.jpg'
  },
  {
    id: 6,
    name: 'Can-Am Angle Box',
    brand: 'Can-Am',
    category: 'corner',
    price: 199.99,
    rating: 4.8,
    reviews: 67,
    badge: 'Sale',
    image: '/product-placeholder.jpg'
  },
  {
    id: 7,
    name: 'TapeTech Power Sander',
    brand: 'TapeTech',
    category: 'sanding',
    price: 899.99,
    rating: 4.9,
    reviews: 234,
    badge: 'Best Seller',
    image: '/product-placeholder.jpg'
  },
  {
    id: 8,
    name: 'Drywall Master Mud Box',
    brand: 'Drywall Master',
    category: 'mudboxes',
    price: 1299.99,
    rating: 4.7,
    reviews: 54,
    image: '/product-placeholder.jpg'
  },
  {
    id: 9,
    name: 'Level5 4" Corner Finisher',
    brand: 'Level5',
    category: 'corner',
    price: 159.99,
    rating: 4.6,
    reviews: 112,
    image: '/product-placeholder.jpg'
  },
  {
    id: 10,
    name: 'Columbia Mud Pump',
    brand: 'Columbia',
    category: 'mudboxes',
    price: 2199.99,
    rating: 4.8,
    reviews: 43,
    badge: 'Popular',
    image: '/product-placeholder.jpg'
  },
  {
    id: 11,
    name: 'Goldblatt Taping Knife Set',
    brand: 'Goldblatt',
    category: 'finishing',
    price: 149.99,
    rating: 4.5,
    reviews: 189,
    image: '/product-placeholder.jpg'
  },
  {
    id: 12,
    name: 'Marshalltown Hand Sander',
    brand: 'Marshalltown',
    category: 'sanding',
    price: 39.99,
    rating: 4.4,
    reviews: 267,
    image: '/product-placeholder.jpg'
  }
];

const brands = ['TapeTech', 'Level5', 'Columbia', 'Delko', 'Can-Am', 'Kraft', 'Drywall Master', 'Goldblatt', 'Marshalltown'];
const categories = [
  { id: 'taping', name: 'Automatic Taping' },
  { id: 'finishing', name: 'Finishing Tools' },
  { id: 'corner', name: 'Corner Tools' },
  { id: 'mudboxes', name: 'Mud Boxes & Pumps' },
  { id: 'sanding', name: 'Sanding Tools' }
];

export default function Products() {
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 3000]);
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);

  const toggleBrand = (brand) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const filteredProducts = products.filter(product => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) return false;
    if (product.price < priceRange[0] || product.price > priceRange[1]) return false;
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Browse our extensive collection of professional drywall tools</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-24">
              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden w-full flex items-center justify-between gap-2 bg-white px-4 py-3 rounded-lg shadow-md mb-4 border border-gray-200"
              >
                <span className="flex items-center gap-2 font-semibold text-gray-900">
                  <Filter size={20} />
                  Filters
                </span>
                <ChevronDown
                  size={20}
                  className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Filters */}
              <div className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                {/* Categories */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <SlidersHorizontal size={18} />
                    Categories
                  </h3>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Brands */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Brands</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {brands.map(brand => (
                      <label key={brand} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand)}
                          onChange={() => toggleBrand(brand)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{brand}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>${priceRange[0]}</span>
                      <span>${priceRange[1]}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      step="50"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {(selectedBrands.length > 0 || selectedCategories.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedBrands([]);
                      setSelectedCategories([]);
                      setPriceRange([0, 3000]);
                    }}
                    className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Sort and Results */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <p className="text-gray-600">
                Showing <span className="font-semibold text-gray-900">{sortedProducts.length}</span> products
              </p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProducts.map(product => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-200 hover:border-primary-300 hover:-translate-y-1"
                >
                  {/* Product Image */}
                  <div className="relative bg-gray-100 aspect-square overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <ShoppingCart size={48} />
                    </div>
                    {product.badge && (
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white ${
                        product.badge === 'Best Seller' ? 'bg-accent-500' :
                        product.badge === 'Popular' ? 'bg-primary-600' :
                        product.badge === 'New' ? 'bg-green-500' :
                        'bg-red-500'
                      }`}>
                        {product.badge}
                      </div>
                    )}
                    <button className="absolute top-3 right-3 p-2 bg-white/90 rounded-full hover:bg-white transition-colors opacity-0 group-hover:opacity-100">
                      <Heart size={18} className="text-gray-600 hover:text-red-500 transition-colors" />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-5">
                    <p className="text-xs text-gray-500 mb-1">{product.brand}</p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                      {product.name}
                    </h3>
                    
                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-400 fill-current" />
                        <span className="text-sm font-medium text-gray-700">{product.rating}</span>
                      </div>
                      <span className="text-xs text-gray-500">({product.reviews} reviews)</span>
                    </div>

                    {/* Price and Add to Cart */}
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-primary-600">
                        ${product.price}
                      </p>
                      <button className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
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
                    setPriceRange([0, 3000]);
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
    </div>
  );
}
