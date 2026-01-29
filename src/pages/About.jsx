import { Building2, Users, Award, Target } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">About Us</h1>
        <div className="bg-white rounded-lg shadow-md p-12">
          <Building2 className="h-16 w-16 mx-auto mb-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            Professional Drywall Tools Since 2026
          </h2>
          <p className="text-gray-600 text-center max-w-3xl mx-auto">
            We are dedicated to providing the highest quality drywall tools and equipment 
            to professionals across the industry.
          </p>
        </div>
      </div>
    </div>
  );
}
