param()
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$MuRoot = Join-Path $RepoRoot 'wp/wp-content/mu-plugins'
if (-not (Test-Path $MuRoot)) { Write-Error "Missing directory: $MuRoot"; exit 1 }
if (-not (Get-Command php -ErrorAction SilentlyContinue)) { Write-Error 'PHP CLI is required on PATH.'; exit 1 }
$Files = Get-ChildItem -Path $MuRoot -Recurse -File -Filter '*.php' | Sort-Object FullName
$Failures = @()
foreach ($File in $Files) {
  $Relative = $File.FullName.Substring($RepoRoot.Length + 1).Replace('\\', '/')
  $Output = php -l $File.FullName 2>&1
  if ($LASTEXITCODE -ne 0) {
    $Failures += [pscustomobject]@{ Path = $Relative; Output = ($Output | Out-String).Trim() }
  } else {
    Write-Host "PHP lint OK: $Relative"
  }
}
if ($Failures.Count -gt 0) {
  Write-Host 'PHP lint failures:'
  foreach ($Failure in $Failures) { Write-Host ("- " + $Failure.Path); Write-Host $Failure.Output }
  exit 1
}
Write-Host "DTB mu-plugin PHP lint passed for $($Files.Count) file(s)."
