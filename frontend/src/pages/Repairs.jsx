import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { SCHEMATIC_DEFINITIONS } from '../data/schematicMappings';

/* ─────────────────────────────────────────────────────────────────────────────
   Brands & tools sourced from schematicMappings — the single source of truth
   for every tool we carry schematics / repair support for.
   ───────────────────────────────────────────────────────────────────────── */
const SUPPORTED_BRANDS = Object.keys(SCHEMATIC_DEFINITIONS); // e.g. Columbia, TapeTech, Asgard, Level5, Platinum

/**
 * Returns the sorted list of unique categories for a given brand.
 * Falls back to [] for unknown brands or "Other".
 */
function getCategoriesForBrand(brand) {
  const entries = SCHEMATIC_DEFINITIONS[brand];
  if (!entries) return [];
  return [...new Set(entries.map((t) => t.category))].sort();
}

/**
 * Returns the tool titles for a specific brand + category combination.
 */
function getModelsForBrandCategory(brand, category) {
  const entries = SCHEMATIC_DEFINITIONS[brand];
  if (!entries || !category) return [];
  return entries
    .filter((t) => t.category === category)
    .map((t) => t.title)
    .sort();
}

/**
 * Builds a human-readable tool description for the success screen.
 */
function getToolDisplayName({ toolBrand, toolModel, toolCategory }) {
  return [toolBrand, toolModel || toolCategory].filter(Boolean).join(' — ');
}

const BLANK_FORM = {
  fullName: '', email: '', phone: '', company: '',
  toolBrand: '', toolCategory: '', toolModel: '', serialNumber: '', toolAge: '',
  serviceType: '', priority: '', issueStart: '', issueDescription: '',
  contactPreference: 'email', additionalNotes: '',
};

const STEPS = [
  { id: 1, label: 'Contact Info',     short: 'Contact'  },
  { id: 2, label: 'Tool Details',     short: 'Tool'     },
  { id: 3, label: 'Service Request',  short: 'Service'  },
  { id: 4, label: 'Review & Submit',  short: 'Review'   },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Service cards shown above the form
   ───────────────────────────────────────────────────────────────────────── */
const services = [
  {
    title: 'Preventative Maintenance',
    description: 'Scheduled inspections, lubrication, seal replacements, and performance tuning to keep tools running at peak condition.',
    items: ['Seasonal equipment inspections', 'Lubrication & fluid replacement', 'Seal & gasket replacements', 'Calibration & adjustment'],
  },
  {
    title: 'Emergency Repairs',
    description: 'When your tools stop working on the job, our technicians diagnose and resolve issues fast — same-day diagnostics available.',
    items: ['Same-day diagnostics', 'Expedited repair turnaround', '24/7 emergency support', 'Field service available'],
  },
  {
    title: 'Warranty & Extended Coverage',
    description: 'Protect your investment with manufacturer warranties and extended coverage plans for professional equipment.',
    items: ['Extended manufacturer warranties', 'Accidental damage coverage', 'Parts & labor protection', 'Annual inspection plans'],
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Reusable labelled field wrapper
   ───────────────────────────────────────────────────────────────────────── */
function Field({ label, required, children, hint }) {
  return (
    <div className="form-group" style={{ marginBottom: '20px' }}>
      <label className="machined-label" style={{ color: 'var(--primary-600)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)', margin: '0 0 6px 0' }}>{hint}</p>}
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step progress bar
   ───────────────────────────────────────────────────────────────────────── */
function ProgressBar({ step, total }) {
  const pct = ((step - 1) / (total - 1)) * 100;
  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Step labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        gap: '4px',
      }}>
        {STEPS.map((s) => (
          <div key={s.id} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            gap: '6px',
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.78rem',
              transition: 'background 0.3s, color 0.3s, border-color 0.3s',
              border: s.id <= step ? '2px solid var(--primary-600)' : '2px solid rgba(15,23,42,0.15)',
              background: s.id < step ? 'var(--primary-600)' : s.id === step ? '#eff6ff' : 'white',
              color: s.id < step ? 'white' : s.id === step ? 'var(--primary-600)' : 'rgba(15,23,42,0.35)',
              flexShrink: 0,
            }}>
              {s.id < step
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : s.id}
            </div>
            <span style={{
              fontSize: 'clamp(0.6rem, 1.5vw, 0.72rem)',
              fontWeight: s.id === step ? 700 : 500,
              color: s.id === step ? 'var(--primary-600)' : s.id < step ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.3)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}>
              {s.short}
            </span>
          </div>
        ))}
      </div>
      {/* Progress track */}
      <div style={{ height: '4px', background: 'rgba(15,23,42,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--primary-600), #3b82f6)',
          borderRadius: '99px',
          transition: 'width 0.45s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Review row helper
   ───────────────────────────────────────────────────────────────────────── */
function ReviewRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: '1px solid rgba(15,23,42,0.06)',
    }}>
      <span style={{
        minWidth: '130px',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(15,23,42,0.45)',
        paddingTop: '2px',
      }}>
        {label}
      </span>
      <span style={{ fontSize: '0.875rem', color: 'black', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Repairs page
   ───────────────────────────────────────────────────────────────────────── */
export default function Repairs() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);

  /* ── field helpers ── */
  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const clearErr = (field) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  /* ── per-step validation ── */
  function validate(s) {
    const errs = {};
    if (s === 1) {
      if (!formData.fullName.trim())             errs.fullName    = 'Full name is required.';
      if (!formData.email.trim())                errs.email       = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
                                                 errs.email       = 'Enter a valid email address.';
      if (!formData.phone.trim())                errs.phone       = 'Phone number is required.';
    }
    if (s === 2) {
      if (!formData.toolBrand)                   errs.toolBrand    = 'Please select a brand.';
      if (formData.toolBrand && formData.toolBrand !== 'Other') {
        if (!formData.toolCategory)              errs.toolCategory = 'Please select a tool category.';
        if (formData.toolCategory && !formData.toolModel)
                                                 errs.toolModel    = 'Please select the tool model.';
      }
    }
    if (s === 3) {
      if (!formData.serviceType)                 errs.serviceType  = 'Please select a service type.';
      if (!formData.priority)                    errs.priority     = 'Please select a priority level.';
      if (!formData.issueDescription.trim())     errs.issueDescription = 'Please describe the issue.';
    }
    return errs;
  }

  function next() {
    const errs = validate(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function back() {
    setErrors({});
    setStep((s) => s - 1);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    setFormData(BLANK_FORM);
    setStep(1);
    setErrors({});
    setSubmitted(false);
  }

  /* ── shared input style ── */
  const inputCls = 'machined-input text-black';
  const errStyle = { fontSize: '0.78rem', color: '#ef4444', marginTop: '5px' };

  /* ──────────────────────────────────────────────────────────────────────────
     Render
     ────────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh' }} className="page-wrapper">
      <SEOHead
        title="Tool Repair Services"
        description="Professional drywall tool repair services and guides. Find repair solutions for TapeTech, Columbia, Asgard, Level5, and Graco drywall finishing tools."
        canonical="https://drywalltoolbox.com/repairs"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
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
          position: 'absolute', top: '-100px', right: '-100px',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '3px', padding: '4px 12px',
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.8)', marginBottom: '20px',
          }}>
            Tool Repair & Maintenance
          </div>
          <h1 style={{
            color: 'white',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 800, margin: '0 0 16px 0',
            lineHeight: 1.1, letterSpacing: '-0.03em',
          }}>
            KEEP YOUR TOOLS<br />
            <span style={{ color: '#93c5fd' }}>RUNNING STRONG.</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
            maxWidth: '600px', lineHeight: 1.6, margin: '0 0 32px 0',
          }}>
            Professional repair and maintenance services for all your drywall tools.
            From emergency fixes to scheduled maintenance — we keep your crew working.
          </p>
          <button
            className="alloy-button"
            style={{ background: 'white', color: '#1e3a8a', border: 'none', cursor: 'pointer' }}
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Request Repair Service
          </button>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        maxWidth: '1400px', margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
          <h2 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800, color: 'var(--primary-600)',
            margin: '0 0 12px 0', letterSpacing: '-0.02em',
          }}>Our Repair Services</h2>
          <p style={{ color: 'rgba(15,23,42,0.6)', fontSize: '1rem', margin: 0 }}>
            Comprehensive coverage for all professional drywall equipment
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px',
        }}>
          {services.map((svc) => (
            <div key={svc.title}
              style={{
                background: 'white',
                border: '1px solid var(--machined-border)',
                borderRadius: '4px',
                padding: 'clamp(1.5rem, 3vw, 2rem)',
                transition: 'box-shadow 0.2s, transform 0.2s',
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
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'black', margin: '0 0 10px 0' }}>
                {svc.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                {svc.description}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {svc.items.map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'rgba(15,23,42,0.7)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

      {/* ── Repair Request Form ──────────────────────────────────────────── */}
      <section style={{
        background: 'var(--alloy-base)',
        borderTop: '1px solid var(--machined-border)',
        borderBottom: '1px solid var(--machined-border)',
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {/* Section heading */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '3px', padding: '4px 12px',
              fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--primary-600)', marginBottom: '14px',
            }}>
              Repair Service Request
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800, color: 'black',
              margin: '0 0 12px 0', letterSpacing: '-0.02em',
            }}>
              Submit a Repair Inquiry
            </h2>
            <p style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)', color: 'rgba(15,23,42,0.55)', margin: 0, lineHeight: 1.6 }}>
              Fill out the form below and our service team will follow up within one business day
              with a quote and estimated turnaround time.
            </p>
          </div>

          {/* Form card */}
          <div
            ref={formRef}
            style={{
              background: 'white',
              border: '1px solid var(--machined-border)',
              borderRadius: '8px',
              padding: 'clamp(1.5rem, 4vw, 2.5rem)',
              boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
            }}
          >
            {submitted ? (
              /* ── Success screen ── */
              <div style={{ textAlign: 'center', padding: 'clamp(2rem, 6vw, 4rem) 0' }}>
                <div style={{
                  width: '72px', height: '72px',
                  background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#16a34a', margin: '0 auto 24px',
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, color: 'black', margin: '0 0 12px 0' }}>
                  Request Submitted!
                </h3>
                <p style={{ fontSize: '0.95rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 8px 0', lineHeight: 1.6 }}>
                  Thank you, <strong>{formData.fullName}</strong>. We received your repair inquiry for{' '}
                  <strong>{getToolDisplayName(formData)}</strong>.
                </p>
                <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
                  Our service team will contact you at <strong>{formData.email}</strong> within one business day
                  with a quote and estimated turnaround time.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="alloy-button"
                    style={{ cursor: 'pointer' }}
                    onClick={resetForm}
                  >
                    Submit Another Request
                  </button>
                  <Link to="/parts" className="alloy-button" style={{
                    textDecoration: 'none',
                    background: 'transparent',
                    color: 'var(--primary-600)',
                    border: '1px solid var(--primary-600)',
                  }}>
                    Browse Parts & Schematics
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <ProgressBar step={step} total={STEPS.length} />

                {/* ── STEP 1: Contact Info ── */}
                {step === 1 && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'black', margin: '0 0 6px 0' }}>
                      Contact Information
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 28px 0' }}>
                      Let us know how to reach you regarding your repair request.
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0 20px',
                    }}>
                      <Field label="Full Name" required>
                        <input
                          type="text" className={inputCls}
                          placeholder="Jane Smith"
                          value={formData.fullName}
                          onChange={set('fullName')}
                          onFocus={() => clearErr('fullName')}
                          autoComplete="name"
                        />
                        {errors.fullName && <p style={errStyle}>{errors.fullName}</p>}
                      </Field>

                      <Field label="Company / Business" hint="Optional">
                        <input
                          type="text" className={inputCls}
                          placeholder="Acme Drywall Co."
                          value={formData.company}
                          onChange={set('company')}
                          autoComplete="organization"
                        />
                      </Field>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0 20px',
                    }}>
                      <Field label="Email Address" required>
                        <input
                          type="email" className={inputCls}
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={set('email')}
                          onFocus={() => clearErr('email')}
                          autoComplete="email"
                        />
                        {errors.email && <p style={errStyle}>{errors.email}</p>}
                      </Field>

                      <Field label="Phone Number" required>
                        <input
                          type="tel" className={inputCls}
                          placeholder="(555) 000-1234"
                          value={formData.phone}
                          onChange={set('phone')}
                          onFocus={() => clearErr('phone')}
                          autoComplete="tel"
                        />
                        {errors.phone && <p style={errStyle}>{errors.phone}</p>}
                      </Field>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Tool Details ── */}
                {step === 2 && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'black', margin: '0 0 6px 0' }}>
                      Tool Details
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 28px 0' }}>
                      Identify the tool that needs service so we can prepare the right technician and parts.
                    </p>

                    {/* Brand */}
                    <Field label="Brand" required>
                      <select
                        className={inputCls}
                        style={{ cursor: 'pointer' }}
                        value={formData.toolBrand}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            toolBrand: e.target.value,
                            toolCategory: '',
                            toolModel: '',
                          }));
                          clearErr('toolBrand');
                          clearErr('toolCategory');
                          clearErr('toolModel');
                        }}
                      >
                        <option value="" disabled>Select a brand…</option>
                        {SUPPORTED_BRANDS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                        <option value="Other">Other / Not Listed</option>
                      </select>
                      {errors.toolBrand && <p style={errStyle}>{errors.toolBrand}</p>}
                    </Field>

                    {/* Structured category + model for known brands */}
                    {formData.toolBrand && formData.toolBrand !== 'Other' && (
                      <>
                        <Field label="Tool Category" required>
                          <select
                            className={inputCls}
                            style={{ cursor: 'pointer' }}
                            value={formData.toolCategory}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                toolCategory: e.target.value,
                                toolModel: '',
                              }));
                              clearErr('toolCategory');
                              clearErr('toolModel');
                            }}
                          >
                            <option value="" disabled>Select a tool category…</option>
                            {getCategoriesForBrand(formData.toolBrand).map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          {errors.toolCategory && <p style={errStyle}>{errors.toolCategory}</p>}
                        </Field>

                        <Field label="Tool Model" required>
                          <select
                            className={inputCls}
                            style={{ cursor: 'pointer' }}
                            value={formData.toolModel}
                            disabled={!formData.toolCategory}
                            onChange={(e) => { set('toolModel')(e); clearErr('toolModel'); }}
                          >
                            <option value="" disabled>
                              {formData.toolCategory ? 'Select the specific model…' : 'Select a category first…'}
                            </option>
                            {getModelsForBrandCategory(formData.toolBrand, formData.toolCategory).map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                          </select>
                          {errors.toolModel && <p style={errStyle}>{errors.toolModel}</p>}
                        </Field>
                      </>
                    )}

                    {/* Freeform fields for "Other" brand */}
                    {formData.toolBrand === 'Other' && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '0 20px',
                      }}>
                        <Field label="Tool Type / Category" hint="e.g. Flat Box, Taper, Pump…">
                          <input
                            type="text" className={inputCls}
                            placeholder="e.g. Finishing Box"
                            value={formData.toolCategory}
                            onChange={(e) => { set('toolCategory')(e); clearErr('toolCategory'); }}
                          />
                        </Field>
                        <Field label="Tool Model / Name" hint="e.g. make, model number, or description">
                          <input
                            type="text" className={inputCls}
                            placeholder="e.g. ProBox 10-inch"
                            value={formData.toolModel}
                            onChange={(e) => { set('toolModel')(e); clearErr('toolModel'); }}
                          />
                        </Field>
                      </div>
                    )}

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0 20px',
                    }}>
                      <Field label="Serial Number" hint="Optional — found on the tool body or original packaging">
                        <input
                          type="text" className={inputCls}
                          placeholder="e.g. COL-2024-XXXXX"
                          value={formData.serialNumber}
                          onChange={set('serialNumber')}
                        />
                      </Field>

                      <Field label="Approximate Tool Age">
                        <select
                          className={inputCls}
                          style={{ cursor: 'pointer' }}
                          value={formData.toolAge}
                          onChange={set('toolAge')}
                        >
                          <option value="">Unknown / Not sure</option>
                          <option value="Under 1 year">Under 1 year</option>
                          <option value="1–3 years">1–3 years</option>
                          <option value="3–5 years">3–5 years</option>
                          <option value="5–10 years">5–10 years</option>
                          <option value="10+ years">10+ years</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Service Request ── */}
                {step === 3 && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'black', margin: '0 0 6px 0' }}>
                      Service Request Details
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 28px 0' }}>
                      Tell us what kind of service you need and describe the issue in as much detail as possible.
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0 20px',
                    }}>
                      <Field label="Service Type" required>
                        <select
                          className={inputCls}
                          style={{ cursor: 'pointer' }}
                          value={formData.serviceType}
                          onChange={(e) => { set('serviceType')(e); clearErr('serviceType'); }}
                        >
                          <option value="" disabled>Select service type…</option>
                          <option value="Preventative Maintenance">Preventative Maintenance</option>
                          <option value="General Repair">General Repair</option>
                          <option value="Emergency Repair">Emergency Repair</option>
                          <option value="Warranty Claim">Warranty Claim</option>
                          <option value="Calibration / Adjustment">Calibration / Adjustment</option>
                          <option value="Parts Replacement Only">Parts Replacement Only</option>
                          <option value="Full Overhaul / Rebuild">Full Overhaul / Rebuild</option>
                        </select>
                        {errors.serviceType && <p style={errStyle}>{errors.serviceType}</p>}
                      </Field>

                      <Field label="Priority Level" required>
                        <select
                          className={inputCls}
                          style={{ cursor: 'pointer' }}
                          value={formData.priority}
                          onChange={(e) => { set('priority')(e); clearErr('priority'); }}
                        >
                          <option value="" disabled>Select priority…</option>
                          <option value="Standard (5–7 business days)">Standard — 5–7 business days</option>
                          <option value="Expedited (2–3 business days)">Expedited — 2–3 business days</option>
                          <option value="Emergency (same/next day)">Emergency — same / next day</option>
                        </select>
                        {errors.priority && <p style={errStyle}>{errors.priority}</p>}
                      </Field>
                    </div>

                    <Field label="When Did the Issue Start?">
                      <select
                        className={inputCls}
                        style={{ cursor: 'pointer' }}
                        value={formData.issueStart}
                        onChange={set('issueStart')}
                      >
                        <option value="">Not sure / N/A</option>
                        <option value="Today">Today</option>
                        <option value="This week">This week</option>
                        <option value="This month">This month</option>
                        <option value="1–3 months ago">1–3 months ago</option>
                        <option value="More than 3 months ago">More than 3 months ago</option>
                      </select>
                    </Field>

                    <Field label="Issue Description" required hint="Describe what's wrong, any symptoms, sounds, leaks, or damage you've noticed">
                      <textarea
                        rows="5"
                        className="machined-textarea text-black"
                        placeholder="e.g. The pump is losing pressure mid-use, the valve seal appears to be leaking at the base connection…"
                        value={formData.issueDescription}
                        onChange={(e) => { set('issueDescription')(e); clearErr('issueDescription'); }}
                        style={{ resize: 'vertical', minHeight: '110px' }}
                      />
                      {errors.issueDescription && <p style={errStyle}>{errors.issueDescription}</p>}
                    </Field>

                    <Field label="Preferred Contact Method">
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', paddingTop: '4px' }}>
                        {[{ val: 'email', label: 'Email' }, { val: 'phone', label: 'Phone Call' }, { val: 'either', label: 'Either' }].map((opt) => (
                          <label key={opt.val} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', fontSize: '0.875rem', color: 'black',
                          }}>
                            <input
                              type="radio"
                              name="contactPreference"
                              value={opt.val}
                              checked={formData.contactPreference === opt.val}
                              onChange={set('contactPreference')}
                              style={{ accentColor: 'var(--primary-600)', width: '16px', height: '16px' }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </Field>

                    <Field label="Additional Notes" hint="Optional — anything else we should know">
                      <textarea
                        rows="3"
                        className="machined-textarea text-black"
                        placeholder="Any special instructions, previous repair history, or photos you'd like to reference…"
                        value={formData.additionalNotes}
                        onChange={set('additionalNotes')}
                        style={{ resize: 'vertical', minHeight: '80px' }}
                      />
                    </Field>
                  </div>
                )}

                {/* ── STEP 4: Review & Submit ── */}
                {step === 4 && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'black', margin: '0 0 6px 0' }}>
                      Review Your Request
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 28px 0' }}>
                      Please review the details below before submitting. Use the Back button to make any changes.
                    </p>

                    {/* Contact section */}
                    <div style={{
                      background: 'var(--alloy-base)',
                      border: '1px solid var(--machined-border)',
                      borderRadius: '6px',
                      padding: '16px 20px',
                      marginBottom: '16px',
                    }}>
                      <div style={{
                        fontSize: '0.7rem', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: 'var(--primary-600)', marginBottom: '8px',
                      }}>
                        Contact Information
                      </div>
                      <ReviewRow label="Name"        value={formData.fullName} />
                      <ReviewRow label="Email"       value={formData.email} />
                      <ReviewRow label="Phone"       value={formData.phone} />
                      <ReviewRow label="Company"     value={formData.company} />
                      <ReviewRow label="Contact Via" value={formData.contactPreference === 'email' ? 'Email' : formData.contactPreference === 'phone' ? 'Phone Call' : 'Either'} />
                    </div>

                    {/* Tool section */}
                    <div style={{
                      background: 'var(--alloy-base)',
                      border: '1px solid var(--machined-border)',
                      borderRadius: '6px',
                      padding: '16px 20px',
                      marginBottom: '16px',
                    }}>
                      <div style={{
                        fontSize: '0.7rem', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: 'var(--primary-600)', marginBottom: '8px',
                      }}>
                        Tool Details
                      </div>
                      <ReviewRow label="Brand"       value={formData.toolBrand} />
                      <ReviewRow label="Category"    value={formData.toolCategory} />
                      <ReviewRow label="Model"       value={formData.toolModel} />
                      <ReviewRow label="Serial #"    value={formData.serialNumber} />
                      <ReviewRow label="Tool Age"    value={formData.toolAge} />
                    </div>

                    {/* Service section */}
                    <div style={{
                      background: 'var(--alloy-base)',
                      border: '1px solid var(--machined-border)',
                      borderRadius: '6px',
                      padding: '16px 20px',
                      marginBottom: '24px',
                    }}>
                      <div style={{
                        fontSize: '0.7rem', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: 'var(--primary-600)', marginBottom: '8px',
                      }}>
                        Service Request
                      </div>
                      <ReviewRow label="Service Type"   value={formData.serviceType} />
                      <ReviewRow label="Priority"       value={formData.priority} />
                      <ReviewRow label="Issue Start"    value={formData.issueStart} />
                      <ReviewRow label="Description"    value={formData.issueDescription} />
                      <ReviewRow label="Notes"          value={formData.additionalNotes} />
                    </div>

                    {/* Disclaimer */}
                    <p style={{
                      fontSize: '0.78rem', color: 'rgba(15,23,42,0.45)',
                      lineHeight: 1.6, margin: '0 0 8px 0',
                    }}>
                      By submitting this request you agree that our service team may contact you via your
                      preferred method to discuss repair options, pricing, and scheduling. No charges are
                      incurred until you approve a quote.
                    </p>
                  </div>
                )}

                {/* ── Navigation buttons ── */}
                <div style={{
                  display: 'flex',
                  justifyContent: step === 1 ? 'flex-end' : 'space-between',
                  alignItems: 'center',
                  marginTop: '28px',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={back}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'transparent',
                        border: '1px solid var(--machined-border)',
                        borderRadius: '3px',
                        padding: '12px 20px',
                        fontSize: '0.825rem', fontWeight: 700,
                        color: 'rgba(15,23,42,0.6)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, color 0.2s',
                        letterSpacing: '0.04em',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(15,23,42,0.35)';
                        e.currentTarget.style.color = 'black';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--machined-border)';
                        e.currentTarget.style.color = 'rgba(15,23,42,0.6)';
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 5l-7 7 7 7"/>
                      </svg>
                      Back
                    </button>
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      className="alloy-button"
                      onClick={next}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      Continue
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="alloy-button"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Submit Repair Request
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>


        </div>
      </section>

      {/* ── Quick Links ──────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 800,
            color: 'var(--primary-600)',
            margin: '0 0 clamp(1.5rem, 3vw, 2rem) 0',
            letterSpacing: '-0.02em',
          }}>
            Related Resources
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}>
            {[
              {
                to: '/parts',
                title: 'Parts & Schematics',
                description: 'Browse interactive part diagrams and order replacement parts for all major brands.',
              },
              {
                to: '/products',
                title: 'Shop Replacement Tools',
                description: 'Upgrade your toolkit — browse our full catalog of professional drywall tools and accessories.',
              },
              {
                to: '/contact',
                title: 'Talk to an Expert',
                description: 'Our industry veterans are ready to help — no bots, no runaround, just real support.',
              },
            ].map((ql) => (
              <Link key={ql.to} to={ql.to} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    background: 'white',
                    border: '1px solid var(--machined-border)',
                    borderRadius: '4px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
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
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'black', margin: '0 0 8px 0' }}>{ql.title}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', margin: 0, lineHeight: 1.5 }}>{ql.description}</p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    color: 'var(--primary-600)', fontSize: '0.75rem',
                    fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginTop: '16px',
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
