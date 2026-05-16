import { Link } from 'react-router-dom';

export default function StorefrontCategoryTile({ title, to }) {
  return (
    <Link to={to} className="storefront-surface storefront-motion-card" style={{ padding: '14px', textDecoration: 'none', display: 'block' }}>
      <strong>{title}</strong>
    </Link>
  );
}
