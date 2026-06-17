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

Write-Host ""
Write-Host "[1/4] Extracting DataForge database to JSON..." -ForegroundColor Green
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
Write-Host "[2/4] Extracting localization files..." -ForegroundColor Green
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
Write-Host "[3/4] Extracting quality band data via query..." -ForegroundColor Green
Write-Host "      Running dcb query for CraftingQualityQuantizationRecord..." -ForegroundColor Gray
Write-Host ""

try {
    & $StarBreakerPath dcb query `
        --p4k $DataP4kPath `
        "CraftingQualityQuantizationRecord" 2>&1 | Out-File -FilePath "$OutputPath\quality-quantization-query.json" -Encoding utf8
        
    & $StarBreakerPath dcb query `
        --p4k $DataP4kPath `
        "CraftingQualityDistributionRecord" 2>&1 | Out-File -FilePath "$OutputPath\quality-distribution-query.json" -Encoding utf8
        
    Write-Host "  Quality data extracted" -ForegroundColor Gray
}
catch {
    Write-Host "WARNING: Quality query failed: $_" -ForegroundColor Yellow
    Write-Host "Quality bands will use fallback data..." -ForegroundColor Yellow
}

$stopwatch.Stop()
$elapsed = $stopwatch.Elapsed

Write-Host ""
Write-Host "[4/4] Extraction complete!" -ForegroundColor Green
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
Write-Host ""
Write-Host "Next step: Run the parsing scripts to generate app data files." -ForegroundColor Yellow
Write-Host "  node scripts/parse-extracted-data.mjs" -ForegroundColor Gray
Write-Host ""
