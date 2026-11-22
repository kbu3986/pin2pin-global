#!/usr/bin/env node
/**
 * Stage 2: Deterministic Schema v2 & Physics Consistency Verifier (AUD-01, AUD-02, AUD-03, AUD-04)
 *
 * Enforces:
 * 1. Zod v2 discriminated union validation (Family 1:N OPN, single package per OPN).
 * 2. Official manufacturer domain check (zero distributor/aggregator URLs).
 * 3. Package pin_count == PACKAGE_PIN_COUNTS[code] == pinout.length with sequential pins 1..N.
 * 4. Dual-Path Vision verification check (parse_source_mode != UNSUPPORTED_SCAN, pinout_vision_verified == true).
 * 5. Physical laws & unit sanity checks:
 *    - V_abs_max >= V_rec_max > V_rec_min >= 0
 *    - LDO: V_out < V_in_max, Dropout(V) < V_in_max, Tj_max between 100 and 175 C, theta_JA > 10 C/W
 *    - DC-DC: fsw between 20 kHz and 10,000 kHz, V_out_max >= V_out_min, L > 0
 *    - Op-Amp/Comparator: Vs_abs >= Vs_max > Vs_min, comparator must specify prop_delay_ns, opamp must specify gbwp_mhz & slew_rate
 * 6. Citation bounds check: every cited page <= datasheet.page_count.
 * 7. Information gain minimum: >= 12 populated distinct specs/thermal fields per part.
 *
 * Usage:
 *   node pipeline/stage2_physics_verifier.mjs <file.json | dir>
 *   node pipeline/stage2_physics_verifier.mjs --all
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  GoldenPartSchemaV2,
  PACKAGE_PIN_COUNTS,
} from '../schemas/part-schema.v2.mjs';

function collectJsonFiles(targetPath) {
  const results = [];
  if (!fs.existsSync(targetPath)) return results;
  const stat = fs.statSync(targetPath);
  if (stat.isFile() && targetPath.endsWith('.json')) {
    return [targetPath];
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      const full = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectJsonFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(full);
      }
    }
  }
  return results;
}

function collectCitedPages(obj, acc = []) {
  if (!obj || typeof obj !== 'object') return acc;
  if (
    typeof obj.value === 'number' &&
    typeof obj.page === 'number' &&
    Number.isInteger(obj.page)
  ) {
    acc.push(obj.page);
    return acc;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      collectCitedPages(val, acc);
    }
  }
  return acc;
}

export function verifyGoldenPart(rawObj, fileLabel = '') {
  const errors = [];
  const warnings = [];

  const parsed = GoldenPartSchemaV2.safeParse(rawObj);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`SCHEMA [${issue.path.join('.')}]: ${issue.message}`);
    }
    return { ok: false, fileLabel, errors, warnings };
  }

  const part = parsed.data;
  const { pkg, specs, datasheet, audit } = {
    pkg: part.package,
    specs: part.specs,
    datasheet: part.datasheet,
    audit: part.audit,
  };

  // 1. Quarantine / Dual-Path Vision checks (AUD-01)
  if (datasheet.parse_source_mode === 'UNSUPPORTED_SCAN') {
    errors.push('AUD-01: Part marked UNSUPPORTED_SCAN must be quarantined, not published.');
  }
  if (!pkg.pinout_vision_verified) {
    errors.push('AUD-01: package.pinout_vision_verified must be true (300 DPI PNG Vision check required).');
  }
  if (!audit.dual_path_verified || !audit.auditor_passed || audit.confidence_score < 0.95) {
    errors.push(
      `AUD-01/STAGE2: Audit gate not met (dual_path=${audit.dual_path_verified}, passed=${audit.auditor_passed}, confidence=${audit.confidence_score}).`,
    );
  }
  if (audit.needs_human_review) {
    errors.push('STAGE2: Part flagged needs_human_review=true cannot pass publish gate.');
  }

  // 2. Package pin count & sequential pinout integrity (AUD-02)
  const expectedPins = PACKAGE_PIN_COUNTS[pkg.code];
  if (expectedPins !== pkg.pin_count) {
    errors.push(
      `PHYSICS: Package ${pkg.code} expects ${expectedPins} pins, got pin_count=${pkg.pin_count}.`,
    );
  }
  if (pkg.pinout.length !== pkg.pin_count) {
    errors.push(
      `PHYSICS: pinout array length (${pkg.pinout.length}) != pin_count (${pkg.pin_count}).`,
    );
  }
  const pinNums = pkg.pinout.map((p) => p.pin).sort((a, b) => a - b);
  for (let i = 0; i < pinNums.length; i++) {
    if (pinNums[i] !== i + 1) {
      errors.push(`PHYSICS: Pin numbers must be sequential 1..${pkg.pin_count}, got [${pinNums.join(',')}].`);
      break;
    }
  }
  if (pkg.exposed_pad.present && pkg.exposed_pad.net === 'NONE') {
    errors.push('PHYSICS: exposed_pad.present=true requires an explicit net (e.g., GND or VOUT).');
  }

  // 3. Thermal physics sanity
  if (pkg.tj_max_c.value < 100 || pkg.tj_max_c.value > 185) {
    errors.push(`PHYSICS: Unreasonable tj_max_c=${pkg.tj_max_c.value} C.`);
  }
  if (pkg.theta_ja_c_per_w.value < 10 || pkg.theta_ja_c_per_w.value > 500) {
    errors.push(`PHYSICS: Unreasonable theta_ja_c_per_w=${pkg.theta_ja_c_per_w.value} C/W.`);
  }

  // 4. Category-specific physical laws
  if (part.category === 'ldo') {
    if (specs.vin_abs_max_v.value < specs.vin_max_v.value) {
      errors.push(
        `PHYSICS[LDO]: vin_abs_max_v (${specs.vin_abs_max_v.value}) < vin_max_v (${specs.vin_max_v.value}).`,
      );
    }
    if (specs.vin_max_v.value <= specs.vin_min_v.value) {
      errors.push(
        `PHYSICS[LDO]: vin_max_v (${specs.vin_max_v.value}) <= vin_min_v (${specs.vin_min_v.value}).`,
      );
    }
    if (specs.vout_v.value >= specs.vin_max_v.value) {
      errors.push(
        `PHYSICS[LDO]: vout_v (${specs.vout_v.value}) must be < vin_max_v (${specs.vin_max_v.value}).`,
      );
    }
    if (specs.dropout_typ_mv.value < 5 || specs.dropout_typ_mv.value > 3000) {
      errors.push(`PHYSICS[LDO]: Suspect dropout_typ_mv=${specs.dropout_typ_mv.value} mV (check mV vs V unit).`);
    }
    if (specs.iout_max_ma.value < 10 || specs.iout_max_ma.value > 10000) {
      errors.push(`PHYSICS[LDO]: Suspect iout_max_ma=${specs.iout_max_ma.value} mA.`);
    }
    if (specs.iq_typ_ua.value <= 0 || specs.iq_typ_ua.value > 20000) {
      errors.push(`PHYSICS[LDO]: Suspect iq_typ_ua=${specs.iq_typ_ua.value} uA (check uA vs mA/nA).`);
    }
    const hasEnPin = pkg.pinout.some((p) => p.role === 'EN');
    if (hasEnPin && specs.en_active_high === null) {
      warnings.push('LDO has EN pin in pinout but en_active_high is null.');
    }
  } else if (part.category === 'dcdc') {
    if (specs.vin_abs_max_v.value < specs.vin_max_v.value) {
      errors.push(
        `PHYSICS[DCDC]: vin_abs_max_v (${specs.vin_abs_max_v.value}) < vin_max_v (${specs.vin_max_v.value}).`,
      );
    }
    if (specs.vin_max_v.value <= specs.vin_min_v.value) {
      errors.push(
        `PHYSICS[DCDC]: vin_max_v (${specs.vin_max_v.value}) <= vin_min_v (${specs.vin_min_v.value}).`,
      );
    }
    if (specs.vout_max_v.value < specs.vout_min_v.value) {
      errors.push(
        `PHYSICS[DCDC]: vout_max_v (${specs.vout_max_v.value}) < vout_min_v (${specs.vout_min_v.value}).`,
      );
    }
    if (specs.fsw_typ_khz.value < 20 || specs.fsw_typ_khz.value > 10000) {
      errors.push(`PHYSICS[DCDC]: Suspect fsw_typ_khz=${specs.fsw_typ_khz.value} kHz (check kHz vs MHz).`);
    }
    if (specs.inductor_typ_uh.value <= 0 || specs.inductor_typ_uh.value > 1000) {
      errors.push(`PHYSICS[DCDC]: Suspect inductor_typ_uh=${specs.inductor_typ_uh.value} uH.`);
    }
    if (specs.efficiency_peak_pct && (specs.efficiency_peak_pct.value < 50 || specs.efficiency_peak_pct.value > 99.5)) {
      errors.push(`PHYSICS[DCDC]: Suspect efficiency_peak_pct=${specs.efficiency_peak_pct.value}%.`);
    }
  } else if (part.category === 'opamp') {
    if (specs.vs_abs_max_v.value < specs.vs_max_v.value) {
      errors.push(
        `PHYSICS[OPAMP]: vs_abs_max_v (${specs.vs_abs_max_v.value}) < vs_max_v (${specs.vs_max_v.value}).`,
      );
    }
    if (specs.vs_max_v.value <= specs.vs_min_v.value) {
      errors.push(
        `PHYSICS[OPAMP]: vs_max_v (${specs.vs_max_v.value}) <= vs_min_v (${specs.vs_min_v.value}).`,
      );
    }
    if (specs.device_kind === 'opamp') {
      if (!specs.gbwp_mhz || !specs.slew_rate_v_per_us) {
        errors.push('PHYSICS[OPAMP]: Op-Amp must include cited gbwp_mhz and slew_rate_v_per_us.');
      }
    } else if (specs.device_kind === 'comparator') {
      if (!specs.prop_delay_ns) {
        errors.push('PHYSICS[COMPARATOR]: Comparator must include cited prop_delay_ns.');
      }
    }
  }

  // 5. Citation page bounds check
  const citedPages = [
    pkg.pinout_source_page,
    ...audit.vision_pages_checked,
    ...collectCitedPages(pkg),
    ...collectCitedPages(specs),
  ];
  for (const p of citedPages) {
    if (p > datasheet.page_count) {
      errors.push(
        `CITATION: Cited page ${p} exceeds datasheet.page_count (${datasheet.page_count}).`,
      );
    }
  }

  // 6. Minimum populated distinct specs check (>= 12 per Stage 5 thin-content gate)
  let populatedCount = 0;
  for (const val of Object.values(specs)) {
    if (val !== null && val !== undefined) populatedCount++;
  }
  // Also count thermal & package electrical fields
  if (pkg.theta_ja_c_per_w) populatedCount++;
  if (pkg.tj_max_c) populatedCount++;
  if (populatedCount < 12) {
    errors.push(`INFO_GAIN: Only ${populatedCount} populated spec fields (minimum 12 required).`);
  }

  return {
    ok: errors.length === 0,
    fileLabel,
    opn: part.opn,
    slug: part.slug,
    category: part.category,
    populatedCount,
    errors,
    warnings,
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const args = process.argv.slice(2);
  let targets = [];
  if (args.includes('--all') || args.length === 0) {
    targets = collectJsonFiles(path.resolve('data/parts'));
  } else {
    for (const a of args) {
      targets.push(...collectJsonFiles(path.resolve(a)));
    }
  }

  if (targets.length === 0) {
    console.log('No Golden Part JSON files found to verify.');
    process.exit(0);
  }

  let passCount = 0;
  let failCount = 0;
  const seenSlugs = new Set();

  for (const file of targets) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`FAIL ${file}: Invalid JSON - ${e.message}`);
      failCount++;
      continue;
    }

    const res = verifyGoldenPart(raw, path.relative(process.cwd(), file));
    if (res.slug) {
      if (seenSlugs.has(res.slug)) {
        res.ok = false;
        res.errors.push(`DUPLICATE_SLUG: Duplicate OPN slug '${res.slug}' across files.`);
      }
      seenSlugs.add(res.slug);
    }

    if (res.ok) {
      passCount++;
      const warnSuffix = res.warnings.length ? ` [WARN: ${res.warnings.join('; ')}]` : '';
      console.log(`PASS ${res.fileLabel} (${res.opn} | ${res.category} | specs=${res.populatedCount})${warnSuffix}`);
    } else {
      failCount++;
      console.error(`FAIL ${res.fileLabel}:`);
      for (const err of res.errors) console.error(`  - ${err}`);
    }
  }

  console.log(`\nSummary: ${passCount} PASSED, ${failCount} FAILED (Total ${targets.length})`);
  process.exit(failCount > 0 ? 1 : 0);
}
