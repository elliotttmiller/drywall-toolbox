import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function StorefrontCTA({ title, copy, to, action = 'Explore' }) {
  return (
    <div className="storefront-cta-block">
      <h3 className="storefront-cta-block__title">{title}</h3>
      <p className="storefront-cta-block__copy">{copy}</p>
      <div>
        <Link to={to} className="alloy-button" style={{ display: 'inline-flex', gap: 6 }}>
          {action} <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
