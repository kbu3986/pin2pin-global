# Pin2Pin Global — Datasheet-Verified Semiconductor Pinout & Cross-Reference DB

[![Live Site](https://img.shields.io/badge/Live-278%20Verified%20EN%20Pages-059669?style=flat-square)](https://kbu3986.github.io/pin2pin-global/en/)
[![Zero-Upload BOM Checker](https://img.shields.io/badge/Tool-Zero--Upload%20BOM%20Checker-0284c7?style=flat-square)](https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/)
[![Verified OPNs](https://img.shields.io/badge/Verified%20OPNs-65%20Parts%20%7C%20130%20Pin%20Diffs-0f172a?style=flat-square)](https://kbu3986.github.io/pin2pin-global/en/catalog/)
[![QA Gate](https://img.shields.io/badge/Stage%205%20QA-7%2F7%20Gates%20PASS-16a34a?style=flat-square)](https://kbu3986.github.io/pin2pin-global/en/methodology/)

**Pin2Pin Global** is an open, datasheet-verified semiconductor cross-reference and pin-compatibility engineering database built to prevent Rev-A PCB power shorts, ESR oscillation, VREF overvoltage, and EOL substitution failures.

- **Live Engineering Workbench**: [https://kbu3986.github.io/pin2pin-global/en/](https://kbu3986.github.io/pin2pin-global/en/)
- **Zero-Upload Client-Side BOM Checker**: [https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/](https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/) *(100% browser memory — zero bytes leave your machine)*
- **Dual-Path Verification Methodology**: [https://kbu3986.github.io/pin2pin-global/en/methodology/](https://kbu3986.github.io/pin2pin-global/en/methodology/)
- **Report a Datasheet / Pinout Discrepancy**: [Open a GitHub Audit Issue](https://github.com/kbu3986/pin2pin-global/issues/new)

---

## Why Pin2Pin Global Exists

Distributor parametric filters group parts by generic family name, hiding critical package-level hazards:

| Real Trap Caught by 300 DPI Vision | Example OPN Comparison | Failure Mode Prevented |
| :--- | :--- | :--- |
| **SOT-23-3 single-letter pin reversal** | [AP7313-33SAG-7 vs AP7313-33SRG-7](https://kbu3986.github.io/pin2pin-global/en/vs/ap7313-33sag-7-vs-ap7313-33srg-7/) | Reverses `VIN` and `GND` inside the same datasheet |
| **SOT-223 thermal tab potential short** | [AMS1117-3.3 vs LM2937IMP-3.3/NOPB](https://kbu3986.github.io/pin2pin-global/en/vs/ams1117-3-3-vs-lm2937imp-3-3-nopb/) | `Tab = VOUT (+3.3 V)` vs `Tab = GND (0 V)` direct rail short |
| **6-pin Buck `VREF` & `EN` cliff** | [TPS54302DDCR vs TPS563201DDCR](https://kbu3986.github.io/pin2pin-global/en/vs/tps54302ddcr-vs-tps563201ddcr/) | Identical pinout, but `0.596 V` vs `0.768 V` `VREF` and `7 V` vs `19 V` `EN` abs max |
| **Op-Amp vs Open-Collector Comparator** | [LM358DR vs LM393DR](https://kbu3986.github.io/pin2pin-global/en/vs/lm358dr-vs-lm393dr/) | Identical SOIC-8 pinout; missing pull-up & MHz linear instability |
| **Datasheet revision & watermark drift** | [NE5532DR](https://kbu3986.github.io/pin2pin-global/en/part/ne5532dr/) · [CAT6219-330TD-GT3](https://kbu3986.github.io/pin2pin-global/en/part/cat6219-330td-gt3/) | TI Rev K ±18 V / 5 V/µs derating; full-page EOL watermark caught via Vision |

---

## Architecture & Verification Guardrails

1. **Dual-Path Official PDF Pipeline (`pipeline/stage0_pdf_ingest.py`)** – Official manufacturer PDFs only (zero DigiKey/Mouser/LCSC scraping). Combines `[PAGE N]` text/table extraction with 300 DPI PNG visual verification of pinout, thermal, and absolute-maximum rating pages. Unreadable scans are quarantined as `UNSUPPORTED_SCAN`.
2. **2-Tier Strict OPN Schema (`schemas/part-schema.v2.mjs`)** – Every record maps 1:1 to a single orderable part number and JEDEC package (`Family 1:N OPN`) with mandatory `pinout_view`, `exposed_pad.net`, `tj_max_c`, `theta_ja_c_per_w`, and page citations.
3. **Deterministic Physics & QA Gates (`stage2_physics_verifier.mjs`, `stage3_xref_engine.mjs`, `stage5_qa_gate.mjs`)** – Enforces `V_abs >= V_rec`, package pin-count parity, alphabetical `a < b` comparison normalization, zero broken internal links (10,349+ checked), and mandatory engineering disclaimers.
4. **Interactive Bench Tools** – Zero-Upload BOM CSV Checker, LDO Junction Temperature ($T_J$) Calculator, DC-DC Efficiency & Inductor Ripple Calculator, and Op-Amp GBWP / Slew-Rate Checker.

---

## Local Commands

```bash
npm run verify:schema   # Stage 2: Zod v2 + deterministic physics checks on all Golden Parts
npm run sync:manifest   # Sync pilot-manifest.json & backlog status from verified parts
npm run build:xref      # Stage 3: Regenerate all alt hubs & alphabetical vs comparisons
npm run web:build       # Next.js 15 static export (web/out) + sitemap.xml / robots.txt
npm run qa:gate         # Stage 5: Run all 7 automated static HTML & SEO QA gates
npm run health:check    # Verify live official PDF links, revision drift, CDN 200 OK & open issues
```

---

## Engineering Disclaimer

All cross-reference recommendations are strictly **Engineering Reference Only (`Candidate Drop-In — Verify Datasheet Before Production`)**. Always verify pinout, thermal derating, and absolute maximum ratings against the latest official manufacturer datasheet prior to PCB layout or production. Not approved for medical (IEC 60601), automotive (AEC-Q100), aerospace, or life-support safety-critical systems.
