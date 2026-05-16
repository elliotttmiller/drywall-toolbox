import { Link } from 'react-router-dom';

const CATEGORY_CONFIG = {
  'Automatic Taping Tools': {
    bg: '#0f2a6b',
    accent: '#3b82f6',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  'Finishing Boxes': {
    bg: '#1d4ed8',
    accent: '#93c5fd',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M7 7V5a1 1 0 011-1h8a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 12h6M12 9.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  'Corner Tools': {
    bg: '#134e7e',
    accent: '#38bdf8',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20V4h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 16V9h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  'Parts': {
    bg: '#0f4c75',
    accent: '#34d399',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  'Handles & Extensions': {
    bg: '#1e3a8a',
    accent: '#a78bfa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="10.5" width="20" height="3" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="6.5" y="7.5" width="3" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14.5" y="7.5" width="3" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  'New Arrivals': {
    bg: '#0c2a4a',
    accent: '#fb923c',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
};

export default function StorefrontCategoryTile({ title, to }) {
  const config = CATEGORY_CONFIG[title] || { bg: 'var(--dtb-shell)', accent: '#3b82f6' };
  return (
    <Link
      to={to}
      className="storefront-category-tile"
      style={{ '--tile-bg': config.bg, '--tile-accent': config.accent }}
      aria-label={`Shop ${title}`}
    >
      <span className="storefront-category-tile__icon">
        {config.icon}
      </span>
      <span className="storefront-category-tile__label">{title}</span>
    </Link>
  );
}
