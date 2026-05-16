import { Link } from 'react-router-dom';

export default function StorefrontBrandTile({ name, logo, to }) {
  return (
    <Link to={to} className="storefront-brand-tile" aria-label={`Shop ${name}`}>
      {logo ? (
        <span className="storefront-brand-tile__logo-wrap">
          <img
            src={logo}
            alt={name}
            className="storefront-brand-tile__logo"
            loading="lazy"
          />
        </span>
      ) : null}
      <span className="storefront-brand-tile__name">{name}</span>
    </Link>
  );
}
