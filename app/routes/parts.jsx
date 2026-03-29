import {json} from 'react-router-dom';
import Parts from '~/pages/Parts';

export const meta = () => [
  {title: 'Parts & Schematics – Drywall Toolbox'},
  {name: 'description', content: 'Interactive parts schematics for Columbia Taping Tools. Find and order replacement parts.'},
];

export async function loader() {
  return json({});
}

export default function PartsRoute() {
  return <Parts />;
}
