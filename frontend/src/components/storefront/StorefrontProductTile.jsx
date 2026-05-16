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

  return (
    <Motion.article
      className="storefront-product-tile storefront-motion-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03 }}
    >
      <button type="button" className="storefront-product-tile__image" onClick={onOpenModal} aria-label={`View ${name}`}>
        {outOfStock && (
          <span className="storefront-product-tile__badge storefront-product-tile__badge--out">Out of Stock</span>
        )}
        {onSale && !outOfStock && (
          <span className="storefront-product-tile__badge storefront-product-tile__badge--sale">Sale</span>
        )}
        <ProductCardImage
          product={resolved}
          src={resolved.image_thumbnail || resolved.image}
          srcSet={resolved.image_srcset}
          sizes="(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 240px"
          alt={name}
          padding="0"
          fit="cover"
          preferThumbnail
          eager={index < 4}
        />
      </button>

      <div className="storefront-product-tile__meta">
        {resolved.brand ? <span className="storefront-product-tile__brand">{resolved.brand}</span> : null}
        <button
          type="button"
          onClick={onOpenModal}
          className="storefront-product-tile__name-button"
          aria-label={`View product details for ${name}`}
        >
          {name}
        </button>
        {sku ? <span className="storefront-product-tile__sku">SKU: {sku}</span> : null}

        <div className="storefront-product-tile__divider" />

        <div className="storefront-product-tile__footer">
          <strong
            className="storefront-product-tile__price"
            style={{ color: outOfStock ? 'var(--dtb-muted)' : 'var(--dtb-text)' }}
          >
            {priceStr}
          </strong>
          {isVariable ? (
            <button type="button" onClick={onOpenModal} className="alloy-button" style={{ minHeight: '34px', fontSize: '0.8rem' }}>
              Options <ChevronRight size={13} />
            </button>
          ) : (
            <button type="button" onClick={onAddToCart} disabled={outOfStock} className="alloy-button" style={{ minHeight: '34px' }} aria-label={`Add ${name} to cart`}>
              <ShoppingCart size={14} />
            </button>
          )}
        </div>
      </div>
    </Motion.article>
  );
}
