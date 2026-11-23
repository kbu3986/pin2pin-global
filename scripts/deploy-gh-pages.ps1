#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Build, Stage 2/3/5 verify, and deploy Pin2Pin Global (EN SSG) to GitHub Pages (gh-pages branch).
#>
param(
  [string]$BasePath = "/pin2pin-global",
  [string]$SiteUrl = "https://kbu3986.github.io/pin2pin-global",
  [string]$Remote = "origin",
  [switch]$PingIndexNow,
  [string]$IndexNowKey = $env:INDEXNOW_KEY
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$env:NEXT_PUBLIC_BASE_PATH = $BasePath
$env:NEXT_PUBLIC_SITE_URL = $SiteUrl

$ManifestPath = Join-Path $RepoRoot "data/pilot-manifest.json"
if (-not (Test-Path $ManifestPath)) {
  throw "Manifest not found at $ManifestPath"
}
$Manifest = Get-Content $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$PartCount = if ($Manifest.page_budget.part_pages) { [int]$Manifest.page_budget.part_pages } else { @($Manifest.parts).Count }
$AltCount = if ($Manifest.page_budget.alt_pages) { [int]$Manifest.page_budget.alt_pages } else { $PartCount }
$VsCount = if ($Manifest.page_budget.vs_pages) { [int]$Manifest.page_budget.vs_pages } else { @($Manifest.vs_pairs).Count }
$TotalPages = if ($Manifest.page_budget.total_en_pages) { [int]$Manifest.page_budget.total_en_pages } else { $PartCount + $AltCount + $VsCount }

$TotalSteps = if ($PingIndexNow) { 6 } else { 5 }

Write-Host "==> [1/$TotalSteps] Stage 2: Verify all $PartCount Golden Parts" -ForegroundColor Cyan
npm run verify:schema
if ($LASTEXITCODE -ne 0) { throw "Stage 2 verification failed" }

Write-Host "==> [2/$TotalSteps] Stage 3: Build $VsCount vs + $AltCount alt xrefs" -ForegroundColor Cyan
npm run build:xref
if ($LASTEXITCODE -ne 0) { throw "Stage 3 xref build failed" }

Write-Host "==> [3/$TotalSteps] Typecheck & Next.js ${TotalPages}p static export ($SiteUrl)" -ForegroundColor Cyan
Remove-Item -Recurse -Force "web/.next", "web/out" -ErrorAction SilentlyContinue
npm --prefix web run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed" }
npm run web:build
if ($LASTEXITCODE -ne 0) { throw "Next.js build failed" }

Write-Host "==> [4/$TotalSteps] Stage 5: Run all 7 automated QA gates (${TotalPages}p)" -ForegroundColor Cyan
npm run qa:gate
if ($LASTEXITCODE -ne 0) { throw "Stage 5 QA gate failed" }

Write-Host "==> [5/$TotalSteps] Publish web/out to gh-pages branch" -ForegroundColor Cyan
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("pin2pin-ghpages-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Path $TempDir | Out-Null
try {
  Copy-Item -Path "web/out/*" -Destination $TempDir -Recurse -Force
  # Ensure dotfile .nojekyll is copied explicitly
  Copy-Item -Path "web/out/.nojekyll" -Destination (Join-Path $TempDir ".nojekyll") -Force

  $RemoteUrl = git remote get-url $Remote
  Push-Location $TempDir
  try {
    git init -b gh-pages | Out-Null
    git config user.name (git -C $RepoRoot config user.name)
    git config user.email (git -C $RepoRoot config user.email)
    git add -A
    $ShortSha = git -C $RepoRoot rev-parse --short HEAD
    git commit -m "deploy(gh-pages): publish ${TotalPages}p EN (${PartCount} parts, ${VsCount} vs) from main@$ShortSha" | Out-Null
    git push --force $RemoteUrl gh-pages
    if ($LASTEXITCODE -ne 0) { throw "gh-pages push failed" }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}

if ($PingIndexNow) {
  Write-Host "==> [6/$TotalSteps] Submitting sitemap URLs to IndexNow" -ForegroundColor Cyan
  $SitemapFile = Join-Path $RepoRoot "web/out/sitemap.xml"
  if ([string]::IsNullOrWhiteSpace($IndexNowKey)) {
    Write-Warning "IndexNow skipped: pass -IndexNowKey or set `$env:INDEXNOW_KEY."
  } elseif (-not (Test-Path $SitemapFile)) {
    Write-Warning "IndexNow skipped: $SitemapFile not found."
  } else {
    $SiteUri = [System.Uri]$SiteUrl
    $SitemapXml = Get-Content $SitemapFile -Raw -Encoding UTF8
    $UrlList = @([regex]::Matches($SitemapXml, '<loc>\s*([^<\s]+)\s*</loc>') | ForEach-Object { $_.Groups[1].Value })
    $KeyLocation = "$($SiteUrl.TrimEnd('/'))/$IndexNowKey.txt"
    $Payload = @{
      host = $SiteUri.Host
      key = $IndexNowKey
      keyLocation = $KeyLocation
      urlList = $UrlList
    } | ConvertTo-Json -Depth 4
    try {
      $Resp = Invoke-WebRequest -Uri "https://api.indexnow.org/indexnow" -Method Post -ContentType "application/json; charset=utf-8" -Body $Payload -UseBasicParsing
      Write-Host "IndexNow accepted $($UrlList.Count) URLs (HTTP $($Resp.StatusCode))." -ForegroundColor Green
    } catch {
      Write-Warning "IndexNow ping returned an error: $($_.Exception.Message)"
    }
  }
}

Write-Host "DONE: Deployed ${TotalPages}p ($PartCount parts, $VsCount vs) to $SiteUrl/en/ via gh-pages!" -ForegroundColor Green
