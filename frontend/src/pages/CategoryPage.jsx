import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductsByCategory } from '../services/catalog';
import { useCart } from '../context/CartContext';
import { useWorkflowTransition } from '../context/WorkflowTransitionContext.jsx';
import ProductDetail from '../components/product/ProductDetail';
import ProductModal from '../components/product/ProductModal';
import ProductShoppingCard from '../components/ui/ProductShoppingCard';
import { ProductSkeletonGrid } from '../components/catalog/ProductShoppingCardSkeleton';
import LoadingCardTransition from '../components/shared/LoadingCardTransition.jsx';
import Toast from '../components/ui/Toast';
import SEOHead from '../components/shared/SEOHead';
import { buildBreadcrumbSchema } from '../utils/schema';
import { getProductVariations } from '../services/api';
import { fetchVariationsBatched, getVariationSelectionMap } from '../utils/variationSelection';
import { PLACEHOLDER_IMAGE } from '../constants/images.js';

export default function CategoryPage() {
  const { slug } = useParams();
  const { addToCart } = useCart();
  const { runWorkflow } = useWorkflowTransition();

  const [pageState, setPageState] = useState({ loading: true, products: [], category: null, error: null });
  const [modalProduct, setModalProduct] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'cart') => setToast({ message, type });

  const handleAddToCart = async (product, quantity = 1) => {
    try {
      await runWorkflow(
        {
          label: 'Adding to cart…',
          sublabel: product?.name || 'Updating your cart securely.',
          blocking: false,
        },
        () => addToCart(product, quantity),
      );
      showToast(`${product.name} added to cart!`, 'cart');
    } catch (err) {
      showToast(err?.message || 'Could not add item to cart. Please try again.', 'error');
    }
  };

  const openModal = (product, cardProduct = null) => {
    const initialResolvedVariation = cardProduct?.parent_id ? cardProduct : null;
    setModalProduct({
      product,
      initialResolvedVariation,
      initialSelectedAttrs: initialResolvedVariation
        ? getVariationSelectionMap(initialResolvedVariation)
        : {},
    });
  };

  const [cardVariationMap, setCardVariationMap] = useState({});
  const cardVariationMapRef = useRef({});

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
    if (variableIds.length === 0) return undefined;

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
    const best = vars.find(v => v.stock_status !== 'outofstock') || vars[0];
    if (!best) return product;
    if (!best.image || best.image === PLACEHOLDER_IMAGE) {
      return {
        ...best,
        image: product.image,
        images: product.images,
        image_thumbnail: product.image_thumbnail,
        image_srcset: product.image_srcset,
        image_sizes: product.image_sizes,
      };
    }
    return best;
  }, [cardVariationMap]);

  if (!loading && error) {
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
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products' },
    { label: categoryName, path: `/category/${slug}` },
  ]);

  const loadingSkeleton = (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 h-10 w-56 rounded-xl dtb-loading-bar" aria-hidden="true" />
      <ProductSkeletonGrid count={24} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        noindex={loading}
        title={loading ? 'Loading category…' : categoryName}
        description={loading ? undefined : `Shop ${categoryName} drywall tools and equipment. Professional-grade products from top brands at unbeatable prices.`}
        canonical={loading ? undefined : `https://drywalltoolbox.com/category/${slug}`}
        schema={loading ? undefined : breadcrumbSchema}
      />

      <LoadingCardTransition loading={loading} skeleton={loadingSkeleton} label="Loading category products">
        <div className="container mx-auto px-4 py-12">
          {category && (
            <h1 className="text-3xl font-bold mb-8 text-gray-900">{category.name}</h1>
          )}

          {products.length === 0 ? (
            <p className="text-gray-500">No products found in this category.</p>
          ) : (
            <div className={`dtb-product-grid${products.length === 1 ? ' dtb-product-grid--single' : ''}`}>
              {products.map((product, index) => {
                const cardProduct = getCardDisplayProduct(product);
                return (
                  <ProductShoppingCard
                    key={product.id}
                    product={product}
                    cardProduct={cardProduct}
                    hasSelectedVariation={false}
                    onOpenModal={() => openModal(product, cardProduct)}
                    onAddToCart={() => handleAddToCart(cardProduct || product, 1)}
                    index={index}
                  />
                );
              })}
            </div>
          )}
        </div>
      </LoadingCardTransition>

      <ProductModal
        isOpen={!!modalProduct}
        product={modalProduct?.product || modalProduct}
        onClose={() => {
          setModalProduct(null);
        }}
      >
        {modalProduct && (
          <ProductDetail
            key={`${modalProduct.product?.id || modalProduct.id}:${modalProduct.initialResolvedVariation?.id || 'parent'}`}
            product={modalProduct.product || modalProduct}
            onAddToCart={handleAddToCart}
            onClose={() => {
              setModalProduct(null);
            }}
            initialVariations={cardVariationMap[modalProduct.product?.id || modalProduct.id] || []}
            initialResolvedVariation={modalProduct.initialResolvedVariation}
            initialSelectedAttrs={modalProduct.initialSelectedAttrs}
          />
        )}
      </ProductModal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
