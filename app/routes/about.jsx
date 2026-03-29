import {json} from 'react-router';
import About from '~/pages/About';

export const meta = () => [
  {title: 'About – Drywall Toolbox'},
  {name: 'description', content: 'Learn about Drywall Toolbox – your source for professional drywall tools and equipment.'},
];

export async function loader() {
  return json({});
}

export default function AboutRoute() {
  return <About />;
}
