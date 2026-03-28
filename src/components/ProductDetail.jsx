import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Reviews from './Reviews';
import { useCart } from '../context/CartContext';
import { Heart, Plus, Minus, X } from 'lucide-react';
import ProductImageGallery from './ProductImageGallery';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';

const BRAND_LOGOS = {
  'Columbia Taping Tools': columbiaLogo,
  'TapeTech': tapeTechLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo,
};

export default function ProductDetail({ product, onAddToCart, onClose }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeTab, setActiveTab] = useState('description');

  if (!product) return null;

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart(product, quantity);
    } else {
      addToCart(product, quantity);
    }
    try {
      if (typeof onClose === 'function') {
        setTimeout(() => onClose(), 220);
      }
    } catch {
      // ignore
    }
  };

  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => setQuantity(prev => Math.max(1, prev - 1));
  const price = product.price || 0;
  const displayPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);

  return (
    <div className="bg-white rounded-none sm:rounded-xl lg:rounded-2xl shadow-2xl overflow-visible animate-fadeIn w-full max-w-6xl mx-auto h-full sm:max-h-[90vh] flex flex-col relative">
      {/* Close Button - Fixed Position at Top Right */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50 p-2 sm:p-3 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close product detail"
          title="Close"
        >
          <X size={24} className="text-gray-600 hover:text-gray-900" />
        </button>
      )}
      
      {/* Scrollable Content with Custom Scrollbar */}
      <div className="overflow-y-auto overflow-x-hidden custom-scrollbar h-full">
        <div className="p-4 sm:p-6 md:p-8 lg:p-12 pt-16 sm:pt-6 max-w-full">
          {/* Top Section - Image Left, Details Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
            {/* Product Image Gallery */}
            <ProductImageGallery product={product} />

            {/* Product Info - Right Side */}
            <div className="flex flex-col">
              {/* Stock Badge & Brand */}
              <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
                <span className="inline-block px-2.5 py-1 sm:px-3 bg-black text-white text-xs font-semibold rounded">
                  In Stock
                </span>
                <span className="text-xs sm:text-sm text-gray-600">{product.brand}</span>
              </div>

              {/* Product Title */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight pr-8">
                {product.name || product.sku || product.part_number}
              </h1>

              {/* Rating - Placeholder */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 text-xs sm:text-sm">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-gray-500">No reviews yet</span>
                <button className="text-blue-600 hover:underline">Write a Review</button>
              </div>

              {/* Price */}
              <div className="mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl font-bold text-gray-900">${displayPrice}</span>
              </div>

              {/* SKU & UPC */}
              <div className="mb-4 sm:mb-6 space-y-1 text-xs sm:text-sm text-gray-600">
                {product.sku && (
                  <div>
                    <span className="font-medium">SKU:</span> <span className="font-mono text-xs sm:text-sm">{product.sku}</span>
                  </div>
                )}
                {product.upc && (
                  <div>
                    <span className="font-medium">UPC:</span> <span className="font-mono text-xs sm:text-sm">{product.upc}</span>
                  </div>
                )}
              </div>

              {/* Quantity & Add to Cart */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6 items-stretch">
                <div className="flex items-center border border-gray-300 rounded w-full sm:w-auto">
                  <button
                    onClick={decrementQuantity}
                    className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-100 transition-colors flex-1 sm:flex-none"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} className="sm:w-4.5 sm:h-4.5 mx-auto" />
                  </button>
                  <span className="px-4 sm:px-6 py-2 sm:py-3 font-medium text-gray-900 border-x border-gray-300 min-w-12 sm:min-w-15 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={incrementQuantity}
                    className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-100 transition-colors flex-1 sm:flex-none"
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} className="sm:w-4.5 sm:h-4.5 mx-auto" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                >
                  ADD TO CART
                </button>

                {/* Favorite button - hidden on mobile */}
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`hidden md:block p-2.5 sm:p-3 rounded border transition-colors ${
                    isWishlisted
                      ? 'bg-red-50 border-red-300 text-red-600'
                      : 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600'
                  }`}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart size={24} className={isWishlisted ? 'fill-current' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Section - Full Width Tabs */}
          <div className="border-t border-gray-200 pt-4 sm:pt-6 md:pt-8">
            <div className="flex gap-4 sm:gap-6 md:gap-8 border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab('description')}
                className={`pb-2 sm:pb-3 font-semibold text-xs sm:text-sm md:text-base transition-colors relative whitespace-nowrap ${
                  activeTab === 'description'
                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                DESCRIPTION
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-2 sm:pb-3 font-semibold text-xs sm:text-sm md:text-base transition-colors relative whitespace-nowrap ${
                  activeTab === 'reviews'
                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                PRODUCT REVIEWS
              </button>
            </div>

            {/* Tab Content - No Internal Scrollbar */}
            <div className="pb-4 sm:pb-6 md:pb-8">
              {activeTab === 'description' && (
                <div>
                  {BRAND_LOGOS[product.brand] && (
                    <div className="flex justify-center mb-5 sm:mb-6">
                      <img
                        src={BRAND_LOGOS[product.brand]}
                        alt={`${product.brand} logo`}
                        className="h-48 sm:h-64 md:h-80 w-auto object-contain"
                      />
                    </div>
                  )}
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Description</h3>
                  {product.description_full ? (
                    <div className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-table:text-sm prose-th:font-semibold prose-th:text-gray-900 prose-td:text-gray-700">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {product.description_full}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-gray-500">No description available.</p>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div>
                  <Reviews 
                    productId={product.part_number || product.id || product.name} 
                    allowSubmit={true} 
                    filterVerified={false} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 10px;
          transition: background-color 0.3s ease;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.5);
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:active {
          background-color: rgba(156, 163, 175, 0.7);
        }
      `}</style>
    </div>
  );
}
