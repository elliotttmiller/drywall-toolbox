import { useState } from 'react'

const QUICK_LEVELS = [
  { label: '5%', sub: 'simple', value: 0.05 },
  { label: '10%', sub: 'standard', value: 0.10 },
  { label: '15%', sub: 'complex', value: 0.15 },
  { label: '20%', sub: 'heavy', value: 0.20 },
]

export default function WasteSelector({ value, onChange }) {
  const isCustom = !QUICK_LEVELS.some(l => l.value === value)
  const [showCustom, setShowCustom] = useState(isCustom)
  const [customInput, setCustomInput] = useState(
    isCustom ? String(Math.round(value * 100)) : ''
  )

  const handleQuickPick = (v) => {
    setShowCustom(false)
    onChange(v)
  }

  const handleCustomToggle = () => {
    setShowCustom(s => {
      if (!s) {
        // Opening custom input — pre-fill with current value
        setCustomInput(String(Math.round(value * 100)))
      }
      return !s
    })
  }

  const handleCustomChange = (raw) => {
    setCustomInput(raw)
    const num = parseFloat(raw)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      onChange(num / 100)
    } else if (raw === '' || raw === undefined) {
      onChange(0)
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {QUICK_LEVELS.map(level => (
          <button
            key={level.value}
            className={`px-2 py-2.5 text-sm rounded-xl border transition-all text-center font-medium ${
              !showCustom && value === level.value
                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-primary-50 hover:border-primary-300 hover:text-gray-900'
            }`}
            onClick={() => handleQuickPick(level.value)}
          >
            <span className="block font-semibold leading-tight">{level.label}</span>
            <span className={`block text-[11px] mt-0.5 ${!showCustom && value === level.value ? 'text-primary-200' : 'text-gray-400'}`}>
              {level.sub}
            </span>
          </button>
        ))}

        {/* Custom % button */}
        <button
          className={`px-2 py-2.5 text-sm rounded-xl border transition-all text-center font-medium ${
            showCustom
              ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-primary-50 hover:border-primary-300 hover:text-gray-900'
          }`}
          onClick={handleCustomToggle}
        >
          <span className="block font-semibold leading-tight">
            {showCustom && customInput !== '' ? `${customInput}%` : 'Custom'}
          </span>
          <span className={`block text-[11px] mt-0.5 ${showCustom ? 'text-primary-200' : 'text-gray-400'}`}>
            any %
          </span>
        </button>
      </div>

      {/* Custom input row */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="number"
            min={0}
            max={100}
            step={1}
            value={customInput}
            onChange={e => handleCustomChange(e.target.value)}
            placeholder="e.g. 12"
            className="w-28 px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
          />
          <span className="text-sm text-gray-500">% waste factor</span>
        </div>
      )}
    </div>
  )
}
