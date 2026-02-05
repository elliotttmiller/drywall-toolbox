import { Link } from 'react-router-dom';
import '../styles/footer-responsive.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <div className="footer-logo">
          <div className="footer-brand-mark" />
          <span className="footer-brand-name">Drywall Toolbox</span>
        </div>
        <p className="footer-tagline">
          Machined Precision for the Modern Finisher. Built for the grind.
        </p>
      </div>

      <div className="footer-section">
        <h5 className="footer-heading">
          Navigation
        </h5>
        <ul className="footer-list">
          <li className="footer-list-item">
            <Link to="/products" className="footer-link">
              Catalog
            </Link>
          </li>
          <li className="footer-list-item">
            <Link to="/parts" className="footer-link">
              Parts Schematics
            </Link>
          </li>
          <li className="footer-list-item">
            <Link to="/about" className="footer-link">
              About Us
            </Link>
          </li>
          <li className="footer-list-item">
            Technical Docs
          </li>
        </ul>
      </div>

      <div className="footer-section">
        <h5 className="footer-heading">
          Support
        </h5>
        <ul className="footer-list">
          <li className="footer-list-item">
            Shipping Policy
          </li>
          <li className="footer-list-item">
            Return Portal
          </li>
          <li className="footer-list-item">
            Safety Guides
          </li>
          <li className="footer-list-item">
            <Link to="/contact" className="footer-link">
              Contact
            </Link>
          </li>
        </ul>
      </div>

      <div className="footer-section">
        <h5 className="footer-heading">
          Industrial Access
        </h5>
        <p className="footer-newsletter-text">
          Sign up for trade-only discounts and technical updates.
        </p>
        <input 
          type="email" 
          placeholder="Email Address" 
          className="machined-input footer-email-input"
        />
      </div>
    </footer>
  );
}
