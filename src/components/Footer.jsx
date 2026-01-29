import { Link } from 'react-router-dom';
import { 
  Wrench, 
  Phone, 
  Mail, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin 
} from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-2 rounded-lg">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Drywall Toolbox</h3>
            </div>
            <p className="text-sm mb-4">
              Professional drywall tools and equipment from industry-leading brands.
            </p>
            <div className="flex gap-3">
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-primary-400 transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-primary-400 transition-colors">Shop</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-primary-400 transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary-400 transition-colors">Contact</Link>
              </li>
            </ul>
          </div>

          {/* Product Categories */}
          <div>
            <h4 className="text-white font-semibold mb-4">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products?category=taping" className="hover:text-primary-400 transition-colors">
                  Automatic Taping
                </Link>
              </li>
              <li>
                <Link to="/products?category=finishing" className="hover:text-primary-400 transition-colors">
                  Finishing Tools
                </Link>
              </li>
              <li>
                <Link to="/products?category=corner" className="hover:text-primary-400 transition-colors">
                  Corner Tools
                </Link>
              </li>
              <li>
                <Link to="/products?category=sanding" className="hover:text-primary-400 transition-colors">
                  Sanding Tools
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Phone size={16} className="mt-1 flex-shrink-0" />
                <a href="tel:1-800-379-9255" className="hover:text-primary-400 transition-colors">
                  1-800-DRYWALL
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail size={16} className="mt-1 flex-shrink-0" />
                <a href="mailto:support@drywalltoolbox.com" className="hover:text-primary-400 transition-colors">
                  support@drywalltoolbox.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-1 flex-shrink-0" />
                <span>123 Tool Street, Builder City, BC 12345</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p>&copy; 2026 Drywall Toolbox. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-primary-400 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-primary-400 transition-colors">
                Terms of Service
              </Link>
              <Link to="/shipping" className="hover:text-primary-400 transition-colors">
                Shipping Info
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
