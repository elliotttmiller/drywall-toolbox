$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$muRoot = Join-Path $repoRoot "wp/wp-content/mu-plugins"
$loaderPath = Join-Path $muRoot "00-dtb-loader.php"

$expectedBootstraps = @(
  "dtb-platform/bootstrap.php",
  "dtb-catalog-platform/bootstrap.php",
  "dtb-commerce/bootstrap.php",
  "dtb-order-platform/bootstrap.php",
  "dtb-schematics/bootstrap.php",
  "dtb-media/bootstrap.php",
  "dtb-marketing/bootstrap.php",
  "dtb-repair-service/bootstrap.php",
  "dtb-integrations/bootstrap.php"
)

if (-not (Test-Path $loaderPath)) {
  throw "Loader not found: $loaderPath"
}

$loaderContent = Get-Content -Path $loaderPath -Raw
$normalizedLoaderContent = $loaderContent -replace "\\", "/"
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

  $position = $nextPosition
}

Write-Host "DTB MU module smoke check passed."
