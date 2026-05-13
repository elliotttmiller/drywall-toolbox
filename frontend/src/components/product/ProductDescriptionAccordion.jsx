/**
 * frontend/src/components/product/ProductDescriptionAccordion.jsx
 *
 * Description / short description accordion tabs for the product detail page.
 *
 * Props:
 *   product           — parent product
 *   selectedVariation — selected variation (may override description)
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import DOMPurify from 'dompurify';

const TABS = [
  { id: 'description',       label: 'Description' },
  { id: 'specs',             label: 'Specifications' },
  { id: 'shipping',          label: 'Shipping & Returns' },
];

export default function ProductDescriptionAccordion({ product }) {
  const [openTab, setOpenTab] = useState('description');

  const description = product?.description || '';
  const short       = product?.short_description || '';

  // Clean HTML before injecting.
  const safeDescription = DOMPurify.sanitize(description);
  const safeShort       = DOMPurify.sanitize(short);

  if (!description && !short) return null;

  return (
    <div
      className="product-description-accordion"
      style={{ borderTop: '1px solid #e2e8f0', marginTop: '32px' }}
    >
      {TABS.map((tab) => {
        const isOpen = openTab === tab.id;
        return (
          <div key={tab.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setOpenTab(isOpen ? '' : tab.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-${tab.id}`}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#0f172a',
                textAlign: 'left',
              }}
            >
              {tab.label}
              <ChevronDown
                size={16}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  color: '#64748b',
                }}
              />
            </button>

            {isOpen && (
              <div
                id={`accordion-${tab.id}`}
                role="region"
                aria-label={tab.label}
                style={{ paddingBottom: '20px' }}
              >
                {tab.id === 'description' && (
                  <div
                    className="prose max-w-none text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: safeDescription || safeShort || '' }}
                    style={{ fontSize: '0.88rem', lineHeight: 1.75, color: '#374151' }}
                  />
                )}
                {tab.id === 'specs' && (
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    {product?.weight && (
                      <div style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontWeight: 600, minWidth: '120px' }}>Weight</span>
                        <span>{product.weight} lbs</span>
                      </div>
                    )}
                    {product?.dimensions && (product.dimensions.length || product.dimensions.width || product.dimensions.height) && (
                      <div style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontWeight: 600, minWidth: '120px' }}>Dimensions</span>
                        <span>
                          {[product.dimensions.length, product.dimensions.width, product.dimensions.height]
                            .filter(Boolean).join(' × ')} in
                        </span>
                      </div>
                    )}
                    {(!product?.weight && !product?.dimensions) && (
                      <p style={{ color: '#94a3b8' }}>No specifications available.</p>
                    )}
                  </div>
                )}
                {tab.id === 'shipping' && (
                  <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.75 }}>
                    <p>Free standard shipping on orders over $75 (contiguous USA).</p>
                    <p>Express and overnight options available at checkout.</p>
                    <p>Returns accepted within 30 days of delivery. See our <a href="/returns" style={{ color: 'var(--primary-600)', textDecoration: 'underline' }}>Return Policy</a> for details.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
