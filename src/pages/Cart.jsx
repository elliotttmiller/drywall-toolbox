import { ShoppingCart, Package } from 'lucide-react';

export default function Cart() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Cart is Empty</h2>
          <p className="text-gray-600 mb-6">Add some products to get started!</p>
        </div>
      </div>
    </div>
  );
}
