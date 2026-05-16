import { Link } from 'react-router-dom';

export default function StorefrontSection({
  title,
  subtitle,
  eyebrow,
  viewAllHref,
  viewAllLabel = 'View all',
  className = '',
  children,
}) {
  return (
    <section className={`storefront-section ${className}`.trim()}>
      <div className="storefront-section__head">
        <div>
          {eyebrow ? <p className="storefront-section__eyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="storefront-section__title">{title}</h2> : null}
          {subtitle ? <p className="storefront-section__subtitle">{subtitle}</p> : null}
        </div>
        {viewAllHref ? <Link to={viewAllHref}>{viewAllLabel}</Link> : null}
      </div>
      {children}
    </section>
  );
}
