import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Reviews from './Reviews';
import TechnicalSpecifications from './TechnicalSpecifications';
import { useCart } from '../context/CartContext';
import { Heart, Plus, Minus, X, ShoppingCart } from 'lucide-react';
import ProductImageGallery from './ProductImageGallery';
import { getProductSpecifications } from '../utils/productSpecifications';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import { getSchematicIdForProduct, buildSchematicsUrl } from '../data/schematicMappings';

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

  // Lock body scroll while this detail panel is mounted
  useEffect(() => {
    if (!product) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [product]);

  if (!product) return null;

  // Determine if this product has a matching schematic diagram
  const schematicId = getSchematicIdForProduct(product);
  const partsUrl = schematicId ? buildSchematicsUrl(schematicId) : null;

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
    <div
      className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl mx-auto flex flex-col relative"
    >
      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close product detail"
          title="Close"
        >
          <X size={20} className="text-gray-600 hover:text-gray-900" />
        </button>
      )}

      {/* Scrollable Content */}
      <div className="overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="p-4 sm:p-6 md:p-8 lg:p-12 max-w-full">
          {/* Top Section — Image left, details right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
            {/* Product Image Gallery */}
            <ProductImageGallery product={product} />

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Stock Badge & Brand */}
              <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
                <span className={`inline-block px-2.5 py-1 sm:px-3 text-white text-xs font-semibold rounded ${
                  product.stock_status === 'outofstock' ? 'bg-red-500' : 'bg-black'
                }`}>
                  {product.stock_status === 'outofstock' ? 'Out of Stock' : 'In Stock'}
                </span>
                <span className="text-xs sm:text-sm text-gray-600">{product.brand}</span>
              </div>

              {/* Product Title */}
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight pr-10">
                {product.name || product.sku || product.part_number}
              </h2>

              {/* Rating — Placeholder */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 text-xs sm:text-sm">
                <div className="flex" aria-label="0 out of 5 stars">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
                    <span className="font-medium">SKU:</span>{' '}
                    <span className="font-mono">{product.sku}</span>
                  </div>
                )}
                {product.upc && (
                  <div>
                    <span className="font-medium">UPC:</span>{' '}
                    <span className="font-mono">{product.upc}</span>
                  </div>
                )}
              </div>

              {/* Quantity + Wishlist row */}
              <div className="flex items-center gap-3 mb-4">
                {/* Quantity Selector — pill style */}
                <div
                  role="group"
                  aria-label="Quantity"
                  className="inline-flex items-center h-11 rounded-xl border border-gray-200 bg-white overflow-hidden select-none"
                >
                  <button
                    onClick={decrementQuantity}
                    className="flex items-center justify-center w-11 h-11 text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} strokeWidth={2.5} />
                  </button>
                  <span className="px-3 min-w-10 text-center text-sm font-bold text-gray-900 tabular-nums border-x border-gray-200">
                    {quantity}
                  </span>
                  <button
                    onClick={incrementQuantity}
                    className="flex items-center justify-center w-11 h-11 text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Wishlist — visible on all screen sizes */}
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl border transition-colors ${
                    isWishlisted
                      ? 'bg-red-50 border-red-200 text-red-500'
                      : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400'
                  }`}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart size={18} className={isWishlisted ? 'fill-current' : ''} />
                </button>
              </div>

              {/* Add to Cart — full width */}
              <button
                onClick={handleAddToCart}
                disabled={product.stock_status === 'outofstock'}
                className="w-full flex items-center justify-center gap-2.5 h-12 px-6 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-sm tracking-wide rounded-xl transition-all mb-4 sm:mb-6 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <ShoppingCart size={17} aria-hidden="true" />
                {product.stock_status === 'outofstock' ? 'OUT OF STOCK' : 'ADD TO CART'}
              </button>
            </div>
          </div>

          {/* Bottom Section — Full Width Tabs */}
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

            {/* Tab Content */}
            <div className="pb-4 sm:pb-6 md:pb-8">
              {activeTab === 'description' && (
                <div>
                  {BRAND_LOGOS[product.brand] && (
                    <div className="flex justify-center mb-5 sm:mb-6">
                      <img
                        src={BRAND_LOGOS[product.brand]}
                        alt={`${product.brand} logo`}
                        className="h-14 sm:h-16 md:h-20 w-auto object-contain"
                      />
                    </div>
                  )}
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Description</h3>
                  {product.description_full ? (
                    <div className="product-description prose prose-sm max-w-none">
                      {/^\s*<[a-z]/i.test(product.description_full)
                        ? <div dangerouslySetInnerHTML={{ __html: product.description_full }} />
                        : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {product.description_full}
                            </ReactMarkdown>
                          )
                      }
                    </div>
                  ) : (
                    <p className="text-gray-500">No description available.</p>
                  )}

                  {/* Technical Specifications Table */}
                  <TechnicalSpecifications specs={getProductSpecifications(product)} onItemClick={onClose} />

                  {/* Replacement Parts Section */}
                  {partsUrl && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                        Find replacement parts for this tool here
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        View the official schematic diagram to identify and order the exact replacement parts you need.
                      </p>
                      <Link
                        to={partsUrl}
                        onClick={onClose}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        View Schematic &amp; Parts Diagram
                      </Link>
                    </div>
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
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb:active { background-color: rgba(156, 163, 175, 0.7); }
      `}</style>
    </div>
  );
}
