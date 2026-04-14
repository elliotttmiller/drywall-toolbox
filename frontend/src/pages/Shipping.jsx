import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

/* ─────────────────────────────────────────────────────────────────────────────
   Shipping options — mirrored from the Repairs page pricing tabs
   ───────────────────────────────────────────────────────────────────────── */
const SHIPPING_OPTIONS = [
  {
    id: 'srs',
    name: 'Standard Return Shipping',
    price: 'Actual cost',
    badge: null,
    target: 'Available to all customers',
    features: [
      'Customer pays actual carrier cost',
      'Transparent; no markup',
      'USPS, FedEx, or UPS',
    ],
  },
  {
    id: 'er',
    name: 'Expedited Return (2-Day)',
    price: '+$25 flat',
    badge: 'Popular',
    target: 'Ideal for urgent jobs and tight deadlines',
    features: [
      '2-day air return',
      '+$25 flat fee',
      'Track every step',
    ],
  },
  {
    id: 'iu',
    name: 'Insurance Upgrade',
    price: '+$15',
    badge: null,
    target: 'Recommended for tools valued over $500',
    features: [
      'Full declared value coverage',
      'File claims directly with carrier',
      'Peace of mind on high-value tools',
    ],
  },
  {
    id: 'pk',
    name: 'Packaging Kit (Pre-Paid)',
    price: '$12 credit',
    badge: null,
    target: 'Ideal for first-time shippers',
    features: [
      'Pre-paid packaging supplied',
      '$12 credited toward repair cost',
      'Right-sized box included',
    ],
  },
  {
    id: 'ldp',
    name: 'Local Drop-Off / Pick-Up',
    price: 'FREE',
    badge: 'Free',
    target: 'Available to local customers',
    features: [
      'No shipping required',
      'Fastest turnaround option',
      'Schedule via contact form',
    ],
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '1',
    title: 'Submit a Repair Request',
    desc: 'Fill out our online repair form with your tool details and preferred service tier. Takes about 3 minutes.',
  },
  {
    step: '2',
    title: 'Receive a Prepaid Inbound Label',
    desc: 'Within 1 business day our team emails you a prepaid label for sending your tool to us — no out-of-pocket cost to ship it in.',
  },
  {
    step: '3',
    title: 'Pack & Drop Off',
    desc: 'Wrap your tool securely, drop it at any USPS, FedEx, or UPS location, and keep your outbound tracking number.',
  },
  {
    step: '4',
    title: 'We Diagnose & Quote',
    desc: 'We inspect the tool and send you a written quote before any work begins. No charges until you approve.',
  },
  {
    step: '5',
    title: 'Repair Completed & Returned',
    desc: 'Once approved and repaired, we ship your tool back using the return option you selected — fully tracked.',
  },
];

const PACKAGING_TIPS = [
  'Use the smallest sturdy box available; wrap the tool in bubble wrap or paper.',
  'Remove any mud, compound, or wet material before packing — this protects both the tool and our technicians.',
  'Include a printed copy of your repair request or a handwritten note describing the issue.',
  'Photograph your tool before sealing the box and keep the photos for your records.',
  'Accepted carriers for inbound: USPS, FedEx, or UPS. Keep your outbound tracking number.',
];

const SHIPPING_FAQ = [
  {
    q: 'Do I pay to ship my tool in?',
    a: 'No. We email you a prepaid inbound shipping label within 1 business day of receiving your repair request. You only pay for return shipping.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Standard return shipping typically arrives within 3–7 business days once the repair is complete. Choose Expedited (2-day air) for urgent jobs.',
  },
  {
    q: 'Can I drop off my tool locally?',
    a: 'Yes — local drop-off and pick-up is FREE and the fastest turnaround option. Contact us to schedule a drop-off appointment.',
  },
  {
    q: 'What if my tool is lost or damaged in transit?',
    a: 'All shipments include basic carrier liability. We strongly recommend the Insurance Upgrade (+$15) for tools valued over $500 to ensure full declared-value coverage.',
  },
  {
    q: 'Which carriers do you use?',
    a: 'We ship via USPS, FedEx, or UPS depending on weight, speed, and destination. The best rate is selected automatically at no extra charge.',
  },
  {
    q: 'Can I use my own shipping account?',
    a: 'Yes. If you have a negotiated rate with a carrier you prefer, let us know in the repair request notes and we will work with your carrier.',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Option card
   ───────────────────────────────────────────────────────────────────────── */
function OptionCard({ option }) {
  const isFree = option.price === 'FREE';
  const isPopular = option.badge === 'Popular';

  return (
    <div
      style={{
        background: isPopular
          ? 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)'
          : 'white',
        border: isPopular
          ? '2px solid var(--color-primary-600, #2563eb)'
          : '1px solid var(--machined-border, #e2e8f0)',
        borderRadius: '10px',
        padding: 'clamp(16px, 3vw, 22px)',
        position: 'relative',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = isPopular
          ? '0 8px 32px rgba(37,99,235,0.2)'
          : '0 6px 24px rgba(15,23,42,0.08)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Badge */}
      {option.badge && (
        <div style={{
          position: 'absolute',
          top: '-11px',
          right: '14px',
          background: option.badge === 'Free' ? '#16a34a'
            : option.badge === 'Popular' ? '#8b5cf6'
            : '#64748b',
          color: 'white',
          borderRadius: '999px',
          padding: '3px 11px',
          fontSize: '0.62rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {option.badge}
        </div>
      )}

      {/* Name + Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <h4 style={{
          margin: 0,
          fontSize: 'clamp(0.875rem, 1.8vw, 0.95rem)',
          fontWeight: 800,
          color: isPopular ? 'var(--color-primary-600, #2563eb)' : '#0f172a',
          lineHeight: 1.3,
          flex: 1,
          paddingRight: '8px',
        }}>
          {option.name}
        </h4>
        <span style={{
          fontSize: 'clamp(1rem, 2.2vw, 1.2rem)',
          fontWeight: 900,
          color: isFree ? '#16a34a'
            : isPopular ? 'var(--color-primary-600, #2563eb)'
            : '#0f172a',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {option.price}
        </span>
      </div>

      {/* Target */}
      <p style={{
        margin: '0 0 12px 0',
        fontSize: '0.75rem',
        color: 'rgba(15,23,42,0.5)',
        lineHeight: 1.4,
        fontStyle: 'italic',
      }}>
        {option.target}
      </p>

      {/* Feature list */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {option.features.map((feat) => (
          <li key={feat} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '7px',
            fontSize: '0.78rem',
            color: 'rgba(15,23,42,0.7)',
            lineHeight: 1.45,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={isPopular ? 'var(--color-primary-600, #2563eb)' : '#16a34a'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '2px' }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {feat}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shipping page
   ───────────────────────────────────────────────────────────────────────── */
export default function Shipping() {
  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="Shipping Information"
        description="Transparent shipping pricing for drywall tool repair services. Learn about our prepaid inbound labels, return shipping options, packaging guidance, and local drop-off availability."
        canonical="https://drywalltoolbox.com/shipping"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding: 'clamp(60px, 10vw, 100px) clamp(1.5rem, 5vw, 3rem)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid dot overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '40px 40px', pointerEvents: 'none',
        }} />
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '420px', height: '420px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
            gap: 'clamp(2rem, 5vw, 4rem)',
            alignItems: 'center',
          }}>
            {/* Left: copy */}
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '99px', padding: '5px 14px',
                fontSize: '0.68rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.8)', marginBottom: '24px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', flexShrink: 0, boxShadow: '0 0 8px #4ade80' }} />
                Shipping & Logistics
              </div>
              <h1 style={{
                color: 'white',
                fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
                fontWeight: 900, margin: '0 0 16px 0',
                lineHeight: 1.08, letterSpacing: '-0.035em',
              }}>
                TRANSPARENT<br />
                <span style={{ color: '#93c5fd' }}>SHIPPING PRICING.</span>
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
                margin: '0 0 32px 0',
                lineHeight: 1.6,
                maxWidth: '480px',
              }}>
                No hidden fees, no surprise surcharges. We email you a prepaid inbound label —
                you only pay for return shipping. Local drop-off is always free.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link
                  to="/repairs"
                  className="alloy-button"
                  style={{ background: 'white', color: '#1e3a8a', textDecoration: 'none', fontWeight: 800, flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Start a Repair Request
                </Link>
                <Link
                  to="/contact"
                  className="alloy-button"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 800, flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Contact Us
                </Link>
              </div>
            </div>

            {/* Right: stat cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}>
              {[
                { value: 'FREE', label: 'Inbound Shipping', sub: 'Prepaid label emailed to you' },
                { value: '1 day', label: 'Label turnaround', sub: 'Label sent within 1 business day' },
                { value: 'FREE', label: 'Local Drop-Off', sub: 'No shipping required' },
                { value: '3 carriers', label: 'USPS · FedEx · UPS', sub: 'Best rate selected automatically' },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  padding: 'clamp(14px, 2.5vw, 20px)',
                  backdropFilter: 'blur(10px)',
                }}>
                  <div style={{
                    fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
                    fontWeight: 900,
                    color: '#93c5fd',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    marginBottom: '6px',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
                    {stat.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Strip ──────────────────────────────────────────────────── */}
      <section style={{
        background: 'white',
        borderBottom: '1px solid var(--machined-border)',
        padding: 'clamp(1.25rem, 3vw, 2rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 'clamp(1rem, 3vw, 1.5rem)',
          }}>
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
                title: 'Prepaid Inbound Label',
                desc: 'We cover inbound shipping — you pay nothing to send your tool.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 0 1-2-2V7l5-5h11a2 2 0 0 1 2 2v15z"/>
                  </svg>
                ),
                title: 'No Hidden Fees',
                desc: 'Return shipping price shown upfront — actual carrier cost, zero markup.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                ),
                title: 'Full Tracking',
                desc: 'Track every shipment in real time with your carrier tracking number.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                title: 'Fast Turnaround',
                desc: 'Label sent in 1 business day. Expedited 2-day return available.',
              },
            ].map((item) => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  flexShrink: 0,
                  width: '40px', height: '40px',
                  background: 'rgba(37,99,235,0.07)',
                  border: '1px solid rgba(37,99,235,0.15)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.55)', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'var(--alloy-base)',
        borderBottom: '1px solid var(--machined-border)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '99px', padding: '5px 16px',
              fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--color-primary-600, #2563eb)', marginBottom: '14px',
            }}>
              The Process
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              How Shipping Works
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0 }}>
              From repair request to your door — every step explained
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(220px, 30vw, 260px), 1fr))',
            gap: '16px',
          }}>
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div key={item.step} style={{
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '12px',
                padding: 'clamp(18px, 3vw, 24px)',
                position: 'relative',
              }}>
                <div style={{
                  width: '36px', height: '36px',
                  background: 'var(--color-primary-600, #2563eb)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800, color: 'white',
                  marginBottom: '14px', flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', margin: 0, lineHeight: 1.55 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shipping Options ─────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '99px', padding: '5px 16px',
              fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--color-primary-600, #2563eb)', marginBottom: '14px',
            }}>
              Return Shipping Options
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Shipping Pricing
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
              Transparent pricing — no hidden fees or surprise surcharges
            </p>
          </div>

          {/* Note bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'rgba(37,99,235,0.05)',
            border: '1px solid rgba(37,99,235,0.15)',
            borderRadius: '6px',
            marginBottom: '24px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-600, #2563eb)', fontWeight: 600 }}>
              Inbound shipping (sending your tool to us) is always FREE — we email you a prepaid label.
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(220px, 28vw, 280px), 1fr))',
            gap: '16px',
          }}>
            {SHIPPING_OPTIONS.map((option) => (
              <OptionCard key={option.id} option={option} />
            ))}
          </div>

          <p style={{
            fontSize: '0.72rem',
            color: 'rgba(15,23,42,0.38)',
            marginTop: '20px',
            lineHeight: 1.6,
          }}>
            * Actual return shipping cost is calculated at time of repair completion based on weight, dimensions, and destination.
            Standard pricing reflects typical tool weights of 5–15 lbs. No charges until you approve your final quote.
          </p>
        </div>
      </section>

      {/* ── Packaging Guide ──────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'var(--alloy-base)',
        borderTop: '1px solid var(--machined-border)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '99px', padding: '5px 16px',
              fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--color-primary-600, #2563eb)', marginBottom: '14px',
            }}>
              Packaging Tips
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              How to Package Your Tool
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0 }}>
              Good packaging prevents transit damage and speeds up diagnostics
            </p>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid var(--machined-border)',
            borderRadius: '12px',
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
          }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {PACKAGING_TIPS.map((tip, i) => (
                <li key={i} style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  paddingBottom: i < PACKAGING_TIPS.length - 1 ? '16px' : 0,
                  borderBottom: i < PACKAGING_TIPS.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none',
                }}>
                  <div style={{
                    flexShrink: 0,
                    width: '26px', height: '26px',
                    background: 'rgba(37,99,235,0.08)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 800,
                    color: 'var(--color-primary-600, #2563eb)',
                    marginTop: '1px',
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.75)', lineHeight: 1.55 }}>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '99px', padding: '5px 16px',
              fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--color-primary-600, #2563eb)', marginBottom: '14px',
            }}>
              Common Questions
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Shipping FAQ
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SHIPPING_FAQ.map((item) => (
              <div key={item.q} style={{
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '10px',
                padding: 'clamp(16px, 3vw, 22px)',
              }}>
                <h3 style={{
                  fontSize: '0.925rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '0 0 8px 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: '20px', height: '20px',
                    background: 'var(--color-primary-600, #2563eb)',
                    borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 900, color: 'white',
                    marginTop: '1px',
                  }}>Q</span>
                  {item.q}
                </h3>
                <p style={{
                  fontSize: '0.85rem',
                  color: 'rgba(15,23,42,0.65)',
                  margin: 0,
                  lineHeight: 1.6,
                  paddingLeft: '30px',
                }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 900, color: 'white',
            margin: '0 0 16px 0', letterSpacing: '-0.025em',
          }}>
            Ready to Ship Your Tool?
          </h2>
          <p style={{
            fontSize: 'clamp(0.925rem, 2vw, 1.05rem)',
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 32px 0',
            lineHeight: 1.6,
          }}>
            Start a repair request and we'll email your prepaid inbound label within one business day.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/repairs"
              className="alloy-button"
              style={{ background: 'white', color: '#1e3a8a', textDecoration: 'none', fontWeight: 800 }}
            >
              Start a Repair Request
            </Link>
            <Link
              to="/contact"
              className="alloy-button"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 700 }}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
