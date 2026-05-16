import { Heart, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductPurchasePanel({
  quantity,
  onDecrease,
  onIncrease,
  onAddToCart,
  canAddToCart,
  isOutOfStock,
  needsVariation,
  hasCompleteSelection,
  isWishlisted,
  onToggleWishlist,
  partsUrl,
}) {
  return (
    <div className="product-detail-purchase-panel dtb-pdp-purchase-panel">
      <div className="dtb-pdp-purchase-row">
        <div className="dtb-pdp-quantity-stepper">
          <button type="button" onClick={onDecrease} className="dtb-pdp-quantity-stepper__button" aria-label="Decrease quantity">
            <Minus size={16} />
          </button>
          <span className="dtb-pdp-quantity-stepper__value">{quantity}</span>
          <button type="button" onClick={onIncrease} className="dtb-pdp-quantity-stepper__button" aria-label="Increase quantity">
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          disabled={!canAddToCart}
          className="dtb-pdp-add-to-cart"
        >
          <ShoppingCart size={16} />
          <span aria-live="polite">
            {isOutOfStock ? 'Out of Stock' : (needsVariation && !hasCompleteSelection ? 'Select Options' : 'Add to Cart')}
          </span>
        </button>
      </div>

      <div className="dtb-pdp-purchase-panel__meta-row">
        <button
          type="button"
          onClick={onToggleWishlist}
          className={`dtb-pdp-save-button${isWishlisted ? ' is-active' : ''}`}
          aria-pressed={isWishlisted}
        >
          <Heart size={16} />
          <span>{isWishlisted ? 'Saved' : 'Save for later'}</span>
        </button>

        {partsUrl ? (
          <Link to={partsUrl} className="dtb-pdp-parts-link">
            View compatible schematics and parts
          </Link>
        ) : null}
      </div>
    </div>
  );
}
