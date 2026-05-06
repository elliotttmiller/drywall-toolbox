/**
 * frontend/src/pages/ShippingPolicy.jsx
 *
 * Shipping Policy page — /shipping-policy
 *
 * Covers: free shipping threshold, carriers & service levels, processing
 * times, international shipping, order modifications, packaging, and FAQs.
 * Static informational page — no auth required.
 */

import { Link } from 'react-router-dom';
import { Truck, Clock, Package, Globe, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import SEOHead from '../components/SEOHead';

/* ─── Shipping rate table data ───────────────────────────────────────────────── */
const SHIPPING_RATES = [
  {
    service:    'Standard Ground',
    carrier:    'UPS / USPS',
    transit:    '3–5 business days',
    price:      'Calculated at checkout',
    highlight:  false,
  },
  {
    service:    'Expedited 2-Day',
    carrier:    'UPS',
    transit:    '2 business days',
    price:      'Calculated at checkout',
    highlight:  false,
  },
  {
    service:    'Overnight',
    carrier:    'UPS',
    transit:    '1 business day',
    price:      'Calculated at checkout',
    highlight:  false,
  },
  {
    service:    'Local Pickup',
    carrier:    'In-person',
    transit:    'By appointment',
    price:      'Free',
    highlight:  false,
  },
];

/* ─── Policy highlight cards ─────────────────────────────────────────────────── */
const HIGHLIGHTS = [
  {
    Icon:  Truck,
    color: '#2563eb',
    bg:    'linear-gradient(135deg, #eff6ff, #dbeafe)',
    title: 'Free Shipping ≥ $150',
    body:  'All orders over $150 ship free via Standard Ground to the contiguous 48 states. AK, HI, and Canada are calculated at carrier rate.',
  },
  {
    Icon:  Clock,
    color: '#16a34a',
    bg:    'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    title: 'Same-Day Processing',
    body:  'In-stock orders placed before 12:00 PM CT on business days are prioritized for same-day pick, pack, and handoff to carrier.',
  },
  {
    Icon:  Package,
    color: '#d97706',
    bg:    'linear-gradient(135deg, #fffbeb, #fef3c7)',
    title: 'Insured & Photographed',
    body:  'Every outbound shipment is photographed before sealing and fully insured at declared value. Large tools are double-boxed with foam inserts.',
  },
  {
    Icon:  Globe,
    color: '#7c3aed',
    bg:    'linear-gradient(135deg, #f5f3ff, #ede9fe)',
    title: 'US & Canada Shipping',
    body:  'We ship to all 50 US states and Canada. International orders outside North America are handled case-by-case — contact us first.',
  },
];

/* ─── FAQ items specific to shipping ────────────────────────────────────────── */
const SHIPPING_FAQS = [
  {
    q: 'How do I track my shipment?',
    a: 'A tracking number is emailed automatically the moment your order ships. You can also find live tracking and your full order history in your Account Dashboard under Order History.',
  },
  {
    q: 'Can I modify or cancel my order after it\'s placed?',
    a: 'Modifications and cancellations can be made within 2 hours of placement, provided the order has not yet been picked. Contact us immediately via the order confirmation page. Once a shipping label is generated, a return must be initiated after delivery.',
  },
  {
    q: 'What if an item is backordered?',
    a: 'We will notify you by email with an estimated restock date and offer to hold, substitute, or refund the line item. Backordered parts never delay in-stock items — they ship separately at no extra shipping charge.',
  },
  {
    q: 'Do you offer local pickup?',
    a: 'Yes — local pickup is available by appointment at our facility. Select "Local Pickup" at checkout and we\'ll send a ready-for-pickup notification. Bring your order confirmation and a valid ID.',
  },
  {
    q: 'How are large or heavy tools packaged?',
    a: 'Larger tools and complete sets are double-boxed with industrial foam inserts and corner protection. If an item requires freight (LTL), we\'ll contact you to coordinate before shipping.',
  },
];

export default function ShippingPolicy() {
  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="Shipping Policy"
        description="Drywall Toolbox shipping policy: free shipping on orders over $150, same-day processing, UPS & USPS service levels, international shipping, and tracking information."
        canonical="https://drywalltoolbox.com/shipping-policy"
      />

      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <section style={{
        background:  'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding:     'clamp(48px, 8vw, 80px) clamp(1.5rem, 5vw, 3rem) clamp(3rem, 6vw, 4rem)',
        position:    'relative',
        overflow:    'hidden',
      }}>
        {/* dot-grid texture */}
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
            Shipping Information
          </div>

          <h1 style={{
            color:         'white',
            fontSize:      'clamp(2rem, 5vw, 3.5rem)',
            fontWeight:    800,
            margin:        0,
            lineHeight:    1.1,
            letterSpacing: '-0.03em',
          }}>
            SHIPPING POLICY
          </h1>

          <p style={{
            color:      'rgba(255,255,255,0.65)',
            fontSize:   'clamp(0.9rem, 2vw, 1rem)',
            margin:     '12px 0 0',
            maxWidth:   '560px',
            lineHeight: 1.6,
          }}>
            Everything you need to know about how we pack, ship, and track your
            Drywall Toolbox orders — from processing times to delivery.
          </p>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <section style={{
        padding:   'clamp(2.5rem, 5vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        maxWidth:  '1400px',
        margin:    '0 auto',
      }}>

        {/* Free-shipping banner */}
        <div style={{
          background:   'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border:       '1px solid #bfdbfe',
          borderRadius: '4px',
          padding:      '20px 28px',
          display:      'flex',
          alignItems:   'center',
          gap:          '16px',
          marginBottom: 'clamp(2rem, 4vw, 3rem)',
          flexWrap:     'wrap',
        }}>
          <div style={{
            width:          '44px',
            height:         '44px',
            background:     'white',
            borderRadius:   '10px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          '#2563eb',
            flexShrink:     0,
            boxShadow:      '0 2px 8px rgba(37,99,235,0.15)',
          }}>
            <Truck size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e3a8a', marginBottom: '2px' }}>
              Free Standard Ground Shipping on Orders Over $150
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(30,58,138,0.7)' }}>
              Applies to orders shipping within the contiguous 48 states. Alaska, Hawaii, and Canada
              are calculated at actual carrier rate.
            </div>
          </div>
        </div>

        {/* Highlight cards */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap:                 '16px',
          marginBottom:        'clamp(2.5rem, 5vw, 4rem)',
        }}>
          {HIGHLIGHTS.map(({ Icon, color, bg, title, body }) => (
            <div key={title} style={{
              background:   'white',
              border:       '1px solid var(--machined-border)',
              borderRadius: '4px',
              padding:      '20px 20px 22px',
            }}>
              <div style={{
                width:          '44px',
                height:         '44px',
                background:     bg,
                borderRadius:   '10px',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                color,
                marginBottom:   '14px',
              }}>
                <Icon size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '6px' }}>
                {title}
              </div>
              <div style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', lineHeight: 1.6 }}>
                {body}
              </div>
            </div>
          ))}
        </div>

        {/* ── Service levels table ──────────────────────────────────────── */}
        <div style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
          <h2 style={{
            fontSize:      'clamp(1.3rem, 2.5vw, 1.75rem)',
            fontWeight:    800,
            color:         '#0f172a',
            margin:        '0 0 6px',
            letterSpacing: '-0.02em',
          }}>
            Service Levels &amp; Carriers
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.55)', margin: '0 0 20px', lineHeight: 1.6 }}>
            Carrier and cost are calculated at checkout based on package weight, dimensions, and destination.
          </p>

          <div style={{
            background:   'white',
            border:       '1px solid var(--machined-border)',
            borderRadius: '4px',
            overflow:     'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display:         'grid',
              gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr',
              padding:         '12px 20px',
              background:      '#f8fafc',
              borderBottom:    '1px solid var(--machined-border)',
              gap:             '8px',
            }}>
              {['Service', 'Carrier', 'Transit Time', 'Cost'].map((h) => (
                <div key={h} style={{
                  fontSize:      '0.68rem',
                  fontWeight:    700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color:         'rgba(15,23,42,0.45)',
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {SHIPPING_RATES.map((row, i) => (
              <div key={row.service} style={{
                display:             'grid',
                gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr',
                padding:             '14px 20px',
                borderBottom:        i < SHIPPING_RATES.length - 1 ? '1px solid var(--machined-border)' : 'none',
                gap:                 '8px',
                alignItems:          'center',
              }}>
                <div style={{ fontWeight: 650, fontSize: '0.875rem', color: '#0f172a' }}>{row.service}</div>
                <div style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)' }}>{row.carrier}</div>
                <div style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)' }}>{row.transit}</div>
                <div style={{
                  fontSize:   '0.825rem',
                  color:      row.price === 'Free' ? '#16a34a' : 'rgba(15,23,42,0.6)',
                  fontWeight: row.price === 'Free' ? 700 : 400,
                }}>
                  {row.price}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-column: processing + international ────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap:                 '24px',
          marginBottom:        'clamp(2.5rem, 5vw, 4rem)',
        }}>

          {/* Processing times */}
          <div style={{
            background:   'white',
            border:       '1px solid var(--machined-border)',
            borderRadius: '4px',
            padding:      'clamp(1.25rem, 3vw, 2rem)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width:          '36px',
                height:         '36px',
                background:     'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                borderRadius:   '8px',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                color:          '#16a34a',
                flexShrink:     0,
              }}>
                <Clock size={18} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Order Processing
              </h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'In-stock items are processed within 1 business day of order placement.',
                'Orders before 12:00 PM CT are prioritized for same-day processing.',
                'You\'ll receive a shipment confirmation email with tracking once your order is picked up by the carrier.',
                'Backordered items ship separately at no additional charge — they never delay in-stock items.',
              ].map((text) => (
                <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle size={15} style={{ color: '#16a34a', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.7)', lineHeight: 1.55 }}>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* International shipping */}
          <div style={{
            background:   'white',
            border:       '1px solid var(--machined-border)',
            borderRadius: '4px',
            padding:      'clamp(1.25rem, 3vw, 2rem)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width:          '36px',
                height:         '36px',
                background:     'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                borderRadius:   '8px',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                color:          '#7c3aed',
                flexShrink:     0,
              }}>
                <Globe size={18} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                International &amp; Canada
              </h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'We ship to all 50 US states and Canada at calculated carrier rates.',
                'Free shipping threshold does not apply to Alaska, Hawaii, or Canada.',
                'International orders outside North America are handled case-by-case.',
                'Contact us before placing an international order to confirm eligibility and get a shipping quote.',
              ].map((text) => (
                <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle size={15} style={{ color: '#7c3aed', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.7)', lineHeight: 1.55 }}>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── FAQ section ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
          <h2 style={{
            fontSize:      'clamp(1.3rem, 2.5vw, 1.75rem)',
            fontWeight:    800,
            color:         '#0f172a',
            margin:        '0 0 20px',
            letterSpacing: '-0.02em',
          }}>
            Common Shipping Questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SHIPPING_FAQS.map(({ q, a }) => (
              <div key={q} style={{
                background:   'white',
                border:       '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding:      '18px 22px',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '8px' }}>
                  {q}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.65)', lineHeight: 1.65 }}>
                  {a}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Damage / lost shipment notice ─────────────────────────────── */}
        <div style={{
          background:   '#fefce8',
          border:       '1px solid #fde68a',
          borderRadius: '4px',
          padding:      '20px 24px',
          display:      'flex',
          alignItems:   'flex-start',
          gap:          '14px',
          marginBottom: 'clamp(2.5rem, 5vw, 4rem)',
        }}>
          <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e', marginBottom: '4px' }}>
              Damaged or Incorrect Order?
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(146,64,14,0.85)', lineHeight: 1.6 }}>
              All outbound shipments are insured and photographed before sealing. If your order arrives
              damaged or contains the wrong item, photograph the packaging and contents immediately and{' '}
              <Link
                to="/contact"
                style={{ color: '#b45309', fontWeight: 600, textDecoration: 'underline' }}
              >
                contact us within 48 hours
              </Link>
              . We will file the carrier claim and dispatch a replacement — you will not be asked to
              return a damaged item.
            </div>
          </div>
        </div>

        {/* ── CTA row ───────────────────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap:                 '16px',
        }}>
          <Link
            to="/returns"
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              gap:             '12px',
              background:      'white',
              border:          '1px solid var(--machined-border)',
              borderRadius:    '4px',
              padding:         '18px 22px',
              textDecoration:  'none',
              transition:      'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-600)';
              e.currentTarget.style.boxShadow   = '0 2px 12px rgba(37,99,235,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--machined-border)';
              e.currentTarget.style.boxShadow   = 'none';
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '3px' }}>
                Start a Return
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)' }}>
                Initiate a return or exchange request
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          </Link>

          <Link
            to="/contact"
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              gap:             '12px',
              background:      'white',
              border:          '1px solid var(--machined-border)',
              borderRadius:    '4px',
              padding:         '18px 22px',
              textDecoration:  'none',
              transition:      'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-600)';
              e.currentTarget.style.boxShadow   = '0 2px 12px rgba(37,99,235,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--machined-border)';
              e.currentTarget.style.boxShadow   = 'none';
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '3px' }}>
                Contact Support
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)' }}>
                Questions about your shipment? We&apos;re here.
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          </Link>

          <Link
            to="/faq"
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              gap:             '12px',
              background:      'white',
              border:          '1px solid var(--machined-border)',
              borderRadius:    '4px',
              padding:         '18px 22px',
              textDecoration:  'none',
              transition:      'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-600)';
              e.currentTarget.style.boxShadow   = '0 2px 12px rgba(37,99,235,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--machined-border)';
              e.currentTarget.style.boxShadow   = 'none';
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '3px' }}>
                Full FAQ
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)' }}>
                Shipping, warranty, repairs &amp; more
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          </Link>
        </div>

      </section>
    </div>
  );
}
