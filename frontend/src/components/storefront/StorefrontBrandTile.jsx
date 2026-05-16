import { Link } from 'react-router-dom';

export default function StorefrontBrandTile({ name, logo, to }) {
  return (
    <Link to={to} className="storefront-surface storefront-motion-card" style={{ padding: '14px', textDecoration: 'none', display: 'grid', gap: '8px', placeItems: 'center' }}>
      {logo ? <img src={logo} alt={name} style={{ maxHeight: 36, width: 'auto', objectFit: 'contain' }} loading="lazy" /> : null}
      <strong style={{ color: 'var(--dtb-text)', textAlign: 'center' }}>{name}</strong>
    </Link>
  );
}
