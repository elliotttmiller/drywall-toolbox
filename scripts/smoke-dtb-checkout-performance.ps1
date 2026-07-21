$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$commerceRoot = Join-Path $repoRoot 'drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce'
$phpPath = Join-Path $commerceRoot 'Payment/CheckoutPerformance.php'
$jsPath = Join-Path $commerceRoot 'assets/woo-native-checkout-performance.js'
$bootstrapPath = Join-Path $commerceRoot 'bootstrap.php'
$officialStripePath = Join-Path $commerceRoot 'Payment/OfficialStripeNativeCheckout.php'
$mobileSheetPath = Join-Path $commerceRoot 'Payment/MobilePaymentSheet.php'
$templatePath = Join-Path $commerceRoot 'Templates/WooNativeCheckoutPage.php'
$prewarmPath = Join-Path $repoRoot 'frontend/src/utils/checkoutPrewarm.js'
$eventsPath = Join-Path $repoRoot 'frontend/src/analytics/ecommerceEvents.js'

$requiredFiles = @(
    $phpPath,
    $jsPath,
    $bootstrapPath,
    $officialStripePath,
    $mobileSheetPath,
    $templatePath,
    $prewarmPath,
    $eventsPath
)
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Required checkout performance file is missing: $file"
    }
}

$php = Get-Content -LiteralPath $phpPath -Raw
$js = Get-Content -LiteralPath $jsPath -Raw
$bootstrap = Get-Content -LiteralPath $bootstrapPath -Raw
$officialStripe = Get-Content -LiteralPath $officialStripePath -Raw
$mobileSheet = Get-Content -LiteralPath $mobileSheetPath -Raw
$template = Get-Content -LiteralPath $templatePath -Raw
$prewarm = Get-Content -LiteralPath $prewarmPath -Raw
$events = Get-Content -LiteralPath $eventsPath -Raw

$requiredPhpTokens = @(
    '/checkout/runtime-telemetry',
    'wp_verify_nonce',
    'DTB_RateLimiter::check',
    'suppress_noncritical_checkout_assets',
    'known_marketing_tracking_suppressed',
    'checkout_document_cache',
    'private_no_store',
    'prewarm_manifest',
    'normalized_origin',
    'redact_sensitive_text',
    '[redacted-client-secret]',
    '[redacted-order-key]'
)
foreach ($token in $requiredPhpTokens) {
    if (-not $php.Contains($token)) {
        throw "Checkout performance PHP contract is missing required token: $token"
    }
}

$requiredJsTokens = @(
    'unhandledrejection',
    'payment_surface_timeout',
    'checkout_root_replaced',
    'state_loss_suspected',
    'third_party_budget',
    'layout-shift',
    'largest-contentful-paint',
    'fetchpriority',
    'paymentBlock?.querySelector( providerFrameSelector )',
    'bodyClassObserver',
    'Reload payment options'
)
foreach ($token in $requiredJsTokens) {
    if (-not $js.Contains($token)) {
        throw "Checkout performance JavaScript contract is missing required token: $token"
    }
}

$forbiddenJsTokens = @(
    'PaymentIntent',
    'CheckoutSession',
    'client_secret',
    'createPaymentMethod',
    'confirmPayment(',
    'stripe.confirm'
)
foreach ($token in $forbiddenJsTokens) {
    if ($js.Contains($token)) {
        throw "Checkout performance JavaScript must not own payment orchestration: $token"
    }
}

if (-not $bootstrap.Contains('/Payment/CheckoutPerformance.php')) {
    throw 'DTB Commerce bootstrap does not load CheckoutPerformance.php.'
}
if (-not $prewarm.Contains('requestIdleCallback') -or -not $prewarm.Contains('asset_prewarm')) {
    throw 'Storefront checkout prewarm must remain low-priority and driven by the server manifest.'
}
if (-not $events.Contains('scheduleCheckoutPrewarm')) {
    throw 'Successful add-to-cart instrumentation no longer schedules checkout prewarm.'
}

$coreVersion = [regex]::Match($officialStripe, "ASSET_VERSION\s*=\s*'([^']+)'").Groups[1].Value
$sheetVersion = [regex]::Match($mobileSheet, "ASSET_VERSION\s*=\s*'([^']+)'").Groups[1].Value
$profileVersion = [regex]::Match($template, "checkout_refinement_version\s*=\s*'([^']+)'").Groups[1].Value

if (-not $coreVersion -or -not $php.Contains("CORE_CHECKOUT_ASSET_VERSION = '$coreVersion'")) {
    throw 'Checkout prewarm core asset version is out of sync with OfficialStripeNativeCheckout.php.'
}
if (-not $sheetVersion -or -not $php.Contains("PAYMENT_SHEET_ASSET_VERSION = '$sheetVersion'")) {
    throw 'Checkout prewarm payment-sheet asset version is out of sync with MobilePaymentSheet.php.'
}
if (-not $profileVersion -or -not $php.Contains("PROFILE_REFINEMENT_ASSET_VERSION = '$profileVersion'")) {
    throw 'Checkout prewarm profile-refinement asset version is out of sync with WooNativeCheckoutPage.php.'
}

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $node) {
    & $node.Source --check $jsPath
    if ($LASTEXITCODE -ne 0) {
        throw 'node --check failed for woo-native-checkout-performance.js.'
    }
}

$phpCommand = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $phpCommand) {
    & $phpCommand.Source -l $phpPath
    if ($LASTEXITCODE -ne 0) {
        throw 'php -l failed for CheckoutPerformance.php.'
    }
}

Write-Host 'PASS: DTB checkout performance and stability static contract checks passed.'
