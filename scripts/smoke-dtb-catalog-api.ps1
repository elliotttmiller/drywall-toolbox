[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$BaseUrl = '',
    [ValidateRange(1, 120)]
    [int]$TimeoutSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$failures = New-Object 'System.Collections.Generic.List[string]'

function Add-Failure {
    param([Parameter(Mandatory = $true)][string]$Message)
    $script:failures.Add($Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Add-Pass {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Assert-FileExists {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Add-Pass "File exists: $Path"
        return $true
    }
    Add-Failure "Missing file: $Path"
    return $false
}

function Invoke-JsonProbe {
    param([Parameter(Mandatory = $true)][string]$Uri)

    try {
        $response = Invoke-WebRequest -Uri $Uri -Method GET -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        $contentType = [string]$response.Headers['Content-Type']
        $json = $null
        try { $json = [string]$response.Content | ConvertFrom-Json } catch { $json = $null }
        return [pscustomobject]@{
            StatusCode  = [int]$response.StatusCode
            ContentType = $contentType
            Json        = $json
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { $statusCode = 0 }
        }
        return [pscustomobject]@{
            StatusCode  = $statusCode
            ContentType = ''
            Json        = $null
        }
    }
}

$catalogBootstrap = Join-Path $RepositoryRoot 'drywalltoolbox/wp/wp-content/mu-plugins/dtb-catalog-platform/bootstrap.php'
$proxyRoutes = Join-Path $RepositoryRoot 'drywalltoolbox/wp/wp-content/mu-plugins/dtb-platform/Rest/ProxyRoutes.php'
$taxonomyPolicy = Join-Path $RepositoryRoot 'products/Production/catalogs/config/production_taxonomy_policy.json'
$productionCatalog = Join-Path $RepositoryRoot 'products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv'

[void](Assert-FileExists $catalogBootstrap)
[void](Assert-FileExists $proxyRoutes)
[void](Assert-FileExists $taxonomyPolicy)
[void](Assert-FileExists $productionCatalog)

if (Test-Path -LiteralPath $catalogBootstrap -PathType Leaf) {
    $content = Get-Content -LiteralPath $catalogBootstrap -Raw
    foreach ($requiredComponent in @(
        '/Infrastructure/CatalogProductRepository.php',
        '/Infrastructure/ProductVariationRepository.php',
        '/Services/CatalogProductNormalizer.php',
        '/Services/CatalogFacetService.php',
        '/Rest/CatalogProductsController.php',
        '/Rest/ProductDetailController.php',
        '/Validation/CatalogValidationService.php'
    )) {
        if ($content.Contains($requiredComponent)) {
            Add-Pass "Catalog bootstrap includes $requiredComponent"
        }
        else {
            Add-Failure "Catalog bootstrap is missing $requiredComponent"
        }
    }
}

if (Test-Path -LiteralPath $taxonomyPolicy -PathType Leaf) {
    try {
        $policy = Get-Content -LiteralPath $taxonomyPolicy -Raw | ConvertFrom-Json
        if ($null -ne $policy) {
            Add-Pass 'Production taxonomy policy contains valid JSON'
        }
    }
    catch {
        Add-Failure 'Production taxonomy policy contains invalid JSON'
    }
}

if ($BaseUrl) {
    $root = $BaseUrl.TrimEnd('/')
    $probes = @(
        [pscustomobject]@{ Name = 'Product list'; Uri = "$root/wp-json/drywall/v1/products?per_page=1&status=publish" },
        [pscustomobject]@{ Name = 'Category list'; Uri = "$root/wp-json/drywall/v1/categories?per_page=1" },
        [pscustomobject]@{ Name = 'Catalog facets'; Uri = "$root/wp-json/dtb/v1/catalog/facets" }
    )

    foreach ($probe in $probes) {
        $result = Invoke-JsonProbe -Uri $probe.Uri
        if ($result.StatusCode -ne 200) {
            Add-Failure "$($probe.Name) returned HTTP $($result.StatusCode)"
            continue
        }
        if ($null -eq $result.Json) {
            Add-Failure "$($probe.Name) did not return valid JSON"
            continue
        }
        Add-Pass "$($probe.Name) returned HTTP 200 JSON"
    }
}

if ($failures.Count -gt 0) {
    Write-Host "`nCatalog API smoke test failed with $($failures.Count) finding(s)." -ForegroundColor Red
    exit 1
}

Write-Host "`nCatalog API smoke test passed." -ForegroundColor Green
exit 0
