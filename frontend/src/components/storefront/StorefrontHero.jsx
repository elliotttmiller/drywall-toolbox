import { Link } from 'react-router-dom';

export default function StorefrontHero() {
  return (
    <section
      className="storefront-hero"
      style={{
        background: 'linear-gradient(135deg, var(--dtb-shell) 0%, #121a2f 60%, #0f2044 100%)',
        borderRadius: 'var(--dtb-radius-lg)',
        padding: 'clamp(1.4rem, 4vw, 2.8rem) clamp(1.2rem, 3vw, 2.4rem)',
        color: 'white',
        marginBottom: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p
          style={{
            margin: '0 0 0.5rem',
            fontSize: '0.68rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(147, 197, 253, 0.90)',
            fontWeight: 800,
          }}
        >
          Professional Drywall Supply
        </p>
        <h1
          style={{
            margin: '0 0 0.6rem',
            fontSize: 'clamp(1.6rem, 4.5vw, 3rem)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: 'white',
          }}
        >
          Contractor-grade tools and parts, shipped fast.
        </h1>
        <p
          style={{
            margin: '0 0 1.1rem',
            color: 'rgba(255,255,255,0.65)',
            fontSize: 'clamp(0.88rem, 1.8vw, 1rem)',
            maxWidth: '50ch',
          }}
        >
          Shop by brand, category, or parts fitment. Same-day processing on in-stock orders.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link
            to="/products"
            className="alloy-button"
            style={{ background: '#2563eb', color: 'white', border: 'none' }}
          >
            Shop All Products
          </Link>
          <Link
            to="/products/brands"
            className="alloy-button secondary"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1.5px solid rgba(255,255,255,0.22)' }}
          >
            Shop by Brand
          </Link>
        </div>
      </div>

      {/* decorative grid pattern */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}
      />
    </section>
  );
}
