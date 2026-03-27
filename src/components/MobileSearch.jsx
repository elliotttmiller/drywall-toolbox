import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loadProducts } from '../data/products';

export default function MobileSearch({ onClose = () => {} }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const products = await loadProducts();
      const filtered = products.filter(product => {
        const name = (product.name || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();
        const brand = (product.brand || '').toLowerCase();
        const q = query.toLowerCase();
        
        return name.includes(q) || sku.includes(q) || brand.includes(q);
      }).slice(0, 5); // Limit to 5 results for mobile
      
      setResults(filtered);
    } catch (error) {
      console.error('Search error:', error);
    }
    setIsLoading(false);
  };

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
    setSearchQuery('');
    setResults([]);
    setIsOpen(false);
    onClose(); // Close the mobile menu
  };

  const handleViewAllResults = () => {
    // Navigate to all-products page with search query
    navigate(`/all-products?search=${encodeURIComponent(searchQuery)}`);
    setIsOpen(false);
    onClose(); // Close the mobile menu;
  };

  return (
    <div className="mobile-search-container">
      <div className="mobile-search-wrapper">
        <div className="mobile-search-input-group">
          <Search size={18} className="mobile-search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="mobile-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setResults([]);
              }}
              className="mobile-search-clear"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {isOpen && (
          <div className="mobile-search-dropdown">
            {isLoading ? (
              <div className="mobile-search-loading">Loading...</div>
            ) : results.length > 0 ? (
              <>
                <div className="mobile-search-results">
                  {results.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product.id)}
                      className="mobile-search-result-item"
                    >
                      <div className="mobile-search-result-image">
                        {product.image && (
                          <img src={product.image} alt={product.name} />
                        )}
                      </div>
                      <div className="mobile-search-result-info">
                        <div className="mobile-search-result-name">{product.name}</div>
                        <div className="mobile-search-result-price">{product.price ? `$${product.price.toFixed(2)}` : 'N/A'}</div>
                      </div>
                    </button>
                  ))}
                </div>
                {searchQuery.trim() && (
                  <button
                    onClick={handleViewAllResults}
                    className="mobile-search-view-all"
                  >
                    View All Results
                  </button>
                )}
              </>
            ) : searchQuery.trim() ? (
              <div className="mobile-search-no-results">No products found</div>
            ) : (
              <div className="mobile-search-placeholder">Start typing to search...</div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .mobile-search-container {
          width: 100%;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .mobile-search-wrapper {
          position: relative;
          width: 100%;
        }

        .mobile-search-input-group {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          transition: all 0.2s ease-out;
        }

        .mobile-search-input-group:focus-within {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .mobile-search-icon {
          color: rgba(15, 23, 42, 0.5);
          flex-shrink: 0;
        }

        .mobile-search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 16px;
          font-family: inherit;
          color: #1f2937;
          padding: 8px 4px;
          -webkit-appearance: none;
          appearance: none;
        }

        .mobile-search-input::placeholder {
          color: #9ca3af;
        }

        .mobile-search-clear {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }

        .mobile-search-clear:active {
          color: #1f2937;
        }

        .mobile-search-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1.5px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 10px 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          max-height: 400px;
          overflow-y: auto;
          z-index: 50;
          margin-top: -2px;
        }

        .mobile-search-results {
          padding: 8px 0;
        }

        .mobile-search-result-item {
          width: 100%;
          padding: 12px 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          background: none;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s ease;
          text-align: left;
          font-family: inherit;
        }

        .mobile-search-result-item:active {
          background-color: #f9fafb;
        }

        .mobile-search-result-image {
          width: 48px;
          height: 48px;
          background: #f3f4f6;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        .mobile-search-result-image img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
        }

        .mobile-search-result-info {
          flex: 1;
          min-width: 0;
        }

        .mobile-search-result-name {
          font-size: 13px;
          font-weight: 500;
          color: #1f2937;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-search-result-price {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .mobile-search-view-all {
          width: 100%;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #2563eb;
          background: #f9fafb;
          border: none;
          border-top: 1px solid #e5e7eb;
          cursor: pointer;
          font-family: inherit;
          transition: background-color 0.2s ease;
        }

        .mobile-search-view-all:active {
          background-color: #f3f4f6;
        }

        .mobile-search-no-results,
        .mobile-search-placeholder,
        .mobile-search-loading {
          padding: 16px;
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
        }

        .mobile-search-loading {
          color: #6b7280;
          font-weight: 500;
        }

        /* Mobile scrollbar styling */
        .mobile-search-dropdown::-webkit-scrollbar {
          width: 4px;
        }

        .mobile-search-dropdown::-webkit-scrollbar-track {
          background: transparent;
        }

        .mobile-search-dropdown::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 2px;
        }

        .mobile-search-dropdown::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}
