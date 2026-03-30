import { Link } from 'react-router-dom';

export default function PartsDiagrams() {
  return (
    <section style={{
      padding: '20px 40px 100px',
      maxWidth: '1400px',
      margin: '0 auto'
    }} className="section-enter parts-section">
      <Link to="/parts" style={{ textDecoration: 'none' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.08) 0%, rgba(59, 130, 246, 0.06) 100%)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: '4px',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s var(--ease-tension)',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.08)'
        }}
        className="parts-hero"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 16px 48px rgba(59, 130, 246, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(59, 130, 246, 0.08)';
        }}
        >
          {/* Centered text content */}
          <div
            style={{
              position: 'relative',
              zIndex: 10,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <h2 style={{
              fontSize: 'clamp(2rem, 6vw, 4rem)',
              color: 'var(--primary-600)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 800,
              lineHeight: 1.1
            }}>
              PARTS
            </h2>
            <div style={{
              width: '60px',
              height: '3px',
              background: 'rgba(59, 130, 246, 0.4)',
              borderRadius: '2px'
            }} />
          </div>
        </div>
      </Link>
    </section>
  );
}

