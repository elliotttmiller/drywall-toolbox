import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getCategories, getProductsByCategory } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductDetail from '../components/ProductDetail';
import Toast from '../components/Toast';

export default function CategoryPage() {
  const { slug } = useParams();
  const { addToCart } = useCart();

  const [category, setCategory]   = useState(null);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [toast, setToast]         = useState(null);

  const showToast = (message, type = 'cart') => setToast({ message, type });

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const run = async () => {
      if (!process.env.REACT_APP_WC_BASE_URL) {
        if (mounted) {
          setError('WooCommerce API is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        const cats  = await getCategories();
        const found = cats.find((c) => c.slug === slug);
        if (!mounted) return;
        if (!found) {
          setError(`Category "${slug}" not found.`);
          setLoading(false);
          return;
        }
        setCategory(found);
        const prods = await getProductsByCategory(found.id);
        if (mounted) setProducts(prods);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load category.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => { mounted = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-400">Loading category…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-16 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link to="/products" className="text-primary-600 underline">Browse all products</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <div className="container mx-auto px-4 py-12">
        {category && (
          <h1 className="text-3xl font-bold mb-8 text-gray-900">{category.name}</h1>
        )}

        {products.length === 0 ? (
          <p className="text-gray-500">No products found in this category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setModalProduct(product)}
              >
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-48 object-contain p-4 bg-gray-50"
                  />
                )}
                <div className="p-4">
                  {product.brand && (
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{product.brand}</p>
                  )}
                  <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">{product.name}</h3>
                  {product.price !== '' && (
                    <p className="text-primary-600 font-bold">
                      ${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || 0).toFixed(2)}
                    </p>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                    className="mt-3 w-full py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product detail modal */}
      {modalProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setModalProduct(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl max-h-[90vh] overflow-auto">
            <ProductDetail
              product={modalProduct}
              onAddToCart={handleAddToCart}
              onClose={() => setModalProduct(null)}
            />
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
