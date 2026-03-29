import { useState } from 'react';

const contactInfo = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    label: 'Email',
    value: 'support@drywalltoolbox.com',
    href: 'mailto:support@drywalltoolbox.com'
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    label: 'Hours',
    value: 'Mon – Fri: 8am – 6pm EST',
    href: null
  }
];

const inquiryTypes = [
  'Technical Support',
  'Bulk Order Inquiry',
  'Returns & Warranty',
  'Parts Availability',
  'Custom Fabrication',
  'General Question'
];

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    inquiryType: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Message Sent. Our engineers will contact you.');
    setFormData({ name: '', inquiryType: '', message: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ minHeight: '100vh' }} className="section-enter page-wrapper">

      {/* Hero strip */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding: 'clamp(48px, 8vw, 80px) clamp(1.5rem, 5vw, 3rem) clamp(3rem, 6vw, 4rem)',
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
            marginBottom: '16px'
          }}>
            Get In Touch
          </div>
          <h1 style={{
            color: 'white',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.03em'
          }}>
            WE&apos;RE HERE TO HELP.
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 'clamp(0.9rem, 2vw, 1rem)',
            margin: '12px 0 0',
            maxWidth: '500px',
            lineHeight: 1.6
          }}>
            Technical support, bulk orders, or custom tool fabrication inquiries — our team of industry veterans has you covered.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section style={{
        padding: 'clamp(2.5rem, 5vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'clamp(2rem, 5vw, 4rem)',
          alignItems: 'start'
        }}>

          {/* Left: contact info */}
          <div>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 800,
              color: 'var(--primary-600)',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em'
            }}>
              Contact Information
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
              Reach out directly or use the form and we&apos;ll get back to you within one business day.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
              {contactInfo.map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-600)',
                    flexShrink: 0
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(15,23,42,0.4)', marginBottom: '3px' }}>
                      {item.label}
                    </div>
                    {item.href ? (
                      <a
                        href={item.href}
                        style={{ fontSize: '0.9rem', color: 'black', textDecoration: 'none', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'black')}
                      >
                        {item.value}
                      </a>
                    ) : (
                      <div style={{ fontSize: '0.9rem', color: 'black' }}>{item.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Response time badge */}
            <div style={{
              background: 'white',
              border: '1px solid var(--machined-border)',
              borderRadius: '4px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'black', marginBottom: '2px' }}>Fast Response</div>
                <div style={{ fontSize: '0.775rem', color: 'rgba(15,23,42,0.5)' }}>We reply within 1 business day</div>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div style={{
            background: 'white',
            border: '1px solid var(--machined-border)',
            borderRadius: '4px',
            padding: 'clamp(1.5rem, 3vw, 2.5rem)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'black', margin: '0 0 24px 0' }}>
              Send a Message
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="machined-label text-blue-600">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="machined-input text-black"
                  required
                />
              </div>

              <div className="form-group">
                <label className="machined-label text-blue-600">Inquiry Type</label>
                <select
                  name="inquiryType"
                  value={formData.inquiryType}
                  onChange={handleChange}
                  className="machined-input text-black"
                  required
                  style={{ cursor: 'pointer' }}
                >
                  <option value="" disabled>Select an inquiry type</option>
                  {inquiryTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="machined-label text-blue-600">Message</label>
                <textarea
                  rows="5"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  className="machined-textarea text-black"
                  required
                />
              </div>

              <button
                type="submit"
                className="alloy-button w-full justify-center"
              >
                Submit Inquiry
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
