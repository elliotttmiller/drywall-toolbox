/**
 * Normalizes a Shopify product from the Storefront API into the internal
 * product shape used throughout the app.
 *
 * Both the products page and CSV-based product loader produce the same shape,
 * so all existing components continue to work without modification.
 *
 * @param {Object} shopifyProduct - Product node from Shopify Storefront API
 * @returns {Object} Normalized product object
 */
export function normalizeProduct(shopifyProduct) {
  if (!shopifyProduct) return null;

  const {
    id,
    title,
    handle,
    vendor,
    description,
    descriptionHtml,
    priceRange,
    images,
    variants,
    metafields,
    seo,
  } = shopifyProduct;

  // Extract metafield values
  const metafieldMap = {};
  if (metafields) {
    for (const mf of metafields) {
      if (mf) metafieldMap[`${mf.namespace}.${mf.key}`] = mf.value;
    }
  }

  const brand = metafieldMap['custom.brand'] || vendor || '';
  const partNumber = metafieldMap['custom.part_number'] || handle || '';
  const upc = metafieldMap['custom.upc'] || '';

  // Images
  const imageNodes = images?.nodes || [];
  const imageUrls = imageNodes.map((img) => img.url).filter(Boolean);
  const primaryImage = imageUrls[0] || '/product-placeholder.jpg';

  // Price from first variant or priceRange
  const firstVariant = variants?.nodes?.[0];
  const priceAmount = firstVariant?.price?.amount
    ?? priceRange?.minVariantPrice?.amount
    ?? '0';
  const price = parseFloat(priceAmount);

  // SKU
  const sku = firstVariant?.sku || partNumber || '';

  return {
    // IDs
    id: id || handle,
    shopify_id: id,
    handle,

    // Display
    name: title || '',
    brand,
    vendor,

    // Product identifiers
    part_number: partNumber,
    sku,
    upc,

    // Pricing
    price,

    // Images
    image: primaryImage,
    images: imageUrls.length > 0 ? imageUrls : ['/product-placeholder.jpg'],

    // Description
    short_description: description || seo?.description || '',
    description_full: descriptionHtml || description || '',

    // Category (inferred from tags or title if not available)
    category: inferCategoryFromProduct(title, description, vendor),

    // Availability
    availableForSale: firstVariant?.availableForSale ?? true,
    quantityAvailable: firstVariant?.quantityAvailable ?? null,

    // Variants (for Shopify cart operations)
    variantId: firstVariant?.id || null,
    variants: variants?.nodes || [],

    // Legacy compatibility
    url: `/products/${handle}`,
    rating: 0,
    reviews: 0,
    badge: null,
    _raw: shopifyProduct,
  };
}

/**
 * Normalize an array of Shopify products.
 */
export function normalizeProducts(shopifyProducts) {
  if (!shopifyProducts) return [];
  const nodes = Array.isArray(shopifyProducts)
    ? shopifyProducts
    : shopifyProducts.nodes || shopifyProducts.edges?.map((e) => e.node) || [];
  return nodes.map(normalizeProduct).filter(Boolean);
}

/**
 * Infer a category from product title and description.
 * Mirrors the logic in app/data/products.js for CSV products.
 */
function inferCategoryFromProduct(name = '', description = '', vendor = '') {
  const text = `${name} ${description} ${vendor}`.toLowerCase();

  if (/\bsand(er|ing)?\b/.test(text)) return 'sanding';
  if (/loading pump|gooseneck|compound tube|mud tube|mud pan|box filler|filler adapt|hot mud pump|mud pump|pump repair/.test(text))
    return 'mudboxes';
  if (/automatic taper|auto taper|\btaper\b|\btaping\b|taping tool|\bbanjo\b|predator taper|semi[ -]auto(matic)?|bazooka/.test(text))
    return 'taping';
  if (/corner roller|angle head|angle box|corner flush|\bflusher\b|corner applicat|corner finish|bead roller|corner cobra|inside corner|outside corner|inside 90|outside 90|\bl-trim\b|nail spot|nailspot|throttle[ -]?box/.test(text))
    return 'corner';
  if (/flat box|finishing box|smoothing blade|flat finisher|finishing knife|putty knife|joint knife|box handle|tomahawk|sabre|wipe[ -]down/.test(text))
    return 'finishing';

  return '';
}
