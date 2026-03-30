import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { loadProducts } from '../data/products';
import { getProduct as wcGetProduct, getProducts as wcGetProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductDetail from '../components/ProductDetail';
import Toast from '../components/Toast';

export default function Product() {
  const { partNumber, id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  useEffect(() => {
    let mounted = true;
    // Support both /product/:partNumber (legacy) and /products/:id (WooCommerce)
    const key = id || partNumber;

    const load = async () => {
      // If a numeric ID and WooCommerce is configured, fetch directly by ID
      if (process.env.REACT_APP_WC_BASE_URL && id && /^\d+$/.test(id)) {
        return wcGetProduct(id);
      }
      // If WooCommerce is configured, search by SKU / part number in the full list
      if (process.env.REACT_APP_WC_BASE_URL) {
        const list = await wcGetProducts();
        return list.find(p => (p.sku || p.part_number || String(p.id)) === key) || null;
      }
      // Fall back to CSV
      const list = await loadProducts();
      return list.find(p => (p.part_number || p.id) === key) || null;
    };

    load()
      .then(found => { if (mounted) setProduct(found || null); })
      .catch(() => { if (mounted) setProduct(null); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [partNumber, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 text-gray-400">Loading product…</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Product not found</h2>
          <p className="text-gray-600 mb-6">We couldn't find the product you're looking for.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded">Go Back</button>
            <Link to="/products" className="px-4 py-2 bg-primary-600 text-white rounded">Browse Products</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <div className="container mx-auto px-4 py-12">
        <ProductDetail 
          product={product} 
          onAddToCart={handleAddToCart}
          onClose={() => navigate(-1)}
        />
      </div>
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

