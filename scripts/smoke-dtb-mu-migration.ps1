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

$rootShimMap = @{
  'dtb-utils.php' = 'dtb-platform/Legacy/dtb-utils.php'
  'dtb-auth.php' = 'dtb-platform/Legacy/dtb-auth.php'
  'dtb-cache.php' = 'dtb-platform/Legacy/dtb-cache.php'
  'dtb-cache-admin.php' = 'dtb-platform/Legacy/dtb-cache-admin.php'
  'dtb-rest-api.php' = 'dtb-platform/Legacy/dtb-rest-api.php'
  'dtb-api-security.php' = 'dtb-platform/Legacy/dtb-api-security.php'
  'dtb-frontend-security.php' = 'dtb-platform/Legacy/dtb-frontend-security.php'
  'dtb-admin-security.php' = 'dtb-platform/Legacy/dtb-admin-security.php'
  'dtb-api-health-monitor.php' = 'dtb-platform/Legacy/dtb-api-health-monitor.php'
  'dtb-admin-performance.php' = 'dtb-platform/Legacy/dtb-admin-performance.php'
  'dtb-ops-dashboard.php' = 'dtb-platform/Legacy/dtb-ops-dashboard.php'
  'dtb-config-reference.php' = 'dtb-platform/Legacy/dtb-config-reference.php'
  'dtb-product-mapping.php' = 'dtb-catalog-platform/Legacy/dtb-product-mapping.php'
  'dtb-catalog-health.php' = 'dtb-catalog-platform/Legacy/dtb-catalog-health.php'
  'dtb-woocommerce.php' = 'dtb-commerce/Legacy/dtb-woocommerce.php'
  'dtb-order-events.php' = 'dtb-order-platform/Legacy/dtb-order-events.php'
  'dtb-order-workflows.php' = 'dtb-order-platform/Legacy/dtb-order-workflows.php'
  'dtb-order-queue.php' = 'dtb-order-platform/Legacy/dtb-order-queue.php'
  'dtb-order-tracking.php' = 'dtb-order-platform/Legacy/dtb-order-tracking.php'
  'dtb-payment-webhooks.php' = 'dtb-order-platform/Legacy/dtb-payment-webhooks.php'
  'dtb-order-admin.php' = 'dtb-order-platform/Legacy/dtb-order-admin.php'
  'dtb-repairs.php' = 'dtb-repair-service/Legacy/dtb-repairs.php'
  'dtb-repair-events.php' = 'dtb-repair-service/Legacy/dtb-repair-events.php'
  'dtb-repair-workflows.php' = 'dtb-repair-service/Legacy/dtb-repair-workflows.php'
  'dtb-repair-queue.php' = 'dtb-repair-service/Legacy/dtb-repair-queue.php'
  'dtb-repair-notifications.php' = 'dtb-repair-service/Legacy/dtb-repair-notifications.php'
  'dtb-repair-admin.php' = 'dtb-repair-service/Legacy/dtb-repair-admin.php'
  'dtb-schematics-api.php' = 'dtb-schematics/Legacy/dtb-schematics-api.php'
  'dtb-schematics-admin.php' = 'dtb-schematics/Legacy/dtb-schematics-admin.php'
  'dtb-image-sync.php' = 'dtb-media/Legacy/dtb-image-sync.php'
  'dtb-coming-soon.php' = 'dtb-marketing/Legacy/dtb-coming-soon.php'
  'dtb-seo.php' = 'dtb-marketing/Legacy/dtb-seo.php'
  'dtb-veeqo.php' = 'dtb-integrations/Legacy/dtb-veeqo.php'
  'dtb-quickbooks.php' = 'dtb-integrations/Legacy/dtb-quickbooks.php'
  'dtb-rewards.php' = 'dtb-integrations/Legacy/dtb-rewards.php'
}

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

$seenTargets = @{}
foreach ($rootFile in $rootShimMap.Keys) {
  $rootPath = Join-Path $muRoot $rootFile
  if (-not (Test-Path $rootPath)) {
    throw "Missing root shim file: $rootFile"
  }

  $targetRel = $rootShimMap[$rootFile]
  $targetAbs = Join-Path $muRoot $targetRel
  if (-not (Test-Path $targetAbs)) {
    throw "Missing migrated legacy implementation for $rootFile at $targetRel"
  }

  $shimContent = Get-Content -Path $rootPath -Raw
  $shimLines = (Get-Content -Path $rootPath).Count
  if ($shimLines -gt 30) {
    throw "Root shim exceeds line threshold (30): $rootFile has $shimLines lines"
  }

  if ($shimContent -notmatch 'Legacy shim\. Real implementation moved to') {
    throw "Root DTB file is not a documented shim: $rootFile"
  }

  if ($shimContent -notmatch [regex]::Escape($targetRel)) {
    throw "Root shim does not point to mapped module implementation: $rootFile => $targetRel"
  }

  if ($shimContent -match "register_rest_route|add_action\(|add_filter\(|register_post_type\(|dbDelta\(|wpdb|function\s+dtb_") {
    throw "Root shim contains business logic indicators: $rootFile"
  }

  if ($seenTargets.ContainsKey($targetRel)) {
    throw "Duplicate shim target registration: $rootFile and $($seenTargets[$targetRel]) both point to $targetRel"
  }
  $seenTargets[$targetRel] = $rootFile
}

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
}

Write-Host 'DTB MU migration smoke check passed.'
