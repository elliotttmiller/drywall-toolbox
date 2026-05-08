/**
 * components/Footer.jsx — FuturisticGradientFooter (IndoUI-style)
 *
 * Dark gradient footer with glowing blue accents, animated hover effects,
 * and responsive mobile accordion sections.
 */

import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Instagram, Facebook, Twitter, ChevronDown, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import LogoWhite from '/logo-white.svg';

const FOOTER_LINK_STYLE = {
  textDecoration: 'none',
  fontSize: '0.875rem',
  color: 'rgba(255,255,255,0.55)',
  transition: 'color 0.18s',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

function FooterLink({ to, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      style={{
        ...FOOTER_LINK_STYLE,
        color: hovered ? '#93c5fd' : 'rgba(255,255,255,0.55)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#93c5fd', flexShrink: 0 }} />
      )}
      {children}
    </Link>
  );
}

export default function Footer() {
  const [expandedMobile, setExpandedMobile] = useState(null);

  const toggleMobileSection = (section) => {
    setExpandedMobile(expandedMobile === section ? null : section);
  };

  return (
    <footer
      className="site-footer"
      style={{
        background: 'linear-gradient(160deg, #0b1120 0%, #0f2150 50%, #1a3a8a 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dot-grid texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)',
        backgroundSize: '36px 36px',
        pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: 'clamp(40px, 6vw, 72px) clamp(20px, 5vw, 40px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '48px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
      }} className="footer-grid">

        {/* Brand column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', width: '100%' }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img src={LogoWhite} alt="Drywall Toolbox" className="footer-logo" style={{ display: 'block' }} />
          </Link>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, textAlign: 'center', maxWidth: '180px', margin: 0 }}>
            Professional drywall tools &amp; expert support.
          </p>
          {/* Social links */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
            {[
              { href: 'https://www.instagram.com/drywalltoolbox', Icon: Instagram, label: 'Instagram' },
              { href: 'https://facebook.com', Icon: Facebook, label: 'Facebook' },
              { href: 'https://twitter.com', Icon: Twitter, label: 'Twitter / X' },
            ].map(({ href, Icon, label }) => (
              <Motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                whileHover={{ y: -2, color: '#93c5fd' }}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '34px', height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.55)',
                  textDecoration: 'none',
                }}
              >
                <Icon size={15} />
              </Motion.a>
            ))}
          </div>
        </div>

        {/* Shop column */}
        <div className="footer-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <h5 style={{ display: 'none', textTransform: 'uppercase', fontSize: '0.67rem', letterSpacing: '0.12em', margin: '0 0 16px 0', fontWeight: 800, color: 'rgba(255,255,255,0.35)' }}>
            Shop
          </h5>
          <button
            onClick={() => toggleMobileSection('shop')}
            className="footer-header-mobile"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: 0, textTransform: 'uppercase', fontSize: '0.67rem', letterSpacing: '0.12em', fontWeight: 800, color: 'rgba(255,255,255,0.35)', width: '100%' }}
          >
            Shop
            <ChevronDown size={14} style={{ transition: 'transform 0.25s', transform: expandedMobile === 'shop' ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(255,255,255,0.35)' }} />
          </button>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: expandedMobile === 'shop' ? 'flex' : 'none', flexDirection: 'column', gap: '10px', alignItems: 'center' }} className="footer-list-shop">
            {[
              { to: '/all-products', label: 'All Products' },
              { to: '/products?category=taping', label: 'Taping Tools' },
              { to: '/products?category=finishing', label: 'Finishing Tools' },
              { to: '/products?category=sanding', label: 'Sanding Tools' },
              { to: '/parts', label: 'Parts & Schematics' },
            ].map(({ to, label }) => (
              <li key={to}><FooterLink to={to}>{label}</FooterLink></li>
            ))}
          </ul>
        </div>

        {/* Support column */}
        <div className="footer-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <h5 style={{ display: 'none', textTransform: 'uppercase', fontSize: '0.67rem', letterSpacing: '0.12em', margin: '0 0 16px 0', fontWeight: 800, color: 'rgba(255,255,255,0.35)' }}>
            Support
          </h5>
          <button
            onClick={() => toggleMobileSection('support')}
            className="footer-header-mobile"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: 0, textTransform: 'uppercase', fontSize: '0.67rem', letterSpacing: '0.12em', fontWeight: 800, color: 'rgba(255,255,255,0.35)', width: '100%' }}
          >
            Support
            <ChevronDown size={14} style={{ transition: 'transform 0.25s', transform: expandedMobile === 'support' ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(255,255,255,0.35)' }} />
          </button>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: expandedMobile === 'support' ? 'flex' : 'none', flexDirection: 'column', gap: '10px', alignItems: 'center' }} className="footer-list-support">
            {[
              { to: '/contact', label: 'Contact Us' },
              { to: '/repairs', label: 'Repair Services' },
              { to: '/shipping-policy', label: 'Shipping Policy' },
              { to: '/returns', label: 'Return Portal' },
              { to: '/policies', label: 'Store Policies' },
            ].map(({ to, label }) => (
              <li key={label}><FooterLink to={to}>{label}</FooterLink></li>
            ))}
          </ul>
        </div>

        {/* Contact column — desktop only */}
        <div className="dtb-footer-contact-col" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h5 style={{ textTransform: 'uppercase', fontSize: '0.67rem', letterSpacing: '0.12em', margin: '0 0 6px 0', fontWeight: 800, color: 'rgba(255,255,255,0.35)' }}>
            Contact &amp; Support
          </h5>
          {[
            { Icon: Mail, href: 'mailto:support@drywalltoolbox.com', text: 'support@drywalltoolbox.com' },
            { Icon: Phone, to: '/contact', text: 'Contact Us Online' },
            { Icon: Clock, text: 'Mon – Fri · 8AM – 5PM CST' },
            { Icon: MapPin, to: '/repairs', text: 'Tool Repair Services' },
          ].map(({ Icon, href, to, text }) => {
            const inner = (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', transition: 'color 0.18s' }}>
                <Icon size={13} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.35)' }} />
                {text}
              </span>
            );
            if (href) return (
              <a key={text} href={href} style={{ textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.querySelector('span').style.color = '#93c5fd'; }}
                onMouseLeave={(e) => { e.currentTarget.querySelector('span').style.color = 'rgba(255,255,255,0.5)'; }}>
                {inner}
              </a>
            );
            if (to) return (
              <Link key={text} to={to} style={{ textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.querySelector('span').style.color = '#93c5fd'; }}
                onMouseLeave={(e) => { e.currentTarget.querySelector('span').style.color = 'rgba(255,255,255,0.5)'; }}>
                {inner}
              </Link>
            );
            return <div key={text}>{inner}</div>;
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', position: 'relative', zIndex: 1, margin: '0 clamp(20px, 5vw, 40px)' }} />

      {/* Copyright */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '20px clamp(20px, 5vw, 40px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.775rem', color: 'rgba(255,255,255,0.25)', margin: 0, fontWeight: 500 }}>
          © 2026 Drywall Toolbox. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['Privacy Policy', 'Terms of Service'].map((item) => (
            <Link
              key={item}
              to="#"
              style={{ fontSize: '0.775rem', color: 'rgba(255,255,255,0.25)', textDecoration: 'none', transition: 'color 0.18s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#93c5fd'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
