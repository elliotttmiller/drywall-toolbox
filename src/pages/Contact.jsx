import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Contact Us</h1>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <MessageSquare className="h-12 w-12 mb-4 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Get in Touch</h2>
            <p className="text-gray-600 mb-6">
              Have a question? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Phone className="h-6 w-6 text-primary-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                  <p className="text-gray-600">1-800-DRYWALL</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Mail className="h-6 w-6 text-primary-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                  <p className="text-gray-600">support@drywalltoolbox.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <MapPin className="h-6 w-6 text-primary-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
                  <p className="text-gray-600">123 Tool Street, Builder City, BC 12345</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
