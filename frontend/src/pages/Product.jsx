import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProductById } from '../services/catalog';
import { useCart } from '../context/CartContext';
import ProductDetail from '../components/ProductDetail';
import Toast from '../components/ui/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import SEOHead from '../components/SEOHead';
import { buildProductSchema, buildBreadcrumbSchema, stripHtml } from '../utils/schema';

export default function Product() {
  const { slug, partNumber } = useParams();
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
    // Support both /products/:slug (current) and /product/:partNumber (legacy)
    const key = slug || partNumber;

    const load = async () => {
      // catalog service resolves by numeric ID, slug, SKU, or part_number
      // using the live WooCommerce REST API.
      return getProductById(key);
    };

    load()
      .then(found => { if (mounted) setProduct(found || null); })
      .catch(() => { if (mounted) setProduct(null); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [slug, partNumber]);

  if (loading) {
    return (
      <>
        <SEOHead noindex title="Loading product…" />
        <LoadingSpinner fullPage size="lg" label="Loading product" />
      </>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-16">
        <SEOHead noindex title="Product not found" />
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

  // Read _dtb_seo_* overrides from WooCommerce product meta_data
  const metaMap = {};
  if (Array.isArray(product.meta_data)) {
    product.meta_data.forEach(({ key: metaKey, value: metaValue }) => { metaMap[metaKey] = metaValue; });
  }

  const seoTitle    = metaMap['_dtb_seo_title']       || product.name || '';
  const seoDesc     = metaMap['_dtb_seo_description'] || stripHtml(product.short_description || product.description || '');
  const seoCanon    = metaMap['_dtb_seo_canonical']   || '';
  const seoNoindex  = !!metaMap['_dtb_seo_noindex'];

  const heroImage = (Array.isArray(product.images) && product.images[0])
    ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0].src)
    : product.image || '';

  const productSchema   = buildProductSchema(product);
  // Canonical slug for the breadcrumb: prefer WooCommerce slug, then SKU, then
  // the URL param we resolved with — keeps breadcrumb links consistent with
  // the canonical URLs emitted by the schema builder and the route definition.
  const productSlug     = product.slug || product.sku || slug || partNumber || String(product.id);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { label: 'Home',       path: '/'         },
    { label: 'Products',   path: '/products' },
    { label: product.name, path: `/products/${productSlug}` },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonical={seoCanon}
        noSuffix={!!metaMap['_dtb_seo_title']}
        noindex={seoNoindex}
        og={{ type: 'product', image: heroImage, imageAlt: product.name }}
        schema={[productSchema, breadcrumbSchema].filter(Boolean)}
        links={heroImage ? [{ rel: 'preload', href: heroImage, as: 'image' }] : []}
      />
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

