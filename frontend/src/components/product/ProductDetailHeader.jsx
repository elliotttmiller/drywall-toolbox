import { CheckCircle2, PackageCheck } from 'lucide-react';

export default function ProductDetailHeader({
  product,
  effectiveName,
  effectiveSku,
  isOutOfStock,
  brandLabel,
  brandLogoSrc,
  brandLogoClassName,
  displayPrice,
  pricePrefix,
  compareAt,
  rawPrice,
  onReviewsClick,
  money,
}) {
  return (
    <header className="dtb-pdp-header">
      <h2 className="dtb-pdp-header__title">
        {effectiveName || product.sku || product.part_number}
      </h2>

      <div className="dtb-pdp-header__meta">
        {brandLabel && brandLogoSrc ? (
          <img src={brandLogoSrc} alt={brandLabel} className={brandLogoClassName} />
        ) : brandLabel ? (
          <span className="dtb-pdp-header__brand-text">{brandLabel}</span>
        ) : null}
        {effectiveSku ? (
          <span className="dtb-pdp-header__meta-item">
            <span className="dtb-pdp-header__meta-label">SKU</span>
            <span className="font-mono">{effectiveSku}</span>
          </span>
        ) : null}
        {product.upc ? (
          <span className="dtb-pdp-header__meta-item">
            <span className="dtb-pdp-header__meta-label">UPC</span>
            <span className="font-mono">{product.upc}</span>
          </span>
        ) : null}
      </div>

      <div className="product-detail-meta-row dtb-pdp-header__status-row">
        <span className={`dtb-pdp-header__status ${isOutOfStock ? 'dtb-pdp-header__status--out' : 'dtb-pdp-header__status--in'}`}>
          {isOutOfStock ? <PackageCheck size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
        </span>
      </div>

      <div className="dtb-pdp-header__price-block">
        <div className="dtb-pdp-header__price-row">
          <span className="dtb-pdp-header__price">
            {pricePrefix}{displayPrice}
          </span>
          {compareAt && parseFloat(compareAt) > parseFloat(rawPrice || 0) ? (
            <span className="dtb-pdp-header__compare-at">
              ${money(compareAt)}
            </span>
          ) : null}
        </div>
        <p className="dtb-pdp-header__support-copy">
          Fast shipping on in-stock items. Need help choosing the right setup? Our pros can help.
        </p>
      </div>

      <button
        type="button"
        onClick={onReviewsClick}
        className="dtb-pdp-header__reviews"
        aria-label="View reviews, 0 out of 5 stars, no reviews yet"
      >
        <span role="img" aria-label="0 out of 5 stars">
          {[...Array(5)].map((_, i) => (
            <svg key={i} className="dtb-pdp-header__review-star" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </span>
        <span>No reviews yet</span>
      </button>
    </header>
  );
}
