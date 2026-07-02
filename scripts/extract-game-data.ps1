<#
.SYNOPSIS
    Extracts Star Citizen game data using StarBreaker CLI.
    
.DESCRIPTION
    This script extracts the DataForge database from Star Citizen's Data.p4k
    and converts it to JSON format for use by the parsing scripts.
    
.PARAMETER StarCitizenPath
    Path to Star Citizen installation. Defaults to standard location.
    
.PARAMETER StarBreakerPath  
    Path to StarBreaker CLI executable.
    
.PARAMETER OutputPath
    Where to output extracted data. Defaults to extracted-data/ in project root.

.EXAMPLE
    .\extract-game-data.ps1
    
.EXAMPLE
    .\extract-game-data.ps1 -StarCitizenPath "D:\Games\StarCitizen\LIVE"
#>

param(
    [string]$StarCitizenPath = "C:\Program Files\Roberts Space Industries\StarCitizen\LIVE",
    [string]$StarBreakerPath = "F:\SC Profiles\starbreaker-cli-v0.2.2-windows-x86_64\starbreaker.exe",
    [string]$OutputPath = $null
)

$ErrorActionPreference = "Stop"

# Get project root (parent of scripts folder)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Default output to extracted-data in project root
if (-not $OutputPath) {
    $OutputPath = Join-Path $ProjectRoot "extracted-data"
}

$DataP4kPath = Join-Path $StarCitizenPath "Data.p4k"

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Invoke-StarBreakerDcbQuery {
    param(
        [Parameter(Mandatory = $true)][string]$RecordType,
        [Parameter(Mandatory = $true)][string]$OutputFile
    )
    $errFile = "$OutputFile.err"
    $cmdLine = "`"$StarBreakerPath`" dcb query --p4k `"$DataP4kPath`" $RecordType > `"$OutputFile`" 2> `"$errFile`""
    cmd /c $cmdLine | Out-Null
    if (-not (Test-Path $OutputFile) -or (Get-Item $OutputFile).Length -eq 0) {
        $errHint = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { '' }
        throw "Query produced no output for $RecordType. $errHint"
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Star Citizen Game Data Extraction" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:"
Write-Host "  Star Citizen: $StarCitizenPath"
Write-Host "  StarBreaker:  $StarBreakerPath"
Write-Host "  Output:       $OutputPath"
Write-Host ""

# Validate paths
if (-not (Test-Path $DataP4kPath)) {
    Write-Host "ERROR: Data.p4k not found at: $DataP4kPath" -ForegroundColor Red
    Write-Host "Please check your Star Citizen installation path." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $StarBreakerPath)) {
    Write-Host "ERROR: StarBreaker not found at: $StarBreakerPath" -ForegroundColor Red
    Write-Host "Please download StarBreaker from: https://github.com/diogotr7/StarBreaker/releases" -ForegroundColor Yellow
    exit 1
}

# Clean previous extraction (optional - comment out to keep old data)
if (Test-Path $OutputPath) {
    Write-Host "Cleaning previous extraction..." -ForegroundColor Yellow
    Remove-Item -Path $OutputPath -Recurse -Force
}

# Create output directory
New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null

# Capture game build version from the LIVE install (used by parse scripts + site UI)
$BuildManifestPath = Join-Path $StarCitizenPath "build_manifest.id"
$GameBuildVersion = $null
if (Test-Path $BuildManifestPath) {
    try {
        $manifest = Get-Content $BuildManifestPath -Raw | ConvertFrom-Json
        $internalVersion = $manifest.Data.Version
        $GameBuildVersion = $null
        if ($internalVersion -and $internalVersion -ne 'None') {
            $parts = $internalVersion -split '\.'
            if ($parts.Length -ge 2) {
                $GameBuildVersion = "$($parts[0]).$($parts[1]).x"
            }
        }
        if (-not $GameBuildVersion -and $manifest.Data.Branch -match '(\d+)\.(\d+)') {
            $GameBuildVersion = "$($Matches[1]).$($Matches[2]).x"
        }
        $gameBuild = @{
            version = $GameBuildVersion
            internalVersion = $internalVersion
            branch = $manifest.Data.Branch
            p4Change = $manifest.Data.RequestedP4ChangeNum
            buildDate = $manifest.Data.BuildDateStamp
            extracted = (Get-Date).ToUniversalTime().ToString("o")
        }
        $gameBuildJson = $gameBuild | ConvertTo-Json -Depth 3
        Write-Utf8NoBom -Path (Join-Path $OutputPath "game-build.json") -Content $gameBuildJson
        Write-Host "Game build: $GameBuildVersion ($($manifest.Data.Branch), internal $($internalVersion))" -ForegroundColor Gray
    }
    catch {
        Write-Host "WARNING: Could not read build_manifest.id: $_" -ForegroundColor Yellow
    }
}
else {
    Write-Host "WARNING: build_manifest.id not found at: $BuildManifestPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[1/7] Extracting DataForge database to JSON..." -ForegroundColor Green
Write-Host "      This may take several minutes..." -ForegroundColor Gray
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    & $StarBreakerPath dcb extract `
        --p4k $DataP4kPath `
        --output $OutputPath `
        --format json
        
    if ($LASTEXITCODE -ne 0) {
        throw "StarBreaker DCB extraction exited with code $LASTEXITCODE"
    }
}
catch {
    Write-Host "ERROR: DataForge extraction failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/7] Extracting localization files..." -ForegroundColor Green
Write-Host "      Getting english language strings for lore/descriptions..." -ForegroundColor Gray
Write-Host ""

try {
    & $StarBreakerPath p4k extract `
        --p4k $DataP4kPath `
        --output $OutputPath `
        --filter "**/Localization/english/**"
        
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Localization extraction returned code $LASTEXITCODE (may be partial)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "WARNING: Localization extraction failed: $_" -ForegroundColor Yellow
    Write-Host "Continuing without localization data..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/7] Extracting shop socpaks..." -ForegroundColor Green
Write-Host "      Branded shops + rest-stop shop modules..." -ForegroundColor Gray
Write-Host ""

try {
    & $StarBreakerPath p4k extract `
        --p4k $DataP4kPath `
        --output $OutputPath `
        --filter "Data/ObjectContainers/PU/Shops/**/*.socpak"

    & $StarBreakerPath p4k extract `
        --p4k $DataP4kPath `
        --output $OutputPath `
        --filter "Data/ObjectContainers/PU/loc/mod/**/reststop_*/**/*.socpak"

    & $StarBreakerPath p4k extract `
        --p4k $DataP4kPath `
        --output $OutputPath `
        --filter "Data/ObjectContainers/PU/loc/mod/**/reststop_ref/**/*.socpak"

    Write-Host "  Shop socpaks extracted" -ForegroundColor Gray
}
catch {
    Write-Host "WARNING: Shop socpak extraction failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[4/7] Extracting shop inventory JSON..." -ForegroundColor Green
Write-Host ""

try {
    & $StarBreakerPath p4k extract `
        --p4k $DataP4kPath `
        --output $OutputPath `
        --filter "Data/Scripts/ShopInventories/**"

    Write-Host "  Shop inventory JSON extracted" -ForegroundColor Gray
}
catch {
    Write-Host "WARNING: Shop inventory extraction failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/7] Extracting quality band data via query..." -ForegroundColor Green
Write-Host "      Running dcb query for CraftingQualityQuantizationRecord..." -ForegroundColor Gray
Write-Host ""

try {
    Invoke-StarBreakerDcbQuery -RecordType "CraftingQualityQuantizationRecord" -OutputFile (Join-Path $OutputPath "quality-quantization-query.json")
    Invoke-StarBreakerDcbQuery -RecordType "CraftingQualityDistributionRecord" -OutputFile (Join-Path $OutputPath "quality-distribution-query.json")
    Write-Host "  Quality data extracted" -ForegroundColor Gray
}
catch {
    Write-Host "WARNING: Quality query failed: $_" -ForegroundColor Yellow
    Write-Host "Quality bands will use fallback data..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[6/7] Extracting mission broker data via query..." -ForegroundColor Green
Write-Host "      Running dcb query for MissionBrokerEntry..." -ForegroundColor Gray
Write-Host ""

try {
    Invoke-StarBreakerDcbQuery -RecordType "MissionBrokerEntry" -OutputFile (Join-Path $OutputPath "mission-broker-query.json")
    Write-Host "  Mission broker data extracted" -ForegroundColor Gray
}
catch {
    Write-Host "WARNING: Mission broker query failed: $_" -ForegroundColor Yellow
    Write-Host "Reputation mission data will be incomplete until this query succeeds..." -ForegroundColor Yellow
}

$stopwatch.Stop()
$elapsed = $stopwatch.Elapsed

Write-Host ""
Write-Host "[7/7] Extraction complete!" -ForegroundColor Green
Write-Host ""

# Count extracted files
$fileCount = (Get-ChildItem -Path $OutputPath -Recurse -File).Count
$sizeMB = [math]::Round((Get-ChildItem -Path $OutputPath -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Extraction Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Files extracted: $fileCount"
Write-Host "  Total size:      $sizeMB MB"
Write-Host "  Time elapsed:    $($elapsed.ToString('mm\:ss'))"
Write-Host "  Output path:     $OutputPath"
if ($GameBuildVersion) {
    Write-Host "  Game build:      $GameBuildVersion"
}
Write-Host ""
Write-Host "Next step: Run the parsing scripts to generate app data files." -ForegroundColor Yellow
Write-Host "  node scripts/parse-extracted-data.mjs" -ForegroundColor Gray
Write-Host ""
Write-Host "Shop socpaks and ShopInventories are in extracted-data/ for future use." -ForegroundColor DarkGray
Write-Host ""
