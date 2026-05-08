import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import SEOHead from '../components/SEOHead';
import NavbarTabs from '../components/ui/NavbarTabs';

/* ─────────────────────────────────────────────────────────────────────────────
   FAQ data — grouped by category
   ───────────────────────────────────────────────────────────────────────── */
const FAQ_CATEGORIES = [
  {
    id: 'shipping-orders',
    label: 'Shipping & Orders',
    questions: [
      {
        q: 'Where do you ship?',
        a: 'We ship to all 50 US states and Canada. International orders outside North America are handled on a case-by-case basis — contact us before placing an international order to confirm eligibility and get a shipping quote.',
      },
      {
        q: 'How long does order processing take?',
        a: 'In-stock tools and parts are typically picked, packed, and handed to the carrier within 1 business day of order placement. Orders placed before 12:00 PM CT on business days are prioritized for same-day processing.',
      },
      {
        q: 'What shipping carriers and service levels do you offer?',
        a: 'We ship via UPS, FedEx, and USPS. Available service levels at checkout include Standard Ground (3–7 business days), Expedited 2-Day, Overnight, and Saturday Delivery (select ZIP codes). Carrier and cost are calculated at checkout based on package weight, dimensions, and destination.',
      },
      {
        q: 'Do you offer free shipping?',
        a: 'Yes — orders over $75 qualify for free Standard Ground shipping to the contiguous 48 states. Alaska, Hawaii, and Canada are excluded from the free shipping threshold and calculated at actual carrier rate.',
      },
      {
        q: 'How do I track my shipment?',
        a: 'A tracking number is emailed automatically the moment your order ships. You can also find live tracking and full order history in your Account Dashboard under Order History.',
      },
      {
        q: 'Can I modify or cancel my order after it\'s placed?',
        a: 'Order modifications and cancellations can be made within 2 hours of placement, provided the order has not yet been picked. Contact us immediately via the order confirmation page or by phone. Once a shipping label is generated, cancellation is no longer possible and a return must be initiated after delivery.',
      },
      {
        q: 'What if an item in my order is backordered?',
        a: 'If a product is out of stock at the time of your order, we will notify you by email with an estimated restock date and give you the option to hold the order, substitute an equivalent item, or receive a full refund for that line item. Backordered parts never delay in-stock items in the same order — they ship separately at no additional shipping charge.',
      },
      {
        q: 'Do you offer local pickup?',
        a: 'Yes — local pickup is available by appointment at our facility. Select "Local Pickup" at checkout and we\'ll send a ready-for-pickup notification. Bring your order confirmation and a valid ID.',
      },
      {
        q: 'How are large or heavy tools packaged for shipping?',
        a: 'Larger tools and complete sets are double-boxed with industrial foam inserts and corner protection. All outbound shipments are photographed before sealing and are fully insured at declared value. If an item requires a freight carrier (LTL), we will contact you to coordinate before shipping.',
      },
    ],
  },
  {
    id: 'warranty-returns',
    label: 'Warranty & Returns',
    questions: [
      {
        q: 'What is your standard return policy for tools and parts?',
        a: 'New, unused products in original, unaltered packaging may be returned within 45 days of delivery for a full refund to the original payment method — with no restocking fee, ever. Items must be in resalable condition — free of installation marks, compound residue, or field use. Return shipping is the customer\'s responsibility unless the item is defective or we made a fulfillment error.',
      },
      {
        q: 'Which items are non-returnable?',
        a: 'The following are non-returnable: electrical components (motors, circuit boards, solenoids), special-order or custom-configured parts, items marked "Final Sale," and any product that has been installed, modified, or used in the field. If you\'re unsure whether an item qualifies, contact us before returning.',
      },
      {
        q: 'How do I initiate a return?',
        a: 'Log in to your Account Dashboard and select the order you\'d like to return, then choose "Request Return." You\'ll receive a Return Merchandise Authorization (RMA) number and instructions within 1 business day. Returns sent without an RMA number may be refused or delayed. Refunds are processed within 3–5 business days of receiving the returned item.',
      },
      {
        q: 'What if my order arrives damaged or incorrect?',
        a: 'All outbound shipments are insured and photographed before sealing. If your order arrives damaged or contains the wrong item, photograph the outer packaging and contents immediately and contact us within 72 hours of delivery. We will file the carrier claim on your behalf and dispatch a replacement at no additional charge — you will not be asked to return a damaged item.',
      },
      {
        q: 'Do new tools carry a manufacturer warranty?',
        a: 'Yes. All new tools sold by Drywall Toolbox are covered by the full manufacturer warranty. Common terms: Columbia Taping Tools — 5 years; TapeTech — per manufacturer terms; Platinum Drywall Tools — 5 years; DeWalt — 3 years; FLEX — 3 years; Festool — 3 years (registered). Warranty claims are processed through us — you do not need to contact the manufacturer separately.',
      },
      {
        q: 'What does the manufacturer warranty cover?',
        a: 'Manufacturer warranties cover defects in materials and workmanship under normal use. They do not cover damage from misuse, improper maintenance, field modifications, accidental damage, or normal wear items such as blades, gates, cables, and rubber components. If a claim is denied under warranty, we will provide a transparent written explanation.',
      },
      {
        q: 'How do I file a warranty claim on a tool I purchased?',
        a: 'Contact us with your order number, a description of the defect, and photos or video of the issue. We will evaluate the claim and either facilitate a manufacturer repair, issue a replacement part, or arrange a full unit exchange depending on the nature and severity of the defect. Most warranty claims are resolved within 5–7 business days.',
      },
      {
        q: 'Do replacement parts carry a warranty?',
        a: 'OEM replacement parts carry a 90-day defect warranty from the date of delivery. If a part fails due to a manufacturing defect within 90 days, we will send a replacement at no charge. This does not apply to wear items (blades, seals, o-rings, springs) which are consumables by design.',
      },
      {
        q: 'What is your price match policy?',
        a: 'We match verified current prices from authorized US dealers on identical, in-stock items. Price match requests must be submitted before purchase and include a direct link or screenshot to the competitor listing. We do not match marketplace sellers (Amazon third-party, eBay), liquidation prices, or prices contingent on bundle deals.',
      },
    ],
  },
  {
    id: 'repair-services',
    label: 'Repair Services',
    questions: [
      {
        q: 'How do I submit a repair request?',
        a: 'Go to the Repair Services page and complete the multi-step request form. You\'ll describe your tool and the issue, and can upload photos. Our team responds within one business day with an itemized quote and estimated turnaround.',
      },
      {
        q: 'Is there a diagnostic or bench fee?',
        a: 'Yes — a $50–$75 diagnostic fee covers full inspection and a written itemized quote. That fee is credited in full toward your repair cost if you approve the work. You are never charged for parts or labor until you give the go-ahead.',
      },
      {
        q: 'What happens if I decline the repair after the quote?',
        a: 'You only pay the diagnostic bench fee. Your tool is returned to you at your expense via your preferred shipping method. No additional charges apply.',
      },
      {
        q: 'How long does a typical repair take?',
        a: 'Most standard rebuilds complete within 5–7 business days after quote approval. Premium overhauls and heavy-damage repairs can take 10–14 business days depending on parts availability. Rush service is available — contact us before submitting.',
      },
      {
        q: 'How is repair pricing determined?',
        a: 'Pricing is based on tool category, service tier, and parts required. All labor and parts are itemized on your written quote — no bundled or hidden fees. Visit the Repair Services page to explore tier pricing by tool type.',
      },
      {
        q: 'Are parts prices locked after the quote?',
        a: 'Hard parts are capped at 20% above the quoted amount. If a cost changes significantly we notify you before proceeding. You retain full approval authority at every stage.',
      },
      {
        q: 'What brands do you repair?',
        a: 'We service TapeTech, Columbia, Asgard, Graco, Level 5, Platinum, SurPro, and Dura-Stilts tools. If your brand isn\'t listed, contact us — we evaluate requests on a case-by-case basis.',
      },
      {
        q: 'What warranty comes with a repair?',
        a: 'Premium Overhaul tier carries a 90-day workmanship warranty. Quick Fix and Standard Rebuild tiers carry 30 days. The warranty covers the same issue recurring — it does not cover new damage, misuse, or normal wear.',
      },
      {
        q: 'Do Pro Members get a discount on repairs?',
        a: 'Yes. Standard Pro members receive 10% off repair labor; Premium Pro members receive 15% off plus priority queue placement. Discounts apply automatically when you\'re logged in at submission.',
      },
    ],
  },
  {
    id: 'tool-care',
    label: 'Tool Care & Maintenance',
    questions: [
      {
        q: 'How often should I service my automatic taper?',
        a: 'High-volume pros running 6+ rolls per day: every 6 months. Standard pros (4–10 rolls/week): annually. Occasional users (under 4 rolls/week): every 18–24 months.',
      },
      {
        q: 'What does a standard service include?',
        a: 'A standard service covers disassembly, full cleaning, inspection of all wear points, lubrication of cables and moving parts, blade and gate replacement if worn, tension and calibration adjustment, and a functional test before return.',
      },
      {
        q: 'Can I do basic maintenance myself?',
        a: 'Yes. Daily cleaning of the taping head, cable lubrication, and gate wipe-down can be done in the field. We recommend professional service for anything involving disassembly of the drive mechanism, gooseneck, or pressure settings — improper adjustment causes compounding wear.',
      },
      {
        q: 'What are the most common failure points on auto tapers?',
        a: 'Cable wear and kinking, cracked or worn blades, drive wheel slippage, and gooseneck pivot wear are the most common issues we see. Catching these early — before they cause secondary damage — is the biggest factor in keeping rebuild costs low.',
      },
      {
        q: 'How should I store my tools off-season?',
        a: 'Drain all mud, flush with warm water, dry thoroughly, and apply a light coat of tool oil to all moving metal parts. Store in a dry, temperature-stable environment. Never store with mud sitting in the taping head or pump body.',
      },
      {
        q: 'What lubricant should I use on flat boxes and handles?',
        a: 'Use a non-silicone, water-soluble tool lubricant on blade hinges and spring pivots. Avoid WD-40 on internal drive components — it displaces moisture short-term but leaves a residue that attracts dried compound. Ask us for brand-specific recommendations when you book a service.',
      },
    ],
  },
  {
    id: 'account-membership',
    label: 'Account & Membership',
    questions: [
      {
        q: 'Do I need an account to place an order?',
        a: 'No — guest checkout is available. However, creating an account gives you order history, tracking, saved addresses, Pro Membership discounts, and access to the repair request form.',
      },
      {
        q: 'What is Pro Membership?',
        a: 'Pro Membership is our trade program for working drywall contractors and finishers. Members receive discounts on all tools, parts, and repair labor, plus early access to new inventory and priority repair queue placement.',
      },
      {
        q: 'How do I sign up for Pro Membership?',
        a: 'Visit the Pro Membership page, select your tier, and complete the short verification form. Standard membership is open to all trade professionals. Premium tier requires proof of active business.',
      },
      {
        q: 'How do I view my past orders?',
        a: 'Log in and go to your Account Dashboard. All orders, invoices, and repair requests are listed there with full detail and live tracking where applicable.',
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Single accordion item
   ───────────────────────────────────────────────────────────────────────── */
function AccordionItem({ question, answer, isOpen, onToggle, isMobile }) {
  return (
    <div style={{
      borderBottom: '1px solid var(--machined-border)',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 'clamp(0.9rem, 2vw, 1rem)',
          fontWeight: 700,
          color: isOpen ? 'var(--primary-600)' : '#0f172a',
          lineHeight: 1.4,
          transition: 'color 0.18s',
        }}>
          {question}
        </span>
        <span style={{
          flexShrink: 0,
          width: '28px', height: '28px',
          borderRadius: '50%',
          background: isOpen ? 'var(--primary-600)' : 'rgba(15,23,42,0.06)',
          border: isOpen ? 'none' : '1px solid var(--machined-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.18s, border 0.18s',
        }}>
          <svg
            width="12" height="12"
            viewBox="0 0 24 24" fill="none"
            stroke={isOpen ? 'white' : '#64748b'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <Motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{
              margin: '0 0 20px 0',
              fontSize: 'clamp(0.875rem, 2vw, 0.95rem)',
              color: 'rgba(15,23,42,0.65)',
              lineHeight: 1.7,
              paddingRight: isMobile ? '0' : '44px',
            }}>
              {answer}
            </p>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main FAQ page
   ───────────────────────────────────────────────────────────────────────── */
export default function FAQ() {
  const [openItems, setOpenItems] = useState({});
  const [activeCategory, setActiveCategory] = useState('shipping-orders');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = (catId, qIdx) => {
    const key = `${catId}-${qIdx}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeData = FAQ_CATEGORIES.find((c) => c.id === activeCategory);



  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="FAQ — Drywall Tool Repair & Maintenance"
        description="Answers to the most common questions about drywall tool repair services, pricing, warranties, maintenance schedules, parts, and shipping."
        canonical="https://drywalltoolbox.com/faq"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)',
        padding: 'clamp(3.5rem, 8vw, 6rem) clamp(1.5rem, 5vw, 3rem) clamp(3rem, 6vw, 5rem)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '99px', padding: '5px 16px',
            fontSize: '0.68rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)', marginBottom: '18px',
          }}>
            Help Center
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            fontWeight: 900,
            color: 'white',
            margin: '0 0 16px 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>
            Frequently Asked<br />
            <span style={{ color: '#93c5fd' }}>Questions</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
            margin: '0 auto',
            lineHeight: 1.6,
            maxWidth: '520px',
          }}>
            Everything you need to know about our repair services, pricing, warranties,
            tool maintenance, and parts ordering.
          </p>
        </div>
      </section>

      {/* ── Category Nav + Accordion ─────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(2rem, 5vw, 5rem) clamp(1rem, 4vw, 3rem)',
        background: 'white',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {isMobile ? (
            /* ── Mobile: NavbarTabs + stacked accordion ── */
            <>
              <NavbarTabs
                tabs={FAQ_CATEGORIES.map((cat) => ({ id: cat.id, label: cat.label }))}
                activeIndex={FAQ_CATEGORIES.findIndex((c) => c.id === activeCategory)}
                onChange={(idx) => setActiveCategory(FAQ_CATEGORIES[idx].id)}
                style={{ marginBottom: '24px' }}
              />

              {/* Active category heading */}
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{
                  fontSize: 'clamp(1.15rem, 4vw, 1.4rem)',
                  fontWeight: 900, color: '#0f172a',
                  margin: '0 0 2px 0', letterSpacing: '-0.02em',
                }}>
                  {activeData?.label}
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.45)', margin: 0 }}>
                  {activeData?.questions.length} questions
                </p>
              </div>

              {/* Accordion */}
              <AnimatePresence mode="wait">
                <Motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                  <div style={{ borderTop: '1px solid var(--machined-border)' }}>
                    {activeData?.questions.map((item, idx) => (
                      <AccordionItem
                        key={idx}
                        question={item.q}
                        answer={item.a}
                        isOpen={!!openItems[`${activeCategory}-${idx}`]}
                        onToggle={() => toggle(activeCategory, idx)}
                        isMobile
                      />
                    ))}
                  </div>
                </Motion.div>
              </AnimatePresence>
            </>
          ) : (
            /* ── Desktop: sticky sidebar + questions panel ── */
            <div style={{ display: 'flex', gap: 'clamp(2rem, 5vw, 4rem)', alignItems: 'flex-start' }}>
              <nav style={{
                flexShrink: 0,
                width: '210px',
                position: 'sticky',
                top: '100px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }} aria-label="FAQ categories">
                <p style={{
                  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'rgba(15,23,42,0.4)',
                  margin: '0 0 10px 0',
                }}>
                  Categories
                </p>
                {FAQ_CATEGORIES.map((cat) => {
                  const active = cat.id === activeCategory;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        background: active ? 'rgba(37,99,235,0.08)' : 'none',
                        border: 'none',
                        borderLeft: active ? '3px solid var(--primary-600)' : '3px solid transparent',
                        borderRadius: '0 6px 6px 0',
                        padding: '9px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: active ? 700 : 500,
                        color: active ? 'var(--primary-700)' : 'rgba(15,23,42,0.6)',
                        transition: 'all 0.15s',
                        lineHeight: 1.4,
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </nav>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: '28px' }}>
                  <h2 style={{
                    fontSize: 'clamp(1.25rem, 3vw, 1.6rem)',
                    fontWeight: 900, color: '#0f172a',
                    margin: '0 0 4px 0', letterSpacing: '-0.02em',
                  }}>
                    {activeData?.label}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)', margin: 0 }}>
                    {activeData?.questions.length} questions
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  <Motion.div
                    key={activeCategory}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div style={{ borderTop: '1px solid var(--machined-border)' }}>
                      {activeData?.questions.map((item, idx) => (
                        <AccordionItem
                          key={idx}
                          question={item.q}
                          answer={item.a}
                          isOpen={!!openItems[`${activeCategory}-${idx}`]}
                          onToggle={() => toggle(activeCategory, idx)}
                        />
                      ))}
                    </div>
                  </Motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Still have questions CTA ─────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'white',
        borderTop: '1px solid var(--machined-border)',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 900, color: '#0f172a',
            margin: '0 0 12px 0', letterSpacing: '-0.02em',
          }}>
            Still have questions?
          </h2>
          <p style={{
            color: 'rgba(15,23,42,0.55)',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
            margin: '0 0 32px 0', lineHeight: 1.6,
          }}>
            Our team is happy to help. Reach out directly or submit a repair request and we'll be in touch within one business day.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/contact"
              style={{
                display: 'inline-block',
                background: 'var(--primary-600)',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.875rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '12px 28px',
                borderRadius: '6px',
                textDecoration: 'none',
              }}
            >
              Contact Us
            </Link>
            <Link
              to="/repairs"
              style={{
                display: 'inline-block',
                background: 'white',
                color: 'var(--primary-700)',
                fontWeight: 800,
                fontSize: '0.875rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '12px 28px',
                borderRadius: '6px',
                border: '1.5px solid rgba(37,99,235,0.3)',
                textDecoration: 'none',
              }}
            >
              Repair Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
