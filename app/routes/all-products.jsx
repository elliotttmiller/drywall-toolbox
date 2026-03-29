import {json} from 'react-router-dom';
import AllProducts from '~/pages/AllProducts';

export const meta = () => [
  {title: 'All Products – Drywall Toolbox'},
  {name: 'description', content: 'Browse all professional drywall tools available at Drywall Toolbox.'},
];

export async function loader() {
  return json({});
}

export default function AllProductsRoute() {
  return <AllProducts />;
}
