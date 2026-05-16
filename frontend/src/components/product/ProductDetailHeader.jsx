import { CheckCircle2, PackageCheck } from 'lucide-react';

export default function ProductDetailHeader({
  product,
  effectiveName,
  effectiveSku,
  isOutOfStock,
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
    <>
      <div className="product-detail-meta-row flex items-center flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 text-white text-xs font-semibold rounded ${
          isOutOfStock ? 'bg-red-500' : 'bg-black'
        }`}>
          {isOutOfStock ? <PackageCheck size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
        </span>
        {product.brand && brandLogoSrc ? (
          <img src={brandLogoSrc} alt={product.brand} className={brandLogoClassName} />
        ) : product.brand ? (
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-gray-500">{product.brand}</span>
        ) : null}
      </div>

      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 leading-tight pr-10">
        {effectiveName || product.sku || product.part_number}
      </h2>

      <div className="mb-3 sm:mb-4 space-y-1 text-xs sm:text-sm text-gray-500">
        {effectiveSku ? (
          <div>
            <span className="font-medium text-gray-400 mr-1">SKU:</span>
            <span className="font-mono">{effectiveSku}</span>
          </div>
        ) : null}
        {product.upc ? (
          <div>
            <span className="font-medium text-gray-400 mr-1">UPC:</span>
            <span className="font-mono">{product.upc}</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onReviewsClick}
        className="flex items-center gap-0.5 mb-5 sm:mb-6 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
        aria-label="View reviews, 0 out of 5 stars, no reviews yet"
      >
        {[...Array(5)].map((_, i) => (
          <svg key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-yellow-400 transition-colors" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </button>

      <hr className="border-gray-100 mb-4 sm:mb-5" />

      <div className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-bold text-gray-900">
            {pricePrefix}{displayPrice}
          </span>
          {compareAt && parseFloat(compareAt) > parseFloat(rawPrice || 0) ? (
            <span className="text-base sm:text-lg text-gray-400 line-through">
              ${money(compareAt)}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}
