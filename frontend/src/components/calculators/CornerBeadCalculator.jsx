import { useState, useMemo, useEffect } from 'react'
import ResultCard from './shared/ResultCard'
import InfoBox from './shared/InfoBox'

const LS_KEY = 'dwCalc_bead'
// 5% added to straight-run lengths to cover splice waste (industry standard)
const SPLICE_WASTE_FACTOR = 1.05

function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY)) || {}
    // Migrate legacy 'standard' beadType value to current 'metal' key
    if (data.beadType === 'standard') data.beadType = 'metal'
    return data
  } catch { return {} }
}

export default function CornerBeadCalculator({ onUpdate }) {
  const saved = loadSaved()
  const [corners, setCorners] = useState(saved.corners ?? 4)
  const [height, setHeight] = useState(saved.height ?? 9)
  const [arches, setArches] = useState(saved.arches ?? 0)
  const [archHeight, setArchHeight] = useState(saved.archHeight ?? 7)
  const [beadType, setBeadType] = useState(saved.beadType ?? 'metal')
  const [stockLength, setStockLength] = useState(saved.stockLength ?? 8)

  const results = useMemo(() => {
    const stdFt = Math.round(corners * height)
    const archFt = Math.round(arches * archHeight * 2)
    const totalFt = stdFt + archFt
    // 5% splice waste on straight runs per industry standard
    const adjustedFt = Math.round(stdFt * SPLICE_WASTE_FACTOR) + archFt
    const sections = Math.ceil(adjustedFt / stockLength)
    return { stdFt, archFt, totalFt, sections }
  }, [corners, height, arches, archHeight, stockLength])

  // Persist inputs across page refreshes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ corners, height, arches, archHeight, beadType, stockLength }))
  }, [corners, height, arches, archHeight, beadType, stockLength])

  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        sections: results.sections,
        beadType,
        stockLength,
        totalFeet: results.totalFt,
        standardFeet: results.stdFt,
        archFeet: results.archFt
      })
    }
  }, [results, beadType, stockLength, onUpdate])

  const beadTypes = [
    { value: 'metal', label: 'Metal corner bead (standard)' },
    { value: 'bullnose', label: 'Bullnose corner bead' },
    { value: 'vinyl', label: 'Vinyl corner bead' },
    { value: 'flex', label: 'Flexible / arch bead' },
  ]

  const stockLengths = [
    { value: 8, label: '8 ft sections' },
    { value: 10, label: '10 ft sections' },
    { value: 12, label: '12 ft sections' },
  ]

  const tips = {
    metal: 'Metal bead is industry standard — the most durable option. Fasten every 6–9" alternating sides. 5% splice waste included.',
    bullnose: 'Bullnose gives a rounded profile — popular in modern and contemporary builds. 5% splice waste included.',
    vinyl: 'Use vinyl in bathrooms and high-humidity areas to prevent rust bleed. Use vinyl-specific compound for best adhesion.',
    flex: 'Flexible bead bends to any radius — required for archways. Score lightly before bending to prevent kinking.'
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Outside Corners
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="cb-corners" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Straight outside corners
            </label>
            <input
              id="cb-corners"
              type="number"
              value={corners}
              min={0}
              onChange={e => setCorners(+e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
              Standard 90° outside corners
            </span>
          </div>
          <div>
            <label htmlFor="cb-height" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Wall / ceiling height (ft)
            </label>
            <input
              id="cb-height"
              type="number"
              value={height}
              min={1}
              step={0.5}
              onChange={e => setHeight(+e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cb-arches" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Archways / curved corners
          </label>
          <input
            id="cb-arches"
            type="number"
            value={arches}
            min={0}
            onChange={e => setArches(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
            Uses flexible arch bead
          </span>
        </div>
        <div>
          <label htmlFor="cb-arch-h" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Arch height (ft)
          </label>
          <input
            id="cb-arch-h"
            type="number"
            value={archHeight}
            min={1}
            step={0.5}
            onChange={e => setArchHeight(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Bead Type &amp; Stock Length
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="cb-type" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Corner bead type
            </label>
            <select
              id="cb-type"
              value={beadType}
              onChange={e => setBeadType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {beadTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cb-stock" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Stock bead length (ft)
            </label>
            <select
              id="cb-stock"
              value={stockLength}
              onChange={e => setStockLength(+e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {stockLengths.map(len => (
                <option key={len.value} value={len.value}>
                  {len.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4"
          aria-live="polite"
          aria-label="Corner bead calculator results"
        >
          <ResultCard
            label="Bead sections to buy"
            value={results.sections}
            sub={`${stockLength} ft sections`}
            hero
          />
          <ResultCard
            label="Total linear ft"
            value={results.totalFt}
            sub="corner bead needed"
          />
          <ResultCard
            label="Straight corners"
            value={results.stdFt}
            sub="ft of straight bead"
          />
          <ResultCard
            label="Arch bead"
            value={results.archFt}
            sub="ft of flex bead"
          />
        </div>

        <InfoBox>
          {tips[beadType]}
        </InfoBox>
      </div>
    </div>
  )
}
