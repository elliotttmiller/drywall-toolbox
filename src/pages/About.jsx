import { 
  Building2, 
  Users, 
  Award, 
  Target,
  CheckCircle2,
  Truck,
  Clock,
  Shield,
  TrendingUp,
  Heart
} from 'lucide-react';

export default function About() {
  const values = [
    {
      icon: Award,
      title: 'Quality First',
      description: 'We only carry tools that meet our strict quality standards from trusted manufacturers.'
    },
    {
      icon: Users,
      title: 'Expert Team',
      description: 'Our team consists of industry professionals who understand your needs.'
    },
    {
      icon: Truck,
      title: 'Fast Shipping',
      description: 'Most orders ship within 24 hours with free shipping on orders over $500.'
    },
    {
      icon: Shield,
      title: 'Warranty Coverage',
      description: 'All products come with manufacturer warranties and our satisfaction guarantee.'
    },
    {
      icon: Heart,
      title: 'Customer Focused',
      description: '24/7 support from real people who care about your success.'
    },
    {
      icon: TrendingUp,
      title: 'Industry Leaders',
      description: 'Partnering with the most innovative brands in the drywall industry.'
    }
  ];

  const stats = [
    { number: '15+', label: 'Years Experience' },
    { number: '10,000+', label: 'Happy Customers' },
    { number: '50+', label: 'Brand Partners' },
    { number: '24/7', label: 'Customer Support' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Building2 className="h-16 w-16 mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              About Drywall Toolbox
            </h1>
            <p className="text-xl text-primary-100">
              Your trusted partner for professional drywall tools and equipment since 2026
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Our Mission
            </h2>
            <p className="text-lg text-gray-600 mb-4">
              At Drywall Toolbox, we're committed to providing professional contractors with the highest quality tools and equipment from the industry's most trusted brands.
            </p>
            <p className="text-lg text-gray-600">
              We understand that your tools are an investment in your business, which is why we carefully curate our selection to include only the best products that will help you work more efficiently and deliver exceptional results.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-primary-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose Us
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We're more than just a supplier – we're your partner in success
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-primary-300 hover:-translate-y-1"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary-100 text-primary-600 mb-4">
                    <IconComponent size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted Brand Partners
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We partner with the industry's most respected manufacturers
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {['TapeTech', 'Level5', 'Columbia', 'Drywall Master', 'Can-Am', 'Delko', 'Kraft', 'Advance', 'Northstar', 'Goldblatt', 'Marshalltown', 'Warner'].map((brand, index) => (
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
            <Target className="h-12 w-12 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Work With Us?
            </h2>
            <p className="text-lg md:text-xl mb-8 text-primary-100">
              Join thousands of professionals who trust Drywall Toolbox for their tool needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Shop Now
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all border-2 border-white/30"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
