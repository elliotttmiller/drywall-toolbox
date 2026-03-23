import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function Footer() {
  const [navOpen, setNavOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <footer className="site-footer" style={{
      background: 'white',
      borderTop: '1px solid var(--machined-border)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Main footer content */}
      <div className="footer-main-content" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(24px, 4vw, 40px)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', order: 3 }}>
          <h3 style={{
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            margin: '0 0 24px 0',
            fontWeight: 800,
            color: 'var(--primary-600)'
          }}>
            Follow Us
          </h3>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a 
              href="https://instagram.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'var(--alloy-deep)', transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => e.target.style.opacity = '0.7'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              <Instagram size={20} />
            </a>
            <a 
              href="https://facebook.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'var(--alloy-deep)', transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => e.target.style.opacity = '0.7'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              <Facebook size={20} />
            </a>
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'var(--alloy-deep)', transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => e.target.style.opacity = '0.7'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              <Twitter size={20} />
            </a>
          </div>
        </div>

        <div className="footer-col footer-center-on-mobile" style={{ order: 1 }}>
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="md:hidden flex items-center justify-center bg-none border-none cursor-pointer text-center relative mb-6"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '24px',
              width: '100%'
            }}
          >
            <h5 style={{
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              margin: 0,
              fontWeight: 800,
              color: 'var(--primary-600)',
              flex: 'none'
            }}>
              Menu
            </h5>
            <ChevronDown 
              size={16} 
              style={{
                position: 'absolute',
                right: 0,
                transform: navOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
                flex: 'none'
              }}
            />
          </button>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0,
            textAlign: 'center'
          }} className={navOpen ? 'block md:block' : 'hidden md:block'}>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              <Link to="/products" style={{ textDecoration: 'none', color: 'black' }}>
                Shop
              </Link>
            </li>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              <Link to="/parts" style={{ textDecoration: 'none', color: 'black' }}>
                Parts
              </Link>
            </li>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              <Link to="/about" style={{ textDecoration: 'none', color: 'black' }}>
                About Us
              </Link>
            </li>
          </ul>
        </div>

        <div className="footer-col footer-center-on-mobile" style={{ order: 2 }}>
          <button
            onClick={() => setSupportOpen(!supportOpen)}
            className="md:hidden flex items-center justify-center bg-none border-none cursor-pointer text-center relative mb-6"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '24px',
              width: '100%'
            }}
          >
            <h5 style={{
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              margin: 0,
              fontWeight: 800,
              color: 'var(--primary-600)',
              flex: 'none'
            }}>
              Support
            </h5>
            <ChevronDown 
              size={16} 
              style={{
                position: 'absolute',
                right: 0,
                transform: supportOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
                flex: 'none'
              }}
            />
          </button>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0,
            textAlign: 'center'
          }} className={supportOpen ? 'block md:block' : 'hidden md:block'}>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              Shipping Policy
            </li>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              Return Portal
            </li>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              Safety Guides
            </li>
            <li style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.6, color: 'black' }}>
              <Link to="/contact" style={{ textDecoration: 'none', color: 'black' }}>
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright Footer */}
      <div className="footer-copyright" style={{
        borderTop: '1px solid var(--machined-border)',
        textAlign: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <p style={{
          fontSize: '0.8rem',
          color: 'rgba(15, 23, 42, 0.7)',
          margin: 0,
          fontWeight: 500
        }}>
          Copyright © 2026 Drywall Toolbox.
        </p>
      </div>
    </footer>
  );
}
