/**
 * frontend/src/pages/ProductDetailPage.jsx
 *
 * Route-level product detail page — /products/:slug
 *
 * Architecture:
 *   - useProductDetail(slug)       → fetches parent + variations + computed
 *   - useSelectedVariation(...)    → URL-driven variation state machine
 *   - ProductMediaGallery          → variation-aware gallery
 *   - ProductPrice                 → price with From/sale
 *   - ProductSkuBlock              → SKU / MPN
 *   - ProductAvailabilityNotice    → stock status badge
 *   - ProductPurchasePanel         → variant selector + qty + add-to-cart
 *   - ProductDescriptionAccordion  → description/specs/shipping
 *
 * URL contract:
 *   /products/:slug                — resolve default variation (see variationUrl.js)
 *   /products/:slug?variant=12345  — pre-select variation 12345
 *
 * State is always fully re-derivable from URL + API data — safe to refresh,
 * use back/forward, or deep-link to any specific variation.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import useProductDetail from '../hooks/useProductDetail';
import { useSelectedVariation } from '../hooks/useSelectedVariation';
import { getVariationSelectionMap } from '../utils/variationSelection';
import { buildBreadcrumbSchema, buildProductSchema, stripHtml } from '../utils/schema';
import ProductDetail from '../components/product/ProductDetail';
import SEOHead from '../components/shared/SEOHead';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/ui/Toast';
import { useState } from 'react';

function getVariationDisplayName(product, selectedVariation, effectiveVariationName) {
  const variationName = `${selectedVariation?.name || ''}`.trim();
  const parentName = `${product?.name || ''}`.trim();
  if (variationName && variationName.toLowerCase() !== parentName.toLowerCase()) {
    return variationName;
  }
  return [parentName, effectiveVariationName].filter(Boolean).join(' — ');
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate  = useNavigate();
  const { addToCart } = useCart();

  const [toast, setToast] = useState(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { product, variations, computed, status, error } = useProductDetail(slug);

  // ── Variation state machine ────────────────────────────────────────────────
  const { selectedVariation } = useSelectedVariation(variations, computed);

  // ── Add to cart ────────────────────────────────────────────────────────────
  const handleAddToCart = (prod, qty = 1) => {
    try {
      addToCart(prod, qty);
      setToast({ message: `${prod.name} added to cart!`, type: 'cart' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to add to cart.', type: 'error' });
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === 'loading' || status === 'idle') {
    return (
      <>
        <SEOHead noindex title="Loading product…" />
        <LoadingSpinner fullPage size="lg" label="Loading product" />
      </>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (status === 'not_found' || !product) {
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

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="min-h-screen container mx-auto px-4 py-16">
        <SEOHead noindex title="Error loading product" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Unable to load product</h2>
          <p className="text-gray-600 mb-6">{error || 'Something went wrong.'}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded">Go Back</button>
        </div>
      </div>
    );
  }

  const effectiveVariationName = selectedVariation
    ? (selectedVariation.variation_attribute_values || [])
        .filter((a) => a.option)
        .map((a) => a.option)
        .join(' / ')
    : '';
  const effectiveProduct = selectedVariation || product;
  const effectiveProductName = selectedVariation
    ? getVariationDisplayName(product, selectedVariation, effectiveVariationName)
    : product.name;

  // ── SEO ────────────────────────────────────────────────────────────────────
  const metaMap = {};
  if (Array.isArray(product.meta_data)) {
    product.meta_data.forEach(({ key: k, value: v }) => { metaMap[k] = v; });
  }
  const seoTitle   = selectedVariation
    ? effectiveProductName
    : (metaMap['_dtb_seo_title'] || product.name || '');
  const seoDesc    = metaMap['_dtb_seo_description'] || stripHtml(
    selectedVariation?.short_description || selectedVariation?.description_full || product.short_description || product.description || ''
  );
  const seoCanon   = metaMap['_dtb_seo_canonical'] || '';
  const seoNoindex = !!metaMap['_dtb_seo_noindex'];

  const heroImage = selectedVariation?.images?.[0] || selectedVariation?.image || product.images?.[0]?.src || product.image || '';

  const productSchema    = buildProductSchema({ ...product, ...effectiveProduct, name: effectiveProductName });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { label: 'Home',       path: '/' },
    { label: 'Products',   path: '/products' },
    { label: effectiveProductName, path: `/products/${product.slug || slug}` },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonical={seoCanon}
        noSuffix={!!metaMap['_dtb_seo_title'] && !selectedVariation}
        noindex={seoNoindex}
        og={{ type: 'product', image: heroImage, imageAlt: effectiveProductName }}
        schema={[productSchema, breadcrumbSchema].filter(Boolean)}
        links={heroImage ? [{ rel: 'preload', href: heroImage, as: 'image' }] : []}
      />

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '24px', fontSize: '0.8rem', color: '#64748b' }}>
          <Link to="/" style={{ color: '#64748b', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <Link to="/products" style={{ color: '#64748b', textDecoration: 'none' }}>Products</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: '#0f172a', fontWeight: 600 }}>{effectiveProductName}</span>
        </nav>
        <ProductDetail
          product={product}
          onAddToCart={handleAddToCart}
          initialVariations={variations}
          initialResolvedVariation={selectedVariation}
          initialSelectedAttrs={selectedVariation ? getVariationSelectionMap(selectedVariation) : {}}
          initialComputedData={computed}
          disableLegacyDetailFetch
        />
      </div>

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
