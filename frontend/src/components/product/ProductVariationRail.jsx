import ProductVariationSelector from './ProductVariationSelector';

export default function ProductVariationRail(props) {
  return (
    <div className="product-variation-rail">
      <ProductVariationSelector {...props} />
    </div>
  );
}
