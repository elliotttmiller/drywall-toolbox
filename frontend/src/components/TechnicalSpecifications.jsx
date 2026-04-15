/**
 * TechnicalSpecifications.jsx — Product technical specifications table renderer
 *
 * Clean, modern, mobile-first two-column specification list.
 * Uses semantic <dl>/<dt>/<dd> markup with a CSS-grid row layout so
 * label and value always sit side-by-side — even on the narrowest phone.
 *
 * When a spec has an `items` array (produced by enrichIncludesSpec for the
 * "Includes" row), each item is rendered as a separate line.  Items that
 * carry a `sku` become clickable links to their individual product page.
 *
 * Usage:
 * <TechnicalSpecifications specs={[
 *   { label: 'Brand', value: 'Asgard' },
 *   { label: 'SKU',   value: 'AT01-AD' },
 *   { label: 'Includes', items: [{ name: '10" Flat Box', sku: 'EZ10-AD' }] },
 * ]} onItemClick={() => closeModal()} />
 */

import { Link } from 'react-router-dom';

export default function TechnicalSpecifications({ specs = [], title = 'Technical Specifications', onItemClick }) {
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
              {Array.isArray(spec.items) ? (
                /* ── Structured includes list ── */
                <ul className="list-none p-0 m-0 space-y-1.5">
                  {spec.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-[0.4em] text-gray-300 select-none" aria-hidden="true">›</span>
                      {item.sku ? (
                        <Link
                          to={`/product/${item.sku}`}
                          onClick={onItemClick}
                          className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors inline-flex items-center gap-1"
                        >
                          {item.name}
                          {/* External-link icon */}
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="shrink-0 opacity-70"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </Link>
                      ) : (
                        <span className="text-gray-700">{item.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : typeof spec.value === 'string' && spec.value.includes('<') ? (
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
