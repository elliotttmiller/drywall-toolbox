import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

export default function StripePaymentSection( {
  email,
  disabled = false,
  onBeforeSubmit,
  onPaymentSuccess,
  onPaymentError,
} ) {
  const stripe = useStripe();
  const elements = useElements();

  async function handleSubmit() {
    if ( ! stripe || ! elements || disabled ) {
      return;
    }

    try {
      await onBeforeSubmit?.();

      const result = await stripe.confirmPayment( {
        elements,
        confirmParams: {
          receipt_email: email || undefined,
        },
        redirect: 'if_required',
      } );

      if ( result.error ) {
        throw new Error( result.error.message || 'Payment could not be completed.' );
      }

      await onPaymentSuccess?.( result.paymentIntent );
    } catch ( error ) {
      onPaymentError?.( error );
    }
  }

  return (
    <div className="space-y-5">
      {/* min-h prevents iframe collapse/layout reflow during Stripe Elements hydration */}
      <div className="rounded-[1.15rem] border border-slate-200 bg-white p-4 min-h-[220px]">
        <PaymentElement
          options={ {
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: true,
              spacedAccordionItems: true,
            },
            paymentMethodOrder: [
              'card',
              'link',
              'affirm',
              'klarna',
              'afterpay_clearpay',
            ],
          } }
        />
      </div>

      <button
        type="button"
        onClick={ handleSubmit }
        disabled={ ! stripe || ! elements || disabled }
        className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Place secure order
      </button>
    </div>
  );
}
