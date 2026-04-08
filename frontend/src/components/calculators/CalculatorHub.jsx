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
  { 
    id: 'sheets', 
    label: 'Drywall Sheets', 
    shortLabel: 'Sheets',
    gradient: 'from-primary-500 to-primary-600',
    bgGradient: 'from-primary-500/10 to-primary-600/10',
  },
  { 
    id: 'mud', 
    label: 'Joint Compound', 
    shortLabel: 'Compound',
    gradient: 'from-primary-600 to-primary-700',
    bgGradient: 'from-primary-600/10 to-primary-700/10',
  },
  { 
    id: 'tape', 
    label: 'Drywall Tape', 
    shortLabel: 'Tape',
    gradient: 'from-primary-400 to-primary-600',
    bgGradient: 'from-primary-400/10 to-primary-600/10',
  },
  { 
    id: 'bead', 
    label: 'Corner Bead', 
    shortLabel: 'Bead',
    gradient: 'from-primary-700 to-primary-800',
    bgGradient: 'from-primary-700/10 to-primary-800/10',
  },
  { 
    id: 'screws', 
    label: 'Screws', 
    shortLabel: 'Screws',
    gradient: 'from-primary-500 to-primary-700',
    bgGradient: 'from-primary-500/10 to-primary-700/10',
  },
  { 
    id: 'summary', 
    label: 'Project Summary', 
    shortLabel: 'Summary',
    gradient: 'from-accent-500 to-primary-700',
    bgGradient: 'from-accent-500/10 to-primary-700/10',
  },
]

// Animation variants
const pageTransition = {
  initial: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      opacity: { duration: 0.2 }
    }
  },
  exit: (direction) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 0.95,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      opacity: { duration: 0.2 }
    }
  })
}

const toastVariants = {
  initial: { opacity: 0, y: -50, scale: 0.9 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 30 }
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    scale: 0.9,
    transition: { duration: 0.2 }
  }
}

const TabIndicatorVariants = {
  animate: {
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 35
    }
  }
}

export default function CalculatorHub() {
  // Lazy initialisers read localStorage once on mount — no setState in effects
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('dwCalc_state') || '{}')
      return s.activeTab ?? 0
    } catch { return 0 }
  })
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [direction, setDirection] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)

  const [summaryData, setSummaryData] = useState({
    sheets: {},
    mud: {},
    tape: {},
    bead: {},
    screws: {}
  })

  // Touch gesture handling for mobile swipe with haptic feedback
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 75
    const isRightSwipe = distance < -75

    if (isLeftSwipe && activeTab < TABS.length - 1) {
      changeTab(activeTab + 1, 1)
    }
    if (isRightSwipe && activeTab > 0) {
      changeTab(activeTab - 1, -1)
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  // Enhanced tab changing with direction tracking
  const changeTab = (newTab, dir = 0) => {
    if (newTab === activeTab) return
    setDirection(dir || (newTab > activeTab ? 1 : -1))
    setActiveTab(newTab)
  }

  // Update handlers for each calculator
  const handleSheetUpdate = useCallback((data) => {
    setSummaryData(prev => ({ ...prev, sheets: data }))
  }, [])

  const handleMudUpdate = useCallback((data) => {
    setSummaryData(prev => ({ ...prev, mud: data }))
  }, [])

  const handleTapeUpdate = useCallback((data) => {
    setSummaryData(prev => ({ ...prev, tape: data }))
  }, [])

  const handleBeadUpdate = useCallback((data) => {
    setSummaryData(prev => ({ ...prev, bead: data }))
  }, [])

  const handleScrewUpdate = useCallback((data) => {
    setSummaryData(prev => ({ ...prev, screws: data }))
  }, [])

  // Toast notification helper
  const showToastMessage = (message) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // Suppress unused-var warning — showToastMessage kept for future use
  void showToastMessage

  const currentTab = TABS[activeTab]
  useEffect(() => {
    const state = {
      activeTab,
      summaryData,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('dwCalc_state', JSON.stringify(state))
  }, [activeTab, summaryData])

  return (
    <div className="w-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <Motion.div
            variants={toastVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-primary-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-primary-500/30">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{toastMessage}</span>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header + floating tab nav ── */}
      <div className="w-full max-w-xl mx-auto px-4 pt-6 pb-3 sm:pt-8 sm:pb-4">
        {/* Heading */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Drywall Calculators
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Estimate sheets, tape, corner bead, and screws — live, on any device.
          </p>
        </div>

        {/* Floating pill tab nav */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-2 py-2">
          <div
            className="flex overflow-x-auto scrollbar-none gap-1"
            style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
          >
            {TABS.map((tab, index) => {
              const isActive = activeTab === index
              return (
                <Motion.button
                  key={tab.id}
                  onClick={() => changeTab(index, index > activeTab ? 1 : -1)}
                  whileTap={{ scale: 0.94 }}
                  style={{ scrollSnapAlign: 'start' }}
                  className={`relative flex items-center px-3.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.shortLabel}
                </Motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Calculator panel ── */}
      <div className="w-full max-w-xl mx-auto px-4 pb-8">
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <Motion.div
              key={activeTab}
              custom={direction}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7 overflow-hidden"
            >
              {/* Active tab accent line */}
              <div className={`h-px w-10 bg-linear-to-r ${currentTab.gradient} rounded-full mb-5`} />

              {activeTab === 0 && <SheetCalculator onUpdate={handleSheetUpdate} />}
              {activeTab === 1 && <MudCalculator onUpdate={handleMudUpdate} sheetData={summaryData.sheets} />}
              {activeTab === 2 && <TapeCalculator onUpdate={handleTapeUpdate} sheetData={summaryData.sheets} />}
              {activeTab === 3 && <CornerBeadCalculator onUpdate={handleBeadUpdate} />}
              {activeTab === 4 && <ScrewCalculator onUpdate={handleScrewUpdate} sheetData={summaryData.sheets} />}
              {activeTab === 5 && <SummaryView data={summaryData} />}
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
