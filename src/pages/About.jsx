import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();

  const features = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      title: 'Quality First',
      description: 'We curate only tools that meet our rigorous standards — sourced from the most trusted manufacturers in the industry.'
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      title: 'Expert Team',
      description: 'Our staff are industry veterans who have worked with drywall tools firsthand — we speak your language.'
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      ),
      title: 'Fast Shipping',
      description: 'Most orders ship within 24 hours. Free shipping on qualifying orders — because your time is money.'
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: 'Warranty Coverage',
      description: 'Every product backed by full manufacturer warranty plus our own satisfaction guarantee — zero risk.'
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      ),
      title: 'Customer Focused',
      description: 'Real support from real people — available whenever you need us. No bots, no runaround.'
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
        </svg>
      ),
      title: 'Industry Leaders',
      description: 'We partner with the most innovative drywall brands — bringing you the latest tools before anyone else.'
    }
  ];

  const stats = [
    { number: '50+', label: 'Brand Partners', sub: 'industry-leading manufacturers' },
    { number: '2,000+', label: 'Products', sub: 'tools, parts & accessories' },
    { number: '24/7', label: 'Support', sub: 'always here when you need us' },
    { number: '100%', label: 'Pro-Grade', sub: 'no consumer-grade products' }
  ];

  const brands = ['TapeTech', 'Columbia', 'DeWalt', 'Hyde', 'Warner', 'Marshalltown', 'Goldblatt', 'Wal-Board'];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: '140px' }}>

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding: '80px 24px 100px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background texture */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '999px',
            padding: '6px 18px',
            marginBottom: '32px',
            fontSize: '0.75rem',
            fontWeight: '700',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
            Professional Drywall Tools Since 2026
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
            fontWeight: '800',
            lineHeight: '1.05',
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: '24px'
          }}>
            Built for the<br />
            <span style={{ color: '#60a5fa' }}>Pro on the Wall</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: '1.7',
            maxWidth: '560px',
            margin: '0 auto 40px'
          }}>
            Drywall Toolbox is the go-to destination for professional contractors who demand the best tools, the best parts, and the best service — every single order.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/products')}
              style={{
                background: '#ffffff',
                color: '#1d4ed8',
                border: 'none',
                borderRadius: '10px',
                padding: '14px 32px',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                letterSpacing: '0.02em'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              Shop Tools
            </button>
            <button
              onClick={() => navigate('/contact')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.3)',
                borderRadius: '10px',
                padding: '14px 32px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(15,23,42,0.06)'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0'
          }} className="about-stats-grid">
            {stats.map((stat, i) => (
              <div key={i} style={{
                padding: '40px 24px',
                textAlign: 'center',
                borderRight: i < stats.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none'
              }} className="about-stat-item">
                <div style={{
                  fontSize: 'clamp(2rem, 5vw, 3rem)',
                  fontWeight: '800',
                  color: 'var(--color-primary-600)',
                  letterSpacing: '-0.03em',
                  lineHeight: '1',
                  marginBottom: '8px'
                }}>
                  {stat.number}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)', lineHeight: '1.4' }}>
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '80px',
            alignItems: 'center'
          }} className="about-mission-grid">
            {/* Left: Text */}
            <div>
              <div style={{
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: '700',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-primary-600)',
                background: 'rgba(37,99,235,0.08)',
                borderRadius: '999px',
                padding: '5px 14px',
                marginBottom: '20px'
              }}>
                Our Mission
              </div>
              <h2 style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: '1.15',
                marginBottom: '24px'
              }}>
                Tools You Can<br />Trust On Every Job
              </h2>
              <p style={{
                fontSize: '1.05rem',
                color: 'rgba(15,23,42,0.65)',
                lineHeight: '1.8',
                marginBottom: '20px'
              }}>
                At Drywall Toolbox, we believe professional contractors deserve professional-grade equipment — not watered-down versions sold at retail stores. That&rsquo;s why we work directly with manufacturers to bring you the tools and parts used on the biggest commercial and residential projects nationwide.
              </p>
              <p style={{
                fontSize: '1.05rem',
                color: 'rgba(15,23,42,0.65)',
                lineHeight: '1.8'
              }}>
                We obsess over every detail — from the precision of a corner roller to the balance of a bazooka blade. Your tools are your livelihood. We take that seriously.
              </p>
            </div>

            {/* Right: Visual card */}
            <div style={{ position: 'relative' }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
                borderRadius: '20px',
                padding: '48px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: '-30px',
                  left: '-30px',
                  width: '160px',
                  height: '160px',
                  background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ position: 'relative' }}>
                  {[
                    { label: 'Schematic diagrams', value: 'Interactive parts viewer' },
                    { label: 'Product catalog', value: '2,000+ tools & parts' },
                    { label: 'Brand partners', value: '50+ top manufacturers' },
                    { label: 'Shipping', value: 'Same-day on most orders' }
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 0',
                      borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.12)' : 'none'
                    }}>
                      <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', fontWeight: '500' }}>{item.label}</span>
                      <span style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: '700' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '96px 24px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: '700',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-primary-600)',
              background: 'rgba(37,99,235,0.08)',
              borderRadius: '999px',
              padding: '5px 14px',
              marginBottom: '16px'
            }}>
              Why Choose Us
            </div>
            <h2 style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
              fontWeight: '800',
              color: '#0f172a',
              letterSpacing: '-0.02em',
              lineHeight: '1.15',
              marginBottom: '16px'
            }}>
              Everything a Pro Needs
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: 'rgba(15,23,42,0.55)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: '1.7'
            }}>
              We&rsquo;re not just a parts store — we&rsquo;re your long-term trade partner.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px'
          }} className="about-features-grid">
            {features.map((feature, i) => (
              <div key={i} style={{
                background: '#f8fafc',
                borderRadius: '16px',
                padding: '32px',
                border: '1px solid rgba(15,23,42,0.06)',
                transition: 'all 0.25s ease',
                cursor: 'default'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(37,99,235,0.2)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 16px 40px rgba(15,23,42,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = 'rgba(15,23,42,0.06)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: 'rgba(37,99,235,0.08)',
                  color: 'var(--color-primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: '1.05rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '10px',
                  letterSpacing: '-0.01em'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: '0.9rem',
                  color: 'rgba(15,23,42,0.6)',
                  lineHeight: '1.7'
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brands strip */}
      <section style={{
        padding: '64px 24px',
        background: '#f8fafc',
        borderTop: '1px solid rgba(15,23,42,0.06)',
        borderBottom: '1px solid rgba(15,23,42,0.06)'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: '700',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(15,23,42,0.4)',
            marginBottom: '32px'
          }}>
            Trusted Brands We Carry
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center'
          }}>
            {brands.map((brand, i) => (
              <span key={i} style={{
                padding: '8px 20px',
                borderRadius: '999px',
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.08)',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#0f172a',
                boxShadow: '0 1px 4px rgba(15,23,42,0.04)'
              }}>
                {brand}
              </span>
            ))}
            <span style={{
              padding: '8px 20px',
              borderRadius: '999px',
              background: 'rgba(37,99,235,0.06)',
              border: '1px solid rgba(37,99,235,0.15)',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: 'var(--color-primary-600)'
            }}>
              + 40 more
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '96px 24px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: '800',
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: '1.1',
            marginBottom: '20px'
          }}>
            Ready to Get to Work?
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: '1.7',
            marginBottom: '40px'
          }}>
            Browse our full catalog of professional drywall tools, parts, and accessories. Ships fast, backed by warranty.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/products')}
              style={{
                background: '#ffffff',
                color: '#1d4ed8',
                border: 'none',
                borderRadius: '10px',
                padding: '16px 36px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                letterSpacing: '0.01em'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              Shop Now
            </button>
            <button
              onClick={() => navigate('/parts')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.25)',
                borderRadius: '10px',
                padding: '16px 36px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            >
              View Schematics
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
