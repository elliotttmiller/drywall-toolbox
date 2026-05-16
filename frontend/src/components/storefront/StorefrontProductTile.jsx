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
  const price = isVariable && product?.min_price != null ? `From $${money(product.min_price)}` : `$${money(resolved.price ?? product?.price ?? 0)}`;

  return (
    <Motion.article
      className="storefront-product-tile storefront-motion-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03 }}
    >
      <button type="button" className="storefront-product-tile__image" onClick={onOpenModal} aria-label={`View ${name}`}>
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

        <div className="storefront-product-tile__footer">
          <strong style={{ color: outOfStock ? 'var(--dtb-muted)' : 'var(--dtb-primary)' }}>{price}</strong>
          {isVariable ? (
            <button type="button" onClick={onOpenModal} className="alloy-button" style={{ minHeight: '34px' }}>
              Options <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={onAddToCart} disabled={outOfStock} className="alloy-button" style={{ minHeight: '34px' }}>
              <ShoppingCart size={14} />
            </button>
          )}
        </div>
      </div>
    </Motion.article>
  );
}
