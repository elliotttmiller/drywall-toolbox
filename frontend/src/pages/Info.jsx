import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

/* ─────────────────────────────────────────────────────────────────────────────
   Maintenance schedule data — mirrored from Repairs page
   ───────────────────────────────────────────────────────────────────────── */
const MAINTENANCE_SCHEDULE = [
  { level: 'High-Volume Pro', usage: '6+ rolls (500 ft) / day', interval: 'Every 6 months', badge: 'Heavy' },
  { level: 'Standard Pro', usage: '4–10 rolls / week', interval: 'Annually', badge: 'Regular' },
  { level: 'Occasional User', usage: '<4 rolls / week', interval: 'Every 18–24 months', badge: 'Light' },
];

const WEAR_PARTS = [
  {
    tool: 'Auto Taper',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
    parts: [
      'Tape wheels ("teeth") — primary wear item; inspect before each season',
      'Blade — check edge condition after every 50–75 rolls',
      'Cable — replace at first sign of fraying or binding',
      'Plunger cup & seals — service annually or when flow drops',
      'Wear bushings & drive dog spring — inspect during any rebuild',
      'Needle — replace if scoring or streaking appears',
    ],
  },
  {
    tool: 'Flat & Angle Boxes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
    ),
    parts: [
      'Blades — resharpen or replace when finish quality drops',
      'Skids — worn skids cause drag and uneven coat thickness',
      'Wheels — inspect for flat spots and scoring',
      'Tension springs — replace if box no longer holds pressure',
      'O-rings & seals — leaking corners almost always mean worn O-rings',
    ],
  },
  {
    tool: 'Mud Pumps',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/>
      </svg>
    ),
    parts: [
      'Gaskets & u-cups — first parts to fail under high pressure; inspect monthly',
      'Screens & valve discs — clog with dried compound; clean after every use',
      'Hose — cracks from UV exposure and kinking; inspect end fittings regularly',
      'Bushings — worn bushings cause side-play and premature seal failure',
    ],
  },
  {
    tool: 'Handles & Accessories',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    parts: [
      'Brake adjusters — sticky or jerky handle action means worn brake pads',
      'Conical springs & friction washers — replace if handle drags or won\'t hold position',
      'Couplers — inspect threads and locking tabs; replace at first sign of slop',
      'Pivot bushings (gooseneck) — replace when corner tool loses rigidity',
    ],
  },
];

const SERVICE_TIPS = [
  {
    title: 'Clean After Every Use',
    desc: 'Flush compound completely from all fluid pathways. Dried mud is the #1 cause of premature part failure and expensive rebuilds.',
    icon: '🧹',
  },
  {
    title: 'Store Dry, Lubricated',
    desc: 'Wipe down metal surfaces, apply a light coat of oil to exposed pivot points and cable, and store in a temperature-stable environment.',
    icon: '🛢️',
  },
  {
    title: 'Never Force a Stuck Mechanism',
    desc: 'Forcing a binding blade, stuck cable, or seized wheel multiplies damage. Stop immediately and send it in for diagnosis.',
    icon: '✋',
  },
  {
    title: 'Track Tool Age & Usage',
    desc: 'Keep a simple log of rolls completed and service dates. High-volume tools should be inspected at 500-roll intervals regardless of visible symptoms.',
    icon: '📋',
  },
  {
    title: 'Inspect Before Each Job',
    desc: 'Spend 2 minutes checking blades, cable, and fluid flow before a job starts — not after a callback from the GC.',
    icon: '🔍',
  },
  {
    title: 'Use Manufacturer-Approved Compound',
    desc: 'Heavier, coarser compounds accelerate blade and wheel wear. Confirm compound viscosity is within the tool manufacturer\'s specification.',
    icon: '⚗️',
  },
];

const REPAIR_FAQ = [
  {
    q: 'When should I repair vs. replace my taper?',
    a: 'A standard rebuild costs $299 — roughly 84% less than a new $1,899 taper. Unless the tool body is cracked or serial-numbered parts are obsolete, repair is almost always the right call.',
  },
  {
    q: 'How long does a typical repair take?',
    a: 'Most repairs are completed within 5–7 business days of receiving your tool. Expedited priority (2–3 days) and emergency same/next-day service are also available.',
  },
  {
    q: 'Do you service all major brands?',
    a: 'Yes. We service TapeTech, Columbia, Asgard, Graco, Level5, USG, and most other professional drywall finishing tool brands. Use the Repairs form to check availability for your specific model.',
  },
  {
    q: 'What warranty covers my repair?',
    a: 'Standard: 15-day workmanship warranty. Professional ProCare members: 30-day warranty. Fleet ProCare members: 60-day warranty. Warranty covers workmanship and installed parts only.',
  },
  {
    q: 'Will I see a parts itemization before I approve?',
    a: 'Always. We send a written quote with labor, parts, and total before any work begins. Hard parts (chains, sprockets, shafts) are capped at 20% above the original quote.',
  },
  {
    q: 'Can I get a quote from a photo before sending my tool?',
    a: 'Yes — attach up to 6 photos in the repair request form and our technicians will review them and include a photo-based estimate within 24 hours.',
  },
  {
    q: 'What happens if my tool can\'t be repaired?',
    a: 'If we determine the tool is beyond economical repair, we will return it to you at no charge (other than shipping) and waive the diagnostic bench fee.',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Info / Knowledge Base page
   ───────────────────────────────────────────────────────────────────────── */
export default function Info() {
  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="Tool Care & Repair Info"
        description="Complete drywall tool maintenance guide: service intervals, critical wear parts, care tips, repair FAQs, and everything you need to keep your auto tapers, flat boxes, mud pumps, and accessories running strong."
        canonical="https://drywalltoolbox.com/info"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding: 'clamp(60px, 10vw, 100px) clamp(1.5rem, 5vw, 3rem)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '40px 40px', pointerEvents: 'none',
        }} />
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
                Tool Care Knowledge Base
              </div>
              <h1 style={{
                color: 'white',
                fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
                fontWeight: 900, margin: '0 0 16px 0',
                lineHeight: 1.08, letterSpacing: '-0.035em',
              }}>
                MAINTENANCE &<br />
                <span style={{ color: '#93c5fd' }}>REPAIR GUIDE.</span>
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
                margin: '0 0 32px 0',
                lineHeight: 1.6,
                maxWidth: '480px',
              }}>
                Industry-recommended service intervals, critical wear-part checklists, pro care tips,
                and repair FAQs — everything you need to keep your tools running strong.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link
                  to="/repairs"
                  className="alloy-button"
                  style={{ background: 'white', color: '#1e3a8a', textDecoration: 'none', fontWeight: 800, flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Request a Repair
                </Link>
                <Link
                  to="/shipping"
                  className="alloy-button"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 700, flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Shipping Info
                </Link>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}>
              {[
                { value: '3 tiers', label: 'Usage-based schedules', sub: 'Heavy · Regular · Light' },
                { value: '4 types', label: 'Tool categories covered', sub: 'Taper · Box · Pump · Handle' },
                { value: '6+', label: 'Pro care tips', sub: 'Proven maintenance practices' },
                { value: '7 FAQs', label: 'Repair questions answered', sub: 'No runaround, real info' },
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
                    fontWeight: 900, color: '#93c5fd',
                    letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '6px',
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

      {/* ── Maintenance Schedule ─────────────────────────────────────────── */}
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
              Service Intervals
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Maintenance Schedule
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
              Industry-recommended service intervals based on your usage level
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--machined-border)', boxShadow: '0 4px 24px rgba(15,23,42,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.925rem', minWidth: '480px' }}>
              <thead>
                <tr style={{ background: 'var(--alloy-deep)' }}>
                  {['Usage Level & Priority', 'Typical Usage', 'Service Interval'].map((heading) => (
                    <th key={heading} style={{
                      padding: '16px 24px',
                      textAlign: 'left',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.92)',
                      whiteSpace: 'nowrap',
                    }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MAINTENANCE_SCHEDULE.map((row, idx) => {
                  const badgeColors = {
                    Heavy:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
                    Regular: { bg: 'var(--primary-100)', border: 'rgba(37,99,235,0.3)', text: 'var(--primary-700)' },
                    Light:   { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
                  };
                  const colors = badgeColors[row.badge] || badgeColors.Regular;
                  return (
                    <tr key={row.level} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--machined-border)', background: idx % 2 === 0 ? 'white' : 'var(--alloy-base)' }}>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '99px',
                            padding: '3px 10px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: colors.text,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {row.badge}
                          </span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.level}</span>
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px', color: 'rgba(15,23,42,0.6)', lineHeight: 1.5 }}>{row.usage}</td>
                      <td style={{ padding: '20px 24px', fontWeight: 700, color: 'var(--color-primary-600, #2563eb)' }}>{row.interval}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Note */}
          <p style={{ fontSize: '0.78rem', color: 'rgba(15,23,42,0.45)', marginTop: '14px', lineHeight: 1.6 }}>
            * Intervals are industry estimates for professional-grade automatic finishing tools. Actual intervals depend on compound type, job-site environment,
            and individual tool condition. When in doubt, schedule a diagnostic inspection.
          </p>
        </div>
      </section>

      {/* ── Critical Wear Parts ──────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'var(--alloy-base)',
        borderTop: '1px solid var(--machined-border)',
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
              Wear-Part Checklist
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Critical Parts to Monitor
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0, maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
              These are the components most likely to cause performance issues — inspect them at every service interval
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 40vw, 420px), 1fr))',
            gap: '20px',
          }}>
            {WEAR_PARTS.map((category) => (
              <div key={category.tool} style={{
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '12px',
                padding: 'clamp(18px, 3vw, 26px)',
                boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
              }}>
                {/* Tool header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--machined-border)' }}>
                  <div style={{
                    width: '44px', height: '44px',
                    background: 'rgba(37,99,235,0.07)',
                    border: '1px solid rgba(37,99,235,0.15)',
                    borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {category.icon}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {category.tool}
                  </h3>
                </div>

                {/* Parts list */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {category.parts.map((part) => (
                    <li key={part} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '0.825rem',
                      color: 'rgba(15,23,42,0.7)',
                      lineHeight: 1.5,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '3px' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {part}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
            <Link
              to="/parts"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '11px 22px',
                background: 'var(--color-primary-600, #2563eb)',
                color: 'white',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Browse Replacement Parts & Schematics
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pro Care Tips ────────────────────────────────────────────────── */}
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
              Pro Tips
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Daily Care Best Practices
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0 }}>
              Habits that extend tool life and reduce repair frequency
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(260px, 30vw, 320px), 1fr))',
            gap: '16px',
          }}>
            {SERVICE_TIPS.map((tip) => (
              <div key={tip.title} style={{
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '12px',
                padding: 'clamp(18px, 3vw, 24px)',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(15,23,42,0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: '12px', lineHeight: 1 }}>{tip.icon}</div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                  {tip.title}
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', margin: 0, lineHeight: 1.55 }}>
                  {tip.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Repair FAQ ───────────────────────────────────────────────────── */}
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
              Common Questions
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Repair FAQ
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0 }}>
              Straight answers to the questions we hear every day
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {REPAIR_FAQ.map((item) => (
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

      {/* ── Quick Links ──────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'white',
        borderTop: '1px solid var(--machined-border)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(1.5rem, 3vw, 2rem)' }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 8px 0', letterSpacing: '-0.02em',
            }}>
              Related Resources
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'rgba(15,23,42,0.5)', margin: 0 }}>
              Everything you need to keep your tools in top shape
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: '16px',
          }}>
            {[
              {
                to: '/repairs',
                title: 'Request a Repair',
                description: 'Submit a 5-step repair inquiry. Transparent pricing, no charges until you approve.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                ),
              },
              {
                to: '/shipping',
                title: 'Shipping Information',
                description: 'Free inbound prepaid label. See all return shipping options and packaging tips.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
              },
              {
                to: '/parts',
                title: 'Parts & Schematics',
                description: 'Browse interactive part diagrams and order replacement parts for all major brands.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h1M3 12H2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 20v1M12 3V2"/>
                  </svg>
                ),
              },
              {
                to: '/contact',
                title: 'Talk to an Expert',
                description: 'Our industry veterans are ready to help — no bots, no runaround, just real support.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600, #2563eb)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 5.56 5.56l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/>
                  </svg>
                ),
              },
            ].map((ql) => (
              <Link key={ql.to} to={ql.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid var(--machined-border)',
                  borderRadius: '12px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.22s, border-color 0.22s, transform 0.22s',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--machined-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                >
                  <div style={{
                    width: '44px', height: '44px',
                    background: 'rgba(37,99,235,0.07)',
                    border: '1px solid rgba(37,99,235,0.15)',
                    borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '14px', flexShrink: 0,
                  }}>
                    {ql.icon}
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>{ql.title}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 16px 0', lineHeight: 1.5, flex: 1 }}>{ql.description}</p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    color: 'var(--color-primary-600, #2563eb)', fontSize: '0.75rem',
                    fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Learn more
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
