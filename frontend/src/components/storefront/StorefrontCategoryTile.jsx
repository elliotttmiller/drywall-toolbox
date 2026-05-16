import { Link } from 'react-router-dom';

const CATEGORY_COLORS = {
  'Automatic Taping Tools': '#1e3a8a',
  'Finishing Boxes': '#1d4ed8',
  'Parts': '#0f4c75',
  'Corner Tools': '#1a3a5c',
  'New Arrivals': '#0c2a4a',
};

export default function StorefrontCategoryTile({ title, to }) {
  const bg = CATEGORY_COLORS[title] || 'var(--dtb-shell)';
  return (
    <Link
      to={to}
      className="storefront-category-tile"
      style={{ background: bg }}
      aria-label={`Shop ${title}`}
    >
      <span className="storefront-category-tile__label">{title}</span>
    </Link>
  );
}
