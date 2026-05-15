/**
 * frontend/src/utils/cartLineFactory.js
 *
 * Canonical factory for building WooCommerce Store API cart line items.
 *
 * Rules (mirroring the architecture requirement):
 *   Simple product           → use product ID
 *   Variable product         → use variation ID (NEVER parent ID)
 *   Toolset selected variant → use variation ID + toolset metadata
 *   Toolset selected simple  → use product ID + toolset metadata
 *   Included accessory       → use product or variation ID + metadata
 *
 * Every line built through this factory passes the same ID contract that
 * woocommerceVariationPayload.js enforces, so Veeqo / QuickBooks always
 * receive real purchasable SKUs.
 *
 * @module cartLineFactory
 */

import { v4 as uuidv4 } from 'uuid';

// ── Simple / variable product lines ──────────────────────────────────────────

/**
 * Build a cart line for a simple product.
 *
 * @param {{ id: number, quantity?: number }} params
 * @returns {{ id: number, quantity: number }}
 */
export function buildSimpleCartLine( { id, quantity = 1 } ) {
  if ( ! id || id <= 0 ) {
    throw new Error( 'cartLineFactory: simple product requires a valid product id.' );
  }
  return { id, quantity };
}

/**
 * Build a cart line for a variation (purchasable child of a variable product).
 * The line always carries the variation ID, not the parent product ID.
 *
 * @param {{ variationId: number, quantity?: number }} params
 * @returns {{ id: number, quantity: number }}
 */
export function buildVariationCartLine( { variationId, quantity = 1 } ) {
  if ( ! variationId || variationId <= 0 ) {
    throw new Error( 'cartLineFactory: variation product requires a valid variationId.' );
  }
  return { id: variationId, quantity };
}

// ── Toolset Builder lines ─────────────────────────────────────────────────────

/**
 * Build all cart line items for a completed Toolset Builder configuration.
 *
 * Each selected slot produces one line item tagged with toolset metadata.
 * All lines for the same configuration share a `_dtb_toolset_instance_id`
 * UUID so WooCommerce orders, Veeqo, and QuickBooks can group them.
 *
 * @param {object} params
 * @param {string}  params.templateId     Template ID (e.g. 'tapetech-full')
 * @param {string}  params.brandKey       Brand key  (e.g. 'tapetech')
 * @param {string}  params.scope          Template scope (e.g. 'full')
 * @param {object}  params.selections
 *   Map of slotId → { slotLabel, productId, variationId?, sku, name,
 *                     variationLabel?, isIncluded? }
 * @returns {Array<{ id: number, quantity: number, metadata: object[] }>}
 */
export function buildToolsetCartLines( {
  templateId,
  brandKey,
  scope,
  selections,
} ) {
  const instanceId = uuidv4();
  const lines      = [];

  for ( const [ slotId, selection ] of Object.entries( selections ) ) {
    const {
      slotLabel       = slotId,
      productId,
      variationId     = 0,
      quantity        = 1,
      isIncluded      = false,
    } = selection;

    if ( ! productId || productId <= 0 ) {
      throw new Error(
        `cartLineFactory: toolset slot "${ slotId }" has no valid productId.`
      );
    }

    // Cart ID — always the variation ID for variable products.
    const cartId = variationId > 0 ? variationId : productId;

    lines.push( {
      id:       cartId,
      quantity,
      metadata: [
        { key: '_dtb_toolset_id',           value: templateId },
        { key: '_dtb_toolset_instance_id',  value: instanceId },
        { key: '_dtb_toolset_slot',         value: slotId },
        { key: '_dtb_toolset_slot_label',   value: slotLabel },
        { key: '_dtb_toolset_brand',        value: brandKey },
        { key: '_dtb_toolset_scope',        value: scope },
        { key: '_dtb_included_item',        value: isIncluded ? '1' : '0' },
      ],
    } );
  }

  return lines;
}

// ── Card product line ─────────────────────────────────────────────────────────

/**
 * Build a cart line from a backend-normalized cardProduct DTO.
 *
 * The cardProduct DTO already encodes the correct ID:
 *   - Simple:    cardProduct.id = product.id
 *   - Variable:  cardProduct.id = defaultVariation.id (variation ID)
 *   - Variation: cardProduct.id = variation.id
 *
 * @param {{ id: number, addToCartType?: string, quantity?: number }} cardProduct
 * @returns {{ id: number, quantity: number }}
 */
export function buildCardProductCartLine( cardProduct, quantity = 1 ) {
  const id = cardProduct?.id;
  if ( ! id || id <= 0 ) {
    throw new Error( 'cartLineFactory: cardProduct has no valid id.' );
  }
  return { id, quantity };
}
