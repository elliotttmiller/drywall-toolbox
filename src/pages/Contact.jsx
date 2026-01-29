import { useState } from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  MessageSquare,
  Send,
  Clock,
  HelpCircle
} from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for your message! We will get back to you soon.');
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const faqs = [
    {
      question: 'What are your shipping times?',
      answer: 'Most orders ship within 1-2 business days. Free shipping on orders over $500.'
    },
    {
      question: 'Do you offer warranties?',
      answer: 'Yes, all products come with manufacturer warranties. Contact us for specific warranty details.'
    },
    {
      question: 'Can I return a product?',
      answer: 'Yes, we accept returns within 30 days of purchase. Items must be in original condition.'
    },
    {
      question: 'Do you offer bulk discounts?',
      answer: 'Yes, we offer competitive pricing for bulk orders. Contact our sales team for a quote.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Get in Touch
            </h1>
            <p className="text-xl text-primary-100">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Contact Info Cards */}
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-xl transition-shadow border border-gray-200">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary-100 text-primary-600 mb-4">
              <Phone size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Phone</h3>
            <p className="text-gray-600 mb-4">Mon-Fri from 8am to 6pm EST</p>
            <a href="tel:1-800-379-9255" className="text-primary-600 hover:text-primary-700 font-semibold">
              1-800-DRYWALL
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-xl transition-shadow border border-gray-200">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary-100 text-primary-600 mb-4">
              <Mail size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Email</h3>
            <p className="text-gray-600 mb-4">We'll respond within 24 hours</p>
            <a href="mailto:support@drywalltoolbox.com" className="text-primary-600 hover:text-primary-700 font-semibold break-all">
              support@drywalltoolbox.com
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-xl transition-shadow border border-gray-200">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary-100 text-primary-600 mb-4">
              <MapPin size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Office</h3>
            <p className="text-gray-600 mb-4">Visit us in person</p>
            <p className="text-gray-700">
              123 Tool Street<br />
              Builder City, BC 12345
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Tell us more about your inquiry..."
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg"
              >
                <Send size={20} />
                Send Message
              </button>
            </form>
          </div>

          {/* FAQ Section */}
          <div>
            <div className="bg-white rounded-lg shadow-md p-8 mb-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="h-8 w-8 text-primary-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Business Hours</h3>
                  <p className="text-gray-600 text-sm">Eastern Standard Time</p>
                </div>
              </div>
              <div className="space-y-3 text-gray-700">
                <div className="flex justify-between">
                  <span>Monday - Friday:</span>
                  <span className="font-semibold">8:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday:</span>
                  <span className="font-semibold">9:00 AM - 4:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday:</span>
                  <span className="font-semibold">Closed</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <HelpCircle className="h-8 w-8 text-primary-600" />
                <h3 className="text-xl font-bold text-gray-900">Frequently Asked Questions</h3>
              </div>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                    <h4 className="font-semibold text-gray-900 mb-2">{faq.question}</h4>
                    <p className="text-gray-600 text-sm">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
