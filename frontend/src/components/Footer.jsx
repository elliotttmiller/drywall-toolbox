import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Instagram, Facebook, Twitter, ChevronDown, Mail, Phone, MapPin, Clock } from 'lucide-react';
import LogoBlack from '/logo-black.svg';

export default function Footer() {
  const [expandedMobile, setExpandedMobile] = useState(null);

  const toggleMobileSection = (section) => {
    setExpandedMobile(expandedMobile === section ? null : section);
  };

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
        gap: '60px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }} className="footer-grid">

        {/* Brand column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', width: '100%' }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img src={LogoBlack} alt="Drywall Toolbox" className="footer-logo" style={{ display: 'block' }} />
          </Link>
          <div style={{ display: 'flex', gap: '6px', marginTop: '16px', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <a
              href="https://www.instagram.com/drywalltoolbox"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--alloy-deep)', textDecoration: 'none', cursor: 'pointer' }}
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--alloy-deep)', textDecoration: 'none', cursor: 'pointer' }}
              aria-label="Facebook"
            >
              <Facebook size={18} />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--alloy-deep)', textDecoration: 'none', cursor: 'pointer' }}
              aria-label="Twitter / X"
            >
              <Twitter size={18} />
            </a>
          </div>
        </div>

        {/* Shop column */}
        <div className="footer-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <h5 style={{
            display: 'none',
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            margin: '0 0 20px 0',
            fontWeight: 800,
            color: 'var(--primary-600)'
          }}>
            Shop
          </h5>
          <button
            onClick={() => toggleMobileSection('shop')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: 0,
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              margin: '0',
              fontWeight: 800,
              color: 'var(--primary-600)',
              width: '100%'
            }}
            className="footer-header-mobile"
          >
            Shop
            <ChevronDown size={16} style={{ 
              transition: 'transform 0.3s ease',
              transform: expandedMobile === 'shop' ? 'rotate(180deg)' : 'rotate(0deg)'
            }} />
          </button>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: 0, 
            display: expandedMobile === 'shop' ? 'flex' : 'none',
            flexDirection: 'column', 
            gap: '10px',
            alignItems: 'center'
          }} className="footer-list-shop">
            {[
              { to: '/all-products', label: 'All Products' },
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
        <div className="footer-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <h5 style={{
            display: 'none',
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            margin: '0 0 20px 0',
            fontWeight: 800,
            color: 'var(--primary-600)'
          }}>
            Support
          </h5>
          <button
            onClick={() => toggleMobileSection('support')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: 0,
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              margin: '0',
              fontWeight: 800,
              color: 'var(--primary-600)',
              width: '100%'
            }}
            className="footer-header-mobile"
          >
            Support
            <ChevronDown size={16} style={{ 
              transition: 'transform 0.3s ease',
              transform: expandedMobile === 'support' ? 'rotate(180deg)' : 'rotate(0deg)'
            }} />
          </button>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: 0, 
            display: expandedMobile === 'support' ? 'flex' : 'none',
            flexDirection: 'column', 
            gap: '10px',
            alignItems: 'center'
          }} className="footer-list-support">
            {[
              { to: '/contact',         label: 'Contact Us'      },
              { to: '/repairs',         label: 'Repair Services' },
              { to: '/shipping-policy', label: 'Shipping Policy' },
              { to: '/returns',         label: 'Return Portal'   },
              { to: '/policies',        label: 'Store Policies'  }
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

        {/* Contact column — desktop only, hidden on mobile/tablet via CSS */}
        <div className="dtb-footer-contact-col">
          <h5>Contact &amp; Support</h5>
          <a href="mailto:support@drywalltoolbox.com" className="dtb-footer-contact-item">
            <Mail size={14} />
            support@drywalltoolbox.com
          </a>
          <Link to="/contact" className="dtb-footer-contact-item">
            <Phone size={14} />
            Contact Us Online
          </Link>
          <span className="dtb-footer-contact-item" style={{ cursor: 'default' }}>
            <Clock size={14} />
            Mon – Fri&nbsp;· 8AM – 5PM CST
          </span>
          <Link to="/repairs" className="dtb-footer-contact-item" style={{ marginTop: '4px' }}>
            <MapPin size={14} />
            Tool Repair Services
          </Link>
        </div>
      </div>

      {/* Copyright Footer */}
      <div style={{
        borderTop: '1px solid var(--machined-border)',
        padding: '20px clamp(20px, 5vw, 40px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        backgroundColor: '#f8fafc',
        textAlign: 'center'
      }}>
        <p style={{
          fontSize: '0.775rem',
          color: 'rgba(15, 23, 42, 0.5)',
          margin: 0,
          fontWeight: 500
        }}>
          © 2026 Drywall Toolbox. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
