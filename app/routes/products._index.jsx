import {json} from 'react-router';
import Products from '~/pages/Products';

export const meta = () => [
  {title: 'Products – Drywall Toolbox'},
  {name: 'description', content: 'Browse professional drywall tools from TapeTech, Columbia, SurPro, Asgard, and Graco.'},
];

export async function loader({context, request}) {
  // Server-side: products are loaded client-side from CSV or Shopify.
  // Once Shopify Admin is configured with products, use context.storefront
  // to query and return normalized products here.
  return json({});
}

export default function ProductsIndex() {
  return <Products />;
}
