$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$muRoot = Join-Path $repoRoot 'wp/wp-content/mu-plugins'
$loaderPath = Join-Path $muRoot '00-dtb-loader.php'

$expectedBootstraps = @(
  'dtb-platform/bootstrap.php',
  'dtb-catalog-platform/bootstrap.php',
  'dtb-commerce/bootstrap.php',
  'dtb-order-platform/bootstrap.php',
  'dtb-schematics/bootstrap.php',
  'dtb-media/bootstrap.php',
  'dtb-marketing/bootstrap.php',
  'dtb-repair-service/bootstrap.php',
  'dtb-integrations/bootstrap.php'
)

# Map of root DTB shim files to their implementation target.
# Two states are recognised:
#   Transitional: target is a Legacy/ path — the legacy file is the production owner.
#   Completed:    target is a module bootstrap path — the module-layer files are the production owner.
# A shim is a "completed no-op" when its target value is the empty string ''.
$rootShimMap = @{
  # dtb-platform — COMPLETED (bootstrap owns all implementation)
  'dtb-utils.php'           = ''
  'dtb-auth.php'            = ''
  'dtb-cache.php'           = ''
  'dtb-cache-admin.php'     = ''
  'dtb-rest-api.php'        = ''
  'dtb-api-security.php'    = ''
  'dtb-frontend-security.php' = ''
  'dtb-admin-security.php'  = ''
  'dtb-api-health-monitor.php' = ''
  'dtb-admin-performance.php' = ''
  'dtb-ops-dashboard.php'   = ''
  'dtb-config-reference.php' = ''
  # dtb-catalog-platform — TRANSITIONAL
  'dtb-product-mapping.php' = 'dtb-catalog-platform/Legacy/dtb-product-mapping.php'
  'dtb-catalog-health.php'  = 'dtb-catalog-platform/Legacy/dtb-catalog-health.php'
  # dtb-commerce — TRANSITIONAL
  'dtb-woocommerce.php'     = 'dtb-commerce/Legacy/dtb-woocommerce.php'
  # dtb-order-platform — COMPLETED (bootstrap owns all implementation)
  'dtb-order-events.php'    = ''
  'dtb-order-workflows.php' = ''
  'dtb-order-queue.php'     = ''
  'dtb-order-tracking.php'  = ''
  'dtb-payment-webhooks.php' = ''
  'dtb-order-admin.php'     = ''
  # dtb-repair-service — COMPLETED
  'dtb-repairs.php'              = ''
  'dtb-repair-events.php'        = ''
  'dtb-repair-workflows.php'     = ''
  'dtb-repair-queue.php'         = ''
  'dtb-repair-notifications.php' = ''
  'dtb-repair-admin.php'         = ''
  # dtb-schematics — TRANSITIONAL
  'dtb-schematics-api.php'  = 'dtb-schematics/Legacy/dtb-schematics-api.php'
  'dtb-schematics-admin.php' = 'dtb-schematics/Legacy/dtb-schematics-admin.php'
  # dtb-media — TRANSITIONAL
  'dtb-image-sync.php'      = 'dtb-media/Legacy/dtb-image-sync.php'
  # dtb-marketing — TRANSITIONAL
  'dtb-coming-soon.php'     = 'dtb-marketing/Legacy/dtb-coming-soon.php'
  'dtb-seo.php'             = 'dtb-marketing/Legacy/dtb-seo.php'
  # dtb-integrations — TRANSITIONAL
  'dtb-veeqo.php'           = 'dtb-integrations/Legacy/dtb-veeqo.php'
  'dtb-quickbooks.php'      = 'dtb-integrations/Legacy/dtb-quickbooks.php'
  'dtb-rewards.php'         = 'dtb-integrations/Legacy/dtb-rewards.php'
}

# ─── Loader checks ────────────────────────────────────────────────────────────

if (-not (Test-Path $loaderPath)) {
  throw "Loader not found: $loaderPath"
}

$loaderContent = Get-Content -Path $loaderPath -Raw
$normalizedLoaderContent = $loaderContent -replace '\\', '/'
$position = -1

foreach ($bootstrap in $expectedBootstraps) {
  $fullPath = Join-Path $muRoot $bootstrap
  if (-not (Test-Path $fullPath)) {
    throw "Missing bootstrap: $bootstrap"
  }

  $nextPosition = $normalizedLoaderContent.IndexOf("/$bootstrap")
  if ($nextPosition -lt 0) {
    throw "Loader is missing bootstrap include: $bootstrap"
  }

  if ($nextPosition -le $position) {
    throw "Loader bootstrap order is incorrect at: $bootstrap"
  }

  if ([regex]::Matches($normalizedLoaderContent, [regex]::Escape("/$bootstrap")).Count -ne 1) {
    throw "Loader has duplicate bootstrap include: $bootstrap"
  }

  $bootstrapContent = Get-Content -Path $fullPath -Raw
  if ($bootstrapContent -match "dtb_module_require\(\s*'dtb-[^/]+\.php'\s*\)") {
    throw "Bootstrap requires legacy root dtb file: $bootstrap"
  }

  $position = $nextPosition
}

# ─── Root shim checks ─────────────────────────────────────────────────────────

$seenTargets = @{}
foreach ($rootFile in $rootShimMap.Keys) {
  $rootPath = Join-Path $muRoot $rootFile
  if (-not (Test-Path $rootPath)) {
    throw "Missing root shim file: $rootFile"
  }

  $shimContent = Get-Content -Path $rootPath -Raw
  $shimLines = (Get-Content -Path $rootPath).Count
  if ($shimLines -gt 30) {
    throw "Root shim exceeds line threshold (30): $rootFile has $shimLines lines"
  }

  if ($shimContent -notmatch 'Legacy shim\. Real implementation moved to') {
    throw "Root DTB file is not a documented shim: $rootFile"
  }

  if ($shimContent -match "register_rest_route|add_action\(|add_filter\(|register_post_type\(|dbDelta\(|wpdb|function\s+dtb_") {
    throw "Root shim contains business logic indicators: $rootFile"
  }

  $targetRel = $rootShimMap[$rootFile]

  if ($targetRel -ne '') {
    # Transitional shim — legacy file must still exist and be referenced.
    $targetAbs = Join-Path $muRoot $targetRel
    if (-not (Test-Path $targetAbs)) {
      throw "Missing migrated legacy implementation for $rootFile at $targetRel"
    }
    if ($shimContent -notmatch [regex]::Escape($targetRel)) {
      throw "Root shim does not point to mapped module implementation: $rootFile => $targetRel"
    }
    if ($seenTargets.ContainsKey($targetRel)) {
      throw "Duplicate shim target registration: $rootFile and $($seenTargets[$targetRel]) both point to $targetRel"
    }
    $seenTargets[$targetRel] = $rootFile
  }
  # Completed no-op shims (targetRel == '') need no target check.
}

# ─── Bootstrap must not load Legacy/ files ────────────────────────────────────
# Check every module bootstrap for Legacy/ requires.  Transitional modules may
# load Legacy/ via their wrapper module files; only bootstraps are checked here.
foreach ($bootstrap in $expectedBootstraps) {
  $fullPath = Join-Path $muRoot $bootstrap
  $bootstrapContent = Get-Content -Path $fullPath -Raw
  if ($bootstrapContent -match [regex]::Escape('/Legacy/')) {
    throw "Bootstrap loads a Legacy/ file directly: $bootstrap"
  }
}

# ─── Module-internal file checks ─────────────────────────────────────────────

$moduleFiles = Get-ChildItem -Path $muRoot -Recurse -File -Filter '*.php' |
  Where-Object {
    $_.FullName -match '/dtb-[^/]+/' -and
    $_.FullName -notmatch '/Legacy/' -and
    $_.Name -ne 'bootstrap.php' -and
    $_.Name -ne 'index.php'
  }

foreach ($file in $moduleFiles) {
  $content = Get-Content -Path $file.FullName -Raw

  if ($content -match '(?i)placeholder\s+implementation|@todo\s+placeholder|__PLACEHOLDER__') {
    throw "Placeholder module file detected: $($file.FullName)"
  }

  # Module files must not directly require root-level dtb-*.php files.
  if ($content -match "require(?:_once)?\s+[^;]+/dtb-[a-z][^/]+\.php") {
    throw "Module file requires a root-level dtb-*.php file: $($file.FullName)"
  }
}

Write-Host 'DTB MU migration smoke check passed.'
