/**
 * frontend/src/utils/schema.js
 *
 * Pure schema.org JSON-LD builder functions.
 * No side effects — every function receives data and returns a plain object.
 */

const SITE_URL  = 'https://drywalltoolbox.com';
const SITE_NAME = 'Drywall Toolbox';

/** Remove HTML tags and decode common entities for clean schema descriptions. */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g,  '&')   // must be last — prevents double-decoding of &amp;lt; etc.
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Build a schema.org/Product object.
 *
 * @param {object} product   — WooCommerce product object
 * @param {Array}  reviews   — array of review objects (optional)
 * @returns {object}
 */
export function buildProductSchema(product, reviews = []) {
  if (!product) return null;

  const name        = product.name        || '';
  const sku         = product.sku         || product.partNumber || '';
  const description = stripHtml(product.description || product.short_description || '');
  const brand       = product.brand       || product.meta_data?.find?.(m => m.key === 'brand')?.value || '';
  const price       = product.price       || product.regular_price || '';
  const salePrice   = product.sale_price;
  const inStock     = product.stock_status !== 'outofstock';

  // Prefer the first WC image; fall back to flat `image` field.
  const imageUrl = (Array.isArray(product.images) && product.images[0])
    ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0].src)
    : (product.image || '');

  const schema = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name,
    description,
    ...(sku       && { sku, mpn: sku }),
    ...(imageUrl  && { image: imageUrl }),
    ...(brand     && { brand: { '@type': 'Brand', name: brand } }),
    offers: {
      '@type':            'Offer',
      url:                product.permalink || (product.slug ? `${SITE_URL}/products/${product.slug}` : `${SITE_URL}/products/${product.id}`),
      priceCurrency:      'USD',
      price:              salePrice || price,
      ...(price && salePrice && { priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }),
      availability:       inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name:    SITE_NAME,
        url:     SITE_URL,
      },
    },
  };

  if (reviews && reviews.length > 0) {
    const totalRating = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
    const avgRating   = (totalRating / reviews.length).toFixed(1);

    schema.aggregateRating = {
      '@type':       'AggregateRating',
      ratingValue:   avgRating,
      reviewCount:   reviews.length,
      bestRating:    '5',
      worstRating:   '1',
    };

    schema.review = reviews.slice(0, 10).map(r => ({
      '@type':  'Review',
      author:   { '@type': 'Person', name: r.reviewer || r.author || 'Customer' },
      datePublished: r.date_created || r.date || '',
      reviewBody:    stripHtml(r.review || r.content || ''),
      reviewRating:  {
        '@type':       'Rating',
        ratingValue:   String(r.rating || 5),
        bestRating:    '5',
        worstRating:   '1',
      },
    }));
  }

  return schema;
}

/**
 * Build a schema.org/BreadcrumbList.
 *
 * @param {Array<{label: string, path: string}>} crumbs
 * @returns {object}
 */
export function buildBreadcrumbSchema(crumbs) {
  if (!Array.isArray(crumbs) || crumbs.length === 0) return null;

  return {
    '@context':        'https://schema.org',
    '@type':           'BreadcrumbList',
    itemListElement:   crumbs.map((crumb, index) => ({
      '@type':  'ListItem',
      position: index + 1,
      name:     crumb.label,
      item:     `${SITE_URL}${crumb.path}`,
    })),
  };
}

/**
 * Build a static schema.org/Organization object for Drywall Toolbox.
 *
 * @returns {object}
 */
export function buildOrganizationSchema() {
  return {
    '@context':   'https://schema.org',
    '@type':      'Organization',
    name:         SITE_NAME,
    url:          SITE_URL,
    logo:         `${SITE_URL}/logo-white.svg`,
    description:  'Professional drywall tools and equipment from top brands. Shop automatic taping tools, mud boxes, finishing tools, and more.',
    contactPoint: {
      '@type':            'ContactPoint',
      contactType:        'customer service',
      email:              'support@drywalltoolbox.com',
      availableLanguage:  'English',
    },
    sameAs: [
      'https://www.facebook.com/drywalltoolbox',
      'https://www.instagram.com/drywalltoolbox',
    ],
  };
}

/**
 * Build a schema.org/WebSite with SearchAction for sitelinks search box.
 *
 * @returns {object}
 */
export function buildSiteLinksSearchBoxSchema() {
  return {
    '@context':    'https://schema.org',
    '@type':       'WebSite',
    name:          SITE_NAME,
    url:           SITE_URL,
    potentialAction: {
      '@type':       'SearchAction',
      target:        {
        '@type':      'EntryPoint',
        urlTemplate:  `${SITE_URL}/all-products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
