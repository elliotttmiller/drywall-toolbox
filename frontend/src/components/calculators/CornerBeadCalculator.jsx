import { useState, useMemo, useEffect } from 'react'
import ResultCard from './shared/ResultCard'
import InfoBox from './shared/InfoBox'
import CalcDropdown from './shared/CalcDropdown'

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

const beadTypeOptions = [
  { value: 'metal',    label: 'Metal corner bead',  description: 'Standard — most durable' },
  { value: 'bullnose', label: 'Bullnose bead',       description: 'Rounded profile, modern look' },
  { value: 'vinyl',    label: 'Vinyl corner bead',   description: 'High-humidity / bathrooms' },
  { value: 'flex',     label: 'Flexible / arch bead',description: 'Bends to any radius' },
]

const stockLengthOptions = [
  { value: 8,  label: '8 ft sections',  description: 'Standard stock length' },
  { value: 10, label: '10 ft sections', description: 'Less waste on tall walls' },
  { value: 12, label: '12 ft sections', description: 'Minimum cuts on tall walls' },
]

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
    // Arch bead arc length: for a semicircular arch, arc = π × radius = π × archHeight
    const archFt = Math.round(arches * Math.PI * archHeight)
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

  const tips = {
    metal:    'Metal bead is industry standard — the most durable option. Fasten every 6–9" alternating sides. 5% splice waste included.',
    bullnose: 'Bullnose gives a rounded profile — popular in modern and contemporary builds. 5% splice waste included.',
    vinyl:    'Use vinyl in bathrooms and high-humidity areas to prevent rust bleed. Use vinyl-specific compound for best adhesion.',
    flex:     'Flexible arch bead is designed to bend to any radius without scoring — the factory kerfs allow it to conform to curves. Fasten every 4–6" along the curve (or every 2–3" for tight radii under 12"), alternating sides.',
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Outside Corners
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label htmlFor="cb-corners" className="block text-xs font-medium text-gray-600 mb-1.5">
              Straight outside corners
            </label>
            <input
              id="cb-corners"
              type="number"
              value={corners}
              min={0}
              onChange={e => setCorners(+e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <span className="text-xs text-gray-500 mt-1.5 block leading-snug">
              Standard 90° outside corners
            </span>
          </div>
          <div>
            <label htmlFor="cb-height" className="block text-xs font-medium text-gray-600 mb-1.5">
              Wall / ceiling height (ft)
            </label>
            <input
              id="cb-height"
              type="number"
              value={height}
              min={1}
              step={0.5}
              onChange={e => setHeight(+e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div>
          <label htmlFor="cb-arches" className="block text-xs font-medium text-gray-600 mb-1.5">
            Curved / arch corners
          </label>
          <input
            id="cb-arches"
            type="number"
            value={arches}
            min={0}
            onChange={e => setArches(+e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <span className="text-xs text-gray-500 mt-1.5 block leading-snug">
            Uses flexible arch bead
          </span>
        </div>
        <div>
          <label htmlFor="cb-arch-h" className="block text-xs font-medium text-gray-600 mb-1.5">
            Arch radius / rise (ft)
          </label>
          <input
            id="cb-arch-h"
            type="number"
            value={archHeight}
            min={1}
            step={0.5}
            onChange={e => setArchHeight(+e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Bead Type &amp; Stock Length
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label htmlFor="cb-type" className="block text-xs font-medium text-gray-600 mb-1.5">
              Corner bead type
            </label>
            <CalcDropdown
              id="cb-type"
              value={beadType}
              onChange={setBeadType}
              options={beadTypeOptions}
            />
          </div>
          <div>
            <label htmlFor="cb-stock" className="block text-xs font-medium text-gray-600 mb-1.5">
              Stock bead length (ft)
            </label>
            <CalcDropdown
              id="cb-stock"
              value={stockLength}
              onChange={v => setStockLength(+v)}
              options={stockLengthOptions}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4"
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

