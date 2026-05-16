import { motion as Motion } from 'framer-motion';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import ProductCardImage from '../product/ProductCardImage';

function money(value) {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value || '0'));
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
}

export default function StorefrontProductTile({
  product,
  cardProduct,
  onOpenModal,
  onAddToCart,
  index = 0,
  variant = 'grid',
}) {
  const resolved = cardProduct || product || {};
  const isVariable = Boolean(product?.is_variable);
  const stockStatus = resolved.stock_status || product?.stock_status || 'instock';
  const outOfStock = stockStatus === 'outofstock';
  const name = resolved.name || product?.name || resolved.part_number || 'Product';
  const sku = resolved.sku || product?.sku || '';
  const priceStr = isVariable && product?.min_price != null
    ? `From $${money(product.min_price)}`
    : `$${money(resolved.price ?? product?.price ?? 0)}`;

  const onSale = !isVariable && resolved.sale_price && resolved.regular_price
    && parseFloat(resolved.sale_price) < parseFloat(resolved.regular_price);
  const cardClassName = `dtb-product-card dtb-product-card--${variant} storefront-motion-card`;

  return (
    <Motion.article
      className={cardClassName}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03 }}
    >
      <button type="button" className="dtb-product-card__image" onClick={onOpenModal} aria-label={`View ${name}`}>
        {outOfStock && (
          <span className="dtb-product-card__badge dtb-product-card__badge--out">Out of Stock</span>
        )}
        {onSale && !outOfStock && (
          <span className="dtb-product-card__badge dtb-product-card__badge--sale">Sale</span>
        )}
        <ProductCardImage
          product={resolved}
          src={resolved.image_thumbnail || resolved.image}
          srcSet={resolved.image_srcset}
          sizes={variant === 'rail' ? '(max-width: 767px) 44vw, 188px' : '(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 240px'}
          alt={name}
          className="dtb-product-card__img"
          padding="0"
          fit="contain"
          preferThumbnail
          eager={index < 4}
        />
      </button>

      <div className="dtb-product-card__meta">
        {resolved.brand ? <span className="dtb-product-card__brand">{resolved.brand}</span> : null}
        <button
          type="button"
          onClick={onOpenModal}
          className="dtb-product-card__name"
          aria-label={`View product details for ${name}`}
        >
          {name}
        </button>
        {sku ? <span className="dtb-product-card__sku">SKU: {sku}</span> : null}

        <div className="dtb-product-card__divider" />

        <div className="dtb-product-card__footer">
          <strong
            className="dtb-product-card__price"
            style={{ color: outOfStock ? 'var(--dtb-muted)' : 'var(--dtb-text)' }}
          >
            {priceStr}
          </strong>
          {isVariable ? (
            <button type="button" onClick={onOpenModal} className="dtb-product-card__action dtb-product-card__action--options">
              <span>Options</span>
              <ChevronRight size={13} />
            </button>
          ) : (
            <button type="button" onClick={onAddToCart} disabled={outOfStock} className="dtb-product-card__action" aria-label={`Add ${name} to cart`}>
              <ShoppingCart size={14} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </Motion.article>
  );
}
