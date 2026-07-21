param(
    [string]$Url = 'https://drywalltoolbox.com/checkout/',
    [string]$ApiKey = $env:GOOGLE_PAGESPEED_API_KEY,
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $parsedUrl = [Uri]$Url
} catch {
    throw "Url must be an absolute http(s) URL: $Url"
}
if (-not $parsedUrl.IsAbsoluteUri -or $parsedUrl.Scheme -notin @('http', 'https') -or -not $parsedUrl.Host) {
    throw "Url must be an absolute http(s) URL: $Url"
}

$query = [ordered]@{
    url = $Url
    strategy = 'mobile'
    category = 'performance'
}
if ($ApiKey) {
    $query['key'] = $ApiKey
}

$queryString = ($query.GetEnumerator() | ForEach-Object {
    '{0}={1}' -f [Uri]::EscapeDataString([string]$_.Key), [Uri]::EscapeDataString([string]$_.Value)
}) -join '&'
$endpoint = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?$queryString"

Write-Host "Running Google PageSpeed Insights mobile audit for $Url"
$response = Invoke-RestMethod -Method Get -Uri $endpoint -TimeoutSec 180
$lhr = $response.lighthouseResult
if (-not $lhr) {
    throw 'PageSpeed response did not include lighthouseResult.'
}

function Get-AuditValue([string]$Id) {
    $audit = $lhr.audits.$Id
    if (-not $audit) { return $null }
    return [ordered]@{
        display = $audit.displayValue
        numeric = $audit.numericValue
        score = $audit.score
    }
}

$performanceScore = $null
if ($null -ne $lhr.categories.performance.score) {
    $performanceScore = [math]::Round(([double]$lhr.categories.performance.score) * 100)
}

$summary = [ordered]@{
    audited_url = $Url
    fetched_at = $response.analysisUTCTimestamp
    strategy = 'mobile'
    performance_score = $performanceScore
    first_contentful_paint = Get-AuditValue 'first-contentful-paint'
    largest_contentful_paint = Get-AuditValue 'largest-contentful-paint'
    cumulative_layout_shift = Get-AuditValue 'cumulative-layout-shift'
    total_blocking_time = Get-AuditValue 'total-blocking-time'
    speed_index = Get-AuditValue 'speed-index'
    server_response_time = Get-AuditValue 'server-response-time'
    render_blocking_resources = Get-AuditValue 'render-blocking-resources'
    unused_javascript = Get-AuditValue 'unused-javascript'
    third_party_summary = Get-AuditValue 'third-party-summary'
    note = 'A public PSI run cannot reproduce a shopper-specific WooCommerce cart/session. Use this as a checkout-shell baseline; validate cart-filled checkout with a scripted mobile Lighthouse/WebPageTest flow in staging.'
}

$summaryJson = $summary | ConvertTo-Json -Depth 8
Write-Host $summaryJson

if ($OutputPath) {
    $resolved = [IO.Path]::GetFullPath($OutputPath)
    $directory = Split-Path -Parent $resolved
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $summaryJson | Set-Content -LiteralPath $resolved -Encoding UTF8
    Write-Host "Saved PageSpeed summary to $resolved"
}
