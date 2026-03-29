import {json} from 'react-router-dom';
import Cart from '~/pages/Cart';

export const meta = () => [
  {title: 'Shopping Cart – Drywall Toolbox'},
];

export async function loader() {
  return json({});
}

export default function CartRoute() {
  return <Cart />;
}
