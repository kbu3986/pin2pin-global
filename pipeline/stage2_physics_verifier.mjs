#!/usr/bin/env node
/**
 * Stage 2: Deterministic Schema v2 & Physics Consistency Verifier (AUD-01, AUD-02, AUD-03, AUD-04)
 *
 * Enforces:
 * 1. Zod v2 discriminated union validation (Family 1:N OPN, single package per OPN).
 * 2. Official manufacturer domain check (zero distributor/aggregator URLs) + source_domain match.
 * 3. Package pin_count == PACKAGE_PIN_COUNTS[code] == pinout.length with sequential pins 1..N,
 *    no duplicate non-power/non-NC pin roles, mandatory power pins, and exposed_pad consistency.
 * 4. Dual-Path Vision verification check (parse_source_mode != UNSUPPORTED_SCAN,
 *    pinout_vision_verified == true, audit.physics_checks_passed == true,
 *    pinout_source_page in audit.vision_pages_checked).
 * 5. Physical laws, sub_topology & unit sanity checks:
 *    - V_abs_max >= V_rec_max > V_rec_min >= 0, ta_min < ta_max <= tj_max
 *    - LDO: sub_topology vs vout_fixed, V_out < V_in_max, Dropout(V) < V_in_max, esr_min <= esr_max
 *    - DC-DC: sub_topology == topology, vout_fixed ? vout_nom_v : vref_v, fsw 20..10000 kHz, L > 0
 *    - Op-Amp/Comparator: sub_topology matches device_kind+channels, Vs_abs >= Vs_max > Vs_min,
 *      comparator requires prop_delay_ns, opamp requires gbwp_mhz & slew_rate
 * 6. Citation bounds check: every cited page & design_gotchas[].page <= datasheet.page_count.
 * 7. Information gain minimum: >= 12 populated distinct spec/thermal fields and >= 10 CitedNumber records.
 * 8. Guides & Trust JSON validation when running `--all`: schema + filename/slug + cross-ref integrity.
 *
 * Usage:
 *   node pipeline/stage2_physics_verifier.mjs <file.json | dir>
 *   node pipeline/stage2_physics_verifier.mjs --all
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EngineeringGuideSchema,
  GoldenPartSchemaV2,
  PACKAGE_PIN_COUNTS,
  TrustPageDocSchema,
} from '../schemas/part-schema.v2.mjs';

const MULTI_PIN_ALLOWED_ROLES = new Set([
  'GND',
  'VIN',
  'VOUT',
  'SW',
  'NC',
  'VCC',
  'VEE',
  'OTHER',
]);

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
  return results.sort();
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
  if (!audit.physics_checks_passed) {
    errors.push('STAGE2: audit.physics_checks_passed must be true.');
  }
  if (!audit.dual_path_verified || !audit.auditor_passed || audit.confidence_score < 0.95) {
    errors.push(
      `AUD-01/STAGE2: Audit gate not met (dual_path=${audit.dual_path_verified}, passed=${audit.auditor_passed}, confidence=${audit.confidence_score}).`,
    );
  }
  if (audit.needs_human_review) {
    errors.push('STAGE2: Part flagged needs_human_review=true cannot pass publish gate.');
  }

  // 2. Package pin count, sequential pinout, duplicate roles, mandatory power pins & EP (AUD-02)
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

  const seenPinRoles = new Map();
  const roleSet = new Set();
  for (const pin of pkg.pinout) {
    roleSet.add(pin.role);
    if (!MULTI_PIN_ALLOWED_ROLES.has(pin.role)) {
      if (seenPinRoles.has(pin.role)) {
        errors.push(
          `PHYSICS: Duplicate non-power pin role '${pin.role}' on pins ${seenPinRoles.get(pin.role)} and ${pin.pin}.`,
        );
      } else {
        seenPinRoles.set(pin.role, pin.pin);
      }
    }
  }

  // Mandatory power-pin checks by category
  if (part.category === 'ldo') {
    if (!roleSet.has('VIN')) errors.push('PHYSICS[LDO]: Pinout missing mandatory VIN pin.');
    if (!roleSet.has('VOUT')) errors.push('PHYSICS[LDO]: Pinout missing mandatory VOUT pin.');
    if (!roleSet.has('GND') && !roleSet.has('ADJ')) {
      errors.push('PHYSICS[LDO]: Pinout missing mandatory GND or ADJ pin.');
    }
  } else if (part.category === 'dcdc') {
    if (specs.topology === 'boost') {
      if (!roleSet.has('VIN') && !roleSet.has('VOUT')) {
        errors.push('PHYSICS[DCDC]: Boost pinout missing mandatory VIN or VOUT power pin.');
      }
    } else if (!roleSet.has('VIN')) {
      errors.push('PHYSICS[DCDC]: Pinout missing mandatory VIN pin.');
    }
    if (!roleSet.has('GND')) errors.push('PHYSICS[DCDC]: Pinout missing mandatory GND pin.');
    if (!roleSet.has('SW')) errors.push('PHYSICS[DCDC]: Pinout missing mandatory SW pin.');
  } else if (part.category === 'opamp') {
    if (!roleSet.has('VCC') && !roleSet.has('VIN')) {
      errors.push('PHYSICS[OPAMP]: Pinout missing mandatory positive supply pin (VCC/VIN).');
    }
    if (!roleSet.has('VEE') && !roleSet.has('GND')) {
      errors.push('PHYSICS[OPAMP]: Pinout missing mandatory negative/ground supply pin (VEE/GND).');
    }
  }

  if (pkg.exposed_pad.present && pkg.exposed_pad.net === 'NONE') {
    errors.push('PHYSICS: exposed_pad.present=true requires an explicit net (e.g., GND or VOUT).');
  }
  if (!pkg.exposed_pad.present && pkg.exposed_pad.net !== 'NONE') {
    errors.push(
      `PHYSICS: exposed_pad.present=false but exposed_pad.net='${pkg.exposed_pad.net}' (must be 'NONE').`,
    );
  }

  // 3. Thermal physics sanity
  if (pkg.tj_max_c.value < 100 || pkg.tj_max_c.value > 185) {
    errors.push(`PHYSICS: Unreasonable tj_max_c=${pkg.tj_max_c.value} C.`);
  }
  if (pkg.theta_ja_c_per_w.value < 10 || pkg.theta_ja_c_per_w.value > 500) {
    errors.push(`PHYSICS: Unreasonable theta_ja_c_per_w=${pkg.theta_ja_c_per_w.value} C/W.`);
  }
  if (
    pkg.theta_jc_c_per_w &&
    pkg.theta_jc_c_per_w.value > pkg.theta_ja_c_per_w.value
  ) {
    warnings.push(
      `theta_jc_c_per_w (${pkg.theta_jc_c_per_w.value}) > theta_ja_c_per_w (${pkg.theta_ja_c_per_w.value}) — expected only for RθJC(top) on bottom-pad WSON/VSON/DFN packages.`,
    );
  }

  // 4. Category-specific physical laws & sub_topology consistency
  if (part.category === 'ldo') {
    const expectFixed = part.sub_topology === 'fixed-ldo';
    if (specs.vout_fixed !== expectFixed) {
      errors.push(
        `PHYSICS[LDO]: sub_topology='${part.sub_topology}' conflicts with specs.vout_fixed=${specs.vout_fixed}.`,
      );
    }
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
    if (specs.vout_fixed && specs.vin_min_v.value < specs.vout_v.value) {
      warnings.push(
        `LDO vin_min_v (${specs.vin_min_v.value} V) < fixed vout_v (${specs.vout_v.value} V) (family minimum Vin recorded; regulation requires Vin >= Vout + Vdo).`,
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
    if (
      specs.esr_min_ohm &&
      specs.esr_max_ohm &&
      specs.esr_min_ohm.value > specs.esr_max_ohm.value
    ) {
      errors.push(
        `PHYSICS[LDO]: esr_min_ohm (${specs.esr_min_ohm.value}) > esr_max_ohm (${specs.esr_max_ohm.value}).`,
      );
    }
    const hasEnPin = pkg.pinout.some((p) => p.role === 'EN');
    if (hasEnPin && specs.en_active_high === null) {
      warnings.push('LDO has EN pin in pinout but en_active_high is null.');
    }
  } else if (part.category === 'dcdc') {
    if (part.sub_topology !== specs.topology) {
      errors.push(
        `PHYSICS[DCDC]: sub_topology='${part.sub_topology}' does not match specs.topology='${specs.topology}'.`,
      );
    }
    if (specs.vout_fixed && specs.vout_nom_v === null) {
      errors.push('PHYSICS[DCDC]: Fixed-output DC-DC (vout_fixed=true) must populate vout_nom_v.');
    }
    if (!specs.vout_fixed && specs.vref_v === null) {
      errors.push('PHYSICS[DCDC]: Adjustable DC-DC (vout_fixed=false) must populate vref_v.');
    }
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
    if (
      specs.efficiency_peak_pct &&
      (specs.efficiency_peak_pct.value < 50 || specs.efficiency_peak_pct.value > 99.5)
    ) {
      errors.push(`PHYSICS[DCDC]: Suspect efficiency_peak_pct=${specs.efficiency_peak_pct.value}%.`);
    }
  } else if (part.category === 'opamp') {
    const chLabel =
      specs.channels === 1 ? 'single' : specs.channels === 2 ? 'dual' : 'quad';
    const expectedSub = `${specs.device_kind}-${chLabel}`;
    if (part.sub_topology !== expectedSub) {
      errors.push(
        `PHYSICS[OPAMP]: sub_topology='${part.sub_topology}' conflicts with device_kind='${specs.device_kind}' + channels=${specs.channels} (expected '${expectedSub}').`,
      );
    }
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
  const pkgCitedPages = collectCitedPages(pkg);
  const specCitedPages = collectCitedPages(specs);
  const citedNumberCount = pkgCitedPages.length + specCitedPages.length;
  const citedPages = [
    pkg.pinout_source_page,
    ...audit.vision_pages_checked,
    ...pkgCitedPages,
    ...specCitedPages,
  ];
  for (const p of citedPages) {
    if (p > datasheet.page_count) {
      errors.push(
        `CITATION: Cited page ${p} exceeds datasheet.page_count (${datasheet.page_count}).`,
      );
    }
  }

  // 5b. Design gotcha page citations must be within the datasheet
  for (const [i, g] of (part.design_gotchas || []).entries()) {
    if (typeof g.page === 'number' && g.page > datasheet.page_count) {
      errors.push(
        `CITATION: design_gotchas[${i}].page (${g.page}) exceeds datasheet.page_count (${datasheet.page_count}).`,
      );
    }
  }

  // 5c. Pinout source page must have been Vision-checked (AUD-01 Dual-Path)
  if (!audit.vision_pages_checked.includes(pkg.pinout_source_page)) {
    errors.push(
      `AUD-01: pinout_source_page (${pkg.pinout_source_page}) is not listed in audit.vision_pages_checked [${audit.vision_pages_checked.join(',')}].`,
    );
  }

  // 5d. source_domain must match the PDF URL hostname (AUD-03 provenance)
  try {
    const host = new URL(datasheet.pdf_url).hostname.toLowerCase().replace(/^www\./, '');
    const sd = String(datasheet.source_domain).toLowerCase().replace(/^www\./, '');
    const domainOk = host === sd || host.endsWith(`.${sd}`) || sd.endsWith(`.${host}`);
    if (!domainOk) {
      errors.push(
        `AUD-03: datasheet.source_domain '${datasheet.source_domain}' does not match pdf_url hostname '${host}'.`,
      );
    }
  } catch (e) {
    errors.push(`AUD-03: datasheet.pdf_url is not parseable (${e.message}).`);
  }

  // 5e. File name must match slug (prevents mis-filed / duplicated OPN records)
  if (fileLabel) {
    const base = path.basename(fileLabel, '.json');
    if (base !== part.slug) {
      errors.push(`SLUG: File name '${base}.json' does not match slug '${part.slug}'.`);
    }
  }

  // 5f. Temperature ordering: ta_min < ta_max <= tj_max
  if (!(part.temp_grade.ta_min_c < part.temp_grade.ta_max_c)) {
    errors.push(
      `PHYSICS: temp_grade.ta_min_c (${part.temp_grade.ta_min_c}) must be < ta_max_c (${part.temp_grade.ta_max_c}).`,
    );
  }
  if (part.temp_grade.ta_max_c > pkg.tj_max_c.value) {
    errors.push(
      `PHYSICS: temp_grade.ta_max_c (${part.temp_grade.ta_max_c}) exceeds tj_max_c (${pkg.tj_max_c.value}).`,
    );
  }

  // 6. Minimum populated distinct specs (>= 12) & strict CitedNumber count (>= 10)
  let populatedCount = 0;
  for (const val of Object.values(specs)) {
    if (val !== null && val !== undefined) populatedCount++;
  }
  if (pkg.theta_ja_c_per_w) populatedCount++;
  if (pkg.tj_max_c) populatedCount++;
  if (populatedCount < 12) {
    errors.push(`INFO_GAIN: Only ${populatedCount} populated spec fields (minimum 12 required).`);
  }
  if (citedNumberCount < 10) {
    errors.push(
      `CITATION_DEPTH: Only ${citedNumberCount} CitedNumber fields populated (minimum 10 required).`,
    );
  }

  return {
    ok: errors.length === 0,
    fileLabel,
    opn: part.opn,
    slug: part.slug,
    category: part.category,
    populatedCount,
    citedNumberCount,
    errors,
    warnings,
  };
}

export function verifyEngineeringGuide(
  rawObj,
  fileLabel = '',
  { partSlugs = null, vsSlugs = null } = {},
) {
  const errors = [];
  const warnings = [];

  const parsed = EngineeringGuideSchema.safeParse(rawObj);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`GUIDE_SCHEMA [${issue.path.join('.')}]: ${issue.message}`);
    }
    return { ok: false, fileLabel, errors, warnings };
  }

  const guide = parsed.data;
  if (fileLabel) {
    const base = path.basename(fileLabel, '.json');
    if (base !== guide.slug) {
      errors.push(`GUIDE_SLUG: File name '${base}.json' does not match slug '${guide.slug}'.`);
    }
  }
  if (partSlugs && partSlugs.size > 0) {
    for (const slug of guide.related_parts) {
      if (!partSlugs.has(slug)) {
        errors.push(`GUIDE_REF: related_parts references unknown part slug '${slug}'.`);
      }
    }
  }
  if (vsSlugs && vsSlugs.size > 0) {
    for (const vsSlug of guide.related_vs) {
      if (!vsSlugs.has(vsSlug)) {
        errors.push(`GUIDE_REF: related_vs references unknown VS slug '${vsSlug}'.`);
      }
    }
  }
  for (const [i, sec] of guide.sections.entries()) {
    if (sec.table) {
      const colCount = sec.table.headers.length;
      for (const [r, row] of sec.table.rows.entries()) {
        if (row.length !== colCount) {
          errors.push(
            `GUIDE_TABLE: sections[${i}].table.rows[${r}] has ${row.length} cell(s), expected ${colCount}.`,
          );
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    fileLabel,
    slug: guide.slug,
    errors,
    warnings,
  };
}

export function verifyTrustDoc(rawObj, fileLabel = '') {
  const errors = [];
  const warnings = [];

  const parsed = TrustPageDocSchema.safeParse(rawObj);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`TRUST_SCHEMA [${issue.path.join('.')}]: ${issue.message}`);
    }
    return { ok: false, fileLabel, errors, warnings };
  }

  const doc = parsed.data;
  if (fileLabel) {
    const base = path.basename(fileLabel, '.json');
    if (base !== doc.slug) {
      errors.push(`TRUST_SLUG: File name '${base}.json' does not match slug '${doc.slug}'.`);
    }
  }

  return {
    ok: errors.length === 0,
    fileLabel,
    slug: doc.slug,
    errors,
    warnings,
  };
}

// CLI execution (cross-platform Windows/POSIX check via fileURLToPath)
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  let targets = [];
  if (runAll) {
    targets = collectJsonFiles(path.resolve('data/parts'));
  } else {
    for (const a of args) {
      if (a.startsWith('--')) continue;
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
      console.log(
        `PASS ${res.fileLabel} (${res.opn} | ${res.category} | specs=${res.populatedCount} | cited=${res.citedNumberCount})${warnSuffix}`,
      );
    } else {
      failCount++;
      console.error(`FAIL ${res.fileLabel}:`);
      for (const err of res.errors) console.error(`  - ${err}`);
    }
  }

  // When running --all, also validate data/guides/*.json and data/trust/*.json
  let guidePass = 0;
  let guideFail = 0;
  let trustPass = 0;
  let trustFail = 0;

  if (runAll) {
    let manifestVsSlugs = null;
    const manifestPath = path.resolve('data/pilot-manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const mf = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifestVsSlugs = new Set((mf.vs_pairs || []).map((v) => v.slug));
      } catch {
        manifestVsSlugs = null;
      }
    }

    const guideFiles = collectJsonFiles(path.resolve('data/guides'));
    for (const file of guideFiles) {
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.error(`FAIL ${file}: Invalid JSON - ${e.message}`);
        guideFail++;
        continue;
      }
      const res = verifyEngineeringGuide(raw, path.relative(process.cwd(), file), {
        partSlugs: seenSlugs,
        vsSlugs: manifestVsSlugs,
      });
      if (res.ok) {
        guidePass++;
        console.log(`PASS ${res.fileLabel} (guide: ${res.slug})`);
      } else {
        guideFail++;
        console.error(`FAIL ${res.fileLabel}:`);
        for (const err of res.errors) console.error(`  - ${err}`);
      }
    }

    const trustFiles = collectJsonFiles(path.resolve('data/trust'));
    for (const file of trustFiles) {
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.error(`FAIL ${file}: Invalid JSON - ${e.message}`);
        trustFail++;
        continue;
      }
      const res = verifyTrustDoc(raw, path.relative(process.cwd(), file));
      if (res.ok) {
        trustPass++;
        console.log(`PASS ${res.fileLabel} (trust: ${res.slug})`);
      } else {
        trustFail++;
        console.error(`FAIL ${res.fileLabel}:`);
        for (const err of res.errors) console.error(`  - ${err}`);
      }
    }
  }

  const totalFail = failCount + guideFail + trustFail;
  console.log(
    `\nSummary: Parts ${passCount}/${targets.length} PASSED` +
      (runAll
        ? ` | Guides ${guidePass}/${guidePass + guideFail} PASSED | Trust ${trustPass}/${trustPass + trustFail} PASSED`
        : '') +
      ` (Total FAIL=${totalFail})`,
  );
  process.exit(totalFail > 0 ? 1 : 0);
}
