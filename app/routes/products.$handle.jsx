import {json} from 'react-router';
import {useLoaderData} from 'react-router';
import {normalizeProduct} from '~/lib/normalizeProduct';
import {PRODUCT_QUERY} from '~/lib/shopify.server';
import Product from '~/pages/Product';

export const meta = ({data}) => {
  if (!data?.product) {
    return [{title: 'Product Not Found – Drywall Toolbox'}];
  }
  return [
    {title: `${data.product.name} – Drywall Toolbox`},
    {name: 'description', content: data.product.short_description || `Shop ${data.product.name} at Drywall Toolbox.`},
  ];
};

export async function loader({context, params}) {
  const {handle} = params;
  const {storefront} = context;

  let shopifyProduct = null;
  if (storefront) {
    try {
      const {product} = await storefront.query(PRODUCT_QUERY, {
        variables: {handle, country: context.storefront.i18n?.country, language: context.storefront.i18n?.language},
      });
      shopifyProduct = product ? normalizeProduct(product) : null;
    } catch (err) {
      console.warn('Shopify product fetch failed, falling back to CSV:', err.message);
    }
  }

  return json({product: shopifyProduct, handle});
}

export default function ProductPage() {
  // Product component handles its own data loading from URL params + CSV
  // The Shopify product data (when available) will be passed via context
  return <Product />;
}
