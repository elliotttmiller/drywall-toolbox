import './calculator-report.css'

const LOGO_URL = 'https://drywalltoolbox.com/logos/logo-white.svg'

export default function CalculatorReport({ report }) {
  return (
    <article className="dtb-calculator-report" aria-label="Drywall Toolbox material estimate report">
      <header className="dtb-report-header">
        <div className="dtb-report-brand">
          <img
            className="dtb-report-logo"
            src={LOGO_URL}
            alt="Drywall Toolbox"
            loading="eager"
            decoding="sync"
          />
          <div className="dtb-report-brand-copy">
            <span>Professional Estimation Suite</span>
            <strong>Material planning built for the field.</strong>
          </div>
        </div>
        <div className="dtb-report-title-block">
          <span className="dtb-report-kicker">Material Estimate</span>
          <strong>{report.project.jobName}</strong>
          <small>{report.generatedDateLabel}</small>
        </div>
      </header>

      <section className="dtb-report-project-card" aria-label="Project details">
        <ReportMeta label="Job name" value={report.project.jobName} emphasis />
        <ReportMeta label="Job address" value={report.project.jobAddress} />
        <ReportMeta label="Contractor" value={report.project.contractorName} />
        <ReportMeta label="Estimator" value={report.project.estimatorName} />
        <ReportMeta label="Estimate date" value={report.generatedDateLabel} />
        <ReportMeta label="Report ID" value={`DTB-${report.generatedDate.replaceAll('-', '')}`} />
        {report.project.notes && (
          <div className="dtb-report-notes">
            <span>Project notes</span>
            <p>{report.project.notes}</p>
          </div>
        )}
      </section>

      <section className="dtb-report-summary-section">
        <SectionHeading
          eyebrow="Purchase planning"
          title="Material Takeoff"
          description="Recommended purchase quantities generated from the current calculator inputs."
        />
        <div className="dtb-report-takeoff-grid">
          {report.summaryItems.map((item, index) => (
            <div className="dtb-report-takeoff-card" key={item.key}>
              <span className="dtb-report-takeoff-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="dtb-report-takeoff-label">{item.label}</span>
              <div className="dtb-report-takeoff-quantity">
                <strong>{item.quantity}</strong>
                <small>{item.unit}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dtb-report-detail-section">
        <SectionHeading
          eyebrow="Calculation record"
          title="Estimate Details"
          description="Inputs, assumptions, and calculated quantities organized by calculator."
        />

        <div className="dtb-report-sections-stack">
          {report.sections.map((section, index) => (
            <section className={`dtb-report-material-section dtb-report-material-section--${section.key}`} key={section.key}>
              <div className="dtb-report-material-header">
                <div className="dtb-report-material-title">
                  <span>{String(index + 1).padStart(2, '0')} · {section.eyebrow}</span>
                  <h3>{section.title}</h3>
                </div>
                <div className="dtb-report-primary-result">
                  <small>{section.primary.label}</small>
                  <div>
                    <strong>{section.primary.value}</strong>
                    {section.primary.unit && <span>{section.primary.unit}</span>}
                  </div>
                </div>
              </div>

              <div className="dtb-report-group-grid">
                {section.groups.map((group) => (
                  <ReportDataTable key={`${section.key}-${group.key}`} title={group.title} rows={group.rows} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <footer className="dtb-report-footer">
        <div className="dtb-report-footer-brand">
          <strong>Drywall Toolbox</strong>
          <span>drywalltoolbox.com</span>
        </div>
        <p>{report.disclaimer}</p>
      </footer>
    </article>
  )
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="dtb-report-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  )
}

function ReportMeta({ label, value, emphasis = false }) {
  return (
    <div className={`dtb-report-meta${emphasis ? ' dtb-report-meta--emphasis' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ReportDataTable({ title, rows }) {
  return (
    <div className="dtb-report-data-panel">
      <div className="dtb-report-data-panel-title">{title}</div>
      <table className="dtb-report-data-table">
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.label}`}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
