import { useState, memo } from 'react'
import { ChevronDown } from 'lucide-react'

const LS_VIZ_KEY = 'sheetLayoutVisualizerState'
const MAX_CELLS = 100

/**
 * Compute display cell dimensions that preserve the physical sheet aspect ratio.
 * Horizontal hang sheets are wider than tall; vertical hang sheets are taller than wide.
 */
function getCellSize(acrossDim, verticalDim) {
  const ratio = acrossDim / verticalDim
  if (ratio >= 1) {
    // Sheet is wider than tall (horizontal hang)
    const cellH = 20
    return { cellWidth: Math.max(12, Math.round(cellH * ratio)), cellHeight: cellH }
  }
  // Sheet is taller than wide (vertical hang)
  const cellW = 16
  return { cellWidth: cellW, cellHeight: Math.max(12, Math.round(cellW / ratio)) }
}

/**
 * Reduce the displayed grid to stay within MAX_CELLS while preserving the
 * sheetsAcross / sheetsVertical ratio as closely as possible.
 */
function getDisplayGrid(sheetsAcross, sheetsVertical) {
  if (sheetsAcross <= 0 || sheetsVertical <= 0) {
    return { displayAcross: 0, displayVertical: 0, capped: false }
  }
  if (sheetsAcross * sheetsVertical <= MAX_CELLS) {
    return { displayAcross: sheetsAcross, displayVertical: sheetsVertical, capped: false }
  }
  const ratio = sheetsAcross / sheetsVertical
  const da = Math.min(sheetsAcross, Math.max(1, Math.ceil(Math.sqrt(MAX_CELLS * ratio))))
  const dv = Math.min(sheetsVertical, Math.max(1, Math.ceil(MAX_CELLS / da)))
  return { displayAcross: da, displayVertical: dv, capped: true }
}

/** Per-wall schematic grid strip. */
const WallStrip = memo(function WallStrip({
  wall,
  wallIndex,
  cellWidth,
  cellHeight,
  hangDirection,
}) {
  const { sheetsAcross, sheetsVertical, sheetsForWall, length, hJointLength, vJointLength } = wall
  const { displayAcross, displayVertical, capped } = getDisplayGrid(sheetsAcross, sheetsVertical)

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-3"
      style={{ contain: 'layout paint' }}
    >
      {/* Wall header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-gray-800">Wall {wallIndex + 1}</span>
          <span className="text-[11px] text-gray-400 ml-1.5 tabular-nums">{length} ft</span>
        </div>
        <span className="shrink-0 text-[11px] text-primary-600 font-semibold tabular-nums bg-primary-50 px-2 py-0.5 rounded-full">
          {sheetsAcross}×{sheetsVertical} = {sheetsForWall} sheets
        </span>
      </div>

      {/* Seam footage */}
      <div className="flex gap-3 mb-2.5">
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span
            aria-hidden="true"
            className="inline-block w-4"
            style={{
              borderBottom: `2px ${hangDirection === 'horizontal' ? 'solid' : 'dashed'} #94a3b8`,
            }}
          />
          H: {Math.round(hJointLength)} ft
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span
            aria-hidden="true"
            className="inline-block"
            style={{
              width: 0,
              height: 12,
              borderLeft: `2px ${hangDirection === 'vertical' ? 'solid' : 'dashed'} #94a3b8`,
            }}
          />
          V: {Math.round(vJointLength)} ft
        </span>
      </div>

      {/* Sheet grid — empty state for zero-length wall */}
      {displayAcross === 0 || displayVertical === 0 ? (
        <p className="text-[11px] text-gray-400 italic">No sheets — zero wall length</p>
      ) : (
        <div className="overflow-x-auto" style={{ contain: 'paint' }}>
          <div
            role="grid"
            aria-label={`Wall ${wallIndex + 1}: ${sheetsAcross} sheets across, ${sheetsVertical} rows`}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${displayAcross}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${displayVertical}, ${cellHeight}px)`,
              width: displayAcross * cellWidth,
            }}
          >
            {Array.from({ length: displayAcross * displayVertical }, (_, i) => {
              const col = i % displayAcross
              const row = Math.floor(i / displayAcross)
              // Alternating tint communicates the dominant seam direction:
              // horizontal hang → alternate row tint; vertical hang → alternate column tint
              const tinted = hangDirection === 'horizontal' ? row % 2 === 0 : col % 2 === 0
              return (
                <div
                  key={i}
                  role="gridcell"
                  style={{
                    width: cellWidth,
                    height: cellHeight,
                    border: '1px solid #e2e8f0',
                    backgroundColor: tinted ? '#f0f9ff' : '#f8fafc',
                    boxSizing: 'border-box',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {capped && (
        <p className="text-[10px] text-amber-600 mt-2">
          Showing {displayAcross}×{displayVertical} of {sheetsAcross}×{sheetsVertical} cells
        </p>
      )}
    </div>
  )
})

/**
 * SheetLayoutVisualizer — collapsible schematic grid showing per-wall sheet
 * placement for layout planning and waste estimation.
 *
 * Props:
 *   wallLayouts           WallLayout[]   — from computeLayout results
 *   acrossDim             number         — sheet dimension across the wall (ft)
 *   verticalDim           number         — sheet dimension up the wall (ft)
 *   hangDirection         'horizontal' | 'vertical'
 *   ceilHeight            number         — ceiling height in ft (display only)
 *   baseSheets            number         — total layout sheets before waste
 *   totalJointLinearFeet  number         — aggregate joint footage
 */
const SheetLayoutVisualizer = memo(function SheetLayoutVisualizer({
  wallLayouts,
  acrossDim,
  verticalDim,
  hangDirection,
  baseSheets,
  totalJointLinearFeet,
}) {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(LS_VIZ_KEY) === 'expanded' } catch { return false }
  })

  const toggle = () => {
    setExpanded(prev => {
      const next = !prev
      try { localStorage.setItem(LS_VIZ_KEY, next ? 'expanded' : 'collapsed') } catch { /* ignore */ }
      return next
    })
  }

  const { cellWidth, cellHeight } = getCellSize(acrossDim, verticalDim)

  const hasData =
    Array.isArray(wallLayouts) &&
    wallLayouts.length > 0 &&
    wallLayouts.some(w => (w.length || 0) > 0)

  const dominantSeam = hangDirection === 'horizontal' ? 'H-seams' : 'V-seams'

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Accordion header / toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls="sheet-layout-viz-body"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        style={{ minHeight: 44 }}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-gray-800 shrink-0">Sheet Layout</span>
          {hasData && (
            <>
              <span className="text-[10px] font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full shrink-0">
                {wallLayouts.length} wall{wallLayouts.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full shrink-0">
                {baseSheets} sheets
              </span>
              <span className="text-[10px] font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
                {dominantSeam} dominant
              </span>
            </>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 ml-2 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Expandable body */}
      {expanded && (
        <div id="sheet-layout-viz-body" className="p-4 space-y-4 border-t border-gray-200">
          {!hasData ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm font-medium">No layout data yet</p>
              <p className="text-xs mt-1">
                Add walls and set ceiling height to visualize the sheet layout.
              </p>
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                aria-label="Sheet layout visualization"
              >
                {wallLayouts.map((wall, i) => (
                  <WallStrip
                    key={wall.id}
                    wall={wall}
                    wallIndex={i}
                    cellWidth={cellWidth}
                    cellHeight={cellHeight}
                    hangDirection={hangDirection}
                  />
                ))}
              </div>

              <p className="text-[11px] text-gray-400 leading-snug border-t border-gray-100 pt-3">
                Schematic visualization for layout planning and waste estimation; not for field cut
                mapping. Alternating tint indicates{' '}
                {hangDirection === 'horizontal' ? 'horizontal row' : 'vertical column'} seams.
                Total joint footage: {Math.round(totalJointLinearFeet)} linear ft.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
})

export default SheetLayoutVisualizer
