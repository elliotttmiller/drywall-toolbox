import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Sliders, RefreshCw } from 'lucide-react';
import '../styles/filter-panel.css';

export default function FilterPanel({
  isOpen,
  onClose,
  categories,
  brands,
  maxPrice,
  selectedBrands,
  selectedCategories,
  priceRange,
  onBrandChange,
  onCategoryChange,
  onPriceChange,
  onClearFilters,
  resultsCount,
}) {
  const [expandedSections, setExpandedSections] = useState({
    categories: true,
    brands: true,
    price: true,
  });
  const panelRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Only close if clicking on the overlay
        if (e.target.className.includes('filter-panel-overlay')) {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const hasActiveFilters =
    selectedBrands.length > 0 ||
    selectedCategories.length > 0 ||
    priceRange[0] !== 0 ||
    priceRange[1] !== maxPrice;

  return (
    <>
      {/* Overlay - positioned below the fixed site header */}
      {isOpen && (
        <div
          className="filter-panel-overlay fixed left-0 right-0 bottom-0 bg-black/30 z-40 backdrop-blur-sm"
          style={{ top: 'var(--header-height)' }}
          onClick={onClose}
        />
      )}

      {/* Desktop Sidebar - Always Visible */}
      <aside className="hidden lg:block lg:w-72 shrink-0">
        <div className="lg:sticky lg:top-24 h-full">
          <FilterContent
            categories={categories}
            brands={brands}
            maxPrice={maxPrice}
            selectedBrands={selectedBrands}
            selectedCategories={selectedCategories}
            priceRange={priceRange}
            onBrandChange={onBrandChange}
            onCategoryChange={onCategoryChange}
            onPriceChange={onPriceChange}
            onClearFilters={onClearFilters}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            hasActiveFilters={hasActiveFilters}
            resultsCount={resultsCount}
          />
        </div>
      </aside>

      {/* Mobile Sidebar - Slide In */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed inset-0 z-50 pointer-events-none lg:hidden"
          style={{ top: 'var(--header-height)' }}
        >
          {/* Tap outside to close indicator */}
          <div 
            className="pointer-events-auto absolute inset-0"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          />
          
          <div className="pointer-events-auto">
            <div className="fixed left-0 bottom-0 w-full max-w-sm bg-white shadow-2xl overflow-y-auto flex flex-col" style={{ top: 'var(--header-height)' }}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-3 flex items-center justify-between shrink-0">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Sliders size={18} />
                  Filters
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-target"
                  aria-label="Close filters"
                  title="Close filters (ESC)"
                >
                  <X size={22} className="text-gray-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                <FilterContent
                  categories={categories}
                  brands={brands}
                  maxPrice={maxPrice}
                  selectedBrands={selectedBrands}
                  selectedCategories={selectedCategories}
                  priceRange={priceRange}
                  onBrandChange={onBrandChange}
                  onCategoryChange={onCategoryChange}
                  onPriceChange={onPriceChange}
                  onClearFilters={onClearFilters}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  hasActiveFilters={hasActiveFilters}
                  resultsCount={resultsCount}
                  isMobile
                />
              </div>

              {/* Mobile Footer - Done Button */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-3 shrink-0">
                <button
                  onClick={onClose}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors touch-target"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterContent({
  categories,
  brands,
  maxPrice,
  selectedBrands,
  selectedCategories,
  priceRange,
  onBrandChange,
  onCategoryChange,
  onPriceChange,
  onClearFilters,
  expandedSections,
  toggleSection,
  hasActiveFilters,
  resultsCount,
  isMobile,
}) {
  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden ${isMobile ? 'shadow-none rounded-none -mx-3' : ''}`}>
      {/* Results Count */}
      {resultsCount !== undefined && (
        <div className={`py-2.5 bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-100 ${isMobile ? 'px-2 mx-3 rounded' : 'px-4'}`}>
          <p className="text-xs font-medium text-gray-700">
            <span className="text-primary-600 font-bold">{resultsCount}</span> products found
          </p>
        </div>
      )}

      {/* Filter Sections */}
      <div className="divide-y divide-gray-200">
        {/* Categories Section */}
        <FilterSection
          title="Categories"
          isExpanded={expandedSections.categories}
          onToggle={() => toggleSection('categories')}
          itemCount={selectedCategories.length}
          isMobile={isMobile}
        >
          <div className="space-y-2">
            {categories.map(category => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <label
                  key={category.id}
                  className={`flex items-center gap-3 cursor-pointer group p-2 rounded-lg transition-all ${
                    isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onCategoryChange(category.id)}
                    className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer accent-primary-600 shrink-0"
                  />
                  <span className={`text-sm transition-colors ${
                    isSelected ? 'text-primary-700 font-medium' : 'text-gray-700 group-hover:text-gray-900'
                  }`}>
                    {category.name}
                  </span>
                  {isSelected && (
                    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                      ✓
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </FilterSection>

        {/* Brands Section */}
        <FilterSection
          title="Brands"
          isExpanded={expandedSections.brands}
          onToggle={() => toggleSection('brands')}
          itemCount={selectedBrands.length}
          isMobile={isMobile}
        >
          <div className={`space-y-2 ${isMobile ? 'max-h-48' : 'max-h-56'} overflow-y-auto pr-2 custom-scrollbar`}>
            {brands.map(brand => {
              const isSelected = selectedBrands.includes(brand);
              return (
                <label
                  key={brand}
                  className={`flex items-center gap-3 cursor-pointer group p-2 rounded-lg transition-all ${
                    isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onBrandChange(brand)}
                    className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer accent-primary-600 shrink-0"
                  />
                  <span className={`text-sm transition-colors ${
                    isSelected ? 'text-primary-700 font-medium' : 'text-gray-700 group-hover:text-gray-900'
                  }`}>
                    {brand}
                  </span>
                  {isSelected && (
                    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                      ✓
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </FilterSection>

        {/* Price Range Section */}
        <FilterSection
          title="Price Range"
          isExpanded={expandedSections.price}
          onToggle={() => toggleSection('price')}
          isMobile={isMobile}
        >
          <div className="space-y-3 p-2">
            {/* Price Display */}
            <div className="flex items-center justify-between bg-primary-50 px-3 py-2 rounded-lg border border-primary-200">
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-primary-600">
                  ${priceRange[0].toFixed(0)}
                </span>
                <span className="text-xs text-gray-500">to</span>
                <span className="text-base font-bold text-primary-600">
                  ${priceRange[1].toFixed(0)}
                </span>
              </div>
            </div>

            {/* Range Slider */}
            <div className="space-y-3">
              {/* Min Price Input */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Min Price
                </label>
                <input
                  type="range"
                  min="0"
                  max={maxPrice}
                  step="50"
                  value={priceRange[0]}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value);
                    if (newMin <= priceRange[1]) {
                      onPriceChange([newMin, priceRange[1]]);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$0</span>
                  <span>${maxPrice}</span>
                </div>
              </div>

              {/* Max Price Input */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Max Price
                </label>
                <input
                  type="range"
                  min="0"
                  max={maxPrice}
                  step="50"
                  value={priceRange[1]}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    if (newMax >= priceRange[0]) {
                      onPriceChange([priceRange[0], newMax]);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                />
              </div>
            </div>
          </div>
        </FilterSection>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className={`border-t border-gray-200 bg-gray-50 ${isMobile ? 'px-2 py-2 m-3 rounded' : 'px-4 py-4'}`}>
          <button
            onClick={onClearFilters}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium text-sm transition-colors"
          >
            <RefreshCw size={16} />
            Clear All Filters
          </button>
        </div>
      )}

      {/* Footer Stats */}
      <div className={`border-t border-gray-200 text-xs text-gray-600 ${isMobile ? 'px-2 py-2 m-3 rounded bg-gray-50' : 'px-4 py-3 bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <span>{hasActiveFilters ? 'Filters Active' : 'No filters'}</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-800">
              {(selectedBrands.length + selectedCategories.length + (priceRange[0] !== 0 || priceRange[1] !== maxPrice ? 1 : 0))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  isExpanded,
  onToggle,
  itemCount,
  children,
  isMobile,
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors ${
          isMobile ? 'px-2 py-3' : 'px-4 py-3.5'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          {itemCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
              {itemCount}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-600 transition-transform duration-200 shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className={`space-y-1 bg-gray-50 ${isMobile ? 'px-2 pb-2' : 'px-4 pb-3.5'}`}>
          {children}
        </div>
      )}
    </div>
  );
}
