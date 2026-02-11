import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      background: 'white',
      borderTop: '1px solid var(--machined-border)',
      padding: '80px 40px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '40px'
    }}>
      <div>
        <div style={{
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          fontSize: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            background: 'var(--alloy-deep)',
            clipPath: 'polygon(0% 15%, 15% 0%, 100% 0%, 100% 85%, 85% 100%, 0% 100%)'
          }} />
          <span>Drywall Toolbox</span>
        </div>
        <p style={{ fontSize: '0.8rem', opacity: 0.5, color: 'black' }}>
          Machined Precision for the Modern Finisher. Built for the grind.
        </p>
      </div>

      <div>
        <h5 style={{
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          marginBottom: '24px',
          fontWeight: 800,
          color: 'var(--primary-600)'
        }}>
          Navigation
        </h5>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.9, color: 'black' }}>
            <Link to="/products" style={{ textDecoration: 'none', color: 'black' }}>
              Shop
            </Link>
          </li>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.9, color: 'black' }}>
            <Link to="/parts" style={{ textDecoration: 'none', color: 'black' }}>
              Parts Schematics
            </Link>
          </li>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.9, color: 'black' }}>
            <Link to="/about" style={{ textDecoration: 'none', color: 'black' }}>
              About us
            </Link>
          </li>
        </ul>
      </div>

      <div>
        <h5 style={{
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          marginBottom: '24px',
          fontWeight: 800,
          color: 'var(--primary-600)'
        }}>
          Support
        </h5>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
            Shipping Policy
          </li>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
            Return Portal
          </li>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
            Safety Guides
          </li>
          <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.9, color: 'black' }}>
            <Link to="/contact" style={{ textDecoration: 'none', color: 'black' }}>
              Contact Us
            </Link>
          </li>
        </ul>
      </div>

      <div>
        <h5 style={{
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          marginBottom: '24px',
          fontWeight: 800
        }}>
          Industrial Access
        </h5>
        <p style={{ fontSize: '0.8rem', marginBottom: '16px', color: 'black', fontWeight: 'normal' }}>
          Sign up for trade-only discounts and technical updates.
        </p>
        <input 
          type="email" 
          placeholder="Email Address" 
          className="machined-input"
          style={{ padding: '10px', fontSize: '0.8rem' }}
        />
      </div>
    </footer>
  );
}
