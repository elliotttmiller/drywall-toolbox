const SHEET_SIZE_LABELS = { 32: '4×8 ft', 40: '4×10 ft', 48: '4×12 ft' }
const HANG_DIRECTION_LABELS = { horizontal: 'Horizontal', vertical: 'Vertical' }
const COMPOUND_TYPE_LABELS = {
  'all-purpose': 'All-Purpose',
  topping: 'Topping',
  setting: 'Setting (Hot Mud)',
  lightweight: 'Lightweight All-Purpose',
}
const TAPE_TYPE_LABELS = { paper: 'Paper tape', mesh: 'Fiberglass mesh', flex: 'Flexible corner tape' }
const BEAD_TYPE_LABELS = {
  metal: 'Metal corner bead',
  standard: 'Metal corner bead',
  bullnose: 'Bullnose bead',
  vinyl: 'Vinyl corner bead',
  flex: 'Flexible / arch bead',
}
const APPLICATION_LABELS = { wall: 'Walls', ceiling: 'Ceiling', both: 'Walls + ceiling' }
const EMPTY_VALUE = '—'

function hasValue(value) {
  return value !== null && value !== undefined && value !== ''
}

function numberValue(value, maximumFractionDigits = 2) {
  if (!hasValue(value) || Number.isNaN(Number(value))) return EMPTY_VALUE
  return Number(value).toLocaleString(undefined, { maximumFractionDigits })
}

function valueWithUnit(value, unit, maximumFractionDigits = 2) {
  const formatted = numberValue(value, maximumFractionDigits)
  return formatted === EMPTY_VALUE ? EMPTY_VALUE : `${formatted} ${unit}`
}

function percentage(value) {
  if (!hasValue(value) || Number.isNaN(Number(value))) return EMPTY_VALUE
  return `${Math.round(Number(value) * 100)}%`
}

function safeText(value, fallback = EMPTY_VALUE) {
  const text = String(value ?? '').trim()
  return text || fallback
}

function localDateParts(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return {
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    label: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
  }
}

function primary(label, value, unit) {
  const formatted = numberValue(value, 2)
  return { label, value: formatted, unit: formatted === EMPTY_VALUE ? '' : unit }
}

function detail(label, value) {
  return { label, value: hasValue(value) ? String(value) : EMPTY_VALUE }
}

function group(key, title, rows) {
  return { key, title, rows }
}

function makeSection({ key, eyebrow, title, primaryResult, groups }) {
  return {
    key,
    eyebrow,
    title,
    primary: primaryResult,
    groups,
    details: groups.flatMap((item) => item.rows),
  }
}

/**
 * Canonical presentation model for the Summary tab and printable/PDF report.
 * Calculator-specific field mapping belongs here so output surfaces cannot drift.
 *
 * @param {object} data CalculatorHub summary state.
 * @param {Date} generatedAt Report generation time.
 * @returns {object}
 */
export function buildCalculatorReport(data = {}, generatedAt = new Date()) {
  const { project = {}, sheets = {}, mud = {}, tape = {}, bead = {}, screws = {} } = data
  const generatedDate = localDateParts(generatedAt)
  const openingDeductions = hasValue(sheets.gross) && hasValue(sheets.net)
    ? Math.max(0, Number(sheets.gross) - Number(sheets.net))
    : null

  return {
    schemaVersion: 2,
    generatedAt: generatedAt.toISOString(),
    generatedDate: generatedDate.iso,
    generatedDateLabel: generatedDate.label,
    project: {
      jobName: safeText(project.jobName, 'Untitled project'),
      jobAddress: safeText(project.jobAddress),
      contractorName: safeText(project.contractorName),
      estimatorName: safeText(project.estimatorName),
      notes: String(project.notes ?? '').trim(),
    },
    summaryItems: [
      { key: 'sheets', label: 'Drywall Sheets', quantity: numberValue(sheets.sheets, 0), unit: 'sheets' },
      { key: 'mud', label: 'Joint Compound', quantity: numberValue(mud.buckets5gal, 0), unit: '5-gal buckets' },
      { key: 'tape', label: 'Joint Tape', quantity: numberValue(tape.rolls, 0), unit: 'rolls' },
      { key: 'bead', label: 'Corner Bead', quantity: numberValue(bead.sections, 0), unit: 'sections' },
      { key: 'screws', label: 'Drywall Screws', quantity: numberValue(screws.boxes, 0), unit: 'boxes' },
    ],
    sections: [
      makeSection({
        key: 'sheets',
        eyebrow: 'Board takeoff',
        title: 'Drywall Sheets',
        primaryResult: primary('Recommended quantity', sheets.sheets, 'sheets'),
        groups: [
          group('inputs', 'Project inputs', [
            detail('Sheet size', SHEET_SIZE_LABELS[sheets.sheetSize] || EMPTY_VALUE),
            detail('Hang direction', HANG_DIRECTION_LABELS[sheets.hangDir] || EMPTY_VALUE),
            detail('Wall count', numberValue(sheets.numWalls, 0)),
            detail('Ceiling height', valueWithUnit(sheets.ceilHeight, 'ft')),
            detail('Ceiling included', hasValue(sheets.inclCeiling) ? (sheets.inclCeiling ? 'Yes' : 'No') : EMPTY_VALUE),
            detail('Applied waste factor', percentage(sheets.wastePct)),
          ]),
          group('results', 'Calculated takeoff', [
            detail('Wall area', valueWithUnit(sheets.wallArea, 'sq ft', 0)),
            detail('Ceiling area', valueWithUnit(sheets.ceilArea, 'sq ft', 0)),
            detail('Opening deductions', valueWithUnit(openingDeductions, 'sq ft', 0)),
            detail('Net board area', valueWithUnit(sheets.net, 'sq ft', 0)),
            detail('Base sheets', numberValue(sheets.baseSheets, 0)),
            detail('Layout waste indicator', percentage(sheets.dynamicWaste)),
            detail('Total joint footage', valueWithUnit(sheets.totalJointLinearFeet, 'lf', 0)),
          ]),
        ],
      }),
      makeSection({
        key: 'mud',
        eyebrow: 'Finishing material',
        title: 'Joint Compound',
        primaryResult: primary('5-gallon buckets', mud.buckets5gal, 'buckets'),
        groups: [
          group('inputs', 'Finish specification', [
            detail('Calculated area', valueWithUnit(mud.area, 'sq ft', 0)),
            detail('Finish level', hasValue(mud.finishLevel) ? `Level ${mud.finishLevel}` : EMPTY_VALUE),
            detail('Compound type', COMPOUND_TYPE_LABELS[mud.compoundType] || safeText(mud.compoundType)),
            detail('Coat count', numberValue(mud.coats, 0)),
          ]),
          group('results', 'Material requirement', [
            detail('Total compound', valueWithUnit(mud.totalGallons, 'gal')),
            detail('1-gallon equivalent', valueWithUnit(mud.buckets1gal, 'buckets', 0)),
            detail('Calculation source', mud.syncedFromSheets ? 'Synced from sheet net area' : 'Manual calculator area'),
          ]),
        ],
      }),
      makeSection({
        key: 'tape',
        eyebrow: 'Joint treatment',
        title: 'Joint Tape',
        primaryResult: primary('Recommended quantity', tape.rolls, 'rolls'),
        groups: [
          group('inputs', 'Tape specification', [
            detail('Tape type', TAPE_TYPE_LABELS[tape.tapeType] || safeText(tape.tapeType)),
            detail('Roll size', valueWithUnit(tape.rollSize, 'ft', 0)),
            detail('Calculation source', tape.syncedFromSheets ? 'Layout-derived joint footage' : 'Manual area estimate'),
          ]),
          group('results', 'Coverage requirement', [
            detail('Joint footage', valueWithUnit(tape.seamFeet, 'ft', 0)),
            detail('Corner footage', valueWithUnit(tape.cornerFeet, 'ft', 0)),
            detail('Total tape', valueWithUnit(tape.totalFeet, 'ft', 0)),
          ]),
        ],
      }),
      makeSection({
        key: 'bead',
        eyebrow: 'Outside corners',
        title: 'Corner Bead',
        primaryResult: primary('Recommended quantity', bead.sections, 'sections'),
        groups: [
          group('inputs', 'Bead specification', [
            detail('Bead type', BEAD_TYPE_LABELS[bead.beadType] || safeText(bead.beadType)),
            detail('Stock length', valueWithUnit(bead.stockLength, 'ft', 0)),
          ]),
          group('results', 'Linear requirement', [
            detail('Straight corners', valueWithUnit(bead.standardFeet, 'ft', 0)),
            detail('Arch / flexible bead', valueWithUnit(bead.archFeet, 'ft', 0)),
            detail('Total bead', valueWithUnit(bead.totalFeet, 'ft', 0)),
          ]),
        ],
      }),
      makeSection({
        key: 'screws',
        eyebrow: 'Fasteners',
        title: 'Drywall Screws',
        primaryResult: primary('Recommended quantity', screws.boxes, 'boxes'),
        groups: [
          group('inputs', 'Fastener specification', [
            detail('Screw length', safeText(screws.screwLength)),
            detail('Application', APPLICATION_LABELS[screws.application] || safeText(screws.application)),
            detail('Sheets used', numberValue(screws.sheetsUsed, 0)),
            detail('Box size', valueWithUnit(screws.boxSize, 'screws', 0)),
          ]),
          group('results', 'Calculated quantity', [
            detail('Screws per sheet', numberValue(screws.perSheet, 0)),
            detail('Total screws', numberValue(screws.totalScrews, 0)),
            detail('Calculation source', screws.syncedFromSheets ? 'Synced from sheet quantity' : 'Manual sheet quantity'),
          ]),
        ],
      }),
    ],
    disclaimer: 'Material quantities are planning estimates based on the dimensions, selections, and waste factors entered in the Drywall Toolbox calculators. Verify field measurements, project specifications, manufacturer requirements, and applicable local code before purchasing or installing materials.',
  }
}

export function reportFilename(report) {
  const rawName = report?.project?.jobName || 'Material Estimate'
  const safeName = rawName.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'Material-Estimate'
  const date = report?.generatedDate || localDateParts(new Date()).iso
  return `DTB-Material-Estimate_${safeName}_${date}.pdf`
}
