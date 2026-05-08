import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductsByCategory } from '../services/catalog';
import { useCart } from '../context/CartContext';
import ProductDetail from '../components/ProductDetail';
import ProductModal from '../components/ProductModal';
import ProductShoppingCard from '../components/ui/ProductShoppingCard';
import Toast from '../components/ui/Toast';
import SEOHead from '../components/SEOHead';
import { buildBreadcrumbSchema } from '../utils/schema';
import { getProductVariations } from '../services/api';
import { fetchVariationsBatched } from '../utils/variationSelection';

export default function CategoryPage() {
  const { slug } = useParams();
  const { addToCart } = useCart();

  // All fetch-derived state in one object — avoids synchronous multi-setState
  // inside useEffect (react-hooks/set-state-in-effect rule).
  const [pageState, setPageState] = useState({ loading: true, products: [], category: null, error: null });
  const [modalProduct, setModalProduct] = useState(null);
  const [toast, setToast]         = useState(null);

  const showToast = (message, type = 'cart') => setToast({ message, type });

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  const [cardVariationMap, setCardVariationMap] = useState({});
  const cardVariationMapRef = useRef({});

  // Depend on the visible variable-product ID set instead of the products
  // array identity so the effect does not re-fire on equivalent renders.

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
  const pageVariableIdsKey = products
    .filter((p) => p.is_variable && p.id)
    .map((p) => String(p.id))
    .join(',');

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
    }).catch(() => { /* variations are non-critical */ });

    return () => { mounted = false; };
  }, [pageVariableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCardDisplayProduct = useCallback((product) => {
    if (!product.is_variable) return product;
    const vars = cardVariationMap[product.id];
    if (!Array.isArray(vars) || vars.length === 0) return product;
    // Prefer first in-stock variation; fall back to first variation overall.
    return vars.find(v => v.stock_status !== 'outofstock') || vars[0] || product;
  }, [cardVariationMap]);

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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {products.map((product, index) => {
                const cardProduct = getCardDisplayProduct(product);
                const hasSelectedVariation = cardProduct.id !== product.id;
                return (
                  <ProductShoppingCard
                    key={product.id}
                    product={product}
                    cardProduct={cardProduct}
                    hasSelectedVariation={hasSelectedVariation}
                    onOpenModal={() => {
                      setModalProduct(product);
                    }}
                      onAddToCart={() => handleAddToCart(cardProduct, 1)}
                    index={index}
                  />
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
        }}
      >
        {modalProduct && (
          <ProductDetail
            key={modalProduct.id}
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={() => {
              setModalProduct(null);
            }}
            initialVariations={cardVariationMap[modalProduct.id] || []}
          />
        )}
      </ProductModal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
