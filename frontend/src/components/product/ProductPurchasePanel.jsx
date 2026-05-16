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
    <div className="product-detail-purchase-panel space-y-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
          <button type="button" onClick={onDecrease} className="p-2" aria-label="Decrease quantity">
            <Minus size={16} />
          </button>
          <span className="px-3 py-2 min-w-10 text-center font-semibold">{quantity}</span>
          <button type="button" onClick={onIncrease} className="p-2" aria-label="Increase quantity">
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleWishlist}
          className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 ${isWishlisted ? 'border-red-300 text-red-500' : 'border-gray-200 text-gray-500'}`}
          aria-pressed={isWishlisted}
        >
          <Heart size={16} />
          Save
        </button>
      </div>

      <button
        type="button"
        onClick={onAddToCart}
        disabled={!canAddToCart}
        className="alloy-button w-full justify-center"
        style={{ display: 'flex' }}
      >
        <ShoppingCart size={16} />
        <span aria-live="polite">
          {isOutOfStock ? 'Out of Stock' : (needsVariation && !hasCompleteSelection ? 'Select Options' : 'Add to Cart')}
        </span>
      </button>

      {partsUrl ? (
        <Link to={partsUrl} className="inline-flex text-sm text-blue-600 hover:text-blue-700 underline">
          View compatible schematics and parts
        </Link>
      ) : null}
    </div>
  );
}
