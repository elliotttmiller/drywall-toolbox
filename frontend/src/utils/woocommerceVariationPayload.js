/**
 * frontend/src/utils/woocommerceVariationPayload.js
 *
 * Builds the WooCommerce Store API cart/add-item payload for variable products.
 *
 * WC Store API requires:
 *   id       — variation ID (NOT parent product ID)
 *   quantity — number
 *   variation — array of { attribute: string, value: string }
 *     where `attribute` is the pa_* slug for global attributes or the exact
 *     attribute name for local attributes.
 *
 * Reference:
 *   https://developer.woocommerce.com/2021/11/15/how-to-add-to-cart-using-the-store-api/
 */

const GLOBAL_ATTRIBUTE_PREFIX = 'pa_';

/**
 * Derive the correct Store API attribute slug from a WooCommerce attribute object.
 *
 * Global WC attributes (registered under Products → Attributes) use the pa_
 * prefix (e.g. pa_size).  Product-specific (local) attributes use the exact
 * attribute name as-is.
 *
 * @param {Object} attr  Variation attribute object with at least { name, slug }.
 * @returns {string}     Attribute key for the Store API variation array.
 */
function resolveAttributeSlug(attr) {
  const slug = String(attr?.slug || '').trim();
  const name = String(attr?.name || '').trim();

  // If the slug is already prefixed with pa_ (global attribute), use it.
  if (slug.startsWith(GLOBAL_ATTRIBUTE_PREFIX)) return slug;

  // If the attribute slug has content, use it (WC normalises slugs).
  if (slug) return slug;

  // Fall back to the display name — used by local product attributes.
  return name;
}

/**
 * Build the `variation` array expected by the WooCommerce Store API
 * /cart/add-item endpoint.
 *
 * @param {Array<Object>} variationAttributeValues
 *   The `variation_attribute_values` array from the variation object.
 *   Each entry: { id, name, slug, option }
 * @returns {Array<{attribute: string, value: string}>}
 */
export function buildStoreApiVariationPayload(variationAttributeValues) {
  if (!Array.isArray(variationAttributeValues)) return [];

  return variationAttributeValues
    .filter((attr) => attr?.option != null && String(attr.option).trim() !== '')
    .map((attr) => ({
      attribute: resolveAttributeSlug(attr),
      value:     String(attr.option).trim(),
    }));
}

/**
 * Build the full Store API add-to-cart body for any product type.
 *
 * For simple products:
 *   { id: product.id, quantity }
 *
 * For variable products:
 *   { id: variation.id, quantity, variation: [...] }
 *   parent_id is included as metadata only — the cart ID is always the
 *   variation ID, never the parent.
 *
 * @param {Object} product    Parent product (or simple product).
 * @param {Object|null} selectedVariation  Selected variation, or null for simple.
 * @param {number} quantity   Cart quantity (default: 1).
 * @returns {Object}          Body object for POST /wc/store/v1/cart/add-item.
 * @throws {Error}            When a variable product has no selected variation.
 */
export function buildAddToCartPayload(product, selectedVariation, quantity = 1) {
  const isVariable = product?.type === 'variable' || product?.is_variable;

  if (isVariable) {
    if (!selectedVariation?.id) {
      throw new Error(
        `Cannot add variable product "${product?.name || product?.id}" to cart without a selected variation.`
      );
    }

    const variationPayload = buildStoreApiVariationPayload(
      selectedVariation.variation_attribute_values || selectedVariation.attributes || []
    );

    return {
      id:        selectedVariation.id,
      quantity:  Math.max(1, Math.floor(quantity)),
      variation: variationPayload,
      // parent_id is not part of the WC Store API spec, but some extensions
      // read it from the extended data.  Include it for forward-compatibility.
      // It must not be treated as the cart item ID.
      _parent_id: product.id,
    };
  }

  // Simple product.
  return {
    id:       product.id,
    quantity: Math.max(1, Math.floor(quantity)),
  };
}

/**
 * Build the local CartContext item shape for a variable product line.
 *
 * This is the shape stored in CartContext / localStorage and passed to
 * syncAndPlace().  It preserves all metadata needed for cart display,
 * checkout sync, and downstream order creation.
 *
 * @param {Object} product          Parent product.
 * @param {Object} selectedVariation Selected variation.
 * @param {number} quantity          Quantity.
 * @returns {Object}                 Cart item for CartContext.addToCart().
 */
export function buildCartItem(product, selectedVariation, quantity = 1) {
  const isVariable = product?.type === 'variable' || product?.is_variable;

  if (!isVariable) {
    return {
      id:       product.id,
      name:     product.name,
      brand:    product.brand,
      price:    parseFloat(product.price || 0),
      image:    product.images?.[0]?.src || product.image || null,
      sku:      product.sku || '',
      quantity: Math.max(1, Math.floor(quantity)),
      parent_id: null,
      variation_attribute_values: null,
    };
  }

  if (!selectedVariation?.id) {
    throw new Error(
      `Cannot build cart item for variable product "${product?.name}" without a selected variation.`
    );
  }

  const variationImage =
    selectedVariation.image?.src || selectedVariation.image || null;
  const parentImage =
    product.images?.[0]?.src || product.image || null;

  const attrVals = Array.isArray(selectedVariation.variation_attribute_values)
    ? selectedVariation.variation_attribute_values
    : Array.isArray(selectedVariation.attributes)
      ? selectedVariation.attributes.map((a) => ({
          id:     a.id ?? 0,
          name:   a.name ?? '',
          slug:   a.slug ?? '',
          option: a.option ?? '',
        }))
      : [];

  const variationLabel = attrVals
    .filter((a) => a.option)
    .map((a) => `${a.name}: ${a.option}`)
    .join(' / ');

  return {
    id:       selectedVariation.id,
    name:     product.name,
    brand:    product.brand,
    variation_name: variationLabel,
    price:    parseFloat(selectedVariation.price || product.price || 0),
    image:    variationImage || parentImage,
    sku:      selectedVariation.sku || product.sku || '',
    quantity: Math.max(1, Math.floor(quantity)),
    parent_id: product.id,
    variation_attribute_values: attrVals,
    stock_status:       selectedVariation.stock_status,
    backorders_allowed: selectedVariation.backorders_allowed,
  };
}
