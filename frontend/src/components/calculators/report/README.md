# Calculator report workflow

This directory owns the customer-facing Calculator Hub report/export presentation.

## Contract

`calculatorReportModel.js` is the canonical presentation mapper from `CalculatorHub` summary state into the report model. The Summary tab and printable report must consume that model rather than maintaining separate label maps or export-specific calculations.

Each calculator report section exposes semantic groups (for example project/specification inputs and calculated/material results). `CalculatorReport.jsx` renders those groups as structured report tables; the report template must not recalculate quantities.

`CalculatorReport.jsx` uses the production white Drywall Toolbox logo at `https://drywalltoolbox.com/logos/logo-white.svg` in the dark report header. The document typography uses a rounded system-first font stack so export/print does not depend on a third-party font service.

`calculator-report.css` owns the Letter-size preview and print rules. Print isolation is activated only while `body.dtb-calculator-report-printing` is present. During calculator printing, the normal application root is removed from print layout so hidden SPA content cannot create trailing blank PDF pages.

## Save as PDF / print flow

1. User completes calculator inputs and opens Summary.
2. Project metadata is stored with `dwCalc_state` alongside calculator summary data.
3. `buildCalculatorReport()` normalizes labels, units, local report date, grouped calculator sections, and all five material summaries.
4. **Export / Save PDF** opens the dedicated report preview.
5. **Save / Print PDF** invokes the browser print dialog using the dedicated print-only report root. Selecting **Save as PDF** produces the PDF; selecting a printer produces the same formatted document.
6. The temporary print body class and document title are restored after printing.

No calculator report data is sent to WordPress or an external PDF service. The workflow adds no public render endpoint, server-side PDF dependency, or integration credential surface.

## Invariants

- Supported sheet sizes are 4×8, 4×10, and 4×12.
- Joint Compound must appear in the visible summary and report.
- Print styling must be scoped to calculator report print mode.
- Report values must come from calculator outputs; the report layer may format but must not change calculation authority.
- Calculator sections must preserve semantic grouping rather than flattening all values into an undifferentiated list.
- Keep project/report state backward-compatible with existing `dwCalc_state` data.
