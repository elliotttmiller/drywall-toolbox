import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import SEOHead from '../components/shared/SEOHead';
import { SCHEMATIC_DEFINITIONS } from '../data/schematicMappings';
import veeqoService from '../services/veeqo';
import { useAuthContext } from '../auth/AuthContext.js';
import { getMembershipStatus, MEMBERSHIP_TIERS } from '../api/membership.js';

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
  // serviceType: human-readable label displayed in Step 5 Review (e.g. "Standard Repair ($85–$195)")
  // pricingTierId: machine-readable tier id for logic/validation (e.g. "standard")
  // Both set together when the user picks a tier card in Step 3.
  serviceType: '', pricingTierId: '', priority: '', issueStart: '', issueDescription: '',
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
// ─── Authoritative repair pricing — sourced from DTB_Strategy_Overview.md ────
// Display rules:
//   • "Best Value" tag on the recommended tier per category
//   • Auto Taper anchor line displayed when toolCategory is an auto taper
//   • Member discounts (10% / 15%) shown only to authenticated members in Step 5

export const REPAIR_PRICING = {
  autoTaper: {
    label: 'Auto Taper',
    anchor: { newPrice: 1899, rebuildPrice: 299, savePct: 84 },
    tiers: [
      { id: 'qt',  name: 'Quick Fix',         price: 75,  desc: 'Adjustments, cable & blade swap, minor fixes',        badge: null },
      { id: 'sr',  name: 'Standard Rebuild',  price: 299, desc: 'Full head rebuild — covers most worn-out tapers',     badge: 'Best Value' },
      { id: 'po',  name: 'Premium Overhaul',  price: 499, desc: 'Complete overhaul including wear kit + all seals',    badge: null },
      { id: 'ftu', name: 'Factory Tune-Up',   price: 179, desc: 'Deep clean, lube, calibrate — no parts replacement',  badge: null },
    ],
  },
  flatBoxes: {
    label: 'Flat & Angle Boxes',
    tiers: [
      { id: 'fr',  name: 'Refresh',           price: 49,  desc: 'Clean, adjust, test — blade & gate check',           badge: null },
      { id: 'rb',  name: 'Rebuild',           price: 89,  desc: 'Full disassembly, worn parts replaced',              badge: 'Best Value' },
      { id: 'pp',  name: 'Pro Package',       price: 149, desc: 'Three boxes rebuilt — best rate per unit',           badge: '3-Box Bundle' },
      { id: 'tub', name: 'Tune-Up',           price: 59,  perUnit: true, desc: 'Per-box deep clean + lube service',   badge: null },
    ],
  },
  mudPumps: {
    label: 'Mud Pumps',
    tiers: [
      { id: 'ss',  name: 'Seal & Screen',     price: 59,  desc: 'Seal replacement + screen clean — most common fix',  badge: null },
      { id: 'fr2', name: 'Full Rebuild',      price: 119, desc: 'Complete pump teardown, all wear parts replaced',    badge: 'Best Value' },
      { id: 'ph',  name: 'Pump + Hose',       price: 159, desc: 'Full rebuild including hose replacement',            badge: null },
      { id: 'ps',  name: 'Preventive',        price: 79,  desc: 'Pre-season service — seals, screen, lubrication',   badge: null },
    ],
  },
  handles: {
    label: 'Handles & Accessories',
    tiers: [
      { id: 'hr',  name: 'Handle Rebuild',    price: 49,  desc: 'Standard handle rebuild with new hardware',          badge: null },
      { id: 'gn',  name: 'Gooseneck',         price: 39,  desc: 'Gooseneck corner tool rebuild',                      badge: null },
      { id: 'cf',  name: 'Corner Flusher',    price: 69,  desc: 'Corner flusher full service',                        badge: null },
      { id: 'ns',  name: 'Nail Spotter',      price: 45,  desc: 'Nail spotter rebuild',                               badge: null },
      { id: 'bu',  name: 'Tool Bundle',       price: 99,  desc: 'Any three handles serviced together',                badge: 'Bundle Savings' },
    ],
  },
  diagnostic: {
    label: 'Diagnostic',
    tiers: [
      { id: 'dx', name: 'Diagnostic / Bench Fee', priceMin: 50, priceMax: 75,
        desc: 'Full inspection and written quote. Fee credited toward repair cost if you approve.', badge: null },
    ],
  },
};

// ─── Full pricing tab data — sourced from research_repairs.md ────────────────
export const PRICING_TAB_DATA = [
  {
    id: 'autoTaper',
    label: 'Auto Tapers',
    shortLabel: 'Auto Tapers',
    anchor: { newPrice: '$1,899', rebuildPrice: '$299', savePct: '84%' },
    note: 'Rebuild vs. new taper: save up to 84% with a Standard Rebuild',
    tiers: [
      {
        id: 'qt', name: 'Quick Fix', price: '$75', badge: null,
        target: 'Ideal for minor symptoms and straightforward fixes',
        features: ['Blade + cable replacement', 'Lubrication service', 'Minor adjustments'],
      },
      {
        id: 'sr', name: 'Standard Rebuild', price: '$299', badge: 'Best Value',
        target: 'Most common service for worn-out tapers',
        features: ['Wheels, bushings & liners', 'Plunger cup, cable & blade', 'Needle + calibration', 'Full wear-kit replacement'],
      },
      {
        id: 'po', name: 'Premium Overhaul', price: '$499', badge: null,
        target: 'Ideal for high-volume professionals and fleet operators',
        features: ['Everything in Standard Rebuild', 'Chain/sprocket inspection', 'Tube flip option', 'Priority turnaround', '90-day workmanship warranty'],
      },
      {
        id: 'ftu', name: 'Factory Tune-Up', price: '$179', badge: null,
        target: 'Preventive care for maintenance-focused contractors',
        features: ['Deep cleaning & inspection', '11+ wear-part replacements', 'Performance report', 'Lubrication & calibration'],
      },
    ],
  },
  {
    id: 'flatBoxes',
    label: 'Flat & Angle Boxes',
    shortLabel: 'Flat Boxes',
    anchor: null,
    note: 'Bundle: Rebuild 3 boxes, get the 4th at 50% off',
    tiers: [
      {
        id: 'bwr', name: 'Blade & Wheel Refresh', price: '$49', badge: null,
        target: 'Quick performance boost',
        features: ['New blades + wheels', 'Basic adjustment & test', 'Clean & lubricate'],
      },
      {
        id: 'fbr', name: 'Full Box Rebuild', price: '$89', badge: 'Best Value',
        target: 'Standard repair for streaking or drag issues',
        features: ['Blades, wheels & skids', 'Springs, seals & O-rings', 'Full calibration', 'Comprehensive teardown'],
      },
      {
        id: 'pbp', name: 'Pro Box Package', price: '$149', badge: '3-Box Bundle',
        target: 'Best value for multiple boxes',
        features: ['Full rebuild on 3 boxes', 'Free handle inspection', '60-day workmanship warranty', 'Best rate per unit'],
      },
      {
        id: 'abtu', name: 'Annual Box Tune-Up', price: '$59/box', badge: null,
        target: 'Preventive maintenance plan',
        features: ['Preventive cleaning', 'Wear inspection', 'Minor adjustments', 'Per-box service'],
      },
    ],
  },
  {
    id: 'mudPumps',
    label: 'Mud Pumps',
    shortLabel: 'Mud Pumps',
    anchor: null,
    note: 'Comprehensive fluid system servicing for all major pump brands',
    tiers: [
      {
        id: 'sss', name: 'Seal & Screen Service', price: '$59', badge: null,
        target: 'Recommended for minor flow issues',
        features: ['Gaskets & u-cups', 'Screens & valve discs', 'Pressure test'],
      },
      {
        id: 'fpr', name: 'Full Pump Rebuild', price: '$119', badge: 'Best Value',
        target: 'Recommended for weak pressure or leakage',
        features: ['Complete disassembly', 'All wear parts replaced', 'Housing inspection', 'Flow calibration'],
      },
      {
        id: 'php', name: 'Pump + Hose Package', price: '$159', badge: null,
        target: 'Comprehensive fluid system service',
        features: ['Full pump rebuild', 'Hose inspection/repair', 'Fittings check', 'End-to-end fluid test'],
      },
      {
        id: 'ppt', name: 'Preventive Pump Tune', price: '$79', badge: null,
        target: 'Ideal for high-volume users preventing downtime',
        features: ['Cleaning & inspection', 'Seal inspection', 'Screen replacement', 'Lubrication'],
      },
    ],
  },
  {
    id: 'handles',
    label: 'Handles & Accessories',
    shortLabel: 'Accessories',
    anchor: null,
    note: 'Bundle: Handle + Gooseneck + Corner Flusher = $99 (save $38)',
    tiers: [
      {
        id: 'hr2', name: 'Handle Rebuild', price: '$49', badge: null,
        target: 'Any handle length',
        features: ['Brake adjusters', 'Springs & washers', 'Couplers', 'Any standard length'],
      },
      {
        id: 'gns', name: 'Gooseneck Service', price: '$39', badge: null,
        target: 'Corner tool stability',
        features: ['Pivot bushings', 'Tension adjustment', 'Lubrication'],
      },
      {
        id: 'cfr', name: 'Corner Flusher Rebuild', price: '$69', badge: null,
        target: 'Corner finishing quality',
        features: ['Blades & springs', 'Pivot point service', 'Calibration'],
      },
      {
        id: 'nss', name: 'Nail Spotter Service', price: '$45', badge: null,
        target: 'Consistent spotting results',
        features: ['Plunger service', 'Seal replacement', 'Trigger mechanism'],
      },
      {
        id: 'ab2', name: 'Accessory Bundle', price: '$99', badge: 'Bundle Savings',
        target: 'Complete accessory overhaul',
        features: ['Handle + Gooseneck + Corner Flusher', 'Save $38 vs individual', 'All three rebuilt together'],
      },
    ],
  },
  {
    id: 'shipping',
    label: 'Shipping & Logistics',
    shortLabel: 'Shipping',
    anchor: null,
    note: 'Transparent pricing — no hidden fees or surprise surcharges',
    tiers: [
      {
        id: 'srs', name: 'Standard Return Shipping', price: 'Actual cost', badge: null,
        target: 'Available to all customers',
        features: ['Customer pays actual carrier cost', 'Transparent; no markup', 'USPS, FedEx, or UPS'],
      },
      {
        id: 'er', name: 'Expedited Return (2-Day)', price: '+$25 flat', badge: 'Popular',
        target: 'Ideal for urgent jobs and tight deadlines',
        features: ['2-day air return', '+$25 flat fee', 'Track every step'],
      },
      {
        id: 'iu', name: 'Insurance Upgrade', price: '+$15', badge: null,
        target: 'Recommended for tools valued over $500',
        features: ['Full declared value coverage'],
      },
      {
        id: 'pk', name: 'Packaging Kit (Pre-Paid)', price: '$12 credit', badge: null,
        target: 'Ideal for first-time shippers',
        features: ['Pre-paid packaging supplied', '$12 credited toward repair'],
      },
      {
        id: 'ldp', name: 'Local Drop-Off / Pick-Up', price: 'FREE', badge: 'Free',
        target: 'Available to local customers',
        features: ['No shipping required', 'Fastest turnaround option'],
      },
    ],
  },
];

// Copy blocks — trust signals and pricing anchor
const REPAIR_COPY = {
  anchor:         'New Taper: ~$1,899  |  Standard Rebuild: $299  —  Save 84%',
  partsLock:      'All replacement parts quoted and locked before work begins. No surprise invoices.',
  noCharge:       'No charges until you review and approve your final quote.',
  sustainability: 'Every rebuilt tool keeps ~2.5 lbs of steel out of the landfill.',
  warrantyBase:   '15-day workmanship warranty on all repairs.',
  warrantyPro:    '30-day warranty — Professional members.',
  warrantyFleet:  '60-day warranty — Fleet members.',
};

const MAINTENANCE_SCHEDULE = [
  { level: 'High-Volume Pro', usage: '6+ rolls (500 ft) / day', interval: 'Every 6 months', badge: 'Heavy' },
  { level: 'Standard Pro', usage: '4–10 rolls / week', interval: 'Annually', badge: 'Regular' },
  { level: 'Occasional User', usage: '<4 rolls / week', interval: 'Every 18–24 months', badge: 'Light' },
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
          borderRadius: '8px',
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
   Multi-tab pricing component — shows all repair categories with tier cards
   ───────────────────────────────────────────────────────────────────────── */
const tabPanelVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: [0.36, 0, 0.66, 0] } },
};

function PricingTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = PRICING_TAB_DATA[activeTab];

  return (
    <div>
      {/* Tab navigation */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '28px' }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          minWidth: 'max-content',
          padding: '4px',
          background: 'rgba(15,23,42,0.04)',
          borderRadius: '10px',
          border: '1px solid var(--machined-border)',
        }}>
          {PRICING_TAB_DATA.map((t, i) => {
            const active = i === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(12px, 2.5vw, 18px)',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 500,
                  fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
                  background: active ? 'white' : 'transparent',
                  color: active ? 'var(--primary-600)' : 'rgba(15,23,42,0.55)',
                  boxShadow: active ? '0 1px 6px rgba(15,23,42,0.1)' : 'none',
                  letterSpacing: active ? '0.01em' : 'normal',
                }}
              >
                <span className="tab-label-full" style={{ display: 'block' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note bar */}
      {tab.note && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'rgba(37,99,235,0.05)',
          border: '1px solid rgba(37,99,235,0.15)',
          borderRadius: '12px',
          marginBottom: '20px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-600)', fontWeight: 600 }}>{tab.note}</span>
        </div>
      )}

      {/* Tab content with animation */}
      <AnimatePresence mode="wait" initial={false}>
        <Motion.div
          key={tab.id}
          variants={tabPanelVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(220px, 28vw, 280px), 1fr))',
            gap: '16px',
          }}>
            {tab.tiers.map((tier) => {
              const isBestValue = tier.badge === 'Best Value';
              const isFree = tier.price === 'FREE';
              return (
                <div
                  key={tier.id}
                  style={{
                    background: isBestValue ? 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)' : 'white',
                    border: isBestValue ? '2px solid var(--primary-600)' : '1px solid var(--machined-border)',
                    borderRadius: '10px',
                    padding: 'clamp(16px, 3vw, 22px)',
                    position: 'relative',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = isBestValue
                      ? '0 8px 32px rgba(37,99,235,0.2)'
                      : '0 6px 24px rgba(15,23,42,0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div style={{
                      position: 'absolute',
                      top: '-11px',
                      right: '14px',
                      background: isBestValue ? 'var(--primary-600)'
                        : tier.badge === 'Bundle Savings' || tier.badge === '3-Box Bundle' ? '#f59e0b'
                        : tier.badge === 'Free' ? '#16a34a'
                        : tier.badge === 'Popular' ? '#8b5cf6'
                        : '#64748b',
                      color: 'white',
                      borderRadius: '999px',
                      padding: '3px 11px',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                      {tier.badge}
                    </div>
                  )}

                  {/* Name + Price */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: 'clamp(0.875rem, 1.8vw, 0.95rem)',
                      fontWeight: 800,
                      color: isBestValue ? 'var(--primary-600)' : '#0f172a',
                      lineHeight: 1.3,
                      flex: 1,
                      paddingRight: '8px',
                    }}>
                      {tier.name}
                    </h4>
                    <span style={{
                      fontSize: 'clamp(1rem, 2.2vw, 1.2rem)',
                      fontWeight: 900,
                      color: isFree ? '#16a34a' : isBestValue ? 'var(--primary-600)' : '#0f172a',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {tier.price}
                    </span>
                  </div>

                  {/* Target */}
                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '0.75rem',
                    color: 'rgba(15,23,42,0.5)',
                    lineHeight: 1.4,
                    fontStyle: 'italic',
                  }}>
                    {tier.target}
                  </p>

                  {/* Feature list */}
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tier.features.map((feat) => (
                      <li key={feat} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '7px',
                        fontSize: '0.78rem',
                        color: 'rgba(15,23,42,0.7)',
                        lineHeight: 1.45,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBestValue ? 'var(--primary-600)' : '#16a34a'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Motion.div>
      </AnimatePresence>

      {/* Disclaimer */}
      <p style={{
        fontSize: '0.72rem',
        color: 'rgba(15,23,42,0.38)',
        marginTop: '20px',
        lineHeight: 1.6,
      }}>
        * All prices are industry estimates. Actual costs may vary based on tool condition, parts availability, and findings during disassembly.
        Budget an extra 20–30% for potential "hard parts" (chains, sprockets, shafts). No charges until you approve your quote.
      </p>
    </div>
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

  // Auth + membership state
  const { user, isAuthenticated } = useAuthContext();
  const [membershipStatus, setMembershipStatus] = useState(null);

  // Fetch membership status once user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      getMembershipStatus(user.id).then(setMembershipStatus).catch(() => {});
    }
  }, [isAuthenticated, user?.id]);

  // Derive which REPAIR_PRICING category maps to the selected toolCategory
  const repairCategory = useMemo(() => {
    const cat = (formData.toolCategory || '').toLowerCase();
    if (/auto.?tap/i.test(cat)) return 'autoTaper';
    if (/flat|angle/i.test(cat)) return 'flatBoxes';
    if (/pump/i.test(cat)) return 'mudPumps';
    if (/handle|corner|nail|gooseneck|flusher|spotter/i.test(cat)) return 'handles';
    return 'diagnostic';
  }, [formData.toolCategory]);

  // Pricing tier selection helper
  function selectTier(tier) {
    const priceDisplay = tier.priceMin
      ? `$${tier.priceMin}–$${tier.priceMax}`
      : `$${tier.price}${tier.perUnit ? '/box' : ''}`;
    setFormData((prev) => ({
      ...prev,
      serviceType:    `${tier.name} (${priceDisplay})`,
      pricingTierId:  tier.id,
    }));
    setErrors((prev) => { const n = { ...prev }; delete n.serviceType; return n; });
  }

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
        description="Professional drywall tool repair services and guides. Find repair solutions for TapeTech, Columbia, Asgard, Graco, and other professional drywall finishing tools."
        canonical="https://drywalltoolbox.com/repairs"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)',
        padding: 'clamp(60px, 10vw, 100px) clamp(1.5rem, 5vw, 3rem)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid dot overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '40px 40px', pointerEvents: 'none',
        }} />
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '420px', height: '420px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '10%',
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(29,78,216,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
            gap: 'clamp(2rem, 5vw, 4rem)',
            alignItems: 'center',
          }}>
            {/* Left: copy */}
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
                Tool Repair & Maintenance
              </div>
              <h1 style={{
                color: 'white',
                fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
                fontWeight: 900, margin: '0 0 16px 0',
                lineHeight: 1.08, letterSpacing: '-0.035em',
              }}>
                KEEP YOUR TOOLS<br />
                <span style={{ color: '#93c5fd' }}>RUNNING STRONG.</span>
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
                margin: '0 0 32px 0',
                lineHeight: 1.6,
                maxWidth: '480px',
              }}>
                Professional drywall tool repair for automatic tapers, flat boxes, mud pumps, and accessories.
                Transparent pricing, 90-day warranty, no charges until you approve.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="alloy-button"
                  style={{ background: 'white', color: '#1e3a8a', border: 'none', cursor: 'pointer', fontWeight: 800, flex: '1 1 0', minWidth: 0 }}
                  onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Request Repair
                </button>
                <button
                  type="button"
                  className="alloy-button"
                  style={{ background: 'white', color: '#1e3a8a', border: 'none', cursor: 'pointer', fontWeight: 800, flex: '1 1 0', minWidth: 0 }}
                  onClick={() => {
                    document.getElementById('pricing-tabs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Tabs ────────────────────────────────────────────────── */}
      <section
        id="pricing-tabs-section"
        style={{
          background: 'var(--alloy-base)',
          borderTop: '1px solid var(--machined-border)',
          padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 3rem)',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '99px', padding: '5px 16px',
              fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--primary-600)', marginBottom: '14px',
            }}>
              Industry Pricing Reference
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
            }}>
              Repair Pricing
            </h2>
          </div>
          <PricingTabs />
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
              borderRadius: '99px', padding: '5px 16px',
              fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--primary-600)', marginBottom: '14px',
            }}>
              Repair Service Request
            </div>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 900, color: '#0f172a',
              margin: '0 0 12px 0', letterSpacing: '-0.025em',
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
              borderRadius: '16px',
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
                  borderRadius: '12px',
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

                    {/* Service Tier Cards */}
                    <div style={{ marginBottom: '24px' }}>
                      <label className="machined-label" style={{ color: 'var(--primary-600)', marginBottom: 10, display: 'block' }}>
                        Service Type <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>
                      </label>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '12px',
                      }}>
                        {(REPAIR_PRICING[repairCategory]?.tiers || []).map((tier) => {
                          const selected = formData.pricingTierId === tier.id;
                          return (
                            <div
                              key={tier.id}
                              onClick={() => selectTier(tier)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && selectTier(tier)}
                              style={{
                                border: `2px solid ${selected ? 'var(--primary-600)' : 'rgba(15,23,42,0.1)'}`,
                                borderRadius: '14px',
                                padding: '16px',
                                cursor: 'pointer',
                                position: 'relative',
                                background: selected ? '#eff6ff' : 'white',
                                transition: 'border-color 0.2s, background 0.2s',
                              }}
                            >
                              {tier.badge && (
                                <div style={{
                                  position: 'absolute', top: -10, right: 12,
                                  background: tier.badge === 'Best Value' ? '#16a34a' : '#f59e0b',
                                  color: 'white', borderRadius: '999px',
                                  padding: '2px 10px', fontSize: '0.65rem', fontWeight: 700,
                                }}>
                                  {tier.badge}
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{tier.name}</span>
                                <span style={{ fontWeight: 800, color: 'var(--primary-600)', fontSize: '1.05rem', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                                  {tier.priceMin ? `$${tier.priceMin}–$${tier.priceMax}` : `$${tier.price}${tier.perUnit ? '/box' : ''}`}
                                </span>
                              </div>
                              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'rgba(15,23,42,0.55)' }}>
                                {tier.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {errors.serviceType && <p style={errStyle}>{errors.serviceType}</p>}
                    </div>

                    {/* Trust signal row */}
                    <div style={{
                      display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px',
                      padding: '14px 16px', background: '#f8fafc', borderRadius: '12px',
                      borderLeft: '3px solid var(--primary-600)',
                    }}>
                      {[REPAIR_COPY.noCharge, REPAIR_COPY.partsLock, REPAIR_COPY.sustainability].map((copy) => (
                        <span key={copy} style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {copy}
                        </span>
                      ))}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0 20px',
                    }}>
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
                      borderRadius: '12px',
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
                          borderRadius: '10px',
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
                                  borderRadius: '12px',
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
                      borderRadius: '12px',
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
                      borderRadius: '12px',
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
                      borderRadius: '12px',
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
                                  borderRadius: '8px',
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

                    {/* ProCare member discount preview — only for pro/fleet members */}
                    {membershipStatus && membershipStatus.tier !== 'essential' && (
                      <div style={{
                        padding: '12px 16px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '12px',
                        marginBottom: '16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8' }}>
                            {MEMBERSHIP_TIERS[membershipStatus.tier]?.name} Member Discount
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(15,23,42,0.6)' }}>
                          Your {((MEMBERSHIP_TIERS[membershipStatus.tier]?.laborDiscount || 0) * 100).toFixed(0)}% labor
                          {membershipStatus.tier === 'fleet' ? ' + parts' : ''} discount will be automatically applied
                          to your final invoice. Estimated savings shown after diagnostic.
                          {membershipStatus.tier === 'professional' ? ' 30-day workmanship warranty.' : ' 60-day workmanship warranty.'}
                        </p>
                      </div>
                    )}

                    {/* Shipping section */}
                    <div style={{
                      background: 'var(--alloy-base)',
                      border: '1px solid var(--machined-border)',
                      borderRadius: '12px',
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
                        borderRadius: '12px',
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
                        borderRadius: '10px',
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
        background: 'white',
        borderTop: '1px solid var(--machined-border)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(1.5rem, 3vw, 2rem)' }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 900,
              color: '#0f172a',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em',
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
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>{ql.title}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'rgba(15,23,42,0.6)', margin: '0 0 16px 0', lineHeight: 1.5, flex: 1 }}>{ql.description}</p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    color: 'var(--primary-600)', fontSize: '0.75rem',
                    fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.08em',
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
