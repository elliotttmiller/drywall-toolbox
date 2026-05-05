import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductsByCategory } from '../services/catalog';
import { useCart } from '../context/CartContext';
import ProductDetail from '../components/ProductDetail';
import ProductModal from '../components/ProductModal';
import ProductCard from '../components/ProductCard';
import Toast from '../components/Toast';
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
  const [modalResolvedVariation, setModalResolvedVariation] = useState(null);
  const [toast, setToast]         = useState(null);

  const showToast = (message, type = 'cart') => setToast({ message, type });

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  const [cardVariants, setCardVariants] = useState({});
  const [cardVariationMap, setCardVariationMap] = useState({});
  const [loadingVariationIds, setLoadingVariationIds] = useState({});
  const cardVariationMapRef = useRef({});
  const handleVariantSelect = useCallback((productId, attrName, value) => {
    setCardVariants(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [attrName]: value },
    }));
  }, []);

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

    setLoadingVariationIds((prev) => {
      const next = { ...prev };
      variableIds.forEach((id) => { next[id] = true; });
      return next;
    });

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations).then((pairs) => {
      if (!mounted) return;
      const next = {};
      pairs.forEach(([id, vars]) => {
        next[id] = vars;
      });
      setCardVariationMap((prev) => ({ ...prev, ...next }));
      setLoadingVariationIds((prev) => {
        const next = { ...prev };
        variableIds.forEach((id) => { delete next[id]; });
        return next;
      });
    }).catch(() => {
      if (mounted) {
        setLoadingVariationIds((prev) => {
          const next = { ...prev };
          variableIds.forEach((id) => { delete next[id]; });
          return next;
        });
      }
    });

    return () => { mounted = false; };
  }, [pageVariableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {products.map((product, index) => {
                const cardProduct = getCardDisplayProduct(product);
                const hasSelectedVariation = cardProduct.id !== product.id;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cardProduct={cardProduct}
                    hasSelectedVariation={hasSelectedVariation}
                    cardVariants={cardVariants[product.id] || {}}
                    onVariantSelect={(attrName, value) => handleVariantSelect(product.id, attrName, value)}
                    isVariationLoading={Boolean(loadingVariationIds[product.id])}
                    onOpenModal={() => {
                      setModalSelectedAttrs(cardVariants[product.id] || {});
                      setModalResolvedVariation(hasSelectedVariation ? cardProduct : null);
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
          setModalSelectedAttrs({});
          setModalResolvedVariation(null);
        }}
      >
        {modalProduct && (
          <ProductDetail
            key={`${modalProduct.id}:${modalResolvedVariation?.id || 0}`}
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={() => {
              setModalProduct(null);
              setModalSelectedAttrs({});
              setModalResolvedVariation(null);
            }}
            initialSelectedAttrs={modalSelectedAttrs}
            initialResolvedVariation={modalResolvedVariation}
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
