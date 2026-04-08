import { useState, useMemo, useEffect } from 'react'
import ResultCard from './shared/ResultCard'
import InfoBox from './shared/InfoBox'

// Joint compound coverage rates by finish level (GA-214-2022 / USG / National Gypsum specs)
// Units: US gallons per 100 sq ft (all coats combined, including 10% applicator waste)
const MUD_GAL_PER_100 = { 0: 0, 1: 0.5, 2: 1.0, 3: 2.25, 4: 3.0, 5: 4.5 }

// Coat count by finish level (GA-214-2022)
const COAT_COUNT = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }

// Coat distribution percentages (thickest first coat, lightest final)
// Coat 1 (embed/tape): 40%, Coat 2 (fill): 35%, Coat 3 (finish): 25%
// For Level 5, skim coat gets a flat share of the extra volume
const COAT_SPLIT = [0.40, 0.35, 0.25]

const LS_KEY = 'dwCalc_mud'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

const FINISH_LEVELS = [
  {
    value: 0,
    label: 'Level 0 — No finish',
    short: 'Level 0',
    description: 'No taping, finishing, or accessories required. Used only for temporary construction or where appearance is unimportant.',
    application: 'Fire-only assemblies, demolition areas, areas concealed above suspended ceilings',
    coats: 0,
  },
  {
    value: 1,
    label: 'Level 1 — Basic embed',
    short: 'Level 1',
    description: 'Tape embedded in compound at joints and angles. Excess compound wiped smooth. Tool marks and ridges are acceptable.',
    application: 'Plenum spaces, attics, service corridors — not normally visible to occupants',
    coats: 1,
  },
  {
    value: 2,
    label: 'Level 2 — Tile/utility',
    short: 'Level 2',
    description: 'Tape embedded plus one additional coat over joints and fastener heads. Surface must be free of excess compound.',
    application: 'Surfaces to receive tile, garages, warehouses, storage rooms',
    coats: 2,
  },
  {
    value: 3,
    label: 'Level 3 — Texture ready',
    short: 'Level 3',
    description: 'Two coats over tape and joints; two coats over fasteners and accessories. Smooth, tool-mark free. Primer recommended before texture.',
    application: 'Under medium to heavy textures, commercial-grade wall coverings',
    coats: 3,
  },
  {
    value: 4,
    label: 'Level 4 — Paint ready (standard)',
    short: 'Level 4',
    description: 'Three coats over tape, joints, fasteners, and accessories. Smooth, primer required. Standard for most residential and commercial painted walls.',
    application: 'Most interior painted walls and ceilings, light textures, flat wall coverings',
    coats: 4,
  },
  {
    value: 5,
    label: 'Level 5 — Premium / gloss paint',
    short: 'Level 5',
    description: 'Level 4 plus a full skim coat of compound over the entire surface. Highest quality; eliminates surface variation under critical lighting.',
    application: 'Gloss, semi-gloss, or enamel paint; critical lighting installations; premium residential',
    coats: 5,
  },
]

const COMPOUND_TYPES = [
  {
    value: 'all-purpose',
    label: 'All-Purpose',
    note: 'Best for all coats — most common. Slow-dry (24h between coats). Use for taping through finish coats.',
  },
  {
    value: 'topping',
    label: 'Topping',
    note: 'Final coat(s) only. Easier sanding, brighter white finish. Do not use as a tape coat.',
  },
  {
    value: 'setting',
    label: 'Setting (Hot Mud)',
    note: 'Chemical-set (20–90 min). Excellent for first coats and high-build. Stronger, but harder to sand. Does not shrink.',
  },
  {
    value: 'lightweight',
    label: 'Lightweight All-Purpose',
    note: '25–35% lighter than standard. Slightly easier to sand. Same coverage as all-purpose. Good for large projects.',
  },
]

export default function MudCalculator({ onUpdate, sheetData }) {
  const saved = loadSaved()
  const [area, setArea] = useState(saved.area ?? 800)
  const [finishLevel, setFinishLevel] = useState(saved.finishLevel ?? 4)
  const [compoundType, setCompoundType] = useState(saved.compoundType ?? 'all-purpose')

  const syncedArea = sheetData?.net ?? null
  const syncedFromSheets = syncedArea !== null
  const effectiveArea = syncedFromSheets ? syncedArea : area

  const selectedLevel = FINISH_LEVELS.find(l => l.value === finishLevel)
  const coats = COAT_COUNT[finishLevel]
  const totalGallons = useMemo(() => {
    return (effectiveArea / 100) * MUD_GAL_PER_100[finishLevel]
  }, [effectiveArea, finishLevel])

  const coatBreakdown = useMemo(() => {
    if (coats === 0) return []
    const result = []
    // Distribute volume across coats using COAT_SPLIT (cycle through for coats > 3)
    let remaining = totalGallons
      for (let i = 0; i < coats; i++) {
      // For levels with 4+ coats, level out the final coats
      const share = coats <= 3
        ? COAT_SPLIT[i]
        : i === 0 ? 0.35 : i === coats - 1 ? 0.15 : 0.50 / (coats - 2)
      const gallons = coats <= 3
        ? +(totalGallons * share).toFixed(2)
        : i < coats - 1
          ? +(totalGallons * share).toFixed(2)
          : +(remaining).toFixed(2)
      remaining -= gallons
      result.push({
        label: i === 0 ? 'Tape / embed coat'
          : i === coats - 1 && finishLevel === 5 ? 'Skim coat'
          : i === coats - 1 ? 'Finish coat'
          : `Fill coat ${i}`,
        gallons,
      })
    }
    return result
  }, [totalGallons, coats, finishLevel])

  const buckets5gal = Math.ceil(totalGallons / 5)
  const buckets1gal = Math.ceil(totalGallons)

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ area, finishLevel, compoundType }))
  }, [area, finishLevel, compoundType])

  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        totalGallons: +totalGallons.toFixed(2),
        buckets5gal,
        buckets1gal,
        finishLevel,
        compoundType,
        coats,
        area: effectiveArea,
        syncedFromSheets,
      })
    }
  }, [totalGallons, buckets5gal, buckets1gal, finishLevel, compoundType, coats, effectiveArea, syncedFromSheets, onUpdate])

  const compoundInfo = COMPOUND_TYPES.find(c => c.value === compoundType)

  return (
    <div className="space-y-6">
      {/* Sync indicator */}
      {syncedFromSheets && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 border border-primary-200 text-xs text-primary-700">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
          <span>
            <strong>Synced from Sheets tab</strong> — using net area of {syncedArea} sq ft.
          </span>
        </div>
      )}
      {/* Area Input */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Project Area
        </h3>
        <div>
          <label htmlFor="mud-area" className="block text-xs font-medium text-gray-600 mb-1.5">
            Total drywall area (sq ft)
          </label>
          <input
            id="mud-area"
            type="number"
            value={effectiveArea}
            min={1}
            readOnly={syncedFromSheets}
            onChange={e => !syncedFromSheets && setArea(+e.target.value)}
            className={`w-full px-3 py-2.5 text-sm border rounded-xl text-gray-900 focus:outline-none transition ${
              syncedFromSheets
                ? 'border-primary-200 bg-primary-50 text-primary-700'
                : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            }`}
          />
          <span className="text-xs text-gray-500 mt-1.5 block leading-snug">
            {syncedFromSheets ? 'Auto-populated from Sheets tab (net area after deductions)' : 'Use the net area from the Sheets tab (walls + ceiling after deductions)'}
          </span>
        </div>
      </div>

      {/* Finish Level */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Finish Level <span className="normal-case font-normal text-gray-400">(GA-214-2022)</span>
        </h3>
        <div className="space-y-2">
          {FINISH_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => setFinishLevel(level.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                finishLevel === level.value
                  ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <span className="text-sm font-medium block">{level.label}</span>
                  <span className={`text-xs mt-0.5 block ${finishLevel === level.value ? 'text-primary-200' : 'text-gray-400'}`}>{level.application}</span>
                </div>
                <span className={`text-xs font-mono shrink-0 mt-0.5 ${finishLevel === level.value ? 'text-primary-200' : 'text-gray-400'}`}>
                  {level.coats === 0 ? 'no mud' : `${level.coats} coat${level.coats > 1 ? 's' : ''}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Compound Type */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Compound Type
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {COMPOUND_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setCompoundType(type.value)}
              className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                compoundType === type.value
                  ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
              }`}
            >
              <span className="font-medium block">{type.label}</span>
            </button>
          ))}
        </div>
        {compoundInfo && (
          <p className="text-xs text-gray-500 mt-2 px-1">
            {compoundInfo.note}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="border-t border-gray-200 pt-6">
        <div
          className="grid grid-cols-2 gap-2 sm:gap-3 mb-4"
          aria-live="polite"
          aria-label="Joint compound calculator results"
        >
          <ResultCard
            label="5-gal buckets"
            value={finishLevel === 0 ? '0' : buckets5gal}
            sub="buckets to order"
            hero
          />
          <ResultCard
            label="Total gallons"
            value={finishLevel === 0 ? '0' : totalGallons.toFixed(1)}
            sub="joint compound"
          />
          <ResultCard
            label="Finish level"
            value={selectedLevel?.short}
            sub={`${coats} coat${coats !== 1 ? 's' : ''}`}
          />
          <ResultCard
            label="Compound type"
            value={COMPOUND_TYPES.find(c => c.value === compoundType)?.label}
            sub="selected type"
          />
        </div>

        {/* Per-coat breakdown */}
        {coatBreakdown.length > 0 && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Per-Coat Breakdown
            </p>
            <div className="space-y-2">
              {coatBreakdown.map((coat, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Coat {i + 1} — {coat.label}</span>
                  <span className="font-medium text-gray-900">
                    {coat.gallons} gal
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-2 mt-2">
                <span className="font-medium text-gray-700">Total</span>
                <span className="font-semibold text-gray-900">{totalGallons.toFixed(1)} gal</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Allow 24h dry time between coats. Let each coat dry fully before sanding or re-coating.
            </p>
          </div>
        )}

        <InfoBox variant={finishLevel === 5 ? 'warning' : 'info'}>
          {finishLevel === 0 && 'No joint compound required for Level 0. Panels are fastened with no finishing.'}
          {finishLevel === 1 && 'Level 1: tape embedded in compound only. One coat — no further finishing. Acceptable only in concealed spaces.'}
          {finishLevel === 2 && 'Level 2: tape embedded + one fill coat on joints and fasteners. Surface must be free of excess compound. Used under tile.'}
          {finishLevel === 3 && `Level 3: ${selectedLevel?.description} Apply primer-sealer before texture.`}
          {finishLevel === 4 && 'Level 4 is the industry standard for most residential interiors. Always prime before painting to prevent photographic panning (variation in sheen).'}
          {finishLevel === 5 && 'Level 5 requires a full-surface skim coat and uses nearly 50% more compound than Level 4. Consider hiring a professional finisher for this level.'}
        </InfoBox>
      </div>

      {/* Standards reference */}
      <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Coverage rates per GA-214-2022 (Gypsum Association) and USG/National Gypsum manufacturer specifications.
        1 gal ready-mixed compound ≈ 100–120 sq ft per coat at Level 4.
      </div>
    </div>
  )
}

