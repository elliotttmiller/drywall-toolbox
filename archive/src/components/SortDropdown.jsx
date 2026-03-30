import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/sort-dropdown.css';

const sortOptions = [
  {
    value: 'popular',
    label: 'Most Popular',
    description: 'Trending now'
  },
  {
    value: 'price-low',
    label: 'Price: Low to High',
    description: 'Budget friendly'
  },
  {
    value: 'price-high',
    label: 'Price: High to Low',
    description: 'Premium first'
  },
  {
    value: 'rating',
    label: 'Highest Rated',
    description: 'Customer favorites'
  }
];

export default function SortDropdown({ value = 'popular', onChange = () => {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const currentOption = sortOptions.find(opt => opt.value === value) || sortOptions[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="sort-dropdown-wrapper">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="sort-dropdown-button"
        aria-label="Sort options"
        aria-expanded={isOpen}
      >
        <div className="sort-button-content">
          <span className="sort-button-label">{currentOption.label}</span>
        </div>
        <ChevronDown
          size={18}
          className={`sort-chevron ${isOpen ? 'open' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="sort-dropdown-menu"
          role="listbox"
        >
          {sortOptions.map((option) => {
            const isSelected = value === option.value;

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`sort-dropdown-item ${isSelected ? 'selected' : ''}`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="sort-item-content">
                  <div className="sort-item-text">
                    <div className="sort-item-label">{option.label}</div>
                    <div className="sort-item-description">{option.description}</div>
                  </div>
                </div>
                {isSelected && (
                  <div className="sort-item-checkmark">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
