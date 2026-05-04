import { useState } from 'react'

const LS_KEY = 'dwCalc_presets'

// Full-config presets (walls derived from width×length for rectangular rooms)
const DEFAULT_PRESETS = [
  { id: 'default-bedroom',   name: 'Bedroom',    walls: [{id:1,length:12},{id:2,length:14},{id:3,length:12},{id:4,length:14}], ceilHeight: 9,  doors: 1, windows: 1, inclCeiling: false, roomLength: 12, roomWidth: 14 },
  { id: 'default-master',    name: 'Master BR',  walls: [{id:1,length:16},{id:2,length:18},{id:3,length:16},{id:4,length:18}], ceilHeight: 9,  doors: 1, windows: 2, inclCeiling: false, roomLength: 16, roomWidth: 18 },
  { id: 'default-living',    name: 'Living Rm',  walls: [{id:1,length:18},{id:2,length:20},{id:3,length:18},{id:4,length:20}], ceilHeight: 9,  doors: 2, windows: 2, inclCeiling: false, roomLength: 18, roomWidth: 20 },
  { id: 'default-kitchen',   name: 'Kitchen',    walls: [{id:1,length:12},{id:2,length:16},{id:3,length:12},{id:4,length:16}], ceilHeight: 9,  doors: 1, windows: 1, inclCeiling: false, roomLength: 12, roomWidth: 16 },
  { id: 'default-bathroom',  name: 'Bathroom',   walls: [{id:1,length:8},{id:2,length:10},{id:3,length:8},{id:4,length:10}],  ceilHeight: 8,  doors: 1, windows: 1, inclCeiling: false, roomLength: 8,  roomWidth: 10 },
  { id: 'default-garage',    name: 'Garage',     walls: [{id:1,length:20},{id:2,length:24},{id:3,length:20},{id:4,length:24}], ceilHeight: 10, doors: 1, windows: 0, inclCeiling: false, roomLength: 20, roomWidth: 24 },
]

function loadPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY))
    return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_PRESETS
  } catch {
    return DEFAULT_PRESETS
  }
}

function savePresetsToStorage(presets) {
  localStorage.setItem(LS_KEY, JSON.stringify(presets))
}

/**
 * RoomPresets — fully user-configurable preset manager.
 *
 * Props:
 *   onApply(preset)     — called when user clicks a preset card
 *   currentConfig       — the live calculator state (for "Save current" feature)
 */
export default function RoomPresets({ onApply, currentConfig }) {
  const [presets, setPresets] = useState(loadPresets)
  const [savingName, setSavingName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const persistPresets = (next) => {
    setPresets(next)
    savePresetsToStorage(next)
  }

  const handleSaveCurrent = () => {
    if (!savingName.trim()) return
    const newPreset = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: savingName.trim(),
      ...(currentConfig || {}),
    }
    persistPresets([...presets, newPreset])
    setSavingName('')
    setShowSaveInput(false)
  }

  const handleDelete = (id) => {
    persistPresets(presets.filter(p => p.id !== id))
  }

  const startRename = (preset) => {
    setEditingId(preset.id)
    setEditName(preset.name)
  }

  const commitRename = () => {
    if (!editName.trim()) { setEditingId(null); return }
    persistPresets(presets.map(p => p.id === editingId ? { ...p, name: editName.trim() } : p))
    setEditingId(null)
  }

  const resetDefaults = () => {
    persistPresets(DEFAULT_PRESETS)
  }

  // Summary line for a preset card (e.g. "4 walls · 9 ft ceilings")
  const presetSummary = (p) => {
    const wallCount = Array.isArray(p.walls) ? p.walls.length : 4
    return `${wallCount} walls · ${p.ceilHeight ?? 9} ft ceilings`
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {presets.map(preset => (
          <div
            key={preset.id}
            className="group relative bg-gray-50 border border-gray-200 rounded-xl hover:bg-primary-50 hover:border-primary-300 transition-all"
          >
            {/* Main click area */}
            <button
              onClick={() => onApply(preset)}
              className="w-full p-2.5 text-left active:scale-95 transition-transform"
            >
              {editingId === preset.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-xs font-semibold text-gray-800 bg-white border border-primary-300 rounded-lg px-1.5 py-0.5 focus:outline-none"
                />
              ) : (
                <div className="font-semibold text-xs text-gray-800 leading-tight pr-8">
                  {preset.name}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                {presetSummary(preset)}
              </div>
            </button>

            {/* Action buttons (edit/delete) — visible on hover */}
            <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                title="Rename preset"
                onClick={e => { e.stopPropagation(); startRename(preset) }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-primary-600 hover:bg-primary-100 transition-all text-[11px] leading-none"
              >
                ✎
              </button>
              <button
                title="Delete preset"
                onClick={e => { e.stopPropagation(); handleDelete(preset.id) }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all text-xs leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* Add new preset card */}
        <button
          onClick={() => setShowSaveInput(v => !v)}
          className="p-2.5 border border-dashed border-primary-300 rounded-xl text-left hover:bg-primary-50 transition-all active:scale-95"
        >
          <div className="font-semibold text-xs text-primary-600 leading-tight">+ Save current</div>
          <div className="text-[10px] text-primary-400 mt-0.5">as new preset</div>
        </button>
      </div>

      {/* Inline save-as-preset form */}
      {showSaveInput && (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            type="text"
            value={savingName}
            onChange={e => setSavingName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveCurrent(); if (e.key === 'Escape') { setShowSaveInput(false); setSavingName('') } }}
            placeholder="Preset name (e.g. Guest Bedroom)"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
          />
          <button
            onClick={handleSaveCurrent}
            disabled={!savingName.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setShowSaveInput(false); setSavingName('') }}
            className="px-3 py-2 text-sm text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Reset to defaults (subtle link) */}
      <div className="flex justify-end">
        <button
          onClick={resetDefaults}
          className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Reset to default presets
        </button>
      </div>
    </div>
  )
}
