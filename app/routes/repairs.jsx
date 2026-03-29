import {json} from 'react-router';
import Repairs from '~/pages/Repairs';

export const meta = () => [
  {title: 'Repairs – Drywall Toolbox'},
  {name: 'description', content: 'Professional drywall tool repair services.'},
];

export async function loader() {
  return json({});
}

export default function RepairsRoute() {
  return <Repairs />;
}
