import { useState, useMemo, useEffect } from 'react'
import ResultCard from './shared/ResultCard'
import InfoBox from './shared/InfoBox'

const LS_KEY = 'dwCalc_tape'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

export default function TapeCalculator({ onUpdate }) {
  const saved = loadSaved()
  const [area, setArea] = useState(saved.area ?? 800)
  const [corners, setCorners] = useState(saved.corners ?? 4)
  const [sheetSize, setSheetSize] = useState(saved.sheetSize ?? 48)
  const [tapeType, setTapeType] = useState(saved.tapeType ?? 'paper')
  const [rollSize, setRollSize] = useState(saved.rollSize ?? 500)
  const [ceilHeight, setCeilHeight] = useState(saved.ceilHeight ?? 9)

  const results = useMemo(() => {
    // Seam tape: area divided by sheet width (always 4 ft — sheets are 4 ft wide regardless
    // of length), multiplied by 1.1 for butt-joint overlap
    const seamFt = Math.round((area / 4) * 1.1)
    const cornerFt = Math.round(corners * ceilHeight)
    // mesh tape stretches ~15% more, requiring proportionally more roll length
    const meshMultiplier = tapeType === 'mesh' ? 1.15 : 1
    const total = Math.round((seamFt + cornerFt) * meshMultiplier)
    const rolls = Math.ceil(total / rollSize)
    return { seamFt, cornerFt, total, rolls }
  }, [area, corners, ceilHeight, rollSize, tapeType])

  // Persist inputs across page refreshes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ area, corners, sheetSize, tapeType, rollSize, ceilHeight }))
  }, [area, corners, sheetSize, tapeType, rollSize, ceilHeight])

  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        rolls: results.rolls,
        tapeType,
        rollSize,
        totalFeet: results.total,
        seamFeet: results.seamFt,
        cornerFeet: results.cornerFt
      })
    }
  }, [results, tapeType, rollSize, onUpdate])

  const rollSizes = [
    { value: 75, label: '75 ft' },
    { value: 150, label: '150 ft' },
    { value: 500, label: '500 ft' },
  ]

  const tapeTypes = [
    { value: 'paper', label: 'Paper tape (standard seams)' },
    { value: 'mesh', label: 'Fiberglass mesh tape' },
    { value: 'flex', label: 'Flexible corner tape' },
  ]

  const tips = {
    paper: 'Paper tape requires embedding in mud. Run it tight to the seam with no wrinkles — bubbles cause cracking.',
    mesh: 'Mesh tape self-adheres and is faster to apply, but requires setting-type compound for strength. We\'ve added 15% for stretch.',
    flex: 'Flexible corner tape works on both inside and outside corners — great for rounded transitions.'
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Wall &amp; Ceiling Area
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="tp-area" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Total drywall area (sq ft)
            </label>
            <input
              id="tp-area"
              type="number"
              value={area}
              min={1}
              onChange={e => setArea(+e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
              Walls + ceiling combined
            </span>
          </div>
          <div>
            <label htmlFor="tp-corners" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Outside corners
            </label>
            <input
              id="tp-corners"
              type="number"
              value={corners}
              min={0}
              onChange={e => setCorners(+e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
              Adds corner tape length
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="tp-ceil" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Ceiling height (ft)
          </label>
          <input
            id="tp-ceil"
            type="number"
            value={ceilHeight}
            min={6}
            max={20}
            step={0.5}
            onChange={e => setCeilHeight(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label htmlFor="tp-sheet" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Sheet size used
          </label>
          <select
            id="tp-sheet"
            value={sheetSize}
            onChange={e => setSheetSize(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={32}>4×8 ft</option>
            <option value={48}>4×12 ft</option>
            <option value={54}>4×13.5 ft</option>
          </select>
        </div>
        <div>
          <label htmlFor="tp-type" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Tape type
          </label>
          <select
            id="tp-type"
            value={tapeType}
            onChange={e => setTapeType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {tapeTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
          Roll size
        </label>
        <div className="flex gap-2" role="group" aria-label="Roll size">
          {rollSizes.map(size => (
            <button
              key={size.value}
              className={`flex-1 px-3 py-2 text-sm rounded-md border transition-all ${
                rollSize === size.value
                  ? 'bg-white dark:bg-gray-800 border-gray-400 dark:border-gray-600 font-medium text-gray-900 dark:text-gray-100'
                  : 'bg-transparent border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => setRollSize(size.value)}
              aria-pressed={rollSize === size.value}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4"
          aria-live="polite"
          aria-label="Tape calculator results"
        >
          <ResultCard
            label="Tape rolls needed"
            value={results.rolls}
            sub={`${rollSize} ft rolls`}
            hero
          />
          <ResultCard
            label="Total linear feet"
            value={results.total.toLocaleString()}
            sub="ft of tape total"
          />
          <ResultCard
            label="Field seam tape"
            value={results.seamFt.toLocaleString()}
            sub="ft for field seams"
          />
          <ResultCard
            label="Outside corner tape"
            value={results.cornerFt.toLocaleString()}
            sub="ft for outside corners"
          />
        </div>

        <InfoBox>
          {tips[tapeType]}
        </InfoBox>
      </div>
    </div>
  )
}
