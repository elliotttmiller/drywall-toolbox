$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$moduleRoot = Join-Path $repoRoot 'drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce'
$jsPath = Join-Path $moduleRoot 'assets/woo-native-checkout-payment-sheet.js'
$cssPath = Join-Path $moduleRoot 'assets/woo-native-checkout-payment-sheet.css'
$phpPath = Join-Path $moduleRoot 'Payment/MobilePaymentSheet.php'
$bootstrapPath = Join-Path $moduleRoot 'bootstrap.php'

$requiredFiles = @($jsPath, $cssPath, $phpPath, $bootstrapPath)
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Required mobile payment-sheet file is missing: $file"
    }
}

$js = Get-Content -LiteralPath $jsPath -Raw
$css = Get-Content -LiteralPath $cssPath -Raw
$php = Get-Content -LiteralPath $phpPath -Raw
$bootstrap = Get-Content -LiteralPath $bootstrapPath -Raw

$requiredJsTokens = @(
    "aria-labelledby",
    "aria-modal",
    "event.key !== 'Tab'",
    'getCartTotals',
    'data.subscribe',
    'visualViewport',
    'isProviderOwnedFocusTarget',
    'stripe.com',
    'dtb-payment-sheet-dialog-chrome__close'
)
foreach ($token in $requiredJsTokens) {
    if (-not $js.Contains($token)) {
        throw "Mobile payment-sheet JavaScript contract is missing required token: $token"
    }
}

$requiredCssTokens = @(
    'dtb-payment-sheet-hardened',
    'dtb-payment-sheet-dialog-chrome',
    'safe-area-inset-bottom',
    'prefers-reduced-motion',
    'wc-block-components-checkout-place-order-button'
)
foreach ($token in $requiredCssTokens) {
    if (-not $css.Contains($token)) {
        throw "Mobile payment-sheet CSS contract is missing required token: $token"
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
        throw "Mobile payment-sheet JavaScript must not create or confirm an independent Stripe payment flow: $token"
    }
}

if (-not $php.Contains("[ 'dtb-woo-native-checkout-ui' ]")) {
    throw 'Mobile payment-sheet script must remain downstream of the canonical Woo checkout UI asset.'
}
if (-not $php.Contains('rest_request_after_callbacks')) {
    throw 'Mobile payment-sheet readiness diagnostics are not wired to the checkout capabilities response.'
}
if (-not $bootstrap.Contains("/Payment/MobilePaymentSheet.php")) {
    throw 'DTB Commerce bootstrap does not load MobilePaymentSheet.php.'
}

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $node) {
    & $node.Source --check $jsPath
    if ($LASTEXITCODE -ne 0) {
        throw 'node --check failed for the mobile payment-sheet JavaScript.'
    }
}

$phpCommand = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $phpCommand) {
    & $phpCommand.Source -l $phpPath
    if ($LASTEXITCODE -ne 0) {
        throw 'php -l failed for MobilePaymentSheet.php.'
    }
}

Write-Host 'PASS: DTB mobile payment-sheet static contract checks passed.'
