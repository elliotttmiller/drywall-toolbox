/**
 * ProductCard — Production-grade product listing card.
 *
 * Reusable across Products.jsx, AllProducts.jsx, and CategoryPage.jsx.
 * Follows the DTB Machined Precision design system (machined-design.css).
 *
 * Props
 * ─────
 *   product           Source product. For variable products, this is the parent.
 *   cardProduct       Resolved product to display (selected variation or product itself).
 *   hasSelectedVariation  True when cardProduct is a different object from product.
 *   cardVariants      { [attrName]: value } — current chip selections for this card.
 *   onVariantSelect   (attrName, value) => void — chip change handler.
 *   onOpenModal       () => void — opens the full product detail modal.
 *   onAddToCart       () => void — direct add-to-cart (simple products).
 *   index             Integer card index — used for staggered fade-in animation.
 */

import { ShoppingCart, Heart, ChevronRight } from 'lucide-react';
import ProductCardImage from './ProductCardImage';
import VariantChips from './VariantChips';

const STOCK_STATUS_OUT_OF_STOCK = 'outofstock';

export default function ProductCard({
  product,
  cardProduct,
  hasSelectedVariation = false,
  cardVariants = {},
  onVariantSelect,
  onOpenModal,
  onAddToCart,
  index = 0,
}) {
  // ── Derived display values ────────────────────────────────────────────────
  const effectiveProduct = cardProduct || product;
  const isOutOfStock = (effectiveProduct?.stock_status || product.stock_status) === STOCK_STATUS_OUT_OF_STOCK;
  const isOnSale     = effectiveProduct?.on_sale || product.on_sale;

  // Price display: "From $X.XX" for unresolved variable, otherwise the exact price.
  const displayPrice = product.is_variable && !hasSelectedVariation && product.min_price != null
    ? `From $${Number(product.min_price).toFixed(2)}`
    : `$${typeof effectiveProduct.price === 'number'
        ? effectiveProduct.price.toFixed(2)
        : parseFloat(effectiveProduct.price || 0).toFixed(2)
      }`;

  const hasVariationAttrs =
    product.is_variable &&
    Array.isArray(product.variation_attributes) &&
    product.variation_attributes.length > 0;

  return (
    <div
      className="dtb-plp-card product-card-enter group"
      style={{ '--card-index': index }}
    >
      {/* ── Image area ────────────────────────────────────────────────────── */}
      <div className="dtb-plp-card__img-wrap">
        {/* Clickable overlay — opens modal */}
        <button
          type="button"
          className="dtb-plp-card__img-btn"
          onClick={onOpenModal}
          aria-label={`View ${product.name || product.part_number || 'product'}`}
          tabIndex={0}
        >
          <ProductCardImage
            src={effectiveProduct.image || product.image}
            alt={effectiveProduct.name || product.name}
            padding="10px"
          />
        </button>

        {/* Badge — top-left */}
        {product.badge && (
          <span className={`dtb-plp-card__badge dtb-plp-card__badge--${
            product.badge === 'Best Seller' ? 'bestseller' :
            product.badge === 'Popular'     ? 'popular'    :
            product.badge === 'New'         ? 'new'        : 'sale'
          }`}>
            {product.badge}
          </span>
        )}

        {/* Sale badge — top-left (if no other badge) */}
        {!product.badge && isOnSale && (
          <span className="dtb-plp-card__badge dtb-plp-card__badge--sale">Sale</span>
        )}

        {/* Out-of-stock overlay pill — top-right */}
        {isOutOfStock && (
          <span className="dtb-plp-card__oos-badge">Out of Stock</span>
        )}

        {/* Wishlist button — top-right, visible on hover */}
        <button
          type="button"
          className="dtb-plp-card__wishlist"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
        >
          <Heart size={14} aria-hidden="true" />
        </button>
      </div>

      {/* ── Card body ─────────────────────────────────────────────────────── */}
      <div className="dtb-plp-card__body">
        {/* Brand eyebrow */}
        {product.brand && (
          <p className="dtb-plp-card__brand">{product.brand}</p>
        )}

        {/* Product name */}
        <h3 className="dtb-plp-card__name">
          <button
            type="button"
            onClick={onOpenModal}
            className="dtb-plp-card__name-btn"
          >
            {product.name || product.part_number}
          </button>
        </h3>

        {/* SKU — monospace, muted */}
        {(effectiveProduct.sku || product.sku) && (
          <p className="dtb-plp-card__sku">
            SKU:&nbsp;{effectiveProduct.sku || product.sku}
          </p>
        )}

        {/* Variant chips — for variable products */}
        {hasVariationAttrs && (
          <div className="dtb-plp-card__variants">
            <VariantChips
              attributes={product.variation_attributes}
              selected={cardVariants}
              onSelect={onVariantSelect}
              compact
            />
          </div>
        )}

        {/* ── Footer: price + CTA ─────────────────────────────────────────── */}
        <div className="dtb-plp-card__footer">
          <p className={`dtb-plp-card__price${isOutOfStock ? ' dtb-plp-card__price--oos' : ''}`}>
            {displayPrice}
          </p>

          {product.is_variable ? (
            /* Variable → "Options" text CTA */
            <button
              type="button"
              className="dtb-plp-card__cta dtb-plp-card__cta--options"
              onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
              aria-label="View options"
            >
              Options&nbsp;<ChevronRight size={11} aria-hidden="true" />
            </button>
          ) : (
            /* Simple → cart icon button */
            <button
              type="button"
              className="dtb-plp-card__cta dtb-plp-card__cta--cart"
              onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
              disabled={isOutOfStock}
              aria-label="Add to cart"
            >
              <ShoppingCart size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
