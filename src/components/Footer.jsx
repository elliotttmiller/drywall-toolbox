import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter } from 'lucide-react';
import Logo from '/logo2.svg';

export default function Footer() {
  return (
    <footer className="site-footer" style={{
      background: 'white',
      borderTop: '1px solid var(--machined-border)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Main footer content */}
      <div style={{
        padding: 'clamp(40px, 6vw, 80px) clamp(20px, 5vw, 40px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '40px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }} className="footer-grid">

        {/* Brand column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img src={Logo} alt="Drywall Toolbox" className="footer-logo" style={{ height: '48px', width: 'auto' }} />
          </Link>
          <p style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.55)', lineHeight: 1.6, margin: 0, maxWidth: '220px' }}>
            Professional drywall tools, parts, and accessories. Contractor trusted since day one.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--alloy-deep)', opacity: 0.6, transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--alloy-deep)', opacity: 0.6, transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              aria-label="Facebook"
            >
              <Facebook size={18} />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--alloy-deep)', opacity: 0.6, transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              aria-label="Twitter / X"
            >
              <Twitter size={18} />
            </a>
          </div>
        </div>

        {/* Shop column */}
        <div className="footer-col">
          <h5 style={{
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            margin: '0 0 20px 0',
            fontWeight: 800,
            color: 'var(--primary-600)'
          }}>
            Shop
          </h5>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { to: '/products', label: 'All Products' },
              { to: '/products?category=taping', label: 'Taping Tools' },
              { to: '/products?category=finishing', label: 'Finishing Tools' },
              { to: '/products?category=sanding', label: 'Sanding Tools' },
              { to: '/parts', label: 'Parts & Schematics' }
            ].map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  style={{ textDecoration: 'none', fontSize: '0.85rem', color: 'rgba(15,23,42,0.6)', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(15,23,42,0.6)')}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support column */}
        <div className="footer-col">
          <h5 style={{
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            margin: '0 0 20px 0',
            fontWeight: 800,
            color: 'var(--primary-600)'
          }}>
            Support
          </h5>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { to: '/contact', label: 'Contact Us' },
              { to: '/repairs', label: 'Repair Services' },
              { to: '/about', label: 'About Us' },
              { to: '#', label: 'Shipping Policy' },
              { to: '#', label: 'Return Portal' }
            ].map(({ to, label }) => (
              <li key={label}>
                <Link
                  to={to}
                  style={{ textDecoration: 'none', fontSize: '0.85rem', color: 'rgba(15,23,42,0.6)', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(15,23,42,0.6)')}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact column */}
        <div className="footer-col">
          <h5 style={{
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            margin: '0 0 20px 0',
            fontWeight: 800,
            color: 'var(--primary-600)'
          }}>
            Contact
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(15,23,42,0.4)', marginBottom: '3px' }}>Email</div>
              <a
                href="mailto:support@drywalltoolbox.com"
                style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.65)', textDecoration: 'none', fontFamily: 'var(--font-mono)', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(15,23,42,0.65)')}
              >
                support@drywalltoolbox.com
              </a>
            </div>
            <div style={{
              marginTop: '8px',
              background: 'var(--alloy-base)',
              border: '1px solid var(--machined-border)',
              borderRadius: '4px',
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(15,23,42,0.4)', marginBottom: '4px' }}>Hours</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.65)' }}>Mon – Fri: 8am – 6pm EST</div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Footer */}
      <div style={{
        borderTop: '1px solid var(--machined-border)',
        padding: '20px clamp(20px, 5vw, 40px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        backgroundColor: '#f8fafc'
      }}>
        <p style={{
          fontSize: '0.775rem',
          color: 'rgba(15, 23, 42, 0.5)',
          margin: 0,
          fontWeight: 500
        }}>
          © 2026 Drywall Toolbox. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          {['Privacy Policy', 'Terms of Service'].map((item) => (
            <Link
              key={item}
              to="#"
              style={{ fontSize: '0.775rem', color: 'rgba(15,23,42,0.45)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(15,23,42,0.45)')}
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
