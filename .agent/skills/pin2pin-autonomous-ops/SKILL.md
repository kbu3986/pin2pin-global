---
name: pin2pin-autonomous-ops
description: Standard operating procedure for Pin2Pin Global autonomous daily datasheet expansion, self-healing maintenance, QA gating, and zero-downtime GitHub Pages deployment.
---

# Pin2Pin Global — Autonomous Operations SOP

Every scheduled agent operating on `c:\Users\kbu39\.gemini\antigravity\scratch\pin2pin-global` MUST follow these hard engineering, legal, and SEO rules without exception.

## 1. Non-Negotiable Quality & Compliance Guardrails (AUD-01..AUD-06)

1. **Dual-Path Verification Mandatory (AUD-01)**: Never generate part specs from memory. Every new or updated OPN MUST be downloaded via `python pipeline/stage0_pdf_ingest.py` from an official manufacturer domain (`www.ti.com`, `www.diodes.com`, `www.onsemi.com`, `www.advanced-monolithic.com`) AND have its pinout/thermal/rating pages visually inspected via `read_file` on the rendered 300 DPI PNG images. Low-text scans (`exit code 3`) MUST remain quarantined as `UNSUPPORTED_SCAN`.
2. **Zero Scraping / Zero Anti-Bot Bypass (AUD-03)**: Never scrape DigiKey, Mouser, LCSC, Octopart, or AllDatasheet, and never bypass WAF/Akamai/Cloudflare challenges. If an official URL returns 403/timeout, mark it `blocked_waf` in `data/expansion-backlog.json` and move to the next clean official candidate.
3. **Strict OPN Isolation (AUD-02)**: Every JSON record under `data/parts/<batch>/<slug>.json` represents ONE package-specific OPN (`Family 1:N OPN`) conforming to `schemas/part-schema.v2.mjs`. Never mix packages or assert absolute drop-in guarantees (`Candidate Drop-In` wording only per AUD-04).
4. **Drip-Feed Pace Limit (Anti-Spam SEO)**: Expand by **6 to 10 verified OPNs per daily run** (approx. 25–40 high-density new pages per day) to build steady crawl trust without triggering Google Scaled Content Abuse flags.
5. **All 7 Stage 5 QA Gates Mandatory**: Never commit or deploy unless `npm run verify:schema`, `npm run sync:manifest`, `npm run build:xref`, `npm --prefix web run typecheck`, `npm run web:build`, and `npm run qa:gate` ALL pass with 0 errors.

## 2. Daily Expansion Factory Workflow (`pin2pin-daily-expansion-factory`)

1. Sync git: `git pull --ff-only origin main`.
2. Read `data/expansion-backlog.json`. Select the next **6–8 `pending` OPNs** (preferring balanced LDO / DC-DC / Op-Amp coverage).
   - **Auto-Refill Rule**: If fewer than 12 `pending` items remain in `data/expansion-backlog.json`, discover and live-verify (HTTP 200 `%PDF-` + exact OPN presence inside PDF) 15–20 new high-demand TI / Diodes Inc / onsemi OPNs whose packages match `PACKAGE_PIN_COUNTS` in `schemas/part-schema.v2.mjs`, and append them to `data/expansion-backlog.json`.
3. For each selected OPN:
   - Ingest PDF: `python pipeline/stage0_pdf_ingest.py --slug <slug> --url <hint_pdf_url> --out-dir data/pdfs/auto`
   - Read `[PAGE N]` extracted text AND inspect the 300 DPI PNG pinout/rating pages with `read_file`.
   - Write Schema-v2 Golden JSON to `data/parts/<batch_dir>/<slug>.json`.
4. Run full deterministic pipeline:
   - `npm run verify:schema` (100% PASS)
   - `npm run sync:manifest` (adds new parts + up to 3 high-value canonical `a < b` `vs` pairs per part + updates `expansion-backlog.json`)
   - `npm run build:xref` (regenerates all `alt` + `vs` records with Zod validation)
5. Optional Weekly Content Boost (Sundays only): If no new guide was added in the past 7 days, author 1 deep 1,500+ word engineering field guide in `data/guides/<slug>.json` referencing real verified OPNs in `data/pilot-manifest.json`, then re-run `npm run sync:manifest`.
6. Deploy only after passing all 7 QA gates:
   - Commit updated `data/parts/`, `data/generated/`, `data/pilot-manifest.json`, `data/expansion-backlog.json`, `data/guides/` (if any), and append a run record to `data/audit/expansion-log.json`.
   - Push `origin main`.
   - Run `powershell -ExecutionPolicy Bypass -File scripts/deploy-gh-pages.ps1` (which enforces Stage 2/3/typecheck/Next.js build/Stage 5 QA 7/7 PASS before force-pushing `gh-pages`).
   - Run `npm run health:check` to verify live HTTP 200 + sitemap sync.

## 3. 12-Hour Health Monitor & Self-Healer Workflow (`pin2pin-health-and-issue-healer`)

1. Sync git: `git pull --ff-only origin main`.
2. Run `npm run health:check` (`pipeline/health_monitor.mjs`). Inspect `data/audit/health-latest.json`.
3. **Heal Broken/Updated Datasheets**:
   - If any official PDF shows `revision_drift_detected > 0` or `broken_pdfs > 0`, re-ingest via `stage0_pdf_ingest.py`, inspect 300 DPI PNG via `read_file`, update `revision` / changed specs / `verified_at`, and verify via `stage2_physics_verifier.mjs`.
4. **Heal Reader Error Reports**:
   - Inspect `open_issues` in `data/audit/health-latest.json` (filter `[Pinout/Spec Audit]` issues).
   - For each valid discrepancy reported by a reader: download the cited official manufacturer PDF, verify the exact pinout/spec on the 300 DPI PNG, patch the Golden JSON if confirmed, rebuild & redeploy via `scripts/deploy-gh-pages.ps1`, and post a transparent verification reply citing exact datasheet revision and page number using `gh issue comment` (and close if resolved).
5. If live site is out of sync with `main` (`sitemap_synced: false`), re-run `scripts/deploy-gh-pages.ps1` and confirm HTTP 200 recovery.
6. Commit updated `data/audit/health-latest.json` and `docs/OPS-STATUS.md` to `main` and push if meaningful changes occurred.
