import {json} from 'react-router';
import VeeqoCallback from '~/pages/VeeqoCallback';

export const meta = () => [
  {title: 'Connecting Veeqo – Drywall Toolbox'},
];

export async function loader() {
  return json({});
}

export default function VeeqoCallbackRoute() {
  return <VeeqoCallback />;
}
