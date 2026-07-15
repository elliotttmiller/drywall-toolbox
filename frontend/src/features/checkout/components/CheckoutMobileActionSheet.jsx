import { useState } from 'react';
import { ChevronRight, Loader2, ShieldCheck } from 'lucide-react';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function MoneyRow({ label, value, final = false }) {
  return (
    <div className={`dtb-co-mobile-cta__total-line${final ? ' dtb-co-mobile-cta__total-line--final' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function CheckoutMobileActionSheet({
  displayTotal,
  subtotal,
  shipping,
  taxAmount,
  taxStatus,
  quoteReady,
  processing,
  canSubmitCheckout,
  payButtonLabel,
  payButtonAriaLabel,
  onSubmit,
}) {
  const [expanded, setExpanded] = useState(false);
  const amount = money(displayTotal);
  const shippingCopy = quoteReady ? (Number(shipping || 0) === 0 ? 'Free' : money(shipping)) : 'By address';
  const taxCopy = taxStatus === 'ready'
    ? money(taxAmount)
    : taxStatus === 'loading'
      ? 'Calculating…'
      : 'By address';
  const primaryState = quoteReady
    ? 'Ready'
    : taxStatus === 'loading'
      ? 'Calculating'
      : 'Needs address';

  const handleSubmit = () => {
    if (processing) return;
    onSubmit?.();
  };

  return (
    <div className={`dtb-co-mobile-cta dtb-co-mobile-cta--react${expanded ? ' dtb-co-mobile-cta--expanded' : ''} lg:hidden`}>
      <div className="dtb-co-mobile-cta__inner">
        <button
          type="button"
          className="dtb-co-mobile-cta__summary-toggle"
          aria-expanded={expanded}
          aria-controls="dtb-co-mobile-cta-totals"
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="dtb-co-mobile-cta__summary-label">
            Estimated total
            <span className="dtb-co-mobile-cta__summary-status">{primaryState}</span>
          </span>
          <strong className="dtb-co-mobile-cta__summary-amount">{amount}</strong>
          <ChevronRight className="dtb-co-mobile-cta__summary-chevron" size={17} aria-hidden="true" />
        </button>

        <div className="dtb-co-mobile-cta__context" aria-label="Checkout total context" role="group">
          <span>
            <strong>Shipping</strong>
            {shippingCopy}
          </span>
          <span>
            <strong>Tax</strong>
            {taxCopy}
          </span>
        </div>

        <div
          id="dtb-co-mobile-cta-totals"
          className="dtb-co-mobile-cta__totals"
          aria-label="Order total summary"
          aria-live="polite"
          aria-atomic="true"
          aria-hidden={!expanded}
        >
          <MoneyRow label="Subtotal" value={money(subtotal)} />
          <MoneyRow label="Shipping" value={shippingCopy} />
          <MoneyRow label="Tax" value={taxCopy} />
          <MoneyRow label="Est. total" value={amount} final />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={processing}
          aria-disabled={!canSubmitCheckout || processing}
          data-ready={canSubmitCheckout ? 'true' : 'false'}
          className="dtb-co-btn-primary dtb-co-btn-primary--wide"
          aria-label={payButtonAriaLabel}
        >
          {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          {payButtonLabel}
        </button>

        <div className="dtb-co-mobile-cta__trust">
          <ShieldCheck size={13} aria-hidden="true" />
          <span>Secure handoff. Payment is completed on the next screen.</span>
        </div>
      </div>
    </div>
  );
}

export default CheckoutMobileActionSheet;
