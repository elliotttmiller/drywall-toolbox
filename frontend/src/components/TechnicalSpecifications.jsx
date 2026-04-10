/**
 * TechnicalSpecifications.jsx — Product technical specifications table renderer
 *
 * Clean, modern, mobile-first two-column specification list.
 * Uses semantic <dl>/<dt>/<dd> markup with a CSS-grid row layout so
 * label and value always sit side-by-side — even on the narrowest phone.
 *
 * Usage:
 * <TechnicalSpecifications specs={[
 *   { label: 'Brand', value: 'Asgard' },
 *   { label: 'SKU', value: 'AT01-AD' },
 * ]} />
 */

export default function TechnicalSpecifications({ specs = [], title = 'Technical Specifications' }) {
  if (!specs || specs.length === 0) return null;

  return (
    <section className="tech-specs mt-8 sm:mt-10 mb-6 sm:mb-8" aria-label={title}>
      {/* ── Heading ── */}
      <div className="tech-specs__heading mb-4 sm:mb-5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {title}
        </h3>
        <div className="mt-2 h-[2px] w-8 bg-gray-900 rounded-full" />
      </div>

      {/* ── Spec rows ── */}
      <dl className="tech-specs__list divide-y divide-gray-100">
        {specs.map((spec, index) => (
          <div key={index} className="tech-specs__row grid py-3 sm:py-3.5 gap-x-4 sm:gap-x-6">
            <dt className="tech-specs__label text-xs sm:text-sm font-medium text-gray-400 leading-5 self-start pt-px">
              {spec.label}
            </dt>
            <dd className="tech-specs__value text-sm sm:text-[0.9375rem] font-medium text-gray-900 leading-5 m-0">
              {typeof spec.value === 'string' && spec.value.includes('<') ? (
                <span dangerouslySetInnerHTML={{ __html: spec.value }} />
              ) : (
                spec.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
