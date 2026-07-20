import { useState, useEffect, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import SheetCalculator from './SheetCalculator'
import MudCalculator from './MudCalculator'
import TapeCalculator from './TapeCalculator'
import CornerBeadCalculator from './CornerBeadCalculator'
import ScrewCalculator from './ScrewCalculator'
import SummaryView from './SummaryView'

const TABS = [
  { id: 'sheets', label: 'Drywall Sheets', shortLabel: 'Sheets', gradient: 'from-primary-500 to-primary-600', bgGradient: 'from-primary-500/10 to-primary-600/10' },
  { id: 'mud', label: 'Joint Compound', shortLabel: 'Compound', gradient: 'from-primary-600 to-primary-700', bgGradient: 'from-primary-600/10 to-primary-700/10' },
  { id: 'tape', label: 'Drywall Tape', shortLabel: 'Tape', gradient: 'from-primary-400 to-primary-600', bgGradient: 'from-primary-400/10 to-primary-600/10' },
  { id: 'bead', label: 'Corner Bead', shortLabel: 'Bead', gradient: 'from-primary-700 to-primary-800', bgGradient: 'from-primary-700/10 to-primary-800/10' },
  { id: 'screws', label: 'Screws', shortLabel: 'Screws', gradient: 'from-primary-500 to-primary-700', bgGradient: 'from-primary-500/10 to-primary-700/10' },
  { id: 'summary', label: 'Project Summary', shortLabel: 'Summary', gradient: 'from-accent-500 to-primary-700', bgGradient: 'from-accent-500/10 to-primary-700/10' },
]

const HUB_STORAGE_KEY = 'dwCalc_state'
const HUB_STORAGE_VERSION = 2
const DEFAULT_SUMMARY_DATA = {
  sheets: {},
  mud: {},
  tape: {},
  bead: {},
  screws: {},
  project: { jobName: '', jobAddress: '', contractorName: '', estimatorName: '', notes: '' },
}

function loadHubState() {
  try {
    return JSON.parse(localStorage.getItem(HUB_STORAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function loadSummaryData() {
  const saved = loadHubState()
  const summary = saved.summaryData && typeof saved.summaryData === 'object' ? saved.summaryData : {}
  const project = summary.project && typeof summary.project === 'object' ? summary.project : {}
  return {
    ...DEFAULT_SUMMARY_DATA,
    ...summary,
    project: {
      ...DEFAULT_SUMMARY_DATA.project,
      ...project,
      jobName: project.jobName || summary.projectName || '',
    },
  }
}

const pageTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
}

const toastVariants = {
  initial: { opacity: 0, y: -50, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 30 } },
  exit: { opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } },
}

export default function CalculatorHub() {
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = Number(loadHubState().activeTab)
    return Number.isInteger(savedTab) && savedTab >= 0 && savedTab < TABS.length ? savedTab : 0
  })
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [summaryData, setSummaryData] = useState(loadSummaryData)

  const handleTouchStart = (event) => setTouchStart(event.targetTouches[0].clientX)
  const handleTouchMove = (event) => setTouchEnd(event.targetTouches[0].clientX)

  const changeTab = (newTab) => {
    if (newTab === activeTab) return
    setActiveTab(newTab)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > 75 && activeTab < TABS.length - 1) changeTab(activeTab + 1)
    if (distance < -75 && activeTab > 0) changeTab(activeTab - 1)
    setTouchStart(null)
    setTouchEnd(null)
  }

  const handleSheetUpdate = useCallback((data) => setSummaryData((prev) => ({ ...prev, sheets: data })), [])
  const handleMudUpdate = useCallback((data) => setSummaryData((prev) => ({ ...prev, mud: data })), [])
  const handleTapeUpdate = useCallback((data) => setSummaryData((prev) => ({ ...prev, tape: data })), [])
  const handleBeadUpdate = useCallback((data) => setSummaryData((prev) => ({ ...prev, bead: data })), [])
  const handleScrewUpdate = useCallback((data) => setSummaryData((prev) => ({ ...prev, screws: data })), [])
  const handleProjectUpdate = useCallback((data) => setSummaryData((prev) => ({ ...prev, project: data })), [])

  const showToastMessage = (message) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }
  void showToastMessage

  const currentTab = TABS[activeTab]

  useEffect(() => {
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify({
      version: HUB_STORAGE_VERSION,
      activeTab,
      summaryData,
      timestamp: new Date().toISOString(),
    }))
  }, [activeTab, summaryData])

  return (
    <div className="w-full">
      <AnimatePresence>
        {showToast && (
          <Motion.div variants={toastVariants} initial="initial" animate="animate" exit="exit" className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-primary-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-primary-500/30">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{toastMessage}</span>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      <div className="w-full px-4 pt-6 pb-3 sm:pt-8 sm:pb-4">
        <div className="mx-auto" style={{ maxWidth: 'clamp(320px, 100%, 1200px)' }}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-2 py-2">
            <div className="flex overflow-x-auto scrollbar-none gap-1" style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
              {TABS.map((tab, index) => {
                const isActive = activeTab === index
                return (
                  <Motion.button
                    key={tab.id}
                    onClick={() => changeTab(index)}
                    whileTap={{ scale: 0.94 }}
                    style={{ scrollSnapAlign: 'start' }}
                    className={`relative flex items-center px-3.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200 ${isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                  >
                    {tab.shortLabel}
                  </Motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-8">
        <div className="mx-auto" style={{ maxWidth: 'clamp(320px, 100%, 1200px)' }}>
          <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className="relative">
            <AnimatePresence mode="wait">
              <Motion.div key={activeTab} variants={pageTransition} initial="initial" animate="animate" exit="exit" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7 overflow-hidden">
                <div className={`h-px w-10 bg-linear-to-r ${currentTab.gradient} rounded-full mb-5`} />
                {activeTab === 0 && <SheetCalculator onUpdate={handleSheetUpdate} />}
                {activeTab === 1 && <MudCalculator onUpdate={handleMudUpdate} sheetData={summaryData.sheets} />}
                {activeTab === 2 && <TapeCalculator onUpdate={handleTapeUpdate} sheetData={summaryData.sheets} />}
                {activeTab === 3 && <CornerBeadCalculator onUpdate={handleBeadUpdate} />}
                {activeTab === 4 && <ScrewCalculator onUpdate={handleScrewUpdate} sheetData={summaryData.sheets} />}
                {activeTab === 5 && <SummaryView data={summaryData} onProjectUpdate={handleProjectUpdate} />}
              </Motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
