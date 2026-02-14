# Smart Deploy Script for VKS GAS Projects
# This script only deploys when files have changed since the last deployment

param(
    [switch]$Force,
    [switch]$StatusOnly,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }

# Configuration
$CacheFile = ".deploy-cache.json"
$DeployableExtensions = @(".gs", ".js", ".html", ".json")
$ExcludeFiles = @(".clasp.json", ".deploy-cache.json", "package.json", "package-lock.json")

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  VKS Smart Deploy" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# Check if .clasp.json exists
if (-not (Test-Path ".clasp.json")) {
    Write-Error "ERROR: .clasp.json not found in current directory"
    Write-Host "This doesn't appear to be a clasp project."
    Write-Host "Run 'clasp clone <scriptId>' or create .clasp.json manually."
    exit 1
}

# Get all deployable files
function Get-DeployableFiles {
    $files = Get-ChildItem -Path . -File | Where-Object {
        $ext = $_.Extension.ToLower()
        $name = $_.Name
        ($DeployableExtensions -contains $ext) -and ($ExcludeFiles -notcontains $name)
    }
    return $files
}

# Calculate file hash
function Get-FileHashValue {
    param($FilePath)
    $hash = Get-FileHash -Path $FilePath -Algorithm MD5
    return $hash.Hash
}

# Load previous cache
function Get-DeployCache {
    if (Test-Path $CacheFile) {
        $content = Get-Content $CacheFile -Raw
        return $content | ConvertFrom-Json
    }
    return @{}
}

# Save cache
function Save-DeployCache {
    param($Cache)
    $Cache | ConvertTo-Json -Depth 10 | Set-Content $CacheFile -Encoding UTF8
}

# Main logic
$files = Get-DeployableFiles
$previousCache = Get-DeployCache
$currentHashes = @{}
$changedFiles = @()
$newFiles = @()
$unchangedFiles = @()

Write-Info "Scanning files..."
Write-Host ""

foreach ($file in $files) {
    $hash = Get-FileHashValue -FilePath $file.FullName
    $currentHashes[$file.Name] = @{
        hash = $hash
        size = $file.Length
        modified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    }
    
    $previousHash = $previousCache.PSObject.Properties[$file.Name]
    
    if (-not $previousHash) {
        $newFiles += $file.Name
        if ($Verbose) { Write-Success " + [NEW] $($file.Name)" }
    }
    elseif ($previousHash.Value.hash -ne $hash) {
        $changedFiles += $file.Name
        if ($Verbose) { Write-Warning " * [CHANGED] $($file.Name)" }
    }
    else {
        $unchangedFiles += $file.Name
        if ($Verbose) { Write-Host " - [unchanged] $($file.Name)" -ForegroundColor DarkGray }
    }
}

# Summary
$totalFiles = $files.Count
$totalChanged = $changedFiles.Count + $newFiles.Count

Write-Host "Files scanned: $totalFiles"
Write-Host ""

if ($newFiles.Count -gt 0) {
    Write-Success "New files ($($newFiles.Count)):"
    foreach ($f in $newFiles) { Write-Host "  + $f" -ForegroundColor Green }
}

if ($changedFiles.Count -gt 0) {
    Write-Warning "Changed files ($($changedFiles.Count)):"
    foreach ($f in $changedFiles) { Write-Host "  * $f" -ForegroundColor Yellow }
}

Write-Host ""

# Status only mode
if ($StatusOnly) {
    if ($totalChanged -eq 0) {
        Write-Success "No changes detected since last deployment."
    } else {
        Write-Warning "$totalChanged file(s) need deployment."
    }
    exit 0
}

# Check if deployment needed
if ($totalChanged -eq 0 -and -not $Force) {
    Write-Success "No changes detected. Skipping deployment."
    Write-Host "Use -Force to deploy anyway."
    exit 0
}

if ($Force -and $totalChanged -eq 0) {
    Write-Warning "Force mode: Deploying even though no changes detected."
}

# Deploy
Write-Info "Deploying to Google Apps Script..."
Write-Host ""

try {
    # Use cmd.exe to run clasp to avoid PowerShell execution policy issues
    $result = cmd /c "clasp push --force 2>&1"
    $exitCode = $LASTEXITCODE
    
    Write-Host $result
    
    if ($exitCode -ne 0) {
        Write-Error "Deployment failed with exit code $exitCode"
        exit 1
    }
    
    # Save new cache on success
    Save-DeployCache -Cache $currentHashes
    
    Write-Host ""
    Write-Success "============================================"
    Write-Success "  Deployment successful!"
    Write-Success "  $totalChanged file(s) deployed"
    Write-Success "============================================"
    
    # Show timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host ""
    Write-Host "Deployed at: $timestamp" -ForegroundColor DarkGray
    
} catch {
    Write-Error "Deployment error: $_"
    exit 1
}
