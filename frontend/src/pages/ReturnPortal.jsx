/**
 * frontend/src/pages/ReturnPortal.jsx
 *
 * Return Portal page — /returns
 *
 * Two-step flow:
 *  Step 1 — Order lookup: customer enters Order # and email to locate their order.
 *  Step 2 — Return request form: selects items, provides reason, submits.
 *
 * Submits via the dtb/v1/contact endpoint using inquiry_type "Returns & Warranty".
 * No auth required — works for both guest and logged-in customers.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Loader, RotateCcw,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { apiClient } from '../api/client';

/* ─── Return reason options ──────────────────────────────────────────────────── */
const RETURN_REASONS = [
  'Arrived damaged',
  'Wrong item received',
  'Item not as described',
  'Changed my mind / no longer needed',
  'Defective / not working',
  'Ordered by mistake',
  'Better price found elsewhere',
  'Other',
];

/* ─── Policy summary cards ───────────────────────────────────────────────────── */
const POLICY_POINTS = [
  {
    Icon:  CheckCircle,
    color: '#16a34a',
    bg:    'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    title: '45-Day Return Window',
    body:  'New, unused products in original packaging may be returned within 45 days of purchase — 50% longer than the industry-standard 30 days.',
  },
  {
    Icon:  Package,
    color: '#2563eb',
    bg:    'linear-gradient(135deg, #eff6ff, #dbeafe)',
    title: 'No Restocking Fee — Ever',
    body:  'Standard returns carry zero restocking fees. Used tool returns may be evaluated case-by-case, but we never penalise honest mistakes.',
  },
  {
    Icon:  AlertCircle,
    color: '#d97706',
    bg:    'linear-gradient(135deg, #fffbeb, #fef3c7)',
    title: 'Non-Returnable Items',
    body:  'Used tools with wear/residue, final-sale or outlet items, special-order items, direct-ship items marked non-returnable, and partially used consumables.',
  },
];

/* ─── Input style helper ─────────────────────────────────────────────────────── */
const inputStyle = {
  width:        '100%',
  padding:      '10px 14px',
  border:       '1px solid var(--machined-border)',
  borderRadius: '4px',
  fontSize:     '0.9rem',
  color:        '#0f172a',
  background:   'white',
  outline:      'none',
  boxSizing:    'border-box',
  fontFamily:   'var(--font-main)',
  transition:   'border-color 0.15s',
};

export default function ReturnPortal() {
  /* ── Step control ─────────────────────────────────────────────────────────── */
  const [step, setStep] = useState(1); // 1 = lookup, 2 = form, 3 = success

  /* ── Step 1 state ─────────────────────────────────────────────────────────── */
  const [orderNumber, setOrderNumber] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupName,  setLookupName ] = useState('');
  const [lookupError, setLookupError] = useState('');

  /* ── Step 2 state ─────────────────────────────────────────────────────────── */
  const [returnReason, setReturnReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError]   = useState('');
  /* ─────────────────────────────────────────────────────────────────────────── */
  /* Step 1 — look up the order                                                  */
  /* We validate the input and then advance to the form. In the absence of a     */
  /* dedicated lookup endpoint the order number is carried forward and included  */
  /* in the support message body submitted in Step 2.                            */
  /* ─────────────────────────────────────────────────────────────────────────── */
  const handleLookup = (e) => {
    e.preventDefault();
    setLookupError('');

    const trimmedOrder = orderNumber.trim();
    const trimmedEmail = lookupEmail.trim().toLowerCase();
    const trimmedName  = lookupName.trim();

    if (!trimmedName) {
      setLookupError('Please enter your full name.');
      return;
    }
    if (!trimmedOrder) {
      setLookupError('Please enter your order number.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLookupError('Please enter a valid email address.');
      return;
    }

    setStep(2);
  };

  /* ─────────────────────────────────────────────────────────────────────────── */
  /* Step 2 — submit the return request via the contact endpoint                 */
  /* ─────────────────────────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!returnReason) {
      setSubmitError('Please select a return reason.');
      return;
    }

    setSubmitLoading(true);

    const messageBody = [
      `Return request for Order #${orderNumber.trim()}`,
      `Reason: ${returnReason}`,
      additionalNotes.trim() ? `Additional notes: ${additionalNotes.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await apiClient('/wp-json/dtb/v1/contact', {
        method: 'POST',
        body:   JSON.stringify({
          name:         lookupName.trim(),
          email:        lookupEmail.trim(),
          inquiry_type: 'Returns & Warranty',
          message:      messageBody,
        }),
      });
      setStep(3);
    } catch (err) {
      setSubmitError(
        err?.message ||
        'Unable to submit your return request. Please email us directly at support@drywalltoolbox.com.'
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────── */

  const resetAll = () => {
    setStep(1);
    setOrderNumber('');
    setLookupEmail('');
    setLookupName('');
    setLookupError('');
    setReturnReason('');
    setAdditionalNotes('');
    setSubmitError('');
  };

  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="Return Portal"
        description="Start a return or exchange with Drywall Toolbox. Enter your order number and email to begin. 45-day return window, no restocking fee."
        canonical="https://drywalltoolbox.com/returns"
      />

      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding:    'clamp(48px, 8vw, 80px) clamp(1.5rem, 5vw, 3rem) clamp(3rem, 6vw, 4rem)',
        position:   'relative',
        overflow:   'hidden',
      }}>
        <div style={{
          position:        'absolute',
          inset:           0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize:  '40px 40px',
          pointerEvents:   'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display:       'inline-block',
            background:    'rgba(255,255,255,0.1)',
            border:        '1px solid rgba(255,255,255,0.2)',
            borderRadius:  '3px',
            padding:       '4px 12px',
            fontSize:      '0.7rem',
            fontWeight:    700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,0.8)',
            marginBottom:  '16px',
          }}>
            Returns &amp; Exchanges
          </div>
          <h1 style={{
            color:         'white',
            fontSize:      'clamp(2rem, 5vw, 3.5rem)',
            fontWeight:    800,
            margin:        0,
            lineHeight:    1.1,
            letterSpacing: '-0.03em',
          }}>
            RETURN PORTAL
          </h1>
          <p style={{
            color:      'rgba(255,255,255,0.65)',
            fontSize:   'clamp(0.9rem, 2vw, 1rem)',
            margin:     '12px 0 0',
            maxWidth:   '500px',
            lineHeight: 1.6,
          }}>
            Start a return or exchange in seconds. Enter your order details below
            and our team will get back to you within one business day with an RMA
            number and next steps.
          </p>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <section style={{
        padding:  'clamp(2.5rem, 5vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        maxWidth: '1400px',
        margin:   '0 auto',
      }}>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap:                 'clamp(2rem, 5vw, 4rem)',
          alignItems:          'start',
        }}>

          {/* ── Left: policy summary ──────────────────────────────────────── */}
          <div>
            <h2 style={{
              fontSize:      'clamp(1.3rem, 2.5vw, 1.75rem)',
              fontWeight:    800,
              color:         'var(--primary-600)',
              margin:        '0 0 6px',
              letterSpacing: '-0.02em',
            }}>
              Return Policy
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 28px', lineHeight: 1.6 }}>
              New, unused products in original packaging may be returned within
              45 days for a full refund to the original payment method — with
              no restocking fee, ever.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
              {POLICY_POINTS.map(({ Icon, color, bg, title, body }) => (
                <div key={title} style={{
                  background:   'white',
                  border:       '1px solid var(--machined-border)',
                  borderRadius: '4px',
                  padding:      '16px 18px',
                  display:      'flex',
                  gap:          '14px',
                  alignItems:   'flex-start',
                }}>
                  <div style={{
                    width:          '38px',
                    height:         '38px',
                    background:     bg,
                    borderRadius:   '9px',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    color,
                    flexShrink:     0,
                  }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', marginBottom: '4px' }}>
                      {title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.6)', lineHeight: 1.55 }}>
                      {body}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipping policy link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to="/shipping-policy"
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  gap:            '6px',
                  fontSize:       '0.825rem',
                  color:          'var(--primary-600)',
                  textDecoration: 'none',
                  fontWeight:     600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                View full Shipping Policy <ArrowRight size={14} />
              </Link>
              <Link
                to="/policies"
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  gap:            '6px',
                  fontSize:       '0.825rem',
                  color:          'var(--primary-600)',
                  textDecoration: 'none',
                  fontWeight:     600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                View full Store Policies <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* ── Right: multi-step form ─────────────────────────────────────── */}
          <div>

            {/* Step indicator */}
            {step < 3 && (
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '8px',
                marginBottom: '20px',
              }}>
                {[
                  { n: 1, label: 'Lookup' },
                  { n: 2, label: 'Details' },
                ].map(({ n, label }, i, arr) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width:          '26px',
                        height:         '26px',
                        borderRadius:   '50%',
                        background:     step >= n ? 'var(--primary-600)' : '#e2e8f0',
                        color:          step >= n ? 'white'              : '#94a3b8',
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        fontSize:       '0.7rem',
                        fontWeight:     800,
                        flexShrink:     0,
                      }}>
                        {step > n ? <CheckCircle size={13} /> : n}
                      </div>
                      <span style={{
                        fontSize:   '0.72rem',
                        fontWeight: 700,
                        color:      step >= n ? 'var(--primary-600)' : '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}>
                        {label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{
                        flex:        1,
                        height:      '1px',
                        background:  step > n ? 'var(--primary-600)' : '#e2e8f0',
                        minWidth:    '24px',
                      }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Step 1: Order lookup ─────────────────────────────────────── */}
            {step === 1 && (
              <div style={{
                background:   'white',
                border:       '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding:      'clamp(1.5rem, 3vw, 2.5rem)',
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                  Find Your Order
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.55)', margin: '0 0 24px', lineHeight: 1.5 }}>
                  Enter the order number from your confirmation email and the
                  email address you used at checkout.
                </p>

                {lookupError && (
                  <div style={{
                    background:   '#fef2f2',
                    border:       '1px solid #fecaca',
                    borderRadius: '4px',
                    padding:      '12px 16px',
                    marginBottom: '20px',
                    fontSize:     '0.85rem',
                    color:        '#991b1b',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    {lookupError}
                  </div>
                )}

                <form onSubmit={handleLookup}>
                  <div className="form-group">
                    <label className="machined-label text-blue-600">Full Name</label>
                    <input
                      type="text"
                      value={lookupName}
                      onChange={(e) => setLookupName(e.target.value)}
                      placeholder="John Doe"
                      className="machined-input text-black"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="machined-label text-blue-600">Order Number</label>
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="e.g. 10042"
                      className="machined-input text-black"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="machined-label text-blue-600">Email Address</label>
                    <input
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="machined-input text-black"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="alloy-button w-full justify-center"
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        '8px',
                    }}
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                </form>

                <div style={{
                  borderTop:   '1px solid var(--machined-border)',
                  marginTop:   '20px',
                  paddingTop:  '16px',
                  fontSize:    '0.8rem',
                  color:       'rgba(15,23,42,0.5)',
                  textAlign:   'center',
                  lineHeight:  1.55,
                }}>
                  Can&apos;t find your order number?{' '}
                  <Link
                    to="/contact"
                    style={{ color: 'var(--primary-600)', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    Contact support
                  </Link>{' '}
                  and we&apos;ll look it up for you.
                </div>
              </div>
            )}

            {/* ── Step 2: Return details form ──────────────────────────────── */}
            {step === 2 && (
              <div style={{
                background:   'white',
                border:       '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding:      'clamp(1.5rem, 3vw, 2.5rem)',
              }}>
                {/* Order reference badge */}
                <div style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '10px',
                  background:   '#f8fafc',
                  border:       '1px solid var(--machined-border)',
                  borderRadius: '4px',
                  padding:      '10px 14px',
                  marginBottom: '22px',
                }}>
                  <Package size={16} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'rgba(15,23,42,0.5)' }}>Order </span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>#{orderNumber.trim()}</span>
                    <span style={{ color: 'rgba(15,23,42,0.4)', margin: '0 6px' }}>·</span>
                    <span style={{ color: 'rgba(15,23,42,0.6)', fontSize: '0.8rem' }}>{lookupEmail.trim()}</span>
                  </div>
                </div>

                {submitError && (
                  <div style={{
                    background:   '#fef2f2',
                    border:       '1px solid #fecaca',
                    borderRadius: '4px',
                    padding:      '12px 16px',
                    marginBottom: '20px',
                    fontSize:     '0.85rem',
                    color:        '#991b1b',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    {submitError}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="machined-label text-blue-600">Return Reason</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="machined-input text-black"
                      required
                      disabled={submitLoading}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="" disabled>Select a reason…</option>
                      {RETURN_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="machined-label text-blue-600">
                      Additional Notes <span style={{ fontWeight: 400, color: 'rgba(15,23,42,0.4)' }}>(optional)</span>
                    </label>
                    <textarea
                      rows={4}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Describe the issue, include photos if relevant, or note specific items you'd like to return…"
                      className="machined-textarea text-black"
                      disabled={submitLoading}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={submitLoading}
                      style={{
                        ...inputStyle,
                        width:          'auto',
                        padding:        '10px 18px',
                        cursor:         submitLoading ? 'not-allowed' : 'pointer',
                        fontWeight:     600,
                        fontSize:       '0.875rem',
                        color:          'rgba(15,23,42,0.6)',
                        background:     '#f8fafc',
                        border:         '1px solid var(--machined-border)',
                        display:        'flex',
                        alignItems:     'center',
                        gap:            '6px',
                        flexShrink:     0,
                        transition:     'background 0.15s',
                      }}
                    >
                      <ArrowLeft size={14} /> Back
                    </button>

                    <button
                      type="submit"
                      className="alloy-button justify-center"
                      disabled={submitLoading}
                      style={{
                        opacity:    submitLoading ? 0.7 : 1,
                        cursor:     submitLoading ? 'not-allowed' : 'pointer',
                        flex:       1,
                        display:    'flex',
                        alignItems: 'center',
                        gap:        '8px',
                        minWidth:   '140px',
                      }}
                    >
                      {submitLoading ? (
                        <><Loader size={15} className="animate-spin" /> Submitting…</>
                      ) : (
                        'Submit Return Request'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Step 3: Success ───────────────────────────────────────────── */}
            {step === 3 && (
              <div style={{
                background:     'white',
                border:         '1px solid var(--machined-border)',
                borderRadius:   '4px',
                padding:        'clamp(2rem, 4vw, 3rem)',
                textAlign:      'center',
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            '16px',
              }}>
                <div style={{
                  width:          '60px',
                  height:         '60px',
                  background:     'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  borderRadius:   '50%',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  color:          '#16a34a',
                }}>
                  <CheckCircle size={30} />
                </div>

                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a', margin: '0 0 8px' }}>
                    Return Request Submitted!
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 4px', lineHeight: 1.6 }}>
                    We received your return request for Order <strong>#{orderNumber.trim()}</strong>.
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.5)', margin: 0, lineHeight: 1.6 }}>
                    Our team will respond to <strong>{lookupEmail.trim()}</strong> within
                    1 business day with your RMA number and return instructions.
                    Do not ship items back until you receive your RMA.
                  </p>
                </div>

                <div style={{
                  background:   '#f8fafc',
                  border:       '1px solid var(--machined-border)',
                  borderRadius: '4px',
                  padding:      '14px 18px',
                  width:        '100%',
                  fontSize:     '0.825rem',
                  color:        'rgba(15,23,42,0.6)',
                  lineHeight:   1.55,
                  textAlign:    'left',
                }}>
                  <strong style={{ color: '#0f172a' }}>What happens next?</strong>
                  <ol style={{ margin: '8px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <li>We review your request and email your RMA number.</li>
                    <li>Package the item securely in its original packaging.</li>
                    <li>Ship using the carrier and address provided in the RMA email.</li>
                    <li>Refund is processed within 3–5 business days of receiving the item.</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={resetAll}
                    style={{
                      display:     'inline-flex',
                      alignItems:  'center',
                      gap:         '6px',
                      background:  'white',
                      border:      '1px solid var(--machined-border)',
                      borderRadius: '4px',
                      padding:     '10px 18px',
                      fontSize:    '0.875rem',
                      fontWeight:  600,
                      color:       'rgba(15,23,42,0.7)',
                      cursor:      'pointer',
                    }}
                  >
                    <RotateCcw size={14} /> Start Another Return
                  </button>

                  <Link
                    to="/contact"
                    style={{
                      display:        'inline-flex',
                      alignItems:     'center',
                      gap:            '6px',
                      background:     'var(--primary-600)',
                      color:          'white',
                      padding:        '10px 20px',
                      borderRadius:   '4px',
                      fontSize:       '0.875rem',
                      fontWeight:     700,
                      textDecoration: 'none',
                    }}
                  >
                    Contact Support <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
