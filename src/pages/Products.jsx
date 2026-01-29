import { ShoppingBag, Package, DollarSign } from 'lucide-react';

export default function Products() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Products</h1>
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <ShoppingBag className="h-24 w-24 mx-auto mb-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Catalog Coming Soon</h2>
          <p className="text-gray-600">We're building an amazing shopping experience for you.</p>
        </div>
      </div>
    </div>
  );
}
