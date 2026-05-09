import { CalculatorHub } from '../components/calculators'
import SEOHead from '../components/shared/SEOHead'
import PageHeroBanner from '../components/shared/PageHeroBanner'

export default function Calculators() {
  return (
    <>
      <SEOHead
        title="Drywall Calculators — Sheets, Tape, Corner Bead & Screws"
        description="Free professional drywall calculators. Instantly estimate sheets, joint tape, corner bead sections, and screw boxes for any room. Trade-accurate, mobile-first."
        canonical="https://drywalltoolbox.com/calculators"
      />
      <div className="page-wrapper">
        <PageHeroBanner
          eyebrow="Pro Estimation Suite"
          title="Drywall Calculators"
          highlight="Fast. Accurate. Field-Ready."
          description="Estimate sheets, tape, compound, corner bead, and screws with trade-ready calculations built for real jobsite planning."
          align="center"
        />
        <CalculatorHub />
      </div>
    </>
  )
}
