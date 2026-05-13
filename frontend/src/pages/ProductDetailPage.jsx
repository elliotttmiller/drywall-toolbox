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
import { buildCartItem } from '../utils/woocommerceVariationPayload';
import { buildBreadcrumbSchema, buildProductSchema, stripHtml } from '../utils/schema';
import ProductMediaGallery from '../components/product/ProductMediaGallery';
import ProductPrice from '../components/product/ProductPrice';
import ProductSkuBlock from '../components/product/ProductSkuBlock';
import ProductPurchasePanel from '../components/product/ProductPurchasePanel';
import ProductDescriptionAccordion from '../components/product/ProductDescriptionAccordion';
import SEOHead from '../components/shared/SEOHead';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/ui/Toast';
import { useState } from 'react';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';

const BRAND_LOGOS = {
  'Columbia Taping Tools': columbiaLogo,
  'TapeTech': tapeTechLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo,
  'Level 5': level5Logo,
};

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
  const {
    selectedVariation,
    variationState,
    selectVariation,
  } = useSelectedVariation(variations, computed);

  // ── Add to cart ────────────────────────────────────────────────────────────
  const handleAddToCart = (prod, variation, qty) => {
    try {
      const item = buildCartItem(prod, variation, qty);
      addToCart(item, item.quantity);
      const name = variation
        ? [prod.name, Object.values(
            variation.variation_attribute_values?.reduce((acc, a) => { acc[a.name] = a.option; return acc; }, {}) || {}
          ).join(' / ')].filter(Boolean).join(' — ')
        : prod.name;
      setToast({ message: `${name} added to cart!`, type: 'cart' });
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

  const brandLogo = BRAND_LOGOS[product.brand] ?? null;

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

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '24px', fontSize: '0.8rem', color: '#64748b' }}>
          <Link to="/" style={{ color: '#64748b', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <Link to="/products" style={{ color: '#64748b', textDecoration: 'none' }}>Products</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: '#0f172a', fontWeight: 600 }}>{effectiveProductName}</span>
        </nav>

        {/* Main grid: image left, details right */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: '48px',
            alignItems: 'start',
          }}
          className="product-detail-grid"
        >
          {/* ── Left: Media ──────────────────────────────────────────────────── */}
          <ProductMediaGallery
            product={product}
            selectedVariation={selectedVariation}
          />

          {/* ── Right: Info + Purchase ───────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Brand + badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={product.brand}
                  style={{ height: '22px', objectFit: 'contain' }}
                />
              ) : (
                product.brand && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary-600)' }}>
                    {product.brand}
                  </span>
                )
              )}
            </div>

            {/* Product name */}
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, margin: 0 }}>
              {effectiveProductName}
              {selectedVariation && effectiveVariationName && !`${effectiveProductName}`.toLowerCase().includes(`${effectiveVariationName}`.toLowerCase()) && (
                <span style={{ display: 'block', fontSize: '1rem', fontWeight: 500, color: '#64748b', marginTop: '4px' }}>
                  {effectiveVariationName}
                </span>
              )}
            </h1>

            {/* Short description */}
            {product.short_description && (
              <div
                style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.65 }}
                dangerouslySetInnerHTML={{
                  __html: product.short_description,
                }}
              />
            )}

            {/* Price */}
            <ProductPrice product={product} selectedVariation={selectedVariation} />

            {/* SKU */}
            <ProductSkuBlock product={product} selectedVariation={selectedVariation} />

            {/* Purchase panel */}
            <ProductPurchasePanel
              product={product}
              variations={variations}
              computed={computed}
              selectedVariation={selectedVariation}
              variationState={variationState}
              onVariationSelect={selectVariation}
              onAddToCart={handleAddToCart}
            />
          </div>
        </div>

        {/* Description accordion — full width below the grid */}
        <ProductDescriptionAccordion
          product={product}
          selectedVariation={selectedVariation}
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
