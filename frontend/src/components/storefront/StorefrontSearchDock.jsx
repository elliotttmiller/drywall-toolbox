import { Search } from 'lucide-react';

export default function StorefrontSearchDock({ value, onChange, onFocus, placeholder = 'Search products, brands, SKU...' }) {
  return (
    <label className="storefront-search-dock" aria-label="Search dock">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
      />
    </label>
  );
}
