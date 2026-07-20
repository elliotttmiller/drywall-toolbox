import './calculator-report.css'

export default function CalculatorReport({ report }) {
  return (
    <article className="dtb-calculator-report" aria-label="Drywall Toolbox material estimate report">
      <header className="dtb-report-header">
        <div className="dtb-report-brand">
          <span className="dtb-report-brand-mark" aria-hidden="true">DTB</span>
          <span>
            <strong>Drywall Toolbox</strong>
            <small>Professional Estimation Suite</small>
          </span>
        </div>
        <div className="dtb-report-title-block">
          <span>Material Estimate</span>
          <strong>{report.project.jobName}</strong>
        </div>
      </header>

      <section className="dtb-report-project-card" aria-label="Project details">
        <ReportMeta label="Job name" value={report.project.jobName} />
        <ReportMeta label="Estimate date" value={report.generatedDateLabel} />
        <ReportMeta label="Job address" value={report.project.jobAddress} />
        <ReportMeta label="Contractor" value={report.project.contractorName} />
        <ReportMeta label="Estimator" value={report.project.estimatorName} />
        <ReportMeta label="Report ID" value={`DTB-${report.generatedDate.replaceAll('-', '')}`} />
        {report.project.notes && (
          <div className="dtb-report-notes">
            <span>Project notes</span>
            <p>{report.project.notes}</p>
          </div>
        )}
      </section>

      <section className="dtb-report-summary-section">
        <div className="dtb-report-section-heading">
          <div>
            <span>Purchase planning</span>
            <h2>Material Takeoff</h2>
          </div>
          <p>Recommended quantities from the current calculator inputs.</p>
        </div>
        <div className="dtb-report-takeoff-grid">
          {report.summaryItems.map((item) => (
            <div className="dtb-report-takeoff-card" key={item.key}>
              <span>{item.label}</span>
              <strong>{item.quantity}</strong>
              <small>{item.unit}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="dtb-report-detail-section">
        <div className="dtb-report-section-heading">
          <div>
            <span>Calculation record</span>
            <h2>Estimate Details</h2>
          </div>
          <p>Inputs, assumptions, and calculated quantities used for this report.</p>
        </div>

        <div className="dtb-report-detail-grid">
          {report.sections.map((section) => (
            <section className="dtb-report-material-section" key={section.key}>
              <div className="dtb-report-material-header">
                <div>
                  <span>{section.eyebrow}</span>
                  <h3>{section.title}</h3>
                </div>
                <div className="dtb-report-primary-result">
                  <small>{section.primary.label}</small>
                  <strong>{section.primary.value}</strong>
                  <span>{section.primary.unit}</span>
                </div>
              </div>
              <dl className="dtb-report-detail-list">
                {section.details.map((row) => (
                  <div key={`${section.key}-${row.label}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </section>

      <footer className="dtb-report-footer">
        <div>
          <strong>Drywall Toolbox</strong>
          <span>drywalltoolbox.com</span>
        </div>
        <p>{report.disclaimer}</p>
      </footer>
    </article>
  )
}

function ReportMeta({ label, value }) {
  return (
    <div className="dtb-report-meta">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
