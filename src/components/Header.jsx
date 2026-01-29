import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  ShoppingCart, 
  Search, 
  Phone, 
  Mail,
  Wrench
} from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center py-2 text-sm">
            <div className="flex items-center gap-4">
              <a href="tel:1-800-379-9255" className="flex items-center gap-2 hover:text-primary-100 transition-colors">
                <Phone size={14} />
                <span>1-800-DRYWALL</span>
              </a>
              <a href="mailto:support@drywalltoolbox.com" className="hidden md:flex items-center gap-2 hover:text-primary-100 transition-colors">
                <Mail size={14} />
                <span>support@drywalltoolbox.com</span>
              </a>
            </div>
            <div className="text-xs sm:text-sm font-medium">
              Free Shipping on Orders Over $500
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
                <Wrench className="h-6 w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div className="hidden md:block">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Drywall Toolbox
                </h1>
                <p className="text-xs text-gray-500">Professional Tools & Equipment</p>
              </div>
              <span className="md:hidden text-lg font-bold text-gray-900">Drywall Toolbox</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              <Link 
                to="/" 
                className={`font-medium transition-colors ${
                  isActive('/') 
                    ? 'text-primary-600 border-b-2 border-primary-600' 
                    : 'text-gray-700 hover:text-primary-600'
                }`}
              >
                Home
              </Link>
              <Link 
                to="/products" 
                className={`font-medium transition-colors ${
                  isActive('/products') 
                    ? 'text-primary-600 border-b-2 border-primary-600' 
                    : 'text-gray-700 hover:text-primary-600'
                }`}
              >
                Shop
              </Link>
              <Link 
                to="/about" 
                className={`font-medium transition-colors ${
                  isActive('/about') 
                    ? 'text-primary-600 border-b-2 border-primary-600' 
                    : 'text-gray-700 hover:text-primary-600'
                }`}
              >
                About
              </Link>
              <Link 
                to="/contact" 
                className={`font-medium transition-colors ${
                  isActive('/contact') 
                    ? 'text-primary-600 border-b-2 border-primary-600' 
                    : 'text-gray-700 hover:text-primary-600'
                }`}
              >
                Contact
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* Search Button */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 text-gray-700 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Cart */}
              <Link
                to="/cart"
                className="relative p-2 text-gray-700 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  0
                </span>
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-700 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar (Mobile/Expanded) */}
      {searchOpen && (
        <div className="border-b border-gray-200 bg-gray-50 animate-slide-down">
          <div className="container mx-auto px-4 py-4">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search for tools, brands, or categories..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-gray-200 bg-white animate-slide-down">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            <Link 
              to="/" 
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive('/') 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/products" 
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive('/products') 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Shop
            </Link>
            <Link 
              to="/about" 
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive('/about') 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              About
            </Link>
            <Link 
              to="/contact" 
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive('/contact') 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Contact
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
