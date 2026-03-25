import { Link } from 'react-router-dom';

const services = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
    title: 'Preventative Maintenance',
    description: 'Keep your tools in peak condition with scheduled inspections, lubrication, seal replacements, and performance tuning.',
    items: ['Seasonal equipment inspections', 'Lubrication and fluid replacement', 'Seal and gasket replacements', 'Calibration and adjustment']
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Emergency Repairs',
    description: 'When your tools stop working on the job, our technicians diagnose and resolve issues fast — same-day diagnostics available.',
    items: ['Same-day diagnostics', 'Expedited repair turnaround', '24/7 emergency support', 'Field service available']
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Warranty & Extended Coverage',
    description: 'Protect your investment with manufacturer warranties and extended coverage plans for professional equipment.',
    items: ['Extended manufacturer warranties', 'Accidental damage coverage', 'Parts and labor protection', 'Annual inspection plans']
  }
];

const quickLinks = [
  {
    to: '/parts',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
    title: 'Parts & Schematics',
    description: 'Browse interactive part diagrams and order replacement parts for all major brands.'
  },
  {
    to: '/products',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
    title: 'Shop Replacement Tools',
    description: 'Upgrade your toolkit — browse our full catalog of professional drywall tools and accessories.'
  },
  {
    to: '/contact',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6A16 16 0 0 0 16 16.68l.96-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    title: 'Talk to an Expert',
    description: 'Our industry veterans are ready to help — no bots, no runaround, just real support.'
  }
];

export default function Repairs() {
  return (
    <div style={{ minHeight: '100vh' }} className="section-enter">

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding: 'clamp(60px, 10vw, 100px) clamp(1.5rem, 5vw, 3rem)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '3px',
            padding: '4px 12px',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '20px'
          }}>
            Tool Repair & Maintenance
          </div>
          <h1 style={{
            color: 'white',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 800,
            margin: '0 0 16px 0',
            lineHeight: 1.1,
            letterSpacing: '-0.03em'
          }}>
            KEEP YOUR TOOLS<br />
            <span style={{ color: '#93c5fd' }}>RUNNING STRONG.</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
            maxWidth: '600px',
            lineHeight: 1.6,
            margin: '0 0 32px 0'
          }}>
            Professional repair and maintenance services for all your drywall tools. From emergency fixes to scheduled maintenance — we keep your crew working.
          </p>
          <Link to="/contact" className="alloy-button" style={{ textDecoration: 'none', background: 'white', color: '#1e3a8a' }}>
            Request Repair Service
          </Link>
        </div>
      </section>

      {/* Services */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
          <h2 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800,
            color: 'var(--primary-600)',
            margin: '0 0 12px 0',
            letterSpacing: '-0.02em'
          }}>
            Our Repair Services
          </h2>
          <p style={{ color: 'rgba(15,23,42,0.6)', fontSize: '1rem', margin: 0 }}>
            Comprehensive coverage for all professional drywall equipment
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {services.map((service) => (
            <div
              key={service.title}
              style={{
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding: 'clamp(1.5rem, 3vw, 2rem)',
                transition: 'box-shadow 0.2s, transform 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
                marginBottom: '20px'
              }}>
                {service.icon}
              </div>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'black',
                margin: '0 0 10px 0'
              }}>
                {service.title}
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'rgba(15,23,42,0.6)',
                margin: '0 0 16px 0',
                lineHeight: 1.6
              }}>
                {service.description}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {service.items.map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', color: 'rgba(15,23,42,0.7)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Links */}
      <section style={{
        background: 'var(--alloy-base)',
        borderTop: '1px solid var(--machined-border)',
        padding: 'clamp(3rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 800,
            color: 'var(--primary-600)',
            margin: '0 0 clamp(1.5rem, 3vw, 2rem) 0',
            letterSpacing: '-0.02em'
          }}>
            Related Resources
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px'
          }}>
            {quickLinks.map((ql) => (
              <Link
                key={ql.to}
                to={ql.to}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    background: 'white',
                    border: '1px solid var(--machined-border)',
                    borderRadius: '4px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s, border-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--machined-border)';
                  }}
                >
                  <div style={{ color: 'var(--primary-600)', marginBottom: '12px' }}>{ql.icon}</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'black', margin: '0 0 8px 0' }}>{ql.title}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', margin: 0, lineHeight: 1.5 }}>{ql.description}</p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--primary-600)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: '16px'
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
