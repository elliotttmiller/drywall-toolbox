import {json} from 'react-router';
import VeeqoSettings from '~/pages/VeeqoSettings';

export const meta = () => [
  {title: 'Veeqo Settings – Drywall Toolbox'},
];

export async function loader() {
  return json({});
}

export default function VeeqoSettingsRoute() {
  return <VeeqoSettings />;
}
