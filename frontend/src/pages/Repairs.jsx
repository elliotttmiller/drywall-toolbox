import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { SCHEMATIC_DEFINITIONS } from '../data/schematicMappings';
import veeqoService from '../services/veeqo';

/* ─────────────────────────────────────────────────────────────────────────────
   Brands & tools sourced from schematicMappings — the single source of truth
   for every tool we carry schematics / repair support for.
   ───────────────────────────────────────────────────────────────────────── */
const SUPPORTED_BRANDS = Object.keys(SCHEMATIC_DEFINITIONS).sort((a, b) => a.localeCompare(b)); // alphabetical

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
 * Returns the tool model objects for a specific brand + category combination.
 * Each object has { value, label } where value is the full display string
 * stored in form state and label is the same (title + MPN when available).
 */
function getModelsForBrandCategory(brand, category) {
  const entries = SCHEMATIC_DEFINITIONS[brand];
  if (!entries || !category) return [];
  return entries
    .filter((t) => t.category === category)
    .map((t) => {
      const label = t.mpn ? `${t.title} — ${t.mpn}` : t.title;
      return { value: label, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
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
  contactPreference: 'email',
  // Shipping fields (Step 4)
  address: '', city: '', state: '', zip: '', country: 'US',
  shippingRateId: '', shippingRateName: '', shippingRatePrice: null,
};

const STEPS = [
  { id: 1, label: 'Contact Info',    short: 'Contact'  },
  { id: 2, label: 'Tool Details',    short: 'Tool'     },
  { id: 3, label: 'Service Request', short: 'Service'  },
  { id: 4, label: 'Shipping',        short: 'Shipping' },
  { id: 5, label: 'Review & Submit', short: 'Review'   },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Service cards shown above the form
   ───────────────────────────────────────────────────────────────────────── */
const services = [
  {
    title: 'Preventative Maintenance',
    description: 'Annual tune-ups cost ~1/3 of emergency rebuilds and extend tool life 2–3×. Scheduled inspections, lubrication, seal replacements, and performance tuning.',
    items: ['Usage-based service intervals', 'Lubrication & fluid replacement', 'Seal & gasket replacements', 'Calibration & adjustment'],
  },
  {
    title: 'Repair & Rebuild',
    description: 'Full overhauls, head rebuilds, and targeted repairs for automatic tapers, flat boxes, angle boxes, and mud pumps. Labor-only quotes provided upfront.',
    items: ['Automatic taper head rebuilds', 'Flat & angle box repairs', 'Mud pump overhauls', 'Blade, cable & parts replacement'],
  },
  {
    title: 'Warranty & Service Guarantee',
    description: 'Every repair comes with a workmanship warranty. We stand behind our work — if a repair fails, we make it right.',
    items: ['1-year warranty on replaced parts', 'Free rework if repair fails', 'Transparent labor + parts invoicing', 'No charges until you approve a quote'],
  },
];

const PRICING_TIERS = [
  { service: 'Auto Taper Head Rebuild', laborRange: '$115–$225', partsRange: '$45–$137', totalRange: '$160–$362+', note: 'Most common; includes wear kit' },
  { service: 'Small Tool Rebuild', laborRange: '$35–$100', partsRange: '$27–$40', totalRange: '$62–$140', note: 'Flat box, angle box, mud pump' },
  { service: 'Blade / Cable Replacement', laborRange: '$35', partsRange: '$15–$40', totalRange: '$50–$75', note: 'Flat rate labor' },
  { service: 'Full Overhaul (labor + parts)', laborRange: '$150–$225', partsRange: '$300–$375', totalRange: '$450–$600', note: 'Complete rebuild' },
  { service: 'Diagnostic / Bench Fee', laborRange: '$50–$75', partsRange: '—', totalRange: '$50–$75', note: 'Credited if repair approved' },
];

const MAINTENANCE_SCHEDULE = [
  { level: 'High-Volume Pro', usage: '6+ rolls (500 ft) / day', interval: 'Every 6 months', badge: 'Heavy' },
  { level: 'Standard Pro', usage: '4–10 rolls / week', interval: 'Annually', badge: 'Regular' },
  { level: 'Occasional User', usage: '<4 rolls / week', interval: 'Every 18–24 months', badge: 'Light' },
];

const WEAR_PARTS = [
  { tool: 'Automatic Taper', parts: ['Tape wheels ("teeth")', 'Blade & cable', 'Plunger cup', 'Wear bushings', 'Drive dog spring'] },
  { tool: 'Flat / Angle Boxes', parts: ['Blades', 'Skids & wheels', 'Tension springs', 'O-rings'] },
  { tool: 'Mud Pumps', parts: ['Gaskets & u-cups', 'Screens & valve discs', 'Bushings'] },
  { tool: 'Handles & Extensions', parts: ['Brake adjusters', 'Conical springs', 'Friction washers'] },
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
   Single photo thumbnail with remove button
   ───────────────────────────────────────────────────────────────────────── */
function PhotoThumb({ photo, onRemove }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img
        src={photo.preview}
        alt={photo.name}
        style={{
          width: '40px', height: '40px',
          objectFit: 'cover',
          borderRadius: '4px',
          border: '1px solid rgba(15,23,42,0.12)',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${photo.name}`}
        style={{
          position: 'absolute',
          top: '-5px', right: '-5px',
          width: '16px', height: '16px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.65)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Photo uploader — compact icon trigger only; thumbnails rendered by parent
   ───────────────────────────────────────────────────────────────────────── */
const MAX_PHOTOS = 6;
const MAX_FILE_MB = 10;

function PhotoUploader({ photos, onChange }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const addFiles = useCallback((files) => {
    const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
    const incoming = Array.from(files).filter((f) => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_BYTES) {
        alert(`"${f.name}" exceeds the ${MAX_FILE_MB} MB limit and was not added.`);
        return false;
      }
      return true;
    });
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const toAdd = incoming.slice(0, remaining).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));
    onChange([...photos, ...toAdd]);
  }, [photos, onChange]);

  const full = photos.length >= MAX_PHOTOS;

  return (
    <>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Compact camera icon trigger */}
      {!full && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title={`Attach photos (${photos.length}/${MAX_PHOTOS})`}
          aria-label="Attach photos"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '30px', height: '30px',
            borderRadius: '6px',
            border: photos.length > 0 ? '1.5px solid var(--primary-600)' : '1.5px solid rgba(15,23,42,0.2)',
            background: photos.length > 0 ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.85)',
            color: photos.length > 0 ? 'var(--primary-600)' : 'rgba(15,23,42,0.45)',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s, color 0.15s',
            flexShrink: 0,
            backdropFilter: 'blur(2px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-600)';
            e.currentTarget.style.color = 'var(--primary-600)';
            e.currentTarget.style.background = 'rgba(37,99,235,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = photos.length > 0 ? 'var(--primary-600)' : 'rgba(15,23,42,0.2)';
            e.currentTarget.style.color = photos.length > 0 ? 'var(--primary-600)' : 'rgba(15,23,42,0.45)';
            e.currentTarget.style.background = photos.length > 0 ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.85)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Repairs page
   ───────────────────────────────────────────────────────────────────────── */
export default function Repairs() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);

  // Submission state
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderResult, setOrderResult] = useState(null);

  // Shipping rate state
  const [rates, setRates]           = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState('');

  /* ── field helpers ── */
  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const clearErr = (field) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  /* ── fetch shipping rates for the destination in formData ── */
  const fetchShippingRates = useCallback(async (data) => {
    const { address, city, state: st, zip, country } = data;
    if (!address || !city || !st || !zip) return;

    setRatesLoading(true);
    setRatesError('');
    try {
      const destination = { address, city, state: st, zip, country };
      // Repair service items don't have WC product IDs; pass a placeholder.
      const items = [{
        id: 0,
        sku: 'REPAIR-SVC',
        name: `Repair Service — ${ data.toolBrand } ${ data.toolModel || data.toolCategory }`.trim(),
        quantity: 1,
        price: 0,
        weight: 5, // estimated tool weight in lbs
        category: 'repair service',
      }];
      const result = await veeqoService.getShippingRates(destination, items);
      setRates(result);

      // Pre-select the first rate.
      if (result.length > 0 && !data.shippingRateId) {
        setFormData((prev) => ({
          ...prev,
          shippingRateId:    result[0].id,
          shippingRateName:  result[0].name,
          shippingRatePrice: result[0].price,
        }));
      }
    } catch (err) {
      setRatesError('Could not load shipping options. Please try again.');
      console.error('Shipping rate fetch failed:', err);
    } finally {
      setRatesLoading(false);
    }
  }, []);

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
    if (s === 4) {
      if (!formData.address.trim())              errs.address      = 'Street address is required.';
      if (!formData.city.trim())                 errs.city         = 'City is required.';
      if (!formData.state.trim())                errs.state        = 'State / Province is required.';
      if (!formData.zip.trim())                  errs.zip          = 'ZIP / Postal code is required.';
      if (!formData.shippingRateId)              errs.shippingRateId = 'Please select a shipping option.';
    }
    return errs;
  }

  function next() {
    const errs = validate(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    const nextStep = step + 1;
    setStep(nextStep);

    // When entering Step 4 (Shipping), auto-fetch rates if address already present.
    if (nextStep === 4) {
      fetchShippingRates(formData);
    }

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function back() {
    setErrors({});
    setStep((s) => s - 1);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const result = await veeqoService.submitRepairRequest({
        fullName:           formData.fullName,
        email:              formData.email,
        phone:              formData.phone,
        company:            formData.company,
        toolBrand:          formData.toolBrand,
        toolCategory:       formData.toolCategory,
        toolModel:          formData.toolModel,
        serialNumber:       formData.serialNumber,
        toolAge:            formData.toolAge,
        serviceType:        formData.serviceType,
        priority:           formData.priority,
        issueStart:         formData.issueStart,
        issueDescription:   formData.issueDescription,
        contactPreference:  formData.contactPreference,
        address:            formData.address,
        city:               formData.city,
        state:              formData.state,
        zip:                formData.zip,
        country:            formData.country,
        shippingRateId:     formData.shippingRateId,
        shippingRateName:   formData.shippingRateName,
        shippingRatePrice:  formData.shippingRatePrice,
      });

      setOrderResult(result);
      setSubmitted(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please try again or call us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setFormData(BLANK_FORM);
    setPhotos([]);
    setStep(1);
    setErrors({});
    setSubmitted(false);
    setOrderResult(null);
    setSubmitError('');
    setRates([]);
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

      {/* ── Pricing Reference ───────────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--alloy-base)',
        borderTop: '1px solid var(--machined-border)',
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
              Industry Pricing Reference
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800, color: 'var(--primary-600)',
              margin: '0 0 12px 0', letterSpacing: '-0.02em',
            }}>
              Transparent Repair Pricing
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.6)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
              Industry-standard labor and parts ranges for professional drywall tool repairs.
              No charges until you approve your quote.
            </p>
          </div>

          {/* Pricing table — scrollable on mobile */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '6px', border: '1px solid var(--machined-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px', background: 'white' }}>
              <thead>
                <tr style={{ background: 'var(--primary-600)', color: 'white' }}>
                  {['Service', 'Labor', 'Parts (Est.)', 'Total Range', 'Notes'].map((h) => (
                    <th key={h} style={{
                      padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2vw, 18px)',
                      textAlign: 'left', fontSize: '0.72rem',
                      fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_TIERS.map((row, i) => (
                  <tr key={row.service} style={{ background: i % 2 === 0 ? 'white' : 'rgba(15,23,42,0.02)' }}>
                    <td style={{ padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2vw, 18px)', fontSize: '0.875rem', fontWeight: 600, color: 'black', borderBottom: '1px solid var(--machined-border)' }}>{row.service}</td>
                    <td style={{ padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2vw, 18px)', fontSize: '0.875rem', color: 'rgba(15,23,42,0.75)', borderBottom: '1px solid var(--machined-border)', whiteSpace: 'nowrap' }}>{row.laborRange}</td>
                    <td style={{ padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2vw, 18px)', fontSize: '0.875rem', color: 'rgba(15,23,42,0.75)', borderBottom: '1px solid var(--machined-border)', whiteSpace: 'nowrap' }}>{row.partsRange}</td>
                    <td style={{ padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2vw, 18px)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-600)', borderBottom: '1px solid var(--machined-border)', whiteSpace: 'nowrap' }}>{row.totalRange}</td>
                    <td style={{ padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2vw, 18px)', fontSize: '0.78rem', color: 'rgba(15,23,42,0.5)', borderBottom: '1px solid var(--machined-border)' }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.4)', marginTop: '12px', textAlign: 'center' }}>
            * All prices are industry estimates. Actual costs may vary based on tool condition, parts availability, and additional findings during disassembly.
            Budget an extra 20–30% for potential "hard parts" (chains, sprockets, shafts) discovered during service.
          </p>
        </div>
      </section>

      {/* ── Maintenance Guide ─────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800, color: 'var(--primary-600)',
              margin: '0 0 12px 0', letterSpacing: '-0.02em',
            }}>
              Maintenance Schedule
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.6)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0 }}>
              Industry-recommended service intervals based on your usage level
            </p>
          </div>

          {/* Usage cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
            marginBottom: 'clamp(2rem, 4vw, 3rem)',
          }}>
            {MAINTENANCE_SCHEDULE.map((row) => {
              const badgeColors = {
                Heavy: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
                Regular: { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.25)', text: 'var(--primary-600)' },
                Light: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
              };
              const colors = badgeColors[row.badge] || badgeColors.Regular;
              return (
                <div key={row.level} style={{
                  background: 'white',
                  border: '1px solid var(--machined-border)',
                  borderRadius: '6px',
                  padding: 'clamp(1.25rem, 3vw, 1.75rem)',
                }}>
                  <div style={{
                    display: 'inline-block',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '3px', padding: '3px 10px',
                    fontSize: '0.68rem', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: colors.text, marginBottom: '12px',
                  }}>
                    {row.badge} Use
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'black', margin: '0 0 6px 0' }}>
                    {row.level}
                  </h3>
                  <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.55)', margin: '0 0 14px 0' }}>
                    {row.usage}
                  </p>
                  <div style={{
                    background: 'var(--alloy-base)',
                    border: '1px solid var(--machined-border)',
                    borderRadius: '4px',
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-600)' }}>
                      {row.interval}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wear parts grid */}
          <div>
            <h3 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)', fontWeight: 700, color: 'black', margin: '0 0 clamp(1rem, 2vw, 1.5rem) 0' }}>
              Critical Wear Parts to Monitor
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}>
              {WEAR_PARTS.map((wp) => (
                <div key={wp.tool} style={{
                  background: 'white',
                  border: '1px solid var(--machined-border)',
                  borderRadius: '4px',
                  padding: 'clamp(1rem, 2.5vw, 1.5rem)',
                }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-600)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {wp.tool}
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {wp.parts.map((part) => (
                      <li key={part} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '0.825rem', color: 'rgba(15,23,42,0.7)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {part}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Repair vs. Replace ───────────────────────────────────────────── */}
      <section style={{
        background: 'var(--alloy-base)',
        borderTop: '1px solid var(--machined-border)',
        borderBottom: '1px solid var(--machined-border)',
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800, color: 'var(--primary-600)',
              margin: '0 0 12px 0', letterSpacing: '-0.02em',
            }}>
              Repair vs. Replace Decision Guide
            </h2>
            <p style={{ color: 'rgba(15,23,42,0.6)', fontSize: 'clamp(0.875rem, 2vw, 1rem)', margin: 0 }}>
              Use the industry-standard 70% rule to make the right call
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
          }}>
            {/* Rule card */}
            <div style={{
              background: 'white',
              border: '1px solid var(--machined-border)',
              borderRadius: '6px',
              padding: 'clamp(1.5rem, 3vw, 2rem)',
            }}>
              <div style={{
                display: 'inline-block',
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.2)',
                borderRadius: '3px', padding: '4px 12px',
                fontSize: '0.7rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--primary-600)', marginBottom: '14px',
              }}>
                The 70% Rule
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'black', margin: '0 0 12px 0' }}>
                How to decide
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  background: '#f0fdf4', border: '1px solid #86efac',
                  borderRadius: '4px', padding: '12px 16px',
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#15803d' }}>
                    ✓ Repair is economical if repair cost is under 70% of new tool price
                  </p>
                </div>
                <div style={{
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  borderRadius: '4px', padding: '12px 16px',
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>
                    ✗ Consider replacement if repair cost reaches 70%+ of new tool price
                  </p>
                </div>
              </div>
            </div>

            {/* Example card */}
            <div style={{
              background: 'white',
              border: '1px solid var(--machined-border)',
              borderRadius: '6px',
              padding: 'clamp(1.5rem, 3vw, 2rem)',
            }}>
              <div style={{
                display: 'inline-block',
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: '3px', padding: '4px 12px',
                fontSize: '0.7rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#15803d', marginBottom: '14px',
              }}>
                Real-World Example
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'black', margin: '0 0 16px 0' }}>
                Automatic Taper Rebuild
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'New Tool Price', value: '~$2,000', color: 'rgba(15,23,42,0.7)' },
                  { label: 'Full Rebuild Cost', value: '$450–$600', color: 'rgba(15,23,42,0.7)' },
                  { label: 'Your Savings', value: '70–77%', color: '#15803d' },
                ].map((item) => (
                  <div key={item.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--alloy-base)',
                    border: '1px solid var(--machined-border)',
                    borderRadius: '4px',
                  }}>
                    <span style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                ))}
                <div style={{
                  background: '#f0fdf4', border: '1px solid #86efac',
                  borderRadius: '4px', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginTop: '4px',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#15803d' }}>Verdict: Repair Recommended</span>
                </div>
              </div>
            </div>

            {/* Pro tips card */}
            <div style={{
              background: 'white',
              border: '1px solid var(--machined-border)',
              borderRadius: '6px',
              padding: 'clamp(1.5rem, 3vw, 2rem)',
            }}>
              <div style={{
                display: 'inline-block',
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.2)',
                borderRadius: '3px', padding: '4px 12px',
                fontSize: '0.7rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--primary-600)', marginBottom: '14px',
              }}>
                Pro Tips
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'black', margin: '0 0 14px 0' }}>
                Before You Ship
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  'Photograph your tool and document symptoms before packaging',
                  'Budget 20–30% extra for hard parts (chains, sprockets, shafts)',
                  'Annual tune-ups cost ~1/3 of emergency rebuilds',
                  'Verify your brand/model year is supported before shipping',
                  'Wrap in bubble wrap; use the smallest sturdy box available',
                ].map((tip, i) => (
                  <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.825rem', color: 'rgba(15,23,42,0.7)', lineHeight: 1.5 }}>
                    <span style={{
                      flexShrink: 0,
                      width: '20px', height: '20px',
                      background: 'rgba(37,99,235,0.1)',
                      border: '1px solid rgba(37,99,235,0.2)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-600)',
                      marginTop: '1px',
                    }}>
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
                {orderResult?.wc_order_number && (
                  <p style={{ fontSize: '0.82rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 8px 0' }}>
                    Order <strong style={{ color: 'black' }}>#{orderResult.wc_order_number}</strong>
                  </p>
                )}
                <p style={{ fontSize: '0.95rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 8px 0', lineHeight: 1.6 }}>
                  Thank you, <strong>{formData.fullName}</strong>. We received your repair inquiry for{' '}
                  <strong>{getToolDisplayName(formData)}</strong>.
                </p>
                <p style={{ fontSize: '0.875rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
                  Our service team will contact you at <strong>{formData.email}</strong> within one business day
                  with a quote and estimated turnaround time.
                </p>
                {/* What Happens Next */}
                <div style={{
                  background: 'var(--alloy-base)',
                  border: '1px solid var(--machined-border)',
                  borderRadius: '6px',
                  padding: 'clamp(1.25rem, 3vw, 1.75rem)',
                  marginBottom: '28px',
                  textAlign: 'left',
                  maxWidth: '480px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'black', margin: '0 0 14px 0', textAlign: 'center' }}>
                    What Happens Next
                  </h4>
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { step: '1', text: 'Our team reviews your request and emails you a prepaid inbound shipping label within 1 business day.' },
                      { step: '2', text: 'Pack your tool in bubble wrap inside a sturdy box. Include a printed copy of this request if possible.' },
                      { step: '3', text: 'Ship with USPS, FedEx, or UPS using the provided label. Keep your tracking number.' },
                      { step: '4', text: 'We diagnose your tool and send you a quote. No work begins until you approve pricing.' },
                      { step: '5', text: 'Repaired tool ships back to you within 1–3 weeks depending on parts availability.' },
                    ].map((item) => (
                      <li key={item.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{
                          flexShrink: 0,
                          width: '22px', height: '22px',
                          background: 'var(--primary-600)',
                          borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 800, color: 'white',
                          marginTop: '1px',
                        }}>
                          {item.step}
                        </span>
                        <span style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.7)', lineHeight: 1.5 }}>{item.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
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
                              <option key={model.value} value={model.value}>{model.label}</option>
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

                    <Field label="Preferred Contact Method" hint="How should we reach you when your repair is ready?">
                      <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          {
                            val: 'email',
                            label: 'Email',
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                            ),
                          },
                          {
                            val: 'phone',
                            label: 'Phone',
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 5.56 5.56l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/>
                              </svg>
                            ),
                          },
                          {
                            val: 'either',
                            label: 'Either',
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 3 21 3 21 8"/>
                                <line x1="4" y1="20" x2="21" y2="3"/>
                                <polyline points="21 16 21 21 16 21"/>
                                <line x1="15" y1="15" x2="21" y2="21"/>
                              </svg>
                            ),
                          },
                        ].map((opt) => {
                          const active = formData.contactPreference === opt.val;
                          return (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, contactPreference: opt.val }))}
                              aria-pressed={active}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 13px',
                                borderRadius: '99px',
                                border: active
                                  ? '1.5px solid var(--primary-600)'
                                  : '1.5px solid rgba(15,23,42,0.14)',
                                background: active ? 'var(--primary-600)' : 'white',
                                color: active ? 'white' : 'rgba(15,23,42,0.6)',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                letterSpacing: '0.02em',
                                transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                                outline: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                lineHeight: 1,
                              }}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <Field label="Details & Notes" required hint="Describe symptoms, sounds, leaks, damage, and prior repair history. Tip: photograph your tool before shipping — it speeds up diagnosis.">
                      <div style={{ position: 'relative' }}>
                        <textarea
                          rows="6"
                          className="machined-textarea text-black"
                          placeholder="e.g. The pump is losing pressure mid-use, valve seal leaking at base connection. Previously repaired 6 months ago…"
                          value={formData.issueDescription}
                          onChange={(e) => { set('issueDescription')(e); clearErr('issueDescription'); }}
                          style={{ resize: 'vertical', minHeight: '130px', paddingBottom: '44px' }}
                        />
                        {/* Photo icon anchored to bottom-left of textarea */}
                        <div style={{
                          position: 'absolute',
                          bottom: '10px',
                          left: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          pointerEvents: 'none',
                        }}>
                          <div style={{ pointerEvents: 'auto' }}>
                            <PhotoUploader photos={photos} onChange={setPhotos} />
                          </div>
                          {photos.length > 0 && (
                            <span style={{ fontSize: '0.68rem', color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>
                              {photos.length}/{MAX_PHOTOS} photo{photos.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Thumbnails below the textarea */}
                      {photos.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {photos.map((p) => (
                            <PhotoThumb key={p.id} photo={p} onRemove={() => {
                              const next = photos.filter((x) => x.id !== p.id);
                              URL.revokeObjectURL(p.preview);
                              setPhotos(next);
                            }} />
                          ))}
                        </div>
                      )}
                      {errors.issueDescription && <p style={errStyle}>{errors.issueDescription}</p>}
                    </Field>
                  </div>
                )}

                {/* ── STEP 4: Shipping ── */}
                {step === 4 && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'black', margin: '0 0 6px 0' }}>
                      Return Shipping
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.5)', margin: '0 0 28px 0' }}>
                      Enter the address where we should return your repaired tool. We'll email you a prepaid inbound
                      shipping label, and the selected option covers return delivery.
                    </p>

                    {/* Packaging Tips */}
                    <div style={{
                      background: 'rgba(37,99,235,0.04)',
                      border: '1px solid rgba(37,99,235,0.2)',
                      borderRadius: '6px',
                      padding: 'clamp(12px, 2vw, 16px) clamp(14px, 2.5vw, 20px)',
                      marginBottom: '24px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.825rem', fontWeight: 700, color: 'var(--primary-600)' }}>
                          Packaging Guidance
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {[
                            'Use the smallest sturdy box available; wrap tool in bubble wrap or paper.',
                            'Include a printed copy of this repair form or a written description of the issue.',
                            'Photograph your tool before sealing the box — keep the photos for your records.',
                            'Accepted carriers: USPS, FedEx, UPS. Keep your outbound tracking number.',
                          ].map((tip, i) => (
                            <li key={i} style={{ display: 'flex', gap: '7px', fontSize: '0.8rem', color: 'rgba(15,23,42,0.65)', lineHeight: 1.5 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '3px' }}>
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Address fields */}
                    <Field label="Street Address" required>
                      <input
                        type="text" className={inputCls}
                        placeholder="123 Main St"
                        value={formData.address}
                        onChange={(e) => { set('address')(e); clearErr('address'); }}
                        autoComplete="street-address"
                      />
                      {errors.address && <p style={errStyle}>{errors.address}</p>}
                    </Field>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 20px' }}>
                      <Field label="City" required>
                        <input
                          type="text" className={inputCls}
                          placeholder="Sacramento"
                          value={formData.city}
                          onChange={(e) => { set('city')(e); clearErr('city'); }}
                          autoComplete="address-level2"
                        />
                        {errors.city && <p style={errStyle}>{errors.city}</p>}
                      </Field>

                      <Field label="State / Province" required>
                        <input
                          type="text" className={inputCls}
                          placeholder="CA"
                          value={formData.state}
                          onChange={(e) => { set('state')(e); clearErr('state'); }}
                          autoComplete="address-level1"
                        />
                        {errors.state && <p style={errStyle}>{errors.state}</p>}
                      </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 20px' }}>
                      <Field label="ZIP / Postal Code" required>
                        <input
                          type="text" className={inputCls}
                          placeholder="95814"
                          value={formData.zip}
                          onChange={(e) => { set('zip')(e); clearErr('zip'); }}
                          autoComplete="postal-code"
                        />
                        {errors.zip && <p style={errStyle}>{errors.zip}</p>}
                      </Field>

                      <Field label="Country">
                        <select
                          className={inputCls}
                          style={{ cursor: 'pointer' }}
                          value={formData.country}
                          onChange={(e) => {
                            set('country')(e);
                            // Reset rate when country changes.
                            setFormData((prev) => ({ ...prev, country: e.target.value, shippingRateId: '', shippingRateName: '', shippingRatePrice: null }));
                            setRates([]);
                          }}
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="MX">Mexico</option>
                          <option value="GB">United Kingdom</option>
                          <option value="AU">Australia</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </Field>
                    </div>

                    {/* Refresh rates button */}
                    <div style={{ marginBottom: '24px' }}>
                      <button
                        type="button"
                        onClick={() => fetchShippingRates(formData)}
                        disabled={ratesLoading || !formData.address || !formData.city || !formData.state || !formData.zip}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '3px',
                          border: '1px solid var(--primary-600)',
                          background: 'transparent',
                          color: 'var(--primary-600)',
                          cursor: (!formData.address || !formData.city || !formData.state || !formData.zip) ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem', fontWeight: 700,
                          opacity: (!formData.address || !formData.city || !formData.state || !formData.zip) ? 0.45 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {ratesLoading ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Calculating…
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.42"/>
                            </svg>
                            {rates.length > 0 ? 'Refresh Rates' : 'Get Shipping Rates'}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Rate options */}
                    {ratesError && (
                      <p style={{ fontSize: '0.82rem', color: '#ef4444', marginBottom: '16px' }}>{ratesError}</p>
                    )}
                    {rates.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,23,42,0.45)', marginBottom: '10px' }}>
                          Select Shipping Option
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {rates.map((rate) => {
                            const active = formData.shippingRateId === rate.id;
                            return (
                              <label
                                key={rate.id}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  borderRadius: '6px',
                                  border: active ? '2px solid var(--primary-600)' : '1.5px solid rgba(15,23,42,0.14)',
                                  background: active ? 'rgba(37,99,235,0.04)' : 'white',
                                  cursor: 'pointer',
                                  transition: 'border-color 0.15s, background 0.15s',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <input
                                    type="radio"
                                    name="shippingRate"
                                    value={rate.id}
                                    checked={active}
                                    onChange={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        shippingRateId:    rate.id,
                                        shippingRateName:  rate.name,
                                        shippingRatePrice: rate.price,
                                      }));
                                      clearErr('shippingRateId');
                                    }}
                                    style={{ accentColor: 'var(--primary-600)', width: '16px', height: '16px', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: '0.875rem', fontWeight: active ? 700 : 500, color: 'black' }}>
                                    {rate.name}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '0.875rem', fontWeight: 700,
                                  color: rate.price === 0 ? '#16a34a' : 'black',
                                  whiteSpace: 'nowrap', marginLeft: '12px',
                                }}>
                                  {rate.price === 0 ? 'FREE' : `$${rate.price.toFixed(2)}`}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {errors.shippingRateId && <p style={errStyle}>{errors.shippingRateId}</p>}
                      </div>
                    )}
                    {rates.length === 0 && !ratesLoading && !ratesError && (
                      <p style={{ fontSize: '0.82rem', color: 'rgba(15,23,42,0.45)', marginTop: '4px' }}>
                        Enter your address above then click <strong>Get Shipping Rates</strong> to see available options.
                      </p>
                    )}
                  </div>
                )}

                {/* ── STEP 5: Review & Submit ── */}
                {step === 5 && (
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
                      <ReviewRow label="Contact Via" value={formData.contactPreference === 'email' ? 'Email' : formData.contactPreference === 'phone' ? 'Phone' : 'Either'} />
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
                      <ReviewRow label="Details & Notes" value={formData.issueDescription} />
                      {photos.length > 0 && (
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
                            Photos
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {photos.map((p) => (
                              <img
                                key={p.id}
                                src={p.preview}
                                alt={p.name}
                                style={{
                                  width: '60px', height: '60px',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(15,23,42,0.12)',
                                }}
                              />
                            ))}
                            <span style={{ fontSize: '0.78rem', color: 'rgba(15,23,42,0.5)', alignSelf: 'center' }}>
                              {photos.length} photo{photos.length !== 1 ? 's' : ''} attached
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shipping section */}
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
                        Return Shipping
                      </div>
                      <ReviewRow label="Address"    value={formData.address} />
                      <ReviewRow label="City"       value={formData.city} />
                      <ReviewRow label="State"      value={formData.state} />
                      <ReviewRow label="ZIP"        value={formData.zip} />
                      <ReviewRow label="Country"    value={formData.country} />
                      <ReviewRow
                        label="Shipping Option"
                        value={formData.shippingRateName
                          ? `${formData.shippingRateName} — ${formData.shippingRatePrice === 0 ? 'FREE' : `$${Number(formData.shippingRatePrice).toFixed(2)}`}`
                          : ''}
                      />
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

                    {/* Submit error */}
                    {submitError && (
                      <div style={{
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        padding: '12px 16px',
                        marginTop: '12px',
                        fontSize: '0.875rem',
                        color: '#dc2626',
                      }}>
                        {submitError}
                      </div>
                    )}
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

                  {step < 5 ? (
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
                      disabled={submitting}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                    >
                      {submitting ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          Submitting…
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                          Submit Repair Request
                        </>
                      )}
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
