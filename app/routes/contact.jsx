import {json, redirect} from 'react-router';
import Contact from '~/pages/Contact';

export const meta = () => [
  {title: 'Contact – Drywall Toolbox'},
  {name: 'description', content: 'Get in touch with Drywall Toolbox for product inquiries, orders, and support.'},
];

export async function loader() {
  return json({});
}

/**
 * Server action: handles Contact form POST.
 * In production, integrate with your email service or CRM here.
 */
export async function action({request}) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim() || '';
  const email = formData.get('email')?.toString().trim() || '';
  const message = formData.get('message')?.toString().trim() || '';

  // Basic validation
  if (!name || !email || !message) {
    return json({error: 'Please fill in all required fields.'}, {status: 400});
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return json({error: 'Please enter a valid email address.'}, {status: 400});
  }

  // TODO: Send email via SendGrid / Mailchimp / Shopify Email etc.
  // For now, log and return success
  console.log('Contact form submission:', {name, email, message: message.substring(0, 200)});

  return json({success: true});
}

export default function ContactRoute() {
  return <Contact />;
}
