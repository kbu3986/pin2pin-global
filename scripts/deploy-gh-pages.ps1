#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Build, Stage 2/3/5 verify, and deploy Pin2Pin Global (200p EN SSG) to GitHub Pages (gh-pages branch).
#>
param(
  [string]$BasePath = "/pin2pin-global",
  [string]$SiteUrl = "https://kbu3986.github.io/pin2pin-global",
  [string]$Remote = "origin"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$env:NEXT_PUBLIC_BASE_PATH = $BasePath
$env:NEXT_PUBLIC_SITE_URL = $SiteUrl

Write-Host "==> [1/5] Stage 2: Verify all 50 Golden Parts" -ForegroundColor Cyan
npm run verify:schema
if ($LASTEXITCODE -ne 0) { throw "Stage 2 verification failed" }

Write-Host "==> [2/5] Stage 3: Build 85 vs + 50 alt xrefs" -ForegroundColor Cyan
npm run build:xref
if ($LASTEXITCODE -ne 0) { throw "Stage 3 xref build failed" }

Write-Host "==> [3/5] Typecheck & Next.js 200p static export ($SiteUrl)" -ForegroundColor Cyan
Remove-Item -Recurse -Force "web/.next", "web/out" -ErrorAction SilentlyContinue
npm --prefix web run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed" }
npm run web:build
if ($LASTEXITCODE -ne 0) { throw "Next.js build failed" }

Write-Host "==> [4/5] Stage 5: Run all 7 automated QA gates" -ForegroundColor Cyan
npm run qa:gate
if ($LASTEXITCODE -ne 0) { throw "Stage 5 QA gate failed" }

Write-Host "==> [5/5] Publish web/out to gh-pages branch" -ForegroundColor Cyan
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
    git commit -m "deploy(gh-pages): publish 200p EN pilot from main@$ShortSha" | Out-Null
    git push --force $RemoteUrl gh-pages
    if ($LASTEXITCODE -ne 0) { throw "gh-pages push failed" }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}

Write-Host "DONE: Deployed $SiteUrl/en/ via gh-pages!" -ForegroundColor Green
