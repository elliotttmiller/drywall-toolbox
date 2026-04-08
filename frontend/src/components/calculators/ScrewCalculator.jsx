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
  const [boxSize, setBoxSize] = useState(saved.boxSize ?? 725)

  const results = useMemo(() => {
    const size = +sheetSize
    let perSheet

    if (size === 32) {
      perSheet = spacing === '16'
        ? (application === 'ceiling' ? 36 : 28)
        : (application === 'ceiling' ? 26 : 20)
    } else {
      perSheet = spacing === '16'
        ? (application === 'ceiling' ? 52 : 40)
        : (application === 'ceiling' ? 38 : 30)
    }

    if (application === 'both') {
      perSheet = Math.round(perSheet * 1.35)
    }

    const total = Math.ceil(sheets * perSheet * 1.10)
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
    { value: 145, label: '1 lb (~145 screws)' },
    { value: 725, label: '5 lb (~725 screws)' },
    { value: 1450, label: '10 lb (~1,450 screws)' },
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
          For {appLabel[application]} at {spacing}" OC with {sheetSize === 32 ? '4×8' : '4×12'} sheets — {results.perSheet} screws per sheet including edges. IRC code compliant. 10% overage already included.
        </InfoBox>
      </div>
    </div>
  )
}
