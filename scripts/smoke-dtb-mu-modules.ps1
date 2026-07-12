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

function Assert-Contains {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$Needle,
        [Parameter(Mandatory = $true)][string]$Description
    )
    if ($Content.Contains($Needle)) {
        Add-Pass $Description
        return $true
    }
    Add-Failure $Description
    return $false
}

function Invoke-StatusProbe {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [ValidateSet('GET', 'POST')][string]$Method = 'GET',
        [string]$Body = ''
    )

    try {
        $params = @{
            Uri         = $Uri
            Method      = $Method
            TimeoutSec  = $TimeoutSeconds
            ErrorAction = 'Stop'
            UseBasicParsing = $true
        }
        if ($Body) {
            $params.ContentType = 'application/json'
            $params.Body = $Body
        }
        $response = Invoke-WebRequest @params
        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            Content    = [string]$response.Content
        }
    }
    catch {
        $statusCode = 0
        $content = ''
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { $statusCode = 0 }
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $content = $reader.ReadToEnd()
                    $reader.Dispose()
                }
            }
            catch { $content = '' }
        }
        return [pscustomobject]@{
            StatusCode = $statusCode
            Content    = $content
        }
    }
}

$muRoot = Join-Path $RepositoryRoot 'drywalltoolbox/wp/wp-content/mu-plugins'
$loaderPath = Join-Path $muRoot '00-dtb-loader.php'
$platformBootstrapPath = Join-Path $muRoot 'dtb-platform/bootstrap.php'
$hardenerPath = Join-Path $muRoot 'dtb-platform/Security/LegacyCommerceRouteHardening.php'

if (-not (Assert-FileExists $loaderPath)) {
    throw 'Cannot continue without the MU-plugin loader.'
}

$expectedModules = @(
    'dtb-platform/bootstrap.php',
    'dtb-catalog-platform/bootstrap.php',
    'dtb-commerce/bootstrap.php',
    'dtb-order-platform/bootstrap.php',
    'dtb-schematics/bootstrap.php',
    'dtb-media/bootstrap.php',
    'dtb-marketing/bootstrap.php',
    'dtb-repair-service/bootstrap.php',
    'dtb-integrations/bootstrap.php',
    'dtb-support/bootstrap.php',
    'dtb-returns/bootstrap.php'
)

$loaderContent = Get-Content -LiteralPath $loaderPath -Raw
$lastIndex = -1
foreach ($relativePath in $expectedModules) {
    $absolutePath = Join-Path $muRoot ($relativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    [void](Assert-FileExists $absolutePath)

    $needle = "'/$relativePath'"
    $index = $loaderContent.IndexOf($needle, [StringComparison]::Ordinal)
    if ($index -lt 0) {
        Add-Failure "Loader does not require $relativePath"
        continue
    }
    if ($index -le $lastIndex) {
        Add-Failure "Loader order is incorrect at $relativePath"
        continue
    }
    Add-Pass "Loader order includes $relativePath"
    $lastIndex = $index
}

if (Assert-FileExists $platformBootstrapPath) {
    $platformBootstrap = Get-Content -LiteralPath $platformBootstrapPath -Raw
    [void](Assert-Contains $platformBootstrap "'/Security/LegacyCommerceRouteHardening.php'" 'Platform bootstrap loads legacy commerce route hardening')
}

if (Assert-FileExists $hardenerPath) {
    $hardener = Get-Content -LiteralPath $hardenerPath -Raw
    [void](Assert-Contains $hardener "unregister_rest_route( 'dtb/v1', '/config' )" 'Unsafe DTB config route is replaced')
    [void](Assert-Contains $hardener "unregister_rest_route( 'drywall/v1', '/orders' )" 'Legacy raw order route is unregistered')
    [void](Assert-Contains $hardener "'methods'             => WP_REST_Server::READABLE" 'Legacy order route is re-registered as read-only')
    [void](Assert-Contains $hardener 'dtb_legacy_authenticated_customer_id' 'Legacy reads resolve authenticated customer ownership')
    [void](Assert-Contains $hardener "'wc_credentials_exposed' => false" 'Public runtime config declares credentials unexposed')
}

if ($BaseUrl) {
    $root = $BaseUrl.TrimEnd('/')

    $configProbe = Invoke-StatusProbe -Uri "$root/wp-json/dtb/v1/config"
    if ($configProbe.StatusCode -ne 200) {
        Add-Failure "Runtime config endpoint returned HTTP $($configProbe.StatusCode)"
    }
    else {
        try {
            $config = $configProbe.Content | ConvertFrom-Json
            $serializedConfig = $config | ConvertTo-Json -Depth 100 -Compress
            $unsafeProperties = @('wc_auth_user', 'wc_auth_pass', 'consumer_key', 'consumer_secret')
            foreach ($property in $unsafeProperties) {
                $propertyPattern = '(?i)"' + [Regex]::Escape($property) + '"\s*:'
                if ($serializedConfig -match $propertyPattern) {
                    Add-Failure "Runtime config exposes forbidden property at any depth: $property"
                }
            }
            if ($config.wc_credentials_exposed -eq $false) {
                Add-Pass 'Runtime config confirms WooCommerce credentials are not exposed'
            }
            else {
                Add-Failure 'Runtime config does not confirm credential containment'
            }
        }
        catch {
            Add-Failure 'Runtime config endpoint did not return valid JSON'
        }
    }

    $orderListProbe = Invoke-StatusProbe -Uri "$root/wp-json/drywall/v1/orders?customer=1"
    if ($orderListProbe.StatusCode -in @(401, 403)) {
        Add-Pass 'Unauthenticated legacy order-list access is denied'
    }
    else {
        Add-Failure "Unauthenticated legacy order-list access returned HTTP $($orderListProbe.StatusCode)"
    }

    $orderCreateProbe = Invoke-StatusProbe -Uri "$root/wp-json/drywall/v1/orders" -Method POST -Body '{"line_items":[]}'
    if ($orderCreateProbe.StatusCode -in @(401, 403, 404, 405)) {
        Add-Pass 'Legacy raw order creation is unavailable'
    }
    else {
        Add-Failure "Legacy raw order creation returned HTTP $($orderCreateProbe.StatusCode)"
    }
}

if ($failures.Count -gt 0) {
    Write-Host "`nMU-plugin smoke test failed with $($failures.Count) finding(s)." -ForegroundColor Red
    exit 1
}

Write-Host "`nMU-plugin smoke test passed." -ForegroundColor Green
exit 0
