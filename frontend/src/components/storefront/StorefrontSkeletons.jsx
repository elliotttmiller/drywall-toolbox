import ProductShoppingCardSkeleton from '../catalog/ProductShoppingCardSkeleton.jsx';

export function StorefrontCardSkeleton({ className = '', variant = 'rail' }) {
  return (
    <div className={className} aria-hidden="true">
      <ProductShoppingCardSkeleton variant={variant} />
    </div>
  );
}

export default function StorefrontSkeletons({ count = 4, variant = 'rail' }) {
  return (
    <div className="storefront-rail storefront-rail--fixed-tiles" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <ProductShoppingCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
}
