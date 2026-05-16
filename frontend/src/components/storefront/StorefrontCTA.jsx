import { Link } from 'react-router-dom';

export default function StorefrontCTA({ title, copy, to, action = 'Explore' }) {
  return (
    <div className="storefront-surface" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--dtb-muted)' }}>{copy}</p>
      <div>
        <Link to={to} className="alloy-button">{action}</Link>
      </div>
    </div>
  );
}
