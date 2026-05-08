/**
 * frontend/src/pages/StorePolicies.jsx
 *
 * Store Policies page — /policies
 *
 * Comprehensive static policy reference covering:
 *   § 1 Return Policy (45-day window, no restocking fee, shipping, refunds,
 *        non-returnable items, holiday extension)
 *   § 2 Warranty Policy (manufacturer warranties table, satisfaction guarantee,
 *        out-of-warranty repair support)
 *   § 3 Order Cancellations
 *   § 4 Payment & Financing
 *   § 5 Contact & Support channels
 *
 * Based on: Drywall_Toolbox_Store_Policies.pdf  (Effective May 2026)
 * Static informational page — no auth required.
 */

import { Link } from 'react-router-dom';
import {
  RotateCcw, Shield, Truck, CreditCard, Phone,
  CheckCircle, AlertCircle, ArrowRight, Info,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

/* ─── Return shipping responsibility table ───────────────────────────────────── */
const RETURN_SHIPPING_ROWS = [
  { reason: 'Item received damaged or defective',      payer: 'Drywall Toolbox — prepaid label provided', dtbPays: true  },
  { reason: 'Wrong item shipped (our error)',           payer: 'Drywall Toolbox — prepaid label provided', dtbPays: true  },
  { reason: 'Warranty claim (covered defect)',          payer: 'Drywall Toolbox — prepaid label provided', dtbPays: true  },
  { reason: 'Ordered wrong item (customer error)',      payer: 'Customer pays return shipping',             dtbPays: false },
  { reason: 'Changed mind / no longer needed',          payer: 'Customer pays return shipping',             dtbPays: false },
];

/* ─── Manufacturer warranty table ────────────────────────────────────────────── */
const WARRANTY_ROWS = [
  { brand: 'Columbia Taping Tools',  coverage: '5 Years',     notes: 'Manufacturing defects; all components' },
  { brand: 'Drywall Master Tools',   coverage: '5 Years',     notes: 'Manufacturing defects; all components' },
  { brand: 'Platinum Drywall Tools', coverage: '5 Years',     notes: 'Manufacturing defects; stainless & anodized parts' },
  { brand: 'TapeTech Tools',         coverage: 'Per mfr.',    notes: 'Contact us for current coverage details' },
  { brand: 'DeWalt Power Tools',     coverage: '3 Years',     notes: 'Manufacturing defects; 1-yr free service' },
  { brand: 'FLEX Power Tools',       coverage: '3 Years',     notes: 'Manufacturing defects' },
  { brand: 'Festool',                coverage: '3 Years',     notes: 'Full service coverage (registered tools)' },
  { brand: 'Graco Spray Equipment',  coverage: 'Per product', notes: 'Contact us; varies by model' },
  { brand: 'Dura-Stilts',            coverage: 'Per product', notes: 'Manufacturing defects' },
  { brand: 'Hand Tools (General)',   coverage: 'Lifetime / 1 yr', notes: 'Manufacturer\'s defect; varies by brand' },
];

/* ─── Contact channels ───────────────────────────────────────────────────────── */
const CONTACT_ROWS = [
  // TODO: replace placeholder with real phone number when available
  { channel: 'Phone',          detail: '(XXX) XXX-XXXX — Mon–Fri 8:00 AM – 6:00 PM CST' },
  { channel: 'General Email',  detail: 'support@drywalltoolbox.com' },
  { channel: 'Returns Email',  detail: 'returns@drywalltoolbox.com' },
  { channel: 'Warranty Email', detail: 'warranty@drywalltoolbox.com' },
  { channel: 'Return Portal',  detail: 'drywalltoolbox.com/returns' },
  { channel: 'Order Tracking', detail: 'drywalltoolbox.com/track (or your account dashboard)' },
];

/* ─── Section header component ───────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, iconColor, iconBg, number, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '28px' }}>
      <div style={{
        width:          '48px',
        height:         '48px',
        background:     iconBg,
        borderRadius:   '12px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        color:          iconColor,
        flexShrink:     0,
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{
          fontSize:      '0.65rem',
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         'rgba(15,23,42,0.4)',
          marginBottom:  '3px',
        }}>
          Section {number}
        </div>
        <h2 style={{
          fontSize:      'clamp(1.25rem, 2.5vw, 1.75rem)',
          fontWeight:    800,
          color:         '#0f172a',
          margin:        '0 0 5px',
          letterSpacing: '-0.02em',
          lineHeight:    1.15,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.55)', margin: 0, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Info callout box ───────────────────────────────────────────────────────── */
function Callout({ icon: Icon = Info, color = '#2563eb', bg = '#eff6ff', border = '#bfdbfe', children }) {
  return (
    <div style={{
      background:   bg,
      border:       `1px solid ${border}`,
      borderRadius: '4px',
      padding:      '16px 20px',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          '12px',
      marginBottom: '24px',
    }}>
      <Icon size={18} style={{ color, flexShrink: 0, marginTop: '1px' }} />
      <div style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.75)', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Policy table ───────────────────────────────────────────────────────────── */
function PolicyTable({ headers, rows, columns }) {
  const colTemplate = columns || `repeat(${headers.length}, 1fr)`;
  return (
    <div style={{
      background:   'white',
      border:       '1px solid var(--machined-border)',
      borderRadius: '4px',
      overflow:     'hidden',
      marginBottom: '24px',
    }}>
      <div style={{
        display:             'grid',
        gridTemplateColumns: colTemplate,
        padding:             '10px 20px',
        background:          '#f8fafc',
        borderBottom:        '1px solid var(--machined-border)',
        gap:                 '12px',
      }}>
        {headers.map((h) => (
          <div key={h} style={{
            fontSize:      '0.65rem',
            fontWeight:    700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color:         'rgba(15,23,42,0.45)',
          }}>
            {h}
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display:             'grid',
          gridTemplateColumns: colTemplate,
          padding:             '13px 20px',
          borderBottom:        i < rows.length - 1 ? '1px solid var(--machined-border)' : 'none',
          gap:                 '12px',
          alignItems:          'center',
        }}>
          {row}
        </div>
      ))}
    </div>
  );
}

/* ─── Bullet list ────────────────────────────────────────────────────────────── */
function BulletList({ items, color = '#2563eb' }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {items.map((text) => (
        <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <CheckCircle size={14} style={{ color, marginTop: '2px', flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.72)', lineHeight: 1.55 }}>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Section divider ────────────────────────────────────────────────────────── */
function Divider() {
  return <div style={{ borderTop: '1px solid var(--machined-border)', margin: 'clamp(2.5rem, 5vw, 4rem) 0' }} />;
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function StorePolicies() {
  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="Store Policies"
        description="Drywall Toolbox store policies: 45-day returns with no restocking fee, manufacturer warranties, free shipping on orders $75+, order cancellations, and payment options."
        canonical="https://drywalltoolbox.com/policies"
      />

      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <section style={{
        background:  'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding:     'clamp(48px, 8vw, 80px) clamp(1.5rem, 5vw, 3rem) clamp(3rem, 6vw, 4rem)',
        position:    'relative',
        overflow:    'hidden',
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
            Effective May 2026
          </div>

          <h1 style={{
            color:         'white',
            fontSize:      'clamp(2rem, 5vw, 3.5rem)',
            fontWeight:    800,
            margin:        0,
            lineHeight:    1.1,
            letterSpacing: '-0.03em',
          }}>
            STORE POLICIES
          </h1>

          <p style={{
            color:      'rgba(255,255,255,0.65)',
            fontSize:   'clamp(0.9rem, 2vw, 1rem)',
            margin:     '12px 0 0',
            maxWidth:   '560px',
            lineHeight: 1.6,
          }}>
            Return Policy · Warranty Policy · Shipping Policy · Order Cancellations · Payment &amp; Financing
          </p>

          {/* Quick navigation chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '28px' }}>
            {[
              { label: 'Returns',      href: '#returns'      },
              { label: 'Warranty',     href: '#warranty'     },
              { label: 'Cancellations',href: '#cancellations'},
              { label: 'Payment',      href: '#payment'      },
              { label: 'Contact',      href: '#contact'      },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{
                  background:    'rgba(255,255,255,0.1)',
                  border:        '1px solid rgba(255,255,255,0.2)',
                  borderRadius:  '3px',
                  padding:       '6px 14px',
                  fontSize:      '0.78rem',
                  fontWeight:    600,
                  color:         'rgba(255,255,255,0.85)',
                  textDecoration:'none',
                  transition:    'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <section style={{
        padding:  'clamp(2.5rem, 5vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        maxWidth: '1100px',
        margin:   '0 auto',
      }}>

        {/* ── § 1 Return Policy ──────────────────────────────────────────── */}
        <div id="returns">
          <SectionHeader
            icon={RotateCcw}
            iconColor="#2563eb"
            iconBg="linear-gradient(135deg, #eff6ff, #dbeafe)"
            number="1"
            title="Return Policy"
            subtitle="Your satisfaction is guaranteed. We're here to make returns painless — not punishing."
          />

          {/* 1.1 Return window */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.1 — Standard Return Window
          </h3>
          <Callout icon={CheckCircle} color="#16a34a" bg="#f0fdf4" border="#86efac">
            Drywall Toolbox offers a <strong>45-day return window</strong> from the date of purchase — 50% longer than
            the industry-standard 30 days. <strong>There is NO restocking fee for standard returns — ever.</strong>
          </Callout>
          <BulletList color="#2563eb" items={[
            'Returns accepted within 45 days of invoice date.',
            'Items must be unused, in like-new condition, and in original packaging with all included accessories, documentation, and warranty cards.',
            'A copy of your receipt or order confirmation is required.',
            'There is NO restocking fee for standard returns — ever.',
          ]} />

          {/* 1.2 How to initiate */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.2 — How to Initiate a Return
          </h3>
          <ol style={{ paddingLeft: '1.25rem', margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              <>Submit a return request via our <Link to="/returns" style={{ color: 'var(--primary-600)' }}>online Return Portal</Link> or email <a href="mailto:returns@drywalltoolbox.com" style={{ color: 'var(--primary-600)' }}>returns@drywalltoolbox.com</a>.</>,
              'You will receive an RMA number and return instructions by email within 1 business day.',
              'Package the item securely in its original packaging. Mark the RMA number clearly on the outside of the box.',
              'Ship the return. Returns without a valid RMA number will not be accepted.',
            ].map((item, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.72)', lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ol>
          <Callout icon={AlertCircle} color="#d97706" bg="#fffbeb" border="#fde68a">
            <strong>Important:</strong> Do not ship returns directly to the manufacturer. Always route returns
            through Drywall Toolbox. If an item is defective or was shipped in error, contact us{' '}
            <em>before</em> shipping — we will provide a prepaid return label.
          </Callout>

          {/* 1.3 Return shipping */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.3 — Return Shipping Costs
          </h3>
          <PolicyTable
            headers={['Return Reason', 'Who Pays']}
            columns="2fr 2fr"
            rows={RETURN_SHIPPING_ROWS.map(({ reason, payer, dtbPays }) => [
              <span key="r" style={{ fontSize: '0.875rem', color: '#0f172a' }}>{reason}</span>,
              <span key="p" style={{ fontSize: '0.85rem', color: dtbPays ? '#16a34a' : 'rgba(15,23,42,0.65)', fontWeight: dtbPays ? 600 : 400 }}>
                {payer}
              </span>,
            ])}
          />
          <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.55)', margin: '-12px 0 24px', lineHeight: 1.55 }}>
            We recommend using a trackable shipping service for returns over $75. Drywall Toolbox is not responsible
            for items lost or damaged in transit when the customer is responsible for return shipping.
          </p>

          {/* 1.4 Refund processing */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.4 — Refund Processing
          </h3>
          <BulletList color="#2563eb" items={[
            'Once your return is received and inspected, you will receive an email confirmation within 1 business day.',
            'Approved refunds are issued to the original payment method within 3–5 business days.',
            'Original outbound shipping charges are non-refundable.',
            'If your order shipped under a Free Shipping promotion, the actual cost of outbound shipping will be deducted from your refund.',
            'Refunds for freight shipments exclude the original freight cost even if the order showed "Free Shipping."',
          ]} />

          {/* 1.5 Non-returnable */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.5 — Items Not Eligible for Return
          </h3>
          <BulletList color="#ef4444" items={[
            'Used tools showing signs of wear, marks, damage, or compound residue.',
            'Items returned beyond the 45-day window (warranty claims may still apply — see Section 2).',
            'Closeout, final-sale, discontinued, outlet, or specially priced items (noted on product page).',
            'Direct-ship (drop-shipped) items marked as non-returnable on the product listing.',
            'Partially used consumable case quantities (sandpaper, tape, abrasives, etc.).',
            'Items missing parts, accessories, original manuals, or warranty documentation.',
            'Special-order items custom-configured for the customer.',
          ]} />

          {/* 1.6 Used tool returns */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.6 — Used Tool Returns
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.7)', margin: '0 0 24px', lineHeight: 1.65 }}>
            If you have used an item and believe it did not perform as advertised, please{' '}
            <Link to="/contact" style={{ color: 'var(--primary-600)' }}>contact us</Link> before returning it.
            We will evaluate each case individually. Used tool returns may be subject to assessment and, at our
            discretion, a restocking or evaluation fee may apply. Our goal is always to find a fair resolution —
            we never want you stuck with a tool that doesn't work for your application.
          </p>

          {/* 1.7 Damaged/missing */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.7 — Damaged or Missing Items on Delivery
          </h3>
          <Callout icon={AlertCircle} color="#d97706" bg="#fefce8" border="#fde68a">
            If your order arrives damaged or with missing items, you must notify us{' '}
            <strong>within 72 hours of delivery</strong>. Call or email{' '}
            <a href="mailto:support@drywalltoolbox.com" style={{ color: '#b45309', fontWeight: 600 }}>support@drywalltoolbox.com</a>{' '}
            immediately with photos of the outer packaging and all damaged contents.
          </Callout>
          <BulletList color="#d97706" items={[
            'Photograph the outer packaging and all damaged contents before moving or discarding any packing materials.',
            'Do not discard the box or packing material — it may be needed for a carrier claim.',
            'Check all flaps and inner packing material; smaller parts are sometimes secured inside.',
            'We will resolve the issue via replacement, credit, or refund at our cost — no hassle, no argument.',
          ]} />

          {/* 1.8 Refused freight */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.8 — Refused Freight Shipments
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.7)', margin: '0 0 24px', lineHeight: 1.65 }}>
            If you refuse a freight/LTL shipment without prior authorization from Drywall Toolbox, the cost of
            the original outbound freight plus the cost of the return freight will be deducted from your refund.
            If the shipment arrived visibly damaged, please note the damage on the carrier's delivery receipt
            before signing and <Link to="/contact" style={{ color: 'var(--primary-600)' }}>contact us immediately</Link>{' '}
            rather than refusing the shipment.
          </p>

          {/* 1.9 Holiday extension */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            1.9 — Holiday Extended Returns
          </h3>
          <Callout icon={Info} color="#2563eb" bg="#eff6ff" border="#bfdbfe">
            Purchases made from <strong>November 15 through December 31</strong> each year are eligible for an
            extended return window through <strong>January 31 of the following year</strong>, for unused and
            unopened items only. All other terms of this policy still apply.
          </Callout>
        </div>

        <Divider />

        {/* ── § 2 Warranty Policy ─────────────────────────────────────────── */}
        <div id="warranty">
          <SectionHeader
            icon={Shield}
            iconColor="#16a34a"
            iconBg="linear-gradient(135deg, #f0fdf4, #dcfce7)"
            number="2"
            title="Warranty Policy"
            subtitle="We don't just pass you off to the manufacturer. We actively manage warranty claims on your behalf."
          />

          {/* 2.1 Manufacturer warranties */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            2.1 — Manufacturer Warranties
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.65)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Most professional drywall tools sold by Drywall Toolbox carry manufacturer warranties. Unlike competitors
            who link to external manufacturer pages and leave you to manage the process yourself, Drywall Toolbox
            provides <strong>active warranty support</strong> — we are your advocate with the manufacturer.
          </p>
          <PolicyTable
            headers={['Brand / Product Type', 'Typical Coverage', 'Notes']}
            columns="1.5fr 1fr 2fr"
            rows={WARRANTY_ROWS.map(({ brand, coverage, notes }) => [
              <span key="b" style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{brand}</span>,
              <span key="c" style={{ fontSize: '0.85rem', color: 'var(--primary-600)', fontWeight: 600 }}>{coverage}</span>,
              <span key="n" style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.65)' }}>{notes}</span>,
            ])}
          />

          {/* 2.2 How to file */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            2.2 — How to File a Warranty Claim
          </h3>
          <ol style={{ paddingLeft: '1.25rem', margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              <>Contact Drywall Toolbox first — email <a href="mailto:warranty@drywalltoolbox.com" style={{ color: 'var(--primary-600)' }}>warranty@drywalltoolbox.com</a> with your order number and a description of the issue.</>,
              'Photograph or video the defect. This helps us expedite the claim with the manufacturer on your behalf.',
              'We will determine whether the claim should be routed to us or directly to the manufacturer\'s service department, and provide a prepaid return label if the item needs to come back.',
              'Resolution — repair, replacement, or refund — will be communicated within 3 business days of our receiving the claim.',
            ].map((item, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.72)', lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ol>

          {/* 2.3 What's not covered */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            2.3 — What Warranties Do Not Cover
          </h3>
          <BulletList color="#ef4444" items={[
            'Normal wear and tear from regular professional use.',
            'Damage caused by misuse, abuse, improper application, or failure to maintain/clean the tool.',
            'Damage caused by using unauthorized or incompatible replacement parts.',
            'Cosmetic damage (scratches, dents) not affecting function.',
            'Damage resulting from alteration or modification of the tool.',
            'Tools purchased in "as-is," "outlet," or "refurbished" condition (noted at time of sale).',
          ]} />

          {/* 2.4 Satisfaction guarantee */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            2.4 — Drywall Toolbox Satisfaction Guarantee
          </h3>
          <Callout icon={CheckCircle} color="#16a34a" bg="#f0fdf4" border="#86efac">
            In addition to manufacturer warranties, Drywall Toolbox offers a <strong>30-day satisfaction guarantee</strong>{' '}
            on all standard stock items. If a product does not perform as described within the first 30 days — even if
            used — <Link to="/contact" style={{ color: '#16a34a', fontWeight: 600 }}>contact us</Link>. We will work
            with you toward a repair, exchange, or credit. We are not satisfied until you are.
          </Callout>

          {/* 2.5 Out-of-warranty */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            2.5 — Out-of-Warranty Repair Support
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.7)', margin: '0 0 24px', lineHeight: 1.65 }}>
            Even after warranty periods expire, Drywall Toolbox maintains access to replacement parts and can
            facilitate manufacturer repair programs for major tool brands including TapeTech, Columbia, Drywall
            Master, Graco, and others. <Link to="/contact" style={{ color: 'var(--primary-600)' }}>Contact our
            support team</Link> at <a href="mailto:support@drywalltoolbox.com" style={{ color: 'var(--primary-600)' }}>
            support@drywalltoolbox.com</a> for repair referrals and parts sourcing.
          </p>
        </div>

        <Divider />

        {/* ── § 3 Order Cancellations ─────────────────────────────────────── */}
        <div id="cancellations">
          <SectionHeader
            icon={AlertCircle}
            iconColor="#d97706"
            iconBg="linear-gradient(135deg, #fffbeb, #fef3c7)"
            number="3"
            title="Order Cancellations"
            subtitle={null}
          />
          <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.7)', margin: '0 0 20px', lineHeight: 1.65 }}>
            You may cancel an order at any time <strong>before it has been fulfilled and shipped</strong>. Once a
            shipment has left our facility, the standard return process applies. To cancel, contact us immediately
            at <a href="mailto:support@drywalltoolbox.com" style={{ color: 'var(--primary-600)' }}>support@drywalltoolbox.com</a>{' '}
            and reference your order number.
          </p>
          <BulletList color="#d97706" items={[
            'Direct-ship (drop-shipped) orders and special-order items cannot be cancelled once they have been placed with the manufacturer.',
            'Freight orders that have been picked up by the carrier cannot be cancelled without incurring freight costs.',
          ]} />
        </div>

        <Divider />

        {/* ── § 4 Payment & Financing ─────────────────────────────────────── */}
        <div id="payment">
          <SectionHeader
            icon={CreditCard}
            iconColor="#7c3aed"
            iconBg="linear-gradient(135deg, #f5f3ff, #ede9fe)"
            number="4"
            title="Payment &amp; Financing"
            subtitle={null}
          />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
            Accepted Payment Methods
          </h3>
          <BulletList color="#7c3aed" items={[
            'All major credit cards: Visa, Mastercard, American Express, Discover.',
            'PayPal, Apple Pay, Google Pay, Shop Pay.',
          ]} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
            Financing
          </h3>
          <Callout icon={Info} color="#7c3aed" bg="#f5f3ff" border="#c4b5fd">
            Financing is available through our integrated lending partner on qualifying orders of{' '}
            <strong>$500 or more</strong>. Promotional <strong>0% APR</strong> financing options may be available
            for select periods. Apply at checkout in seconds.
          </Callout>
        </div>

        <Divider />

        {/* ── § 5 Contact & Support ───────────────────────────────────────── */}
        <div id="contact">
          <SectionHeader
            icon={Phone}
            iconColor="#0f172a"
            iconBg="linear-gradient(135deg, #f1f5f9, #e2e8f0)"
            number="5"
            title="Contact &amp; Customer Support"
            subtitle="Our team is available to assist you with any question related to your order, return, warranty, or shipment."
          />
          <PolicyTable
            headers={['Channel', 'Details']}
            columns="1fr 2fr"
            rows={CONTACT_ROWS.map(({ channel, detail }) => [
              <span key="c" style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{channel}</span>,
              <span key="d" style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.7)' }}>{detail}</span>,
            ])}
          />
        </div>

        <Divider />

        {/* ── Customer promise footer ─────────────────────────────────────── */}
        <div style={{
          background:   'linear-gradient(135deg, #0f172a, #1e3a8a)',
          borderRadius: '6px',
          padding:      'clamp(1.5rem, 4vw, 2.5rem) clamp(1.5rem, 4vw, 2.5rem)',
          color:        'white',
          textAlign:    'center',
        }}>
          <div style={{
            fontSize:      'clamp(1rem, 2.5vw, 1.4rem)',
            fontWeight:    800,
            marginBottom:  '10px',
            letterSpacing: '-0.02em',
          }}>
            From Our Family to Yours
          </div>
          <p style={{
            fontSize:   '0.875rem',
            color:      'rgba(255,255,255,0.7)',
            maxWidth:   '680px',
            margin:     '0 auto 24px',
            lineHeight: 1.7,
          }}>
            Drywall Toolbox was built by people who understand the trades. We know what it costs to be on a
            jobsite with the wrong tool or a supplier who won't stand behind what they sell. These policies
            aren't legal fine print — they are our commitment to every contractor, finisher, and professional
            we serve. If we fall short, call us. We'll make it right.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
            <Link
              to="/returns"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            '7px',
                background:     'white',
                color:          '#1e3a8a',
                borderRadius:   '4px',
                padding:        '10px 20px',
                fontSize:       '0.85rem',
                fontWeight:     700,
                textDecoration: 'none',
              }}
            >
              <RotateCcw size={14} /> Start a Return
            </Link>
            <Link
              to="/contact"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            '7px',
                background:     'rgba(255,255,255,0.12)',
                border:         '1px solid rgba(255,255,255,0.2)',
                color:          'white',
                borderRadius:   '4px',
                padding:        '10px 20px',
                fontSize:       '0.85rem',
                fontWeight:     700,
                textDecoration: 'none',
              }}
            >
              <Phone size={14} /> Contact Support <ArrowRight size={14} />
            </Link>
          </div>
          <p style={{
            fontSize:   '0.72rem',
            color:      'rgba(255,255,255,0.4)',
            marginTop:  '20px',
            marginBottom: 0,
          }}>
            Policies subject to change. The version published at drywalltoolbox.com/policies on the date of your order governs.
            Last revised: May 2026.
          </p>
        </div>

      </section>
    </div>
  );
}
