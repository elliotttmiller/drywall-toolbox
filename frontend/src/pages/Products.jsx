import LegacyProducts from './LegacyProducts.jsx';
import ProductsCatalogPlatform from './ProductsCatalogPlatform.jsx';
import { isCatalogPlatformEnabled } from '../utils/featureFlags.js';

export default function Products() {
  return isCatalogPlatformEnabled() ? <ProductsCatalogPlatform /> : <LegacyProducts />;
}
