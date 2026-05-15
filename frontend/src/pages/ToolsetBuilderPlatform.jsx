import { useMemo, useState } from 'react';
import SEOHead from '../components/shared/SEOHead';
import Toast from '../components/ui/Toast';
import { useCart } from '../context/CartContext';
import { useToolsetBuilder } from '../hooks/useToolsetBuilder.js';

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  return `$${Number(value).toFixed(2)}`;
}

export default function ToolsetBuilderPlatform() {
  const {
    templates,
    activeTemplate,
    selectTemplate,
    optionsBySlot,
    selections,
    selectOption,
    clearSlot,
    validate,
    cartLines,
    loadingTemplates,
    loadingOptions,
    validating,
    error,
  } = useToolsetBuilder();
  const { addToCart } = useCart();

  const [toast, setToast] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  const requiredSlotIds = useMemo(
    () => (activeTemplate?.slots || []).filter((s) => s.required).map((s) => s.id),
    [activeTemplate]
  );

  const missingRequired = requiredSlotIds.filter((slotId) => !selections?.[slotId]);

  const handleAddConfiguredKit = async () => {
    const result = await validate();
    const errs = Array.isArray(result?.errors) ? result.errors : [];
    setValidationErrors(errs);
    if (!result?.valid) {
      setToast({ type: 'error', message: errs[0]?.message || 'Validation failed.' });
      return;
    }

    if (!Array.isArray(cartLines) || cartLines.length === 0) {
      setToast({ type: 'error', message: 'No selected items to add.' });
      return;
    }

    for (const line of cartLines) {
      await addToCart(line, line.quantity || 1);
    }

    setToast({ type: 'cart', message: 'Configured toolset added to cart.' });
  };

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title="Toolset Builder"
        description="Configure toolsets from canonical DTB templates and eligible slot options."
        canonical="https://drywalltoolbox.com/toolset-builder"
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Toolset Builder</h1>
          <p className="text-gray-600 mt-1">Build from canonical templates and server-validated slot options.</p>
        </header>

        {loadingTemplates ? (
          <div className="rounded-lg border border-gray-200 bg-white p-5">Loading templates…</div>
        ) : (
          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">1) Select template</h2>
            <div className="flex flex-wrap gap-2">
              {(templates || []).map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template.id)}
                  className={`px-3 py-2 rounded-md border text-sm ${
                    activeTemplate?.id === template.id
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-800 border-gray-300'
                  }`}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeTemplate && (
          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">2) Configure slots</h2>
            {loadingOptions && <p className="text-sm text-gray-500">Loading eligible options…</p>}
            <div className="space-y-5">
              {(activeTemplate.slots || []).map((slot) => {
                const opts = optionsBySlot?.[slot.id] || [];
                const selected = selections?.[slot.id] || null;
                return (
                  <div key={slot.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {slot.label} {slot.required ? <span className="text-red-600">*</span> : null}
                      </h3>
                      {selected ? (
                        <button
                          onClick={() => clearSlot(slot.id)}
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    {slot.hint ? <p className="text-sm text-gray-600 mb-3">{slot.hint}</p> : null}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {opts.map((opt) => {
                        const isSelected =
                          selected?.productId === opt.productId &&
                          (selected?.variationId || 0) === (opt.variationId || 0);
                        return (
                          <button
                            key={`${slot.id}:${opt.productId}:${opt.variationId || 0}`}
                            onClick={() => selectOption(slot.id, opt)}
                            className={`text-left border rounded-md p-3 ${
                              isSelected
                                ? 'border-primary-600 bg-primary-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <p className="font-medium text-gray-900">{opt.name}</p>
                            {opt.variationLabel ? (
                              <p className="text-sm text-gray-600">{opt.variationLabel}</p>
                            ) : null}
                            <p className="text-xs text-gray-500 mt-1">SKU: {opt.sku || 'N/A'}</p>
                            <p className="text-sm text-primary-700 mt-1">{formatPrice(opt.price)}</p>
                          </button>
                        );
                      })}
                      {opts.length === 0 && (
                        <p className="text-sm text-gray-500">No eligible options available for this slot.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTemplate && (
          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">3) Validate & add to cart</h2>
            {missingRequired.length > 0 ? (
              <p className="text-sm text-amber-700">
                Missing required slots: {missingRequired.join(', ')}
              </p>
            ) : null}
            {validationErrors.length > 0 ? (
              <ul className="text-sm text-red-700 list-disc pl-5">
                {validationErrors.map((err, idx) => (
                  <li key={`${err.code || 'err'}:${idx}`}>{err.message || err.code || 'Validation error'}</li>
                ))}
              </ul>
            ) : null}
            <button
              onClick={handleAddConfiguredKit}
              disabled={validating || missingRequired.length > 0}
              className="px-4 py-2 rounded-md bg-primary-600 text-white disabled:opacity-50"
            >
              {validating ? 'Validating…' : 'Validate and add configured kit'}
            </button>
            {error ? <p className="text-sm text-red-700">{error.message || 'Unexpected error.'}</p> : null}
          </section>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
