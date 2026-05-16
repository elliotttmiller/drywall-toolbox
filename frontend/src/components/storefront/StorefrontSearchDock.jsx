import { Search } from 'lucide-react';
import { useId } from 'react';

export default function StorefrontSearchDock({ value, onChange, onFocus, placeholder = 'Search products, brands, SKU...' }) {
  const inputId = useId();

  return (
    <label className="storefront-search-dock" htmlFor={inputId}>
      <Search size={16} aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label="Search for products"
      />
    </label>
  );
}
