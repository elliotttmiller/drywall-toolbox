import { Link } from 'react-router-dom';

export default function StorefrontHero() {
  return (
    <section className="storefront-surface" style={{ padding: 'clamp(1.2rem, 3vw, 2.5rem)' }}>
      <p className="storefront-section__eyebrow">Professional Drywall Supply</p>
      <h1 style={{ margin: '0.35rem 0 0.65rem', fontSize: 'clamp(1.65rem, 4vw, 2.8rem)', fontWeight: 900 }}>
        Contractor-grade tools and parts, shipped fast.
      </h1>
      <p style={{ color: 'var(--dtb-muted)', marginBottom: '1rem' }}>
        Shop by brand, category, and parts fitment with a faster mobile-first storefront.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <Link to="/products" className="alloy-button">Shop Products</Link>
        <Link to="/products/brands" className="alloy-button secondary">Shop by Brand</Link>
      </div>
    </section>
  );
}
