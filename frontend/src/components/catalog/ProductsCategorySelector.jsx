import { ChevronRight } from 'lucide-react';
import './products-selector.css';

export default function ProductsCategorySelector({
  brand,
  brandLogo,
  categories,
  onSelectCategory,
  onBack,
}) {
  return (
    <div className="product-selector">
      <div className="product-selector-header">
        <button type="button" onClick={onBack} className="back-button">
          <span aria-hidden="true">←</span>
          <span>Brands</span>
        </button>
        <div className="product-selector-header-content">
          {brandLogo && (
            <img
              src={brandLogo}
              alt={`${brand} logo`}
              className="product-brand-header-logo"
            />
          )}
        </div>
      </div>

      <div className="product-categories-grid">
        {categories.map((category, index) => (
          <button
            key={category.key || category.slug || category.name}
            type="button"
            className={`product-category-card${category.image ? '' : ' product-category-card--no-image'}`}
            style={{ animationDelay: `${(index + 1) * 0.07}s` }}
            onClick={() => onSelectCategory(category)}
          >
            {category.image && <img src={category.image} alt={category.name} className="product-category-card__image" />}
            <div className="product-category-card__scrim" />
            <div className="product-category-card__content">
              <div className="product-category-card__text">
                <h3 className="product-category-card__name">{category.name}</h3>
                <span className="product-category-card__count">{category.count} product{category.count !== 1 ? 's' : ''}</span>
              </div>
              <ChevronRight className="product-category-card__chevron" size={18} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
