import {json} from 'react-router';
import Home from '~/pages/Home';

export const meta = () => [
  {title: 'Drywall Toolbox – Professional Drywall Tools'},
  {name: 'description', content: 'Shop professional drywall tools from top brands including TapeTech, Columbia Taping Tools, SurPro, Asgard, and Graco.'},
];

export async function loader({context}) {
  // Server-side: prefetch can be added here once Shopify Admin is configured.
  // The TrendingProducts component handles its own data loading from CSV for now.
  return json({});
}

export default function Index() {
  return <Home />;
}
