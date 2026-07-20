import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileDown, Printer, X } from 'lucide-react'
import CalculatorReport from './report/CalculatorReport'
import { buildCalculatorReport, reportFilename } from './report/calculatorReportModel'

const EMPTY_PROJECT = { jobName: '', jobAddress: '', contractorName: '', estimatorName: '', notes: '' }
const PRINTING_CLASS = 'dtb-calculator-report-printing'

export default function SummaryView({ data, onProjectUpdate }) {
  const [projectDraft, setProjectDraft] = useState({ ...EMPTY_PROJECT, ...(data.project || {}) })
  const [showReportPreview, setShowReportPreview] = useState(false)
  const report = useMemo(() => buildCalculatorReport({ ...data, project: projectDraft }), [data, projectDraft])

  useEffect(() => {
    if (!showReportPreview) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowReportPreview(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showReportPreview])

  const handleProjectField = (field) => (event) => {
    const next = { ...projectDraft, [field]: event.target.value }
    setProjectDraft(next)
    onProjectUpdate?.(next)
  }

  const handlePrint = () => {
    const previousTitle = document.title
    const printTitle = reportFilename(report).replace(/\.pdf$/i, '')
    let restored = false
    const restorePrintState = () => {
      if (restored) return
      restored = true
      document.title = previousTitle
      document.body.classList.remove(PRINTING_CLASS)
    }
    document.title = printTitle
    document.body.classList.add(PRINTING_CLASS)
    window.addEventListener('afterprint', restorePrintState, { once: true })
    window.setTimeout(restorePrintState, 60000)
    window.print()
  }

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Report details</p>
          <h3 className="text-base font-semibold text-gray-900">Project information</h3>
          <p className="text-xs text-gray-500 mt-1">These details appear in the professional material estimate report.</p>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ProjectField label="Job name" value={projectDraft.jobName} onChange={handleProjectField('jobName')} placeholder="Smith basement remodel" />
          <ProjectField label="Job address" value={projectDraft.jobAddress} onChange={handleProjectField('jobAddress')} placeholder="123 Main St, Minneapolis, MN" />
          <ProjectField label="Contractor" value={projectDraft.contractorName} onChange={handleProjectField('contractorName')} placeholder="Company or crew name" />
          <ProjectField label="Estimator" value={projectDraft.estimatorName} onChange={handleProjectField('estimatorName')} placeholder="Estimator name" />
          <label className="sm:col-span-2 block">
            <span className="block text-xs font-medium text-gray-600 mb-1.5">Project notes</span>
            <textarea value={projectDraft.notes} onChange={handleProjectField('notes')} rows={3} placeholder="Optional scope, assumptions, or field notes" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm leading-snug focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-y" />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.sections.map((section) => (
          <SummaryCard key={section.key} eyebrow={section.eyebrow} title={section.title} result={`${section.primary.value}${section.primary.unit ? ` ${section.primary.unit}` : ''}`}>
            {section.details.filter((item) => item.value !== '—').slice(0, 7).map((item) => (
              <SummaryItem key={`${section.key}-${item.label}`} label={item.label} value={item.value} />
            ))}
          </SummaryCard>
        ))}
      </div>

      <section className="border border-gray-200 bg-gray-50 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Professional report</p>
            <h3 className="text-base font-semibold text-gray-900">Export or print your material estimate</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">Preview the dedicated Letter-size report, then choose Save as PDF in your browser print dialog or send it directly to a printer.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
            <button type="button" onClick={() => setShowReportPreview(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <FileDown className="w-4 h-4" aria-hidden="true" /> Export / Save PDF
            </button>
            <button type="button" onClick={handlePrint} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition-colors">
              <Printer className="w-4 h-4" aria-hidden="true" /> Print Report
            </button>
          </div>
        </div>
      </section>

      <div className="border border-primary-200 bg-primary-50 rounded-xl p-4 text-sm text-primary-800 leading-relaxed">{report.disclaimer}</div>

      {typeof document !== 'undefined' && createPortal(
        <div className="dtb-calculator-report-print-root" aria-hidden="true"><CalculatorReport report={report} /></div>, document.body,
      )}

      {showReportPreview && typeof document !== 'undefined' && createPortal(
        <div className="dtb-report-preview-modal" role="dialog" aria-modal="true" aria-label="Material estimate report preview">
          <div className="dtb-report-preview-toolbar">
            <div>
              <strong>Material Estimate Preview</strong>
              <p>Letter-size report · choose Save as PDF in the print dialog for a digital copy.</p>
            </div>
            <div className="dtb-report-preview-actions">
              <button type="button" onClick={() => setShowReportPreview(false)}><X className="w-4 h-4 inline-block mr-1.5 align-text-bottom" aria-hidden="true" />Close</button>
              <button type="button" className="dtb-report-preview-primary" onClick={handlePrint}><Printer className="w-4 h-4 inline-block mr-1.5 align-text-bottom" aria-hidden="true" />Save / Print PDF</button>
            </div>
          </div>
          <div className="dtb-report-preview-scroll"><div className="dtb-report-preview-paper"><CalculatorReport report={report} /></div></div>
        </div>, document.body,
      )}
    </div>
  )
}

function ProjectField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
      <input type="text" value={value} onChange={onChange} placeholder={placeholder} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm leading-snug focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition" />
    </label>
  )
}

function SummaryCard({ eyebrow, title, result, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{eyebrow}</p><h3 className="text-sm font-semibold text-gray-900">{title}</h3></div>
        <span className="text-sm font-semibold text-primary-700 text-right">{result}</span>
      </div>
      <div className="px-4 py-3 divide-y divide-gray-100">{children}</div>
    </section>
  )
}

function SummaryItem({ label, value }) {
  return <div className="flex justify-between items-start gap-4 py-2 text-sm first:pt-0 last:pb-0"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-900 text-right">{value}</span></div>
}
