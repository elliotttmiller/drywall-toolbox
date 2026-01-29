import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { loadProducts } from '../data/products';
import { ArrowRight, CheckCircle2, Truck, Award, Clock, Star } from 'lucide-react';

export default function Home() {
  const categories = [
    {
      id: 'taping',
      name: 'Automatic Taping',
      description: 'Professional automatic taping tools and accessories',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'finishing',
      name: 'Finishing Tools',
      description: 'Smoothing and finishing tools for perfect results',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'corner',
      name: 'Corner Tools',
      description: 'Professional corner bead and angle tools',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'mudboxes',
      name: 'Mud Boxes & Pumps',
      description: 'High-capacity mixing and pumping equipment',
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 'sanding',
      name: 'Sanding Tools',
      description: 'Power sanders and hand sanding solutions',
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'safety',
      name: 'Safety Equipment',
      description: 'Protective gear and safety accessories',
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'accessories',
      name: 'Accessories & Parts',
      description: 'Replacement parts and tool accessories',
      color: 'from-gray-500 to-gray-600'
    },
    {
      id: 'specialty',
      name: 'Specialty Tools',
      description: 'Specialized equipment for unique applications',
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  const features = [
    {
      icon: CheckCircle2,
      title: 'Premium Quality',
      description: 'Tools from industry-leading brands you can trust'
    },
    {
      icon: Truck,
      title: 'Free Shipping',
      description: 'On all orders over $500'
    },
    {
      icon: Award,
      title: 'Expert Support',
      description: '24/7 customer service from tool specialists'
    },
    {
      icon: Clock,
      title: 'Fast Delivery',
      description: 'Most orders ship within 1-2 business days'
    }
  ];

  const fallbackBrands = [
    'TapeTech', 'Level5', 'Columbia', 'Drywall Master',
    'Can-Am', 'Delko', 'Kraft', 'Advance', 'Northstar', 
    'Goldblatt', 'Marshalltown', 'Warner'
  ];

  const [brands, setBrands] = useState(fallbackBrands);

  useEffect(() => {
    let mounted = true;
    loadProducts().then(list => {
      if (!mounted) return;
      const unique = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
      if (unique.length > 0) setBrands(unique);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-fade-in">
              Professional Drywall Tools & Equipment
            </h1>
            <p className="text-lg md:text-xl mb-8 text-primary-100 animate-slide-up">
              Premium quality tools from industry-leading brands. Everything you need to get the job done right.
            </p>
            {/* CTAs removed to simplify hero */}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Shop by Category
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Find the perfect tools for your specific needs
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <Link
                  key={category.id}
                  to={`/products?category=${category.id}`}
                  className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-primary-300 hover:-translate-y-1"
                >
                  <div className="p-6">
                            {/* icon removed intentionally to simplify category cards */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {category.description}
                    </p>
                    <div className="flex items-center text-primary-600 text-sm font-semibold">
                      Browse
                      <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
                    <IconComponent size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted Brands
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We carry tools from the most respected manufacturers in the industry
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {brands.map((brand, index) => (
              <div
                key={index}
                className="flex items-center justify-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <span className="text-gray-700 font-semibold text-center">
                  {brand}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <Star className="h-12 w-12 mx-auto mb-6 text-accent-400" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-lg md:text-xl mb-8 text-primary-100">
              Browse our extensive catalog of professional drywall tools and find everything you need for your next project.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              View All Products
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
