import { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

const stripePromise = stripePublishableKey
  ? loadStripe( stripePublishableKey )
  : null;

export default function StripeCheckoutProvider( { clientSecret, children } ) {
  const options = useMemo( () => ( {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary:    '#2563eb',
        colorBackground: '#ffffff',
        colorText:       '#0f172a',
        colorDanger:     '#dc2626',
        borderRadius:    '16px',
        fontFamily:      'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      },
    },
    loader: 'auto',
  } ), [clientSecret] );

  if ( ! stripePublishableKey ) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        Stripe is not configured. Add REACT_APP_STRIPE_PUBLISHABLE_KEY to the frontend environment.
      </div>
    );
  }

  if ( ! clientSecret ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Secure payment methods will load after the checkout form is complete and the Stripe session is created.
      </div>
    );
  }

  return (
    <Elements stripe={ stripePromise } options={ options }>
      { children }
    </Elements>
  );
}
