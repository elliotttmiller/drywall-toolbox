import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductsByCategory } from '../services/catalog';
import { useCart } from '../context/CartContext';
import ProductDetail from '../components/ProductDetail';
import ProductModal from '../components/ProductModal';
import Toast from '../components/Toast';
import VariantChips from '../components/VariantChips';
import SEOHead from '../components/SEOHead';
import { buildBreadcrumbSchema } from '../utils/schema';
import { getProductVariations } from '../services/api';
import { findMatchingVariation, fetchVariationsBatched } from '../utils/variationSelection';

export default function CategoryPage() {
  const { slug } = useParams();
  const { addToCart } = useCart();

  // All fetch-derived state in one object — avoids synchronous multi-setState
  // inside useEffect (react-hooks/set-state-in-effect rule).
  const [pageState, setPageState] = useState({ loading: true, products: [], category: null, error: null });
  const [modalProduct, setModalProduct] = useState(null);
  const [modalSelectedAttrs, setModalSelectedAttrs] = useState({});
  const [toast, setToast]         = useState(null);

  const showToast = (message, type = 'cart') => setToast({ message, type });

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  const [cardVariants, setCardVariants] = useState({});
  const [cardVariationMap, setCardVariationMap] = useState({});
  const cardVariationMapRef = useRef({});
  const handleVariantSelect = useCallback((productId, attrName, value) => {
    setCardVariants(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [attrName]: value },
    }));
  }, []);

  useEffect(() => {
    let mounted = true;

    getProductsByCategory(slug).then((prods) => {
      if (!mounted) return;
      const label = slug.charAt(0).toUpperCase() + slug.slice(1);
      setPageState({
        loading: false,
        products: prods,
        category: { name: label, slug },
        error: prods.length === 0 ? `No products found in "${label}".` : null,
      });
    }).catch((err) => {
      if (mounted) setPageState({ loading: false, products: [], category: null, error: err.message || 'Failed to load category.' });
    });

    return () => { mounted = false; };
  }, [slug]);

  const { loading, products, category, error } = pageState;

  useEffect(() => {
    cardVariationMapRef.current = cardVariationMap;
  }, [cardVariationMap]);

  useEffect(() => {
    const variableIds = products
      .filter((p) => p.is_variable && p.id && !cardVariationMapRef.current[p.id])
      .map((p) => p.id);
    if (variableIds.length === 0) return;

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations).then((pairs) => {
      if (!mounted) return;
      const next = {};
      pairs.forEach(([id, vars]) => {
        next[id] = vars;
      });
      setCardVariationMap((prev) => ({ ...prev, ...next }));
    });

    return () => { mounted = false; };
  }, [products]);

  const getCardDisplayProduct = useCallback((product) => {
    if (!product?.is_variable) return product;
    const selectedAttrs = cardVariants[product.id] || {};
    const selectedVariation = findMatchingVariation(cardVariationMap[product.id] || [], selectedAttrs);
    return selectedVariation || product;
  }, [cardVariationMap, cardVariants]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SEOHead noindex title="Loading category…" />
        <div className="text-center text-gray-400">Loading category…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-16 text-center">
        <SEOHead noindex title="Category not found" />
        <p className="text-red-500 mb-4">{error}</p>
        <Link to="/products" className="text-primary-600 underline">Browse all products</Link>
      </div>
    );
  }

  const categoryName = category?.name || slug;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { label: 'Home',      path: '/'                    },
    { label: 'Products',  path: '/products'             },
    { label: categoryName, path: `/category/${slug}`   },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title={categoryName}
        description={`Shop ${categoryName} drywall tools and equipment. Professional-grade products from top brands at unbeatable prices.`}
        canonical={`https://drywalltoolbox.com/category/${slug}`}
        schema={breadcrumbSchema}
      />
      <div className="container mx-auto px-4 py-12">
        {category && (
          <h1 className="text-3xl font-bold mb-8 text-gray-900">{category.name}</h1>
        )}

        {products.length === 0 ? (
          <p className="text-gray-500">No products found in this category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
                const cardProduct = getCardDisplayProduct(product);
                const hasSelectedVariation = cardProduct.id !== product.id;
                return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setModalSelectedAttrs(cardVariants[product.id] || {});
                  setModalProduct(product);
                }}
              >
                <div className="w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {cardProduct.image ? (
                    <img
                      src={cardProduct.image}
                      alt={cardProduct.name || product.name}
                      className="w-full h-full object-contain p-4"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://www.drywalltoolbox.com/wp/wp-content/uploads/2026/04/no-image-placeholder.webp';
                      }}
                    />
                  ) : (
                    <div className="text-gray-300">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {product.brand && (
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{product.brand}</p>
                  )}
                  <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">{product.name}</h3>
                  {product.is_variable && product.variation_attributes && product.variation_attributes.length > 0 && (
                    <div className="mb-2">
                      <VariantChips
                        attributes={product.variation_attributes}
                        selected={cardVariants[product.id] || {}}
                        onSelect={(attrName, value) => handleVariantSelect(product.id, attrName, value)}
                        compact
                      />
                    </div>
                  )}
                  {product.price !== '' && (
                    <p className="text-primary-600 font-bold">
                      {product.is_variable && !hasSelectedVariation && product.min_price != null
                        ? `From $${product.min_price.toFixed(2)}`
                        : `$${typeof cardProduct.price === 'number' ? cardProduct.price.toFixed(2) : parseFloat(cardProduct.price || 0).toFixed(2)}`
                      }
                    </p>
                  )}
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.is_variable) {
                          setModalSelectedAttrs(cardVariants[product.id] || {});
                          setModalProduct(product);
                        } else {
                          handleAddToCart(product);
                        }
                      }}
                    className="mt-3 w-full py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {product.is_variable ? 'View Options' : 'Add to Cart'}
                  </button>
                </div>
              </div>
                );
            })}
          </div>
        )}
      </div>

      {/* Product detail modal */}
      <ProductModal
        isOpen={!!modalProduct}
        product={modalProduct}
        onClose={() => {
          setModalProduct(null);
          setModalSelectedAttrs({});
        }}
      >
        {modalProduct && (
          <ProductDetail
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={() => {
              setModalProduct(null);
              setModalSelectedAttrs({});
            }}
            initialSelectedAttrs={modalSelectedAttrs}
          />
        )}
      </ProductModal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
