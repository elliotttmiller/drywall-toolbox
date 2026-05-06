/**
 * toolsetTemplates.js
 *
 * Defines the "set type" templates for the Toolset Builder.
 * Each template mirrors the GLTT "build-your-own-set" model:
 *   - A named set type (Full Set, Finishing Set, Taping Set, etc.)
 *   - Ordered configurable SLOTS (required + optional) the user selects ONE product from
 *   - "Always included" accessories (non-selectable, bundled free)
 *   - A product-filter function per slot that matches real catalog products
 *
 * GLTT set types mapped per brand:
 *   TapeTech:   Full Set, Finishing Set, Taping Set
 *   Columbia:   Full Set, Finishing Set, Taping Set, Flat Box Set
 *   Level 5:    Full Set, Finishing Set, Flat Box Set
 *   Asgard:     Full Set, Finishing Set
 */

// ── Slot icon keys (mapped to lucide-react icons in the component) ────────────
// 'taper' | 'flatbox' | 'cornerbox' | 'anglehead' | 'handle' | 'roller' | 'pump' | 'tool'

// ── Keyword-based slot product filters ──────────────────────────────────────────
// Each filter receives a normalized product name (lowercase) and returns boolean.

function nameContains(str) {
  return (name) => name.includes(str);
}
function nameContainsAny(...strs) {
  return (name) => strs.some((s) => name.includes(s));
}
function nameContainsAllOf(...strs) {
  return (name) => strs.every((s) => name.includes(s));
}
function nameContainsButNot(must, ...nots) {
  return (name) => must.every((m) => name.includes(m)) && !nots.some((n) => name.includes(n));
}

// ── TapeTech slot filters ─────────────────────────────────────────────────────
const TT = {
  taper:           nameContainsButNot(['taper'], 'angle', 'corner', 'roller', 'handle', 'pump', 'filler', 'gooseneck', 'adapter', 'part'),
  flatBox:         nameContainsAny('flat box', 'finishing box', '7" box', '8" box', '10" box', '12" box', '14" box', '7-inch box', '10-inch box', '12-inch box'),
  boxHandle:       (name) => (name.includes('box handle') || (name.includes('handle') && name.includes('box'))) && !name.includes('corner') && !name.includes('angle'),
  angleHead:       (name) => name.includes('angle head') && !name.includes('handle') && !name.includes('adapter') && !name.includes('part'),
  cornerApplicator:(name) => (name.includes('corner applicator') || (name.includes('corner box') && !name.includes('handle'))) && !name.includes('part'),
  angleHeadHandle: nameContainsAllOf('angle head', 'handle'),
  rollerHandle:    (name) => name.includes('roller') && name.includes('handle') && !name.includes('corner'),
  cornerHandle:    (name) => (name.includes('corner') && name.includes('handle')) && (name.includes('applicator') || name.includes('box') || name.includes('roller')),
};

// ── Columbia slot filters ─────────────────────────────────────────────────────
const COL = {
  taper:         nameContainsButNot(['taper'], 'angle', 'corner', 'roller', 'handle', 'pump', 'filler', 'gooseneck', 'adapter', 'part'),
  flatBox:       nameContainsAny('flat box', 'finishing box', '7"', '8"', '10"', '12"', '14"'),
  boxHandle:     (name) => (name.includes('box handle') || (name.includes('handle') && name.includes('box'))) && !name.includes('corner') && !name.includes('angle'),
  angleHead:     (name) => name.includes('angle head') && !name.includes('handle') && !name.includes('adapter'),
  cornerBox:     (name) => name.includes('corner box') && !name.includes('handle'),
  angleHeadHandle: nameContainsAllOf('angle head', 'handle'),
  rollerHandle:  (name) => name.includes('roller') && name.includes('handle') && !name.includes('corner'),
  cornerBoxHandle: (name) => name.includes('corner') && name.includes('handle') && (name.includes('box') || name.includes('roller')),
};

// ── Level 5 slot filters ──────────────────────────────────────────────────────
const L5 = {
  flatBox:    nameContainsAny('flat box', 'finishing box', 'skimming box'),
  boxHandle:  (name) => name.includes('handle') && (name.includes('box') || name.includes('flat')),
  angleHead:  (name) => name.includes('angle head') && !name.includes('handle'),
  cornerBox:  (name) => name.includes('corner') && !name.includes('handle'),
  handle:     (name) => name.includes('handle'),
};

// ── Asgard slot filters ───────────────────────────────────────────────────────
const ASG = {
  taper:      nameContainsButNot(['taper'], 'handle', 'part'),
  flatBox:    nameContainsAny('flat box', 'finishing box'),
  boxHandle:  (name) => name.includes('handle') && name.includes('box'),
  angleHead:  (name) => name.includes('angle head') && !name.includes('handle'),
  cornerBox:  (name) => name.includes('corner') && !name.includes('handle'),
};

// ── Slot icons ────────────────────────────────────────────────────────────────
export const SLOT_ICON = {
  taper:           'taper',
  flatBox:         'flatbox',
  flatBox2:        'flatbox',
  boxHandle:       'handle',
  boxHandle2:      'handle',
  angleHead:       'anglehead',
  angleHead2:      'anglehead',
  cornerApplicator:'cornerbox',
  cornerBox:       'cornerbox',
  angleHeadHandle: 'handle',
  rollerHandle:    'roller',
  cornerHandle:    'handle',
  cornerBoxHandle: 'handle',
  cornerApplicatorHandle: 'handle',
  rollerHandle2:   'roller',
};

// ── SET TEMPLATES ─────────────────────────────────────────────────────────────
// Structure:
//   id           : unique string
//   brand        : matches product.brand in catalog
//   name         : human-readable set name
//   scope        : 'full' | 'finishing' | 'taping' | 'flatbox'
//   description  : one-line description
//   tagline      : marketing tagline shown in set card
//   shipping     : 'FREE'
//   savingsLabel : e.g. '5% off'
//   slots        : array of { id, label, required, icon, hint, filter(lowerName) }
//   alwaysIncluded: array of strings (accessory names)
//   recommendedFor: short string (e.g. "Finishing crews", "Full-time tapers")

export const SET_TEMPLATES = [

  // ── TapeTech Full Set ───────────────────────────────────────────────────────
  {
    id:          'tapetech-full',
    brand:       'TapeTech',
    name:        'TapeTech® Custom Full Set',
    scope:       'full',
    description: 'Choose your own taper, flat boxes, angle heads, corner applicator, and handles.',
    tagline:     'Everything from taping to finishing — fully configured your way.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Full-time automatic taping crews',
    slots: [
      { id: 'taper',                   label: 'Automatic Taper',              required: true,  icon: 'taper',    hint: 'The taper applies tape and mud in one pass.',             filter: TT.taper },
      { id: 'flatBox',                 label: 'Flat Box #1',                  required: true,  icon: 'flatbox',  hint: 'Choose your primary flat finishing box size.',             filter: TT.flatBox },
      { id: 'flatBox2',                label: 'Flat Box #2 (Optional)',        required: false, icon: 'flatbox',  hint: 'Add a second flat box for faster two-coat finishing.',     filter: TT.flatBox },
      { id: 'boxHandle',               label: 'Flat Box Handle',              required: true,  icon: 'handle',   hint: 'Controls the angle and reach of your flat boxes.',         filter: TT.boxHandle },
      { id: 'boxHandle2',              label: 'Second Box Handle (Optional)', required: false, icon: 'handle',   hint: 'Match with your second flat box selection.',               filter: TT.boxHandle },
      { id: 'angleHead',               label: 'Angle Head',                   required: true,  icon: 'anglehead',hint: 'Finishes inside angles where walls meet.',                 filter: TT.angleHead },
      { id: 'angleHead2',              label: 'Second Angle Head (Optional)', required: false, icon: 'anglehead',hint: 'Having two angle heads speeds up inside angle work.',       filter: TT.angleHead },
      { id: 'cornerApplicator',        label: 'Corner Applicator',            required: true,  icon: 'cornerbox',hint: 'Applies mud to outside and inside corners.',               filter: TT.cornerApplicator },
      { id: 'angleHeadHandle',         label: 'Angle Head Handle',            required: true,  icon: 'handle',   hint: 'Extends reach for ceiling angle work.',                   filter: TT.angleHeadHandle },
      { id: 'rollerHandle',            label: 'Roller Handle',                required: true,  icon: 'roller',   hint: 'Used with the inside corner roller.',                     filter: TT.rollerHandle },
      { id: 'cornerApplicatorHandle',  label: 'Corner Applicator Handle',     required: true,  icon: 'handle',   hint: 'Provides leverage when applying corner mud.',             filter: TT.cornerHandle },
    ],
    alwaysIncluded: [
      'TapeTech® EasyClean® Loading Pump',
      'TapeTech® Filler Adapter',
      'TapeTech® Gooseneck Adapter',
      'TapeTech® Inside Corner Roller',
      'TapeTech® Corner Finisher Adapter',
    ],
  },

  // ── TapeTech Finishing Set ──────────────────────────────────────────────────
  {
    id:          'tapetech-finishing',
    brand:       'TapeTech',
    name:        'TapeTech® Custom Finishing Set',
    scope:       'finishing',
    description: 'Choose your own flat boxes, angle heads, corner applicator, and handles. No taper.',
    tagline:     'Perfect for dedicated finishing crews — boxes, angles, and corners.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Dedicated finishing crews',
    slots: [
      { id: 'flatBox',                 label: 'Flat Box #1',                  required: true,  icon: 'flatbox',  hint: 'Choose your primary flat finishing box size.',             filter: TT.flatBox },
      { id: 'flatBox2',                label: 'Flat Box #2 (Optional)',        required: false, icon: 'flatbox',  hint: 'Add a second flat box for two-coat work.',                filter: TT.flatBox },
      { id: 'boxHandle',               label: 'Flat Box Handle',              required: true,  icon: 'handle',   hint: 'Controls angle and reach of your flat boxes.',             filter: TT.boxHandle },
      { id: 'boxHandle2',              label: 'Second Box Handle (Optional)', required: false, icon: 'handle',   hint: 'Match with your second flat box.',                         filter: TT.boxHandle },
      { id: 'angleHead',               label: 'Angle Head',                   required: true,  icon: 'anglehead',hint: 'Finishes inside angles where walls meet.',                 filter: TT.angleHead },
      { id: 'angleHead2',              label: 'Second Angle Head (Optional)', required: false, icon: 'anglehead',hint: 'Two angle heads speeds up angle work.',                    filter: TT.angleHead },
      { id: 'cornerApplicator',        label: 'Corner Applicator',            required: true,  icon: 'cornerbox',hint: 'Applies mud to outside and inside corners.',               filter: TT.cornerApplicator },
      { id: 'angleHeadHandle',         label: 'Angle Head Handle',            required: true,  icon: 'handle',   hint: 'Extends reach for ceiling angle work.',                   filter: TT.angleHeadHandle },
      { id: 'rollerHandle',            label: 'Roller Handle',                required: true,  icon: 'roller',   hint: 'Used with the inside corner roller.',                     filter: TT.rollerHandle },
      { id: 'cornerApplicatorHandle',  label: 'Corner Applicator Handle',     required: true,  icon: 'handle',   hint: 'Leverage when applying corner mud.',                      filter: TT.cornerHandle },
    ],
    alwaysIncluded: [
      'TapeTech® EasyClean® Loading Pump',
      'TapeTech® Filler Adapter',
      'TapeTech® Inside Corner Roller',
      'TapeTech® Corner Finisher Adapter',
    ],
  },

  // ── TapeTech Taping Set ─────────────────────────────────────────────────────
  {
    id:          'tapetech-taping',
    brand:       'TapeTech',
    name:        'TapeTech® Custom Taping Set',
    scope:       'taping',
    description: 'Choose your own taper, angle heads, and handles. For taping-only configurations.',
    tagline:     'Tape faster. Built around your taper workflow.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Taping specialists',
    slots: [
      { id: 'taper',           label: 'Automatic Taper',    required: true,  icon: 'taper',    hint: 'The core of the taping set.',             filter: TT.taper },
      { id: 'angleHead',       label: 'Angle Head',         required: true,  icon: 'anglehead',hint: 'Finishes inside angles.',                  filter: TT.angleHead },
      { id: 'angleHeadHandle', label: 'Angle Head Handle',  required: true,  icon: 'handle',   hint: 'Extends reach for angle work.',            filter: TT.angleHeadHandle },
      { id: 'rollerHandle',    label: 'Roller Handle',      required: true,  icon: 'roller',   hint: 'For use with the inside corner roller.',   filter: TT.rollerHandle },
    ],
    alwaysIncluded: [
      'TapeTech® EasyClean® Loading Pump',
      'TapeTech® Gooseneck Adapter',
      'TapeTech® Inside Corner Roller',
      'TapeTech® Corner Finisher Adapter',
    ],
  },

  // ── Columbia Full Set ───────────────────────────────────────────────────────
  {
    id:          'columbia-full',
    brand:       'Columbia Taping Tools',
    name:        'Columbia Custom Full Set',
    scope:       'full',
    description: 'Choose your own taper, flat boxes, angle heads, corner box, and handles.',
    tagline:     'Columbia quality from taping to finishing — every tool, your choice.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Full-time automatic taping crews',
    slots: [
      { id: 'taper',           label: 'Automatic Taper',              required: true,  icon: 'taper',    hint: 'Applies tape and mud simultaneously.',      filter: COL.taper },
      { id: 'flatBox',         label: 'Flat Box #1',                  required: true,  icon: 'flatbox',  hint: 'Choose your primary flat box size.',         filter: COL.flatBox },
      { id: 'flatBox2',        label: 'Flat Box #2 (Optional)',        required: false, icon: 'flatbox',  hint: 'Add a second flat box for two coats.',       filter: COL.flatBox },
      { id: 'boxHandle',       label: 'Flat Box Handle',              required: true,  icon: 'handle',   hint: 'Controls box angle and reach.',              filter: COL.boxHandle },
      { id: 'angleHead',       label: 'Angle Head',                   required: true,  icon: 'anglehead',hint: 'Finishes wall-ceiling angles.',              filter: COL.angleHead },
      { id: 'angleHead2',      label: 'Second Angle Head (Optional)', required: false, icon: 'anglehead',hint: 'Speed up angle work with two heads.',        filter: COL.angleHead },
      { id: 'cornerBox',       label: 'Corner Box',                   required: true,  icon: 'cornerbox',hint: 'Finishes drywall corner joints.',            filter: COL.cornerBox },
      { id: 'angleHeadHandle', label: 'Angle Head Handle',            required: true,  icon: 'handle',   hint: 'Extension for angle head reach.',            filter: COL.angleHeadHandle },
      { id: 'rollerHandle',    label: 'Roller Handle',                required: true,  icon: 'roller',   hint: 'For use with inside corner roller.',         filter: COL.rollerHandle },
      { id: 'cornerBoxHandle', label: 'Corner Box Handle',            required: true,  icon: 'handle',   hint: 'Provides reach for corner box work.',        filter: COL.cornerBoxHandle },
    ],
    alwaysIncluded: [
      'Columbia Hot Mud Pump',
      'Columbia Box Filler',
      'Columbia Gooseneck',
      'Columbia Inside Corner Roller',
      'Columbia Angle Head Adapter',
    ],
  },

  // ── Columbia Finishing Set ──────────────────────────────────────────────────
  {
    id:          'columbia-finishing',
    brand:       'Columbia Taping Tools',
    name:        'Columbia Custom Finishing Set',
    scope:       'finishing',
    description: 'Choose your own flat boxes, angle heads, corner box, and handles.',
    tagline:     'Dedicated finishing power — no taper needed.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Dedicated finishing crews',
    slots: [
      { id: 'flatBox',         label: 'Flat Box #1',                  required: true,  icon: 'flatbox',  hint: 'Choose your primary flat box size.',         filter: COL.flatBox },
      { id: 'flatBox2',        label: 'Flat Box #2 (Optional)',        required: false, icon: 'flatbox',  hint: 'Add a second flat box for two coats.',       filter: COL.flatBox },
      { id: 'boxHandle',       label: 'Flat Box Handle',              required: true,  icon: 'handle',   hint: 'Controls box angle and reach.',              filter: COL.boxHandle },
      { id: 'angleHead',       label: 'Angle Head',                   required: true,  icon: 'anglehead',hint: 'Finishes wall-ceiling angles.',              filter: COL.angleHead },
      { id: 'angleHead2',      label: 'Second Angle Head (Optional)', required: false, icon: 'anglehead',hint: 'Speed up angle work with two heads.',        filter: COL.angleHead },
      { id: 'cornerBox',       label: 'Corner Box',                   required: true,  icon: 'cornerbox',hint: 'Finishes drywall corner joints.',            filter: COL.cornerBox },
      { id: 'angleHeadHandle', label: 'Angle Head Handle',            required: true,  icon: 'handle',   hint: 'Extension for angle head reach.',            filter: COL.angleHeadHandle },
      { id: 'rollerHandle',    label: 'Roller Handle',                required: true,  icon: 'roller',   hint: 'For use with inside corner roller.',         filter: COL.rollerHandle },
      { id: 'cornerBoxHandle', label: 'Corner Box Handle',            required: true,  icon: 'handle',   hint: 'Provides reach for corner box work.',        filter: COL.cornerBoxHandle },
    ],
    alwaysIncluded: [
      'Columbia Hot Mud Pump',
      'Columbia Box Filler',
      'Columbia Inside Corner Roller',
      'Columbia Angle Head Adapter',
    ],
  },

  // ── Columbia Flat Box Set ───────────────────────────────────────────────────
  {
    id:          'columbia-flatbox',
    brand:       'Columbia Taping Tools',
    name:        'Columbia Custom Flat Box Set',
    scope:       'flatbox',
    description: 'Choose your own flat boxes and flat box handle.',
    tagline:     'Flat box focused — for crews that already have tapers and angle heads.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Flat box upgrade or additions',
    slots: [
      { id: 'flatBox',   label: 'Flat Box #1',              required: true,  icon: 'flatbox', hint: 'Choose your primary flat box.',      filter: COL.flatBox },
      { id: 'flatBox2',  label: 'Flat Box #2 (Optional)',   required: false, icon: 'flatbox', hint: 'Add a second flat box size.',         filter: COL.flatBox },
      { id: 'boxHandle', label: 'Flat Box Handle',          required: true,  icon: 'handle',  hint: 'Controls box angle and reach.',      filter: COL.boxHandle },
    ],
    alwaysIncluded: [
      'Columbia Hot Mud Pump',
      'Columbia Box Filler',
    ],
  },

  // ── Columbia Taping Set ─────────────────────────────────────────────────────
  {
    id:          'columbia-taping',
    brand:       'Columbia Taping Tools',
    name:        'Columbia Custom Taping Set',
    scope:       'taping',
    description: 'Choose your own taper, angle heads, and handles.',
    tagline:     'Columbia taping power — tape faster with the right tools.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Taping specialists',
    slots: [
      { id: 'taper',           label: 'Automatic Taper',   required: true,  icon: 'taper',    hint: 'The core of the set.',              filter: COL.taper },
      { id: 'angleHead',       label: 'Angle Head',        required: true,  icon: 'anglehead',hint: 'Finishes wall-ceiling angles.',     filter: COL.angleHead },
      { id: 'angleHeadHandle', label: 'Angle Head Handle', required: true,  icon: 'handle',   hint: 'Extension for angle head reach.',   filter: COL.angleHeadHandle },
      { id: 'rollerHandle',    label: 'Roller Handle',     required: true,  icon: 'roller',   hint: 'For inside corner roller work.',    filter: COL.rollerHandle },
    ],
    alwaysIncluded: [
      'Columbia Hot Mud Pump',
      'Columbia Gooseneck',
      'Columbia Inside Corner Roller',
      'Columbia Angle Head Adapter',
    ],
  },

  // ── Level 5 Full Set ────────────────────────────────────────────────────────
  {
    id:          'level5-full',
    brand:       'Level 5',
    name:        'Level 5 Custom Full Set',
    scope:       'full',
    description: 'Choose your own flat boxes, angle heads, corner tools, and handles.',
    tagline:     'Precision finishing, fully configured — the Level 5 way.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Full finishing crews',
    slots: [
      { id: 'flatBox',   label: 'Flat Box #1',   required: true,  icon: 'flatbox',   hint: 'Choose your primary flat box.',      filter: L5.flatBox },
      { id: 'flatBox2',  label: 'Flat Box #2',   required: false, icon: 'flatbox',   hint: 'Add a second flat box size.',         filter: L5.flatBox },
      { id: 'boxHandle', label: 'Box Handle',    required: true,  icon: 'handle',    hint: 'Controls flat box angle and reach.', filter: L5.boxHandle },
      { id: 'angleHead', label: 'Angle Head',    required: true,  icon: 'anglehead', hint: 'Finishes inside angles.',            filter: L5.angleHead },
      { id: 'cornerBox', label: 'Corner Tool',   required: true,  icon: 'cornerbox', hint: 'Finishes corner joints.',            filter: L5.cornerBox },
      { id: 'handle',    label: 'Handle Set',    required: false, icon: 'handle',    hint: 'Additional handle options.',         filter: L5.handle },
    ],
    alwaysIncluded: [
      'Level 5 Pump & Filler',
      'Level 5 Inside Corner Roller',
    ],
  },

  // ── Level 5 Finishing Set ───────────────────────────────────────────────────
  {
    id:          'level5-finishing',
    brand:       'Level 5',
    name:        'Level 5 Custom Finishing Set',
    scope:       'finishing',
    description: 'Choose your own flat boxes, angle heads, and handles.',
    tagline:     'Everything you need for Level 5 finishing work.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Level 5 finishing specialists',
    slots: [
      { id: 'flatBox',   label: 'Flat Box #1',   required: true,  icon: 'flatbox',   hint: 'Primary flat box selection.',         filter: L5.flatBox },
      { id: 'flatBox2',  label: 'Flat Box #2',   required: false, icon: 'flatbox',   hint: 'Optional second flat box.',           filter: L5.flatBox },
      { id: 'boxHandle', label: 'Box Handle',    required: true,  icon: 'handle',    hint: 'Controls flat box angle and reach.', filter: L5.boxHandle },
      { id: 'angleHead', label: 'Angle Head',    required: true,  icon: 'anglehead', hint: 'Finishes inside angles.',            filter: L5.angleHead },
    ],
    alwaysIncluded: [
      'Level 5 Pump & Filler',
      'Level 5 Inside Corner Roller',
    ],
  },

  // ── Level 5 Flat Box Set ────────────────────────────────────────────────────
  {
    id:          'level5-flatbox',
    brand:       'Level 5',
    name:        'Level 5 Custom Flat Box Set',
    scope:       'flatbox',
    description: 'Choose your own flat boxes and handles.',
    tagline:     'Flat box focus — upgrade or expand your Level 5 flat box collection.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Flat box upgrades',
    slots: [
      { id: 'flatBox',   label: 'Flat Box #1',         required: true,  icon: 'flatbox', hint: 'Choose your primary flat box.',      filter: L5.flatBox },
      { id: 'flatBox2',  label: 'Flat Box #2',         required: false, icon: 'flatbox', hint: 'Optional second flat box.',           filter: L5.flatBox },
      { id: 'boxHandle', label: 'Box Handle',          required: true,  icon: 'handle',  hint: 'Controls flat box angle and reach.', filter: L5.boxHandle },
    ],
    alwaysIncluded: [
      'Level 5 Pump & Filler',
    ],
  },

  // ── Asgard Full Set ──────────────────────────────────────────────────────────
  {
    id:          'asgard-full',
    brand:       'Asgard',
    name:        'Asgard Custom Full Set',
    scope:       'full',
    description: 'Choose your own taper, flat boxes, angle heads, corner tools, and handles.',
    tagline:     'Build the ultimate Asgard setup from taping to finishing.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Full-time automatic taping crews',
    slots: [
      { id: 'taper',     label: 'Automatic Taper', required: true,  icon: 'taper',    hint: 'Core taping tool.',                 filter: ASG.taper },
      { id: 'flatBox',   label: 'Flat Box #1',     required: true,  icon: 'flatbox',  hint: 'Primary flat box selection.',       filter: ASG.flatBox },
      { id: 'flatBox2',  label: 'Flat Box #2',     required: false, icon: 'flatbox',  hint: 'Optional second flat box.',         filter: ASG.flatBox },
      { id: 'boxHandle', label: 'Box Handle',      required: true,  icon: 'handle',   hint: 'Controls flat box angle and reach.',filter: ASG.boxHandle },
      { id: 'angleHead', label: 'Angle Head',      required: true,  icon: 'anglehead',hint: 'Finishes inside angles.',           filter: ASG.angleHead },
      { id: 'cornerBox', label: 'Corner Tool',     required: true,  icon: 'cornerbox',hint: 'Finishes corner joints.',           filter: ASG.cornerBox },
    ],
    alwaysIncluded: [
      'Asgard Loading Pump',
      'Asgard Inside Corner Roller',
    ],
  },

  // ── Asgard Finishing Set ─────────────────────────────────────────────────────
  {
    id:          'asgard-finishing',
    brand:       'Asgard',
    name:        'Asgard Custom Finishing Set',
    scope:       'finishing',
    description: 'Choose your own flat boxes, angle heads, corner tools, and handles.',
    tagline:     'Finishing-focused Asgard configuration.',
    shipping:    'FREE',
    savingsLabel:'5% off',
    recommendedFor: 'Dedicated finishing crews',
    slots: [
      { id: 'flatBox',   label: 'Flat Box #1',   required: true,  icon: 'flatbox',  hint: 'Primary flat box.',               filter: ASG.flatBox },
      { id: 'flatBox2',  label: 'Flat Box #2',   required: false, icon: 'flatbox',  hint: 'Optional second flat box.',       filter: ASG.flatBox },
      { id: 'boxHandle', label: 'Box Handle',    required: true,  icon: 'handle',   hint: 'Controls flat box reach.',        filter: ASG.boxHandle },
      { id: 'angleHead', label: 'Angle Head',    required: true,  icon: 'anglehead',hint: 'Finishes inside angles.',         filter: ASG.angleHead },
      { id: 'cornerBox', label: 'Corner Tool',   required: true,  icon: 'cornerbox',hint: 'Finishes corner joints.',         filter: ASG.cornerBox },
    ],
    alwaysIncluded: [
      'Asgard Loading Pump',
      'Asgard Inside Corner Roller',
    ],
  },
];

// ── Scope display labels ──────────────────────────────────────────────────────
export const SCOPE_LABELS = {
  full:      'Full Set',
  finishing: 'Finishing Set',
  taping:    'Taping Set',
  flatbox:   'Flat Box Set',
};

// ── Scope badge colors ────────────────────────────────────────────────────────
export const SCOPE_COLORS = {
  full:      { bg: '#1e3a8a', text: '#fff' },
  finishing: { bg: '#1d4ed8', text: '#fff' },
  taping:    { bg: '#0369a1', text: '#fff' },
  flatbox:   { bg: '#0891b2', text: '#fff' },
};

// ── Brands that have templates ────────────────────────────────────────────────
export const BUILDER_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Level 5',
  'Asgard',
];

/**
 * Get all templates for a given brand.
 * @param {string} brandName
 * @returns {Array}
 */
export function getTemplatesForBrand(brandName) {
  return SET_TEMPLATES.filter((t) => t.brand === brandName);
}

/**
 * Get a template by its ID.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getTemplateById(id) {
  return SET_TEMPLATES.find((t) => t.id === id);
}

/**
 * Filter catalog products to those matching a slot's filter for a given brand.
 * Excludes parts products.
 * @param {Array} products  — full product catalog
 * @param {string} brand    — brand name
 * @param {Function} filterFn — slot filter function
 * @returns {Array}
 */
export function getSlotProducts(products, brand, filterFn) {
  return products.filter((p) => {
    const b = (p.brand || p.dtb_brand || '').trim();
    if (b !== brand) return false;
    if (p.type === 'variation') return false;
    // Exclude parts
    const cats = (p.categories || []).map((c) =>
      typeof c === 'string' ? c.toLowerCase() : (c.name || c.slug || '').toLowerCase()
    );
    const isParts = cats.some((c) => /parts|repair|replacement/i.test(c)) ||
      /(part|repair|replacement)/i.test(p.category || '');
    if (isParts) return false;

    const name = (p.name || '').toLowerCase();
    return filterFn(name);
  });
}
