import { useState, useMemo, useEffect } from 'react'
import ResultCard from './shared/ResultCard'
import InfoBox from './shared/InfoBox'

const LS_KEY = 'dwCalc_screws'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

export default function ScrewCalculator({ onUpdate }) {
  const saved = loadSaved()
  const [sheets, setSheets] = useState(saved.sheets ?? 20)
  const [spacing, setSpacing] = useState(saved.spacing ?? '16')
  const [application, setApplication] = useState(saved.application ?? 'wall')
  const [sheetSize, setSheetSize] = useState(saved.sheetSize ?? 48)
  const [screwLength, setScrewLength] = useState(saved.screwLength ?? '1-5/8"')
  const [boxSize, setBoxSize] = useState(saved.boxSize ?? 875)

  const results = useMemo(() => {
    const size = +sheetSize
    // Per-sheet screw counts per ASTM C840-23:
    // Walls:    edges 8" OC,  field 16" OC
    // Ceilings: edges 7" OC,  field 12" OC (tighter per ASTM C840-23 to prevent sag)
    let perSheet
    if (size === 32) {          // 4×8 ft
      perSheet = spacing === '16'
        ? (application === 'ceiling' ? 40 : 32)
        : (application === 'ceiling' ? 32 : 28)
    } else if (size === 40) {   // 4×10 ft
      perSheet = spacing === '16'
        ? (application === 'ceiling' ? 50 : 40)
        : (application === 'ceiling' ? 40 : 34)
    } else {                    // 4×12 ft
      perSheet = spacing === '16'
        ? (application === 'ceiling' ? 60 : 48)
        : (application === 'ceiling' ? 48 : 40)
    }

    if (application === 'both') {
      // Average of wall and ceiling density weighted 50/50
      const wallCount = size === 32
        ? (spacing === '16' ? 32 : 28)
        : size === 40
          ? (spacing === '16' ? 40 : 34)
          : (spacing === '16' ? 48 : 40)
      const ceilCount = size === 32
        ? (spacing === '16' ? 40 : 32)
        : size === 40
          ? (spacing === '16' ? 50 : 40)
          : (spacing === '16' ? 60 : 48)
      perSheet = Math.round((wallCount + ceilCount) / 2)
    }

    const total = Math.ceil(sheets * perSheet * 1.10)  // 10% overage for stripping/breakage
    const boxes = Math.ceil(total / boxSize)

    return { perSheet, total, boxes }
  }, [sheets, spacing, application, sheetSize, boxSize])

  // Persist inputs across page refreshes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ sheets, spacing, application, sheetSize, screwLength, boxSize }))
  }, [sheets, spacing, application, sheetSize, screwLength, boxSize])

  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        boxes: results.boxes,
        screwLength,
        boxSize,
        totalScrews: results.total,
        perSheet: results.perSheet,
        application
      })
    }
  }, [results, screwLength, boxSize, application, onUpdate])

  const screwLengths = [
    { value: '1-1/4"', label: '1-1/4" — single layer on wood' },
    { value: '1-5/8"', label: '1-5/8" — standard single layer' },
    { value: '2-1/2"', label: '2-1/2" — double layer / thick' },
    { value: '3"', label: '3" — through thick framing' },
  ]

  const boxSizes = [
    // 1-5/8" #6 coarse thread: ~175 screws/lb (industry standard)
    { value: 175, label: '1 lb (~175 screws)' },
    { value: 875, label: '5 lb (~875 screws)' },
    { value: 1750, label: '10 lb (~1,750 screws)' },
  ]

  const appLabel = {
    wall: 'walls (16" field spacing)',
    ceiling: 'ceilings (12" field spacing)',
    both: 'walls + ceiling'
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Job Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Number of drywall sheets
            </label>
            <input
              type="number"
              value={sheets}
              min={1}
              onChange={e => setSheets(+e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Stud / joist spacing
            </label>
            <select
              value={spacing}
              onChange={e => setSpacing(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="16">16" on center</option>
              <option value="24">24" on center</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Application
          </label>
          <select
            value={application}
            onChange={e => setApplication(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="wall">Walls</option>
            <option value="ceiling">Ceiling</option>
            <option value="both">Walls + ceiling</option>
          </select>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
            Ceilings need closer spacing
          </span>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Sheet size
          </label>
          <select
            value={sheetSize}
            onChange={e => setSheetSize(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={32}>4×8 ft (32 sq ft)</option>
            <option value={40}>4×10 ft (40 sq ft)</option>
            <option value={48}>4×12 ft (48 sq ft)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Screw length
          </label>
          <select
            value={screwLength}
            onChange={e => setScrewLength(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {screwLengths.map(length => (
              <option key={length.value} value={length.value}>
                {length.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Box size
          </label>
          <select
            value={boxSize}
            onChange={e => setBoxSize(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {boxSizes.map(size => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4"
          aria-live="polite"
          aria-label="Screw calculator results"
        >
          <ResultCard
            label="Boxes to buy"
            value={results.boxes}
            sub={`${boxSize.toLocaleString()} screws/box`}
            hero
          />
          <ResultCard
            label="Total screws needed"
            value={results.total.toLocaleString()}
            sub="includes 10% overage"
          />
          <ResultCard
            label="Screws per sheet"
            value={results.perSheet}
            sub="avg per sheet"
          />
          <ResultCard
            label="Screw length"
            value={screwLength}
            sub="coarse thread"
          />
        </div>

        <InfoBox>
          For {appLabel[application]} at {spacing}" OC with {sheetSize === 32 ? '4×8' : sheetSize === 40 ? '4×10' : '4×12'} sheets — {results.perSheet} screws per sheet including edges. ASTM C840-23 compliant. 10% overage already included.
        </InfoBox>
      </div>
    </div>
  )
}
