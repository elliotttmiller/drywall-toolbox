import { Link } from 'react-router-dom';

export default function StorefrontHero() {
  return (
    <section className="dtb-hero">
      {/* decorative background pattern */}
      <div className="dtb-hero__grid" aria-hidden="true" />

      <div className="dtb-hero__inner">
        <p className="dtb-hero__eyebrow">Professional Drywall Supply</p>
        <h1 className="dtb-hero__title">The new standard in drywall.</h1>
        <p className="dtb-hero__sub">
          Contractor-grade tools, replacement parts, and full-service repairs&mdash;all in one place.
          Same-day processing on in-stock orders.
        </p>
        <div className="dtb-hero__actions">
          <Link to="/products" className="dtb-hero__btn dtb-hero__btn--primary">
            Shop All Products
          </Link>
          <Link to="/products/brands" className="dtb-hero__btn dtb-hero__btn--ghost">
            Shop by Brand
          </Link>
        </div>
      </div>
    </section>
  );
}
