/**
 * ui/FeatureSection.jsx — IndoUI-style animated feature card section
 *
 * Props:
 *   features  [{ icon, title, description }]
 *   title     string (optional section heading)
 *   subtitle  string (optional)
 *   className string
 *   style     object
 */

import { motion as Motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.44, ease: [0.16, 1, 0.3, 1] } },
};

export default function FeatureSection({ features = [], title, subtitle, className = '', style = {} }) {
  return (
    <section
      className={`dtb-ui-features${className ? ` ${className}` : ''}`}
      style={{
        padding: 'clamp(2.5rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        background: 'white',
        ...style,
      }}
    >
      {(title || subtitle) && (
        <Motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.44 }}
          style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto clamp(2rem, 4vw, 3.5rem)' }}
        >
          {title && (
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
              fontWeight: 900,
              color: '#0f172a',
              margin: '0 0 12px',
              letterSpacing: '-0.03em',
            }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p style={{
              fontSize: 'clamp(0.9rem, 2vw, 1rem)',
              color: 'rgba(15,23,42,0.55)',
              margin: 0,
              lineHeight: 1.7,
            }}>
              {subtitle}
            </p>
          )}
        </Motion.div>
      )}

      <Motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-30px' }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'clamp(14px, 2.5vw, 22px)',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {features.map((feature, i) => {
          const IconEl = feature.icon;
          return (
            <Motion.div
              key={feature.title || i}
              variants={cardVariants}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(37,99,235,0.10)' }}
              transition={{ duration: 0.2 }}
              style={{
                background: 'white',
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: '14px',
                padding: 'clamp(1.25rem, 3vw, 1.75rem)',
                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                cursor: 'default',
              }}
            >
              {/* Icon chip */}
              <div style={{
                width: '44px', height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(96,165,250,0.08) 100%)',
                border: '1px solid rgba(37,99,235,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {IconEl && <IconEl size={20} style={{ color: 'var(--primary-600)' }} />}
              </div>

              <div>
                <h3 style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '0 0 6px',
                  letterSpacing: '-0.01em',
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: '0.84rem',
                  color: 'rgba(15,23,42,0.55)',
                  margin: 0,
                  lineHeight: 1.6,
                }}>
                  {feature.description}
                </p>
              </div>
            </Motion.div>
          );
        })}
      </Motion.div>
    </section>
  );
}
