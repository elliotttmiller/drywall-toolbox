import { useState, useMemo, useEffect } from 'react'
import ResultCard from './shared/ResultCard'
import InfoBox from './shared/InfoBox'
import WasteSelector from './shared/WasteSelector'
import RoomPresets from './shared/RoomPresets'
import CalcDropdown from './shared/CalcDropdown'

// Default to a standard 12×14 bedroom with 4 walls
const DEFAULT_WALLS = [
  { id: 1, length: 12 },
  { id: 2, length: 14 },
  { id: 3, length: 12 },
  { id: 4, length: 14 },
]

// Default opening deduction sizes per GA-216 / ASTM C1396 (sq ft)
// Users can override these in the calculator UI.
const DEFAULT_DOOR_SQ_FT   = 21  // standard 3 ft × 7 ft door opening
const DEFAULT_WINDOW_SQ_FT = 15  // typical 3 ft × 5 ft window opening

// All standard drywall sheets are 4 ft wide (48 in)
const SHEET_SHORT_DIM = 4  // ft — the narrow dimension, always 4 ft

const LS_KEY = 'dwCalc_sheet'

// sheetSize = area in sq ft; long dimension = sheetSize / SHEET_SHORT_DIM
const sheetSizeOptions = [
  { value: 32, label: '4×8 ft',  description: '32 sq ft — standard' },
  { value: 40, label: '4×10 ft', description: '40 sq ft' },
  { value: 48, label: '4×12 ft', description: '48 sq ft — fewer seams' },
]

const hangDirOptions = [
  { value: 'horizontal', label: 'Horizontal', description: 'Recommended — fewest seams on 8–10 ft walls' },
  { value: 'vertical',   label: 'Vertical',   description: 'Standard — use on tall walls > 12 ft' },
]

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

/**
 * Layout-based sheet calculation per wall (GA-216 / ASTM C840 compliant).
 *
 * Horizontal hang: sheet's LONG dimension (8/10/12 ft) runs along wall length;
 *   SHORT dimension (4 ft) stacks vertically.
 * Vertical hang: sheet's SHORT dimension (4 ft) runs along wall length;
 *   LONG dimension (8/10/12 ft) stacks vertically.
 *
 * Returns per-wall layout data plus total joint linear footage.
 */
function computeLayout(walls, ceilHeight, sheetSize, hangDir, inclCeiling, roomLength, roomWidth) {
  const LONG = sheetSize / SHEET_SHORT_DIM  // 8, 10, or 12 ft

  // Dimension in the "across the wall" direction
  const acrossDim  = hangDir === 'horizontal' ? LONG           : SHEET_SHORT_DIM
  // Dimension in the "up the wall" direction
  const verticalDim = hangDir === 'horizontal' ? SHEET_SHORT_DIM : LONG

  const wallLayouts = walls.map(w => {
    const length = w.length || 0
    const sheetsAcross   = Math.ceil(length    / acrossDim)
    const sheetsVertical = Math.ceil(ceilHeight / verticalDim)
    const sheetsForWall  = sheetsAcross * sheetsVertical
    // Joints: (rows - 1) horizontal seams spanning wall length; (cols - 1) vertical seams spanning wall height
    const hJointLength = (sheetsVertical - 1) * length
    const vJointLength = (sheetsAcross   - 1) * ceilHeight
    return { id: w.id, length, sheetsAcross, sheetsVertical, sheetsForWall, hJointLength, vJointLength }
  })

  const totalWallSheets       = wallLayouts.reduce((s, w) => s + w.sheetsForWall,  0)
  const totalVerticalSeams    = wallLayouts.reduce((s, w) => s + Math.max(0, w.sheetsAcross   - 1), 0)
  const totalJointLinearFeet  = wallLayouts.reduce((s, w) => s + w.hJointLength + w.vJointLength, 0)
  const wallGross             = walls.reduce((s, w) => s + (w.length || 0) * ceilHeight, 0)

  // Ceiling layout (always apply short dim across room length, long dim across width)
  let ceilSheets = 0, ceilJointFt = 0, ceilArea = 0
  if (inclCeiling) {
    ceilArea  = roomLength * roomWidth
    const cSheetsAcross   = Math.ceil(roomLength / SHEET_SHORT_DIM)
    const cSheetsVertical = Math.ceil(roomWidth  / LONG)
    ceilSheets  = cSheetsAcross * cSheetsVertical
    ceilJointFt = (cSheetsAcross - 1) * roomWidth + (cSheetsVertical - 1) * roomLength
  }

  return {
    wallLayouts,
    wallGross,
    ceilArea,
    ceilSheets,
    ceilJointFt,
    totalWallSheets,
    totalVerticalSeams,
    totalJointLinearFeet: totalJointLinearFeet + ceilJointFt,
    acrossDim,
    verticalDim,
    LONG,
  }
}

export default function SheetCalculator({ onUpdate }) {
  const saved = loadSaved()
  const [walls, setWalls] = useState(saved.walls || DEFAULT_WALLS)
  const [ceilHeight, setCeilHeight] = useState(saved.ceilHeight ?? 9)
  const [sheetSize, setSheetSize] = useState(saved.sheetSize ?? 48)
  const [hangDir, setHangDir] = useState(saved.hangDir ?? 'horizontal')
  const [doors, setDoors] = useState(saved.doors ?? 1)
  const [windows, setWindows] = useState(saved.windows ?? 2)
  const [wastePct, setWastePct] = useState(saved.wastePct ?? 0.10)
  const [inclCeiling, setInclCeiling] = useState(saved.inclCeiling ?? false)
  const [roomLength, setRoomLength] = useState(saved.roomLength ?? 12)
  const [roomWidth, setRoomWidth] = useState(saved.roomWidth ?? 14)
  const [doorSqFt, setDoorSqFt] = useState(saved.doorSqFt ?? DEFAULT_DOOR_SQ_FT)
  const [windowSqFt, setWindowSqFt] = useState(saved.windowSqFt ?? DEFAULT_WINDOW_SQ_FT)
  const [showAdvancedOpenings, setShowAdvancedOpenings] = useState(false)

  // All calculation logic lives in useMemo — recalculates only when inputs change
  const results = useMemo(() => {
    const layout = computeLayout(walls, ceilHeight, sheetSize, hangDir, inclCeiling, roomLength, roomWidth)
    const { wallLayouts, wallGross, ceilArea, ceilSheets, totalWallSheets, totalVerticalSeams, totalJointLinearFeet } = layout

    const gross       = wallGross + ceilArea
    const deductions  = doors * doorSqFt + windows * windowSqFt
    const net         = Math.max(0, gross - deductions)

    // Dynamic waste factor per production-grade spec:
    // Base 10% + 2% per additional vertical seam beyond 1 (capped at 25%)
    // Reference: "From Heuristic Guesswork to Codified Precision" §Sheet Quantities
    const dynamicWaste = Math.min(0.25, 0.10 + Math.max(0, totalVerticalSeams - 1) * 0.02)

    const baseSheets  = totalWallSheets + ceilSheets
    const finalSheets = Math.ceil(baseSheets * (1 + wastePct))  // user-selected waste applied to layout total

    return {
      ...layout,
      gross, net, deductions,
      baseSheets,
      sheets: finalSheets,
      dynamicWaste,
      // kept for backward compat
      wallGross,
      ceilArea,
      withWaste: net * (1 + wastePct),
      wallLayouts,
      totalJointLinearFeet,
      totalVerticalSeams,
    }
  }, [walls, ceilHeight, sheetSize, hangDir, doors, windows, wastePct, inclCeiling, roomLength, roomWidth, doorSqFt, windowSqFt])

  // Persist inputs across page refreshes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ walls, ceilHeight, sheetSize, hangDir, doors, windows, wastePct, inclCeiling, roomLength, roomWidth, doorSqFt, windowSqFt }))
  }, [walls, ceilHeight, sheetSize, hangDir, doors, windows, wastePct, inclCeiling, roomLength, roomWidth, doorSqFt, windowSqFt])

  // Notify parent of updates for summary tab and cross-calculator data sharing
  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        sheets: results.sheets,
        sheetSize,
        hangDir,
        gross: Math.round(results.gross),
        net: Math.round(results.net),
        wallArea: Math.round(results.wallGross),
        ceilArea: Math.round(results.ceilArea),
        wastePct,
        dynamicWaste: results.dynamicWaste,
        numWalls: walls.length,
        doors,
        windows,
        inclCeiling,
        doorSqFt,
        windowSqFt,
        // Layout data consumed by Tape, Mud, and Screw calculators
        totalJointLinearFeet: Math.round(results.totalJointLinearFeet),
        totalVerticalSeams: results.totalVerticalSeams,
        baseSheets: results.baseSheets,
        ceilHeight,
        sheetLongDim: results.LONG,
        sheetShortDim: SHEET_SHORT_DIM,
        wallLayouts: results.wallLayouts,
      })
    }
  }, [results, sheetSize, hangDir, wastePct, walls.length, doors, windows, inclCeiling, ceilHeight, doorSqFt, windowSqFt, onUpdate])

  const addWall = () =>
    setWalls(prev => [...prev, { id: Date.now(), length: 10 }])

  const removeWall = (id) =>
    setWalls(prev => prev.filter(w => w.id !== id))

  const updateWallLength = (id, length) =>
    setWalls(prev => prev.map(w => w.id === id ? { ...w, length: +length } : w))

  // Restore full room configuration from a preset (including all optional fields)
  const applyRoomPreset = (preset) => {
    if (Array.isArray(preset.walls)) {
      // New-style preset: has full walls array + all config fields
      setWalls(preset.walls.map((w, i) => ({ id: Date.now() + i, length: w.length })))
      if (preset.ceilHeight  != null) setCeilHeight(preset.ceilHeight)
      if (preset.doors       != null) setDoors(preset.doors)
      if (preset.windows     != null) setWindows(preset.windows)
      if (preset.inclCeiling != null) setInclCeiling(preset.inclCeiling)
      if (preset.roomLength  != null) setRoomLength(preset.roomLength)
      if (preset.roomWidth   != null) setRoomWidth(preset.roomWidth)
      if (preset.doorSqFt    != null) setDoorSqFt(preset.doorSqFt)
      if (preset.windowSqFt  != null) setWindowSqFt(preset.windowSqFt)
    } else {
      // Legacy preset shape (width/length only)
      setWalls([
        { id: Date.now() + 1, length: preset.length },
        { id: Date.now() + 2, length: preset.width },
        { id: Date.now() + 3, length: preset.length },
        { id: Date.now() + 4, length: preset.width },
      ])
    }
  }

  // The full current config — passed to RoomPresets for "save current" functionality
  const currentConfig = { walls, ceilHeight, doors, windows, wastePct, inclCeiling, roomLength, roomWidth, doorSqFt, windowSqFt }

  const wasteLabel = `${Math.round(wastePct * 100)}%`
  const dynamicWasteLabel = `${Math.round(results.dynamicWaste * 100)}%`
  const usingDynamicWaste = wastePct === results.dynamicWaste

  return (
    <div className="space-y-6">
      {/* Room presets */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Room Presets
        </h3>
        <RoomPresets onApply={applyRoomPreset} currentConfig={currentConfig} />
      </div>

      {/* Sheet size + hang direction */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Sheet Size &amp; Hang Direction
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Sheet size
            </label>
            <CalcDropdown
              value={sheetSize}
              onChange={v => setSheetSize(+v)}
              options={sheetSizeOptions}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Hang direction
            </label>
            <CalcDropdown
              value={hangDir}
              onChange={setHangDir}
              options={hangDirOptions}
            />
          </div>
        </div>
      </div>

      {/* Wall list */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Walls — enter each wall length
        </h3>
        <div className="space-y-2">
          {walls.map((wall, index) => {
            // Find this wall's computed layout for the per-wall sheet hint
            const layout = results.wallLayouts?.find(w => w.id === wall.id)
            return (
              <div
                key={wall.id}
                className="bg-gray-50 rounded-xl p-3 border border-gray-200/60"
              >
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-sm font-semibold text-gray-900">
                    Wall {index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    {layout && (
                      <span className="text-xs text-primary-600 font-medium tabular-nums">
                        {layout.sheetsAcross}×{layout.sheetsVertical} = {layout.sheetsForWall} sheets
                      </span>
                    )}
                    {walls.length > 1 && (
                      <button
                        onClick={() => removeWall(wall.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all text-base leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Length (ft)
                    </label>
                    <input
                      type="number"
                      value={wall.length}
                      min={1}
                      step={0.5}
                      onChange={e => updateWallLength(wall.id, e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Height (ft)
                      </label>
                      <input
                        type="number"
                        value={ceilHeight}
                        readOnly
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-100 text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Area (sq ft)
                      </label>
                      <input
                        type="number"
                        value={Math.round((wall.length || 0) * ceilHeight)}
                        readOnly
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-100 text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={addWall}
          className="w-full mt-2 px-4 py-2.5 border border-dashed border-primary-300 rounded-xl text-sm text-primary-600 hover:bg-primary-50 transition-colors font-medium"
        >
          + Add another wall
        </button>
      </div>

      {/* Openings + ceiling height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Ceiling height (ft)
          </label>
          <input
            type="number"
            value={ceilHeight}
            min={6}
            max={20}
            step={0.5}
            onChange={e => setCeilHeight(+e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Door openings
          </label>
          <input
            type="number"
            value={doors}
            min={0}
            onChange={e => setDoors(+e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <span className="text-xs text-gray-500 mt-1.5 block leading-snug">
            Each deducts {doorSqFt} sq ft
          </span>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Window openings
          </label>
          <input
            type="number"
            value={windows}
            min={0}
            onChange={e => setWindows(+e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <span className="text-xs text-gray-500 mt-1.5 block leading-snug">
            Each deducts {windowSqFt} sq ft
          </span>
        </div>
      </div>

      {/* Custom opening sizes (advanced toggle) */}
      <div>
        <button
          onClick={() => setShowAdvancedOpenings(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 transition-colors"
        >
          <span className={`inline-block transition-transform ${showAdvancedOpenings ? 'rotate-90' : ''}`}>▶</span>
          Customize opening sizes
          {(doorSqFt !== DEFAULT_DOOR_SQ_FT || windowSqFt !== DEFAULT_WINDOW_SQ_FT) && (
            <span className="ml-1 text-primary-600 font-semibold">(custom)</span>
          )}
        </button>
        {showAdvancedOpenings && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-500 leading-snug">
              Set the sq ft deducted per opening. GA-216 defaults: door = 21 sq ft (3×7 ft), window = 15 sq ft (3×5 ft).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Sq ft per door
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={doorSqFt}
                    min={1}
                    step={0.5}
                    onChange={e => { const v = +e.target.value; if (v >= 1) setDoorSqFt(v) }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  />
                  {doorSqFt !== DEFAULT_DOOR_SQ_FT && (
                    <button
                      title="Reset to GA-216 default"
                      onClick={() => setDoorSqFt(DEFAULT_DOOR_SQ_FT)}
                      className="shrink-0 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                    >↩</button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Sq ft per window
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={windowSqFt}
                    min={1}
                    step={0.5}
                    onChange={e => { const v = +e.target.value; if (v >= 1) setWindowSqFt(v) }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  />
                  {windowSqFt !== DEFAULT_WINDOW_SQ_FT && (
                    <button
                      title="Reset to default"
                      onClick={() => setWindowSqFt(DEFAULT_WINDOW_SQ_FT)}
                      className="shrink-0 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                    >↩</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ceiling option */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={inclCeiling}
            onChange={e => setInclCeiling(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600"
          />
          <span className="text-sm font-medium text-gray-900">
            Include ceiling
          </span>
        </label>
        {inclCeiling && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Room length (ft)
              </label>
              <input
                type="number"
                value={roomLength}
                min={1}
                step={0.5}
                onChange={e => setRoomLength(+e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Room width (ft)
              </label>
              <input
                type="number"
                value={roomWidth}
                min={1}
                step={0.5}
                onChange={e => setRoomWidth(+e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
            <div className="col-span-2">
              <span className="text-xs text-gray-500 leading-snug">
                Ceiling area: {Math.round(roomLength * roomWidth)} sq ft
                {' '}(use ⅝″ board at 24″ OC to prevent sag)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Waste selector — with dynamic waste hint */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-600">
            Waste factor
          </label>
          <span className="text-xs text-gray-400">
            Calculated: <span className="font-medium text-primary-600">{dynamicWasteLabel}</span>
            {' '}({results.totalVerticalSeams} vertical seam{results.totalVerticalSeams !== 1 ? 's' : ''})
            {!usingDynamicWaste && <span className="ml-1 text-amber-500">(manual override)</span>}
          </span>
        </div>
        <WasteSelector value={wastePct} onChange={setWastePct} />
      </div>

      {/* Results */}
      <div className="border-t border-gray-200 pt-6">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4"
          aria-live="polite"
          aria-label="Sheet calculator results"
        >
          <ResultCard
            label="Sheets to order"
            value={results.sheets}
            sub={`layout-based · ${wasteLabel} waste`}
            hero
          />
          <ResultCard
            label="Base sheets (no waste)"
            value={results.baseSheets}
            sub="from layout simulation"
          />
          <ResultCard
            label="Net area"
            value={Math.round(results.net)}
            sub="sq ft after openings"
          />
          <ResultCard
            label="Total joint footage"
            value={Math.round(results.totalJointLinearFeet)}
            sub="linear ft (feeds tape + mud)"
          />
          <ResultCard
            label="Wall area"
            value={Math.round(results.wallGross)}
            sub="sq ft (gross)"
          />
          {inclCeiling && (
            <ResultCard
              label="Ceiling area"
              value={Math.round(results.ceilArea)}
              sub="sq ft"
            />
          )}
        </div>

        <InfoBox>
          {results.sheets > 0
            ? `Layout-based: ${results.baseSheets} base sheets across ${walls.length} wall(s)${inclCeiling ? ' + ceiling' : ''} — ${doors} door(s) and ${windows} window(s) deducted. Dynamic waste: ${dynamicWasteLabel} (${results.totalVerticalSeams} vertical seams). Applied waste: ${wasteLabel}. Total joint footage: ${Math.round(results.totalJointLinearFeet)} ft — auto-populates Tape and Mud tabs.`
            : 'Add your wall lengths above to see the layout-based sheet count.'}
        </InfoBox>

        <p className="text-xs text-gray-400 mt-3">
          Layout method per ASTM C840 / GA-216: ⌈wall÷sheet⌉ × ⌈height÷sheet⌉ per wall. GA-216 §11.2.1: no sheet deduction for openings &lt; 16 sq ft (openings deducted from net area for compound/tape estimation only). Dynamic waste = 10% base + 2% per additional vertical seam. Joint footage auto-populates Tape &amp; Mud calculators.
        </p>
      </div>
    </div>
  )
}

