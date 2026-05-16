import { Link } from 'react-router-dom';

export default function StorefrontBrandTile({ name, logo, to }) {
  return (
    <Link to={to} className="storefront-brand-tile" aria-label={`Shop ${name}`}>
      {logo ? (
        <img
          src={logo}
          alt={name}
          style={{ maxHeight: 40, maxWidth: '90%', width: 'auto', objectFit: 'contain' }}
          loading="lazy"
        />
      ) : null}
      <span className="storefront-brand-tile__name">{name}</span>
    </Link>
  );
}
