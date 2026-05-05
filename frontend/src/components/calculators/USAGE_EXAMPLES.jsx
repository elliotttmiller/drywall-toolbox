// Example: How to integrate the Drywall Calculator into your React app

import React from 'react'
import { CalculatorHub } from './components/calculators'

// OPTION 1: Drop-in complete calculator suite
export default function CalculatorsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
          Professional Drywall Calculator
        </h1>
        <CalculatorHub />
      </div>
    </div>
  )
}

// OPTION 2: Individual calculator with custom layout
import { 
  SheetCalculator, 
  TapeCalculator,
  SummaryView 
} from './components/calculators'

export function CustomCalculatorLayout() {
  const [sheetData, setSheetData] = React.useState({})
  const [tapeData, setTapeData] = React.useState({})

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Drywall Sheets</h2>
        <SheetCalculator onUpdate={setSheetData} />
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Joint Tape</h2>
        <TapeCalculator onUpdate={setTapeData} />
      </div>
      <div className="lg:col-span-2">
        <h2 className="text-xl font-semibold mb-4">Summary</h2>
        <SummaryView 
          data={{ 
            sheets: sheetData, 
            tape: tapeData,
            bead: {},
            screws: {},
            projectName: 'My Project'
          }} 
        />
      </div>
    </div>
  )
}

// OPTION 3: With cost estimation
export function CalculatorWithPricing() {
  const [materials] = React.useState({})
  
  // Your pricing data
  const prices = {
    sheet_48: 12.50,
    tape_500: 8.75,
    bead_8: 3.25,
    screws_5lb: 15.00
  }

  const calculateCost = () => {
    const sheetCost = (materials.sheets?.sheets || 0) * prices.sheet_48
    const tapeCost = (materials.tape?.rolls || 0) * prices.tape_500
    const beadCost = (materials.bead?.sections || 0) * prices.bead_8
    const screwCost = (materials.screws?.boxes || 0) * prices.screws_5lb
    
    return {
      subtotal: sheetCost + tapeCost + beadCost + screwCost,
      breakdown: { sheetCost, tapeCost, beadCost, screwCost }
    }
  }

  const cost = calculateCost()

  return (
    <div>
      <CalculatorHub />
      
      {/* Custom cost display */}
      <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h3 className="text-2xl font-bold mb-4">Estimated Cost</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Drywall Sheets:</span>
            <span>${cost.breakdown.sheetCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Joint Tape:</span>
            <span>${cost.breakdown.tapeCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Corner Bead:</span>
            <span>${cost.breakdown.beadCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Screws:</span>
            <span>${cost.breakdown.screwCost.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span className="text-emerald-600">${cost.subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// OPTION 4: Syncing with global state (Redux example)
import { useDispatch } from 'react-redux'
import { updateMaterials } from './store/materialsSlice'

export function CalculatorWithRedux() {
  const dispatch = useDispatch()

  const handleUpdate = (calculatorType, data) => {
    dispatch(updateMaterials({ [calculatorType]: data }))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SheetCalculator 
        onUpdate={(data) => handleUpdate('sheets', data)} 
      />
      <TapeCalculator 
        onUpdate={(data) => handleUpdate('tape', data)} 
      />
      {/* ... other calculators */}
    </div>
  )
}

// OPTION 5: With analytics tracking
export function CalculatorWithAnalytics() {
  const trackCalculation = (type, data) => {
    // Send to your analytics service
    window.gtag?.('event', 'calculator_used', {
      calculator_type: type,
      ...data
    })
  }

  return (
    <SheetCalculator 
      onUpdate={(data) => {
        console.log('Sheet calculation:', data)
        trackCalculation('sheets', data)
      }} 
    />
  )
}

// OPTION 6: As a modal/dialog
import { Dialog } from '@headlessui/react'

export function CalculatorModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="max-w-5xl w-full bg-white dark:bg-gray-900 rounded-lg p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold mb-4">
            Material Calculator
          </Dialog.Title>
          
          <CalculatorHub />
          
          <div className="mt-6 flex justify-end">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
