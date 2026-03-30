import { useState, useEffect, useRef } from 'react';
import '../styles/schematic-filter-bar.css';

export default function SchematicFilterBar({ 
  brands, 
  selectedBrand, 
  onBrandChange,
  products,
  selectedProduct,
  onProductChange,
  schematics,
  selectedSchematic,
  onSchematicChange
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setExpandedSection(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBrandSelect = (brand) => {
    onBrandChange(brand);
    setExpandedSection(null);
  };

  const handleProductSelect = (product) => {
    onProductChange(product);
    setExpandedSection(null);
  };

  const handleSchematicSelect = (schematic) => {
    onSchematicChange(schematic);
    setExpandedSection(null);
  };

  return (
    <div className="schematic-filter-bar">
      <div className="filter-bar-container" ref={containerRef}>
        
        {/* Brand Selector */}
        <div className={`filter-section ${expandedSection === 'brand' ? 'expanded' : ''} ${selectedBrand ? 'has-selection' : ''}`}>
          <button 
            className="filter-trigger"
            onClick={() => setExpandedSection(expandedSection === 'brand' ? null : 'brand')}
          >
            <div className="filter-trigger-content">
              <span className="filter-label" style={{ color: 'var(--color-primary-600)' }}>BRAND</span>
              <span className="filter-value" style={{ color: 'black' }}>{selectedBrand || 'Select brand'}</span>
            </div>
            <svg 
              className={`filter-chevron ${expandedSection === 'brand' ? 'rotated' : ''}`}
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {expandedSection === 'brand' && (
            <div className="filter-dropdown">
              <div className="filter-dropdown-content">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    className={`filter-option ${selectedBrand === brand ? 'active' : ''}`}
                    onClick={() => handleBrandSelect(brand)}
                  >
                    <div className="filter-option-content">
                      <span className="filter-option-text">{brand}</span>
                      {selectedBrand === brand && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Arrow Separator */}
        <svg className="filter-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* Product Selector */}
        <div className={`filter-section ${expandedSection === 'product' ? 'expanded' : ''} ${selectedProduct ? 'has-selection' : ''} ${!selectedBrand || products.length === 0 ? 'disabled' : ''}`}>
          <button 
            className="filter-trigger"
            onClick={() => selectedBrand && products.length > 0 && setExpandedSection(expandedSection === 'product' ? null : 'product')}
            disabled={!selectedBrand || products.length === 0}
          >
            <div className="filter-trigger-content">
              <span className="filter-label" style={{ color: 'var(--color-primary-600)' }}>PRODUCT</span>
              <span className="filter-value" style={{ color: 'black' }}>
                {selectedProduct ? `${selectedProduct.name}` : products.length === 0 ? 'No products' : 'Select product'}
              </span>
            </div>
            {selectedBrand && products.length > 0 && (
              <svg 
                className={`filter-chevron ${expandedSection === 'product' ? 'rotated' : ''}`}
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          
          {expandedSection === 'product' && (
            <div className="filter-dropdown">
              <div className="filter-dropdown-content">
                <button
                  className={`filter-option ${!selectedProduct ? 'active' : ''}`}
                  onClick={() => handleProductSelect(null)}
                >
                  <div className="filter-option-content">
                    <span className="filter-option-text">All Products</span>
                    {!selectedProduct && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
                {products.map((product) => (
                  <button
                    key={product.id}
                    className={`filter-option ${selectedProduct?.id === product.id ? 'active' : ''}`}
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="filter-option-content">
                      <div className="filter-option-main">
                        <span className="filter-option-text">{product.name}</span>
                        <span className="filter-option-meta">{product.part_number}</span>
                      </div>
                      {selectedProduct?.id === product.id && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Arrow Separator */}
        <svg className="filter-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* Parts Selector */}
        <div className={`filter-section ${expandedSection === 'schematic' ? 'expanded' : ''} ${selectedSchematic ? 'has-selection' : ''} ${schematics.length === 0 ? 'disabled' : ''}`}>
          <button 
            className="filter-trigger"
            onClick={() => schematics.length > 0 && setExpandedSection(expandedSection === 'schematic' ? null : 'schematic')}
            disabled={schematics.length === 0}
          >
            <div className="filter-trigger-content">
              <span className="filter-label" style={{ color: 'var(--color-primary-600)' }}>PART</span>
              <span className="filter-value" style={{ color: 'black' }}>
                {selectedSchematic ? schematics.find(s => s.id === selectedSchematic)?.title || 'Select part' : schematics.length === 0 ? 'No parts' : 'Select part'}
              </span>
            </div>
            {schematics.length > 0 && (
              <svg 
                className={`filter-chevron ${expandedSection === 'schematic' ? 'rotated' : ''}`}
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          
          {expandedSection === 'schematic' && (
            <div className="filter-dropdown filter-dropdown-schematic">
              <div className="filter-dropdown-content">
                {schematics.map((schematic) => (
                  <button
                    key={schematic.id}
                    className={`filter-option filter-option-schematic ${selectedSchematic === schematic.id ? 'active' : ''}`}
                    onClick={() => handleSchematicSelect(schematic.id)}
                  >
                    <div className="filter-option-content">
                      <div className="filter-option-main">
                        <span className="filter-option-text">{schematic.title}</span>
                        <span className="filter-option-meta">{schematic.description}</span>
                      </div>
                      {selectedSchematic === schematic.id && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
