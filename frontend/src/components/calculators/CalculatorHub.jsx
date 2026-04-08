import { useState, useEffect, useCallback } from 'react'
import SheetCalculator from './SheetCalculator'
import TapeCalculator from './TapeCalculator'
import CornerBeadCalculator from './CornerBeadCalculator'
import ScrewCalculator from './ScrewCalculator'
import SummaryView from './SummaryView'

const TABS = [
  { id: 'sheets', label: 'Sheets', icon: '📋' },
  { id: 'tape', label: 'Tape', icon: '📏' },
  { id: 'bead', label: 'Corner bead', icon: '📐' },
  { id: 'screws', label: 'Screws', icon: '🔩' },
  { id: 'summary', label: 'Summary', icon: '📊' },
]

export default function CalculatorHub() {
  const [activeTab, setActiveTab] = useState(0)
  const [projectName, setProjectName] = useState('New Project')
  const [lastSaved, setLastSaved] = useState(null)
  const [summaryData, setSummaryData] = useState({
    sheets: {},
    tape: {},
    bead: {},
    screws: {}
  })

  // Touch gesture handling for mobile swipe
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe && activeTab < TABS.length - 1) {
      setActiveTab(prev => prev + 1)
    }
    if (isRightSwipe && activeTab > 0) {
      setActiveTab(prev => prev - 1)
    }

    setTouchStart(0)
    setTouchEnd(0)
  }

  // Update handlers for each calculator
  const handleSheetUpdate = useCallback((data) => {
    setSummaryData(prev => ({ ...prev, sheets: data }))
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

  // Save/Load functionality with localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dwCalc_state')
    if (saved) {
      try {
        const state = JSON.parse(saved)
        if (state.projectName) setProjectName(state.projectName)
        if (state.activeTab !== undefined) setActiveTab(state.activeTab)
        if (state.timestamp) setLastSaved(new Date(state.timestamp))
      } catch (e) {
        console.error('Error loading saved state:', e)
      }
    }
  }, [])

  useEffect(() => {
    const state = {
      projectName,
      activeTab,
      summaryData,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('dwCalc_state', JSON.stringify(state))
    setLastSaved(new Date())
  }, [projectName, activeTab, summaryData])

  const saveTemplate = () => {
    const name = prompt('Enter a name for this template:', projectName)
    if (!name) return

    const templates = JSON.parse(localStorage.getItem('dwCalc_templates') || '[]')
    templates.push({
      name,
      projectName,
      summaryData,
      savedAt: new Date().toISOString()
    })

    localStorage.setItem('dwCalc_templates', JSON.stringify(templates))
    alert(`Template "${name}" saved successfully!`)
  }

  const loadTemplate = () => {
    const templates = JSON.parse(localStorage.getItem('dwCalc_templates') || '[]')

    if (templates.length === 0) {
      alert('No saved templates found. Save your current configuration first.')
      return
    }

    const options = templates.map((t, i) => 
      `${i + 1}. ${t.name} (${new Date(t.savedAt).toLocaleDateString()})`
    ).join('\n')
    
    const choice = prompt(`Select a template to load:\n\n${options}\n\nEnter number:`)
    if (!choice) return

    const index = parseInt(choice) - 1
    if (index >= 0 && index < templates.length) {
      const template = templates[index]
      setProjectName(template.projectName || 'Loaded Project')
      if (template.summaryData) setSummaryData(template.summaryData)
      alert('Template loaded! Note: You may need to switch between tabs to see updated values.')
    } else {
      alert('Invalid selection')
    }
  }

  const getTimeSince = () => {
    if (!lastSaved) return 'Never'
    
    const now = new Date()
    const diffMs = now - lastSaved
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`
    return lastSaved.toLocaleDateString()
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Project header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 w-full md:w-auto"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Last saved: {getTimeSince()}
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={saveTemplate}
            className="flex-1 md:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            💾 Save
          </button>
          <button
            onClick={loadTemplate}
            className="flex-1 md:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            📂 Load
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 min-w-max md:min-w-0">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(index)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === index
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calculator panels — always mounted, hidden via CSS to preserve state on tab switch */}
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 md:p-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={activeTab !== 0 ? 'hidden' : ''} role="tabpanel" aria-label="Drywall sheets calculator">
          <SheetCalculator onUpdate={handleSheetUpdate} />
        </div>
        <div className={activeTab !== 1 ? 'hidden' : ''} role="tabpanel" aria-label="Tape calculator">
          <TapeCalculator onUpdate={handleTapeUpdate} />
        </div>
        <div className={activeTab !== 2 ? 'hidden' : ''} role="tabpanel" aria-label="Corner bead calculator">
          <CornerBeadCalculator onUpdate={handleBeadUpdate} />
        </div>
        <div className={activeTab !== 3 ? 'hidden' : ''} role="tabpanel" aria-label="Screw and fastener calculator">
          <ScrewCalculator onUpdate={handleScrewUpdate} />
        </div>
        {activeTab === 4 && (
          <div role="tabpanel" aria-label="Material summary">
            <SummaryView data={{ ...summaryData, projectName }} />
          </div>
        )}
      </div>

      {/* Mobile swipe hint */}
      <div className="mt-4 text-center text-xs text-gray-400 dark:text-gray-600 md:hidden">
        👆 Swipe left/right to switch tabs
      </div>
    </div>
  )
}
