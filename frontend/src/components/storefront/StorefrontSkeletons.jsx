export function StorefrontCardSkeleton({ className = '' }) {
  return <div className={`storefront-skeleton ${className}`.trim()} style={{ height: 260 }} aria-hidden="true" />;
}

export default function StorefrontSkeletons({ count = 4 }) {
  return (
    <div className="storefront-rail" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <StorefrontCardSkeleton key={index} />
      ))}
    </div>
  );
}
