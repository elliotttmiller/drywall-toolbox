import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import '../styles/tool-selector.css';
import BackButton from './BackButton';

export default function ToolSelector({ brand, brandLogo, tools, onSelectTool, onBack }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Group tools by category if they have categories defined
  const groupedTools = tools.reduce((acc, tool) => {
    const category = tool.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  }, {});

  // Determine if we should show categories - show if any tool has a category defined
  const categories = Object.keys(groupedTools).sort();
  const hasAnyCategory = tools.some(tool => tool.category);
  const shouldShowCategoryView = hasAnyCategory || categories.length > 1;

  // If showing category view and no category is selected, show category cards
  const showCategoryCards = shouldShowCategoryView && !selectedCategory;

  return (
    <div className="tool-selector">
      <div className="tool-selector-header">
        <BackButton
          onClick={selectedCategory ? () => {
            setSelectedCategory(null);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
          } : onBack}
          label={selectedCategory ? "Categories" : "Brands"}
        />
        <div className="header-content">
          {brandLogo && (
            <img
              src={brandLogo}
              alt={`${brand} logo`}
              className={[
                'brand-header-logo',
                brand === 'Columbia Taping Tools' ? 'brand-header-logo--columbia' : '',
              ].filter(Boolean).join(' ')}
            />
          )}
          {selectedCategory && <h2>{selectedCategory}</h2>}
        </div>
      </div>

      {showCategoryCards ? (
        // Show category cards — image-forward landscape cards
        <div className="categories-grid">
          {categories.map((category, index) => {
            const firstTool = groupedTools[category][0];
            const categoryImage = firstTool?.previewImage ||
              (firstTool?.imagePages && firstTool.imagePages[Object.keys(firstTool.imagePages)[0]]);
            const count = groupedTools[category].length;
            return (
            <button
              key={category}
              className={`category-card${categoryImage ? '' : ' category-card--no-image'}`}
              style={{ animationDelay: `${(index + 1) * 0.07}s` }}
              onClick={() => {
                setSelectedCategory(category);
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
              }}
            >
              {categoryImage && (
                <img src={categoryImage} alt={category} className="category-card-img" />
              )}
              <div className="category-card-scrim" />
              <div className="category-card-content">
                <div className="category-card-text">
                  <h3 className="category-name">{category}</h3>
                  <span className="category-count">{count} tool{count !== 1 ? 's' : ''}</span>
                </div>
                <ChevronRight className="category-card-chevron" size={18} />
              </div>
            </button>
            );
          })}
        </div>
      ) : showCategoryCards === false && selectedCategory ? (
        // Show tools in selected category
        <div className="tools-grid">
          {groupedTools[selectedCategory].map((tool, index) => (
            <button
              key={tool.id}
              className="tool-card"
              style={{ animationDelay: `${(index + 1) * 0.07}s` }}
              onClick={() => onSelectTool(tool)}
            >
              {/* Image Background */}
              <div className="tool-card-image-bg">
                {tool.previewImage ? (
                  <img src={tool.previewImage} alt={tool.title} />
                ) : tool.imagePages && Object.keys(tool.imagePages).length > 0 ? (
                  <img src={tool.imagePages[Object.keys(tool.imagePages)[0]]} alt={tool.title} />
                ) : (
                  <svg className="placeholder-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                )}
              </div>
              {/* Title Overlay */}
              <div className="tool-card-overlay">
                <h3 className="tool-name">{tool.title}</h3>
              </div>
              {/* Hover accent layer */}
              <div className="tool-card-background" />
            </button>
          ))}
        </div>
      ) : (
        // Fallback: show all tools without categories
        <div className="tools-grid">
          {tools.map((tool, index) => (
            <button
              key={tool.id}
              className="tool-card"
              style={{ animationDelay: `${(index + 1) * 0.07}s` }}
              onClick={() => onSelectTool(tool)}
            >
              {/* Image Background */}
              <div className="tool-card-image-bg">
                {tool.previewImage ? (
                  <img src={tool.previewImage} alt={tool.title} />
                ) : tool.imagePages && Object.keys(tool.imagePages).length > 0 ? (
                  <img src={tool.imagePages[Object.keys(tool.imagePages)[0]]} alt={tool.title} />
                ) : (
                  <svg className="placeholder-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                )}
              </div>
              {/* Title Overlay */}
              <div className="tool-card-overlay">
                <h3 className="tool-name">{tool.title}</h3>
              </div>
              {/* Hover accent layer */}
              <div className="tool-card-background" />
            </button>
          ))}
        </div>
      )}

      {tools.length === 0 && (
        <div className="empty-state">
          <p>No tools available for this brand yet.</p>
        </div>
      )}
    </div>
  );
}
