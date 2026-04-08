import { CalculatorHub } from '../components/calculators'
import SEOHead from '../components/SEOHead'

export default function Calculators() {
  return (
    <>
      <SEOHead
        title="Drywall Calculators — Sheets, Tape, Corner Bead & Screws"
        description="Free professional drywall calculators. Instantly estimate sheets, joint tape, corner bead sections, and screw boxes for any room. Trade-accurate, mobile-first."
        canonical="https://drywalltoolbox.com/calculators"
      />
      <div className="page-wrapper">
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Drywall Calculators
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Estimate sheets, tape, corner bead, and screws — live, on any device.
            </p>
          </div>
          <CalculatorHub />
        </div>
      </div>
    </>
  )
}
