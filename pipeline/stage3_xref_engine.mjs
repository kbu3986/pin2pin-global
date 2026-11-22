#!/usr/bin/env node
/**
 * Stage 3: Deterministic Cross-Reference & Comparison Engine (AUD-02, AUD-04, AUD-06)
 *
 * Loads Golden Parts from `data/parts/**\/*.json`, verifies each part through Stage 2
 * (`verifyGoldenPart`), and deterministically generates:
 *   - 85 normalized 1:1 comparisons (`data/generated/vs/<part_a>-vs-<part_b>.json`)
 *   - 50 alternative hubs (`data/generated/alt/<slug>-alternatives.json`)
 *   - 1 summary index (`data/generated/xref-index.json`)
 *
 * Every output record is validated with `VsComparisonSchema` and `AltHubSchema`
 * from `schemas/part-schema.v2.mjs` before being written to disk.
 *
 * Usage:
 *   node pipeline/stage3_xref_engine.mjs
 *   node pipeline/stage3_xref_engine.mjs --parts-dir data/parts --manifest data/pilot-manifest.json --out-dir data/generated
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AltHubSchema,
  VsComparisonSchema,
} from '../schemas/part-schema.v2.mjs';
import { verifyGoldenPart } from './stage2_physics_verifier.mjs';

export const COMPATIBILITY_BADGES = {
  LEVEL_1_CANDIDATE_DROP_IN:
    'Candidate Drop-In (Verify Datasheet Before Production)',
  LEVEL_2_TUNING_REQUIRED:
    'Functional / Tuning Required (Check Passives & Ratings)',
  LEVEL_3_LAYOUT_CHANGE:
    'PCB Layout Change Required (Pinout or Package Mismatch)',
};

const LEVEL_PRIORITY = {
  LEVEL_1_CANDIDATE_DROP_IN: 0,
  LEVEL_2_TUNING_REQUIRED: 1,
  LEVEL_3_LAYOUT_CHANGE: 2,
};

/**
 * Package pairs that share a JEDEC PCB land pattern but differ in body height/profile.
 * `package_match` remains strictly `a.package.code === b.package.code`; these pairs
 * are flagged as footprint-compatible ONLY with an explicit mechanical/SMT height caution.
 */
const FOOTPRINT_COMPATIBLE_PAIRS = new Set([
  'SOT-23-5|TSOT-23-5',
  'TSOT-23-5|SOT-23-5',
  'SOT-23-6|TSOT-23-6',
  'TSOT-23-6|SOT-23-6',
  'SOT-23-3|SOT-23A-3',
  'SOT-23A-3|SOT-23-3',
]);

function collectJsonFiles(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function fmtNum(val, maxDecimals = 3) {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
  if (Math.abs(val) >= 1000 && Number.isInteger(val)) {
    return String(val);
  }
  const rounded = Number(val.toFixed(maxDecimals));
  return String(rounded);
}

function fmtCited(cited, suffix = '', fallback = 'Not specified') {
  if (!cited || typeof cited.value !== 'number' || !Number.isFinite(cited.value)) {
    return fallback;
  }
  const unitPart = suffix ? ` ${suffix}` : '';
  return `${fmtNum(cited.value)}${unitPart} (p.${cited.page})`;
}

function fmtRange(minCited, maxCited, unit) {
  if (!minCited || !maxCited) return 'Not specified';
  const pageNote =
    minCited.page === maxCited.page
      ? `p.${minCited.page}`
      : `p.${minCited.page}/p.${maxCited.page}`;
  return `${fmtNum(minCited.value)} to ${fmtNum(maxCited.value)} ${unit} (${pageNote})`;
}

function fmtEsrWindow(specs) {
  const minE = specs.esr_min_ohm;
  const maxE = specs.esr_max_ohm;
  if (minE && maxE) {
    const pNote =
      minE.page === maxE.page ? `p.${minE.page}` : `p.${minE.page}/p.${maxE.page}`;
    return `${fmtNum(minE.value)}–${fmtNum(maxE.value)} Ω (${pNote})`;
  }
  if (minE) return `>= ${fmtNum(minE.value)} Ω (p.${minE.page})`;
  if (maxE) return `<= ${fmtNum(maxE.value)} Ω (p.${maxE.page})`;
  return specs.ceramic_cap_stable
    ? 'Low-ESR MLCC compatible'
    : 'See datasheet ESR curve';
}

function compareHigherBetter(aVal, bVal, relTieTol = 0.03) {
  if (aVal === null || aVal === undefined || !Number.isFinite(aVal)) {
    return bVal !== null && bVal !== undefined && Number.isFinite(bVal) ? 'B' : 'CONTEXT';
  }
  if (bVal === null || bVal === undefined || !Number.isFinite(bVal)) return 'A';
  const maxAbs = Math.max(Math.abs(aVal), Math.abs(bVal), 1e-9);
  if (Math.abs(aVal - bVal) / maxAbs <= relTieTol) return 'TIE';
  return aVal > bVal ? 'A' : 'B';
}

function compareLowerBetter(aVal, bVal, relTieTol = 0.03) {
  if (aVal === null || aVal === undefined || !Number.isFinite(aVal)) {
    return bVal !== null && bVal !== undefined && Number.isFinite(bVal) ? 'B' : 'CONTEXT';
  }
  if (bVal === null || bVal === undefined || !Number.isFinite(bVal)) return 'A';
  const maxAbs = Math.max(Math.abs(aVal), Math.abs(bVal), 1e-9);
  if (Math.abs(aVal - bVal) / maxAbs <= relTieTol) return 'TIE';
  return aVal < bVal ? 'A' : 'B';
}

export function normalizeVsPair(slug1, slug2) {
  if (slug1 === slug2) {
    throw new Error(`Cannot compare identical slug '${slug1}' against itself.`);
  }
  const [partA, partB] = slug1 < slug2 ? [slug1, slug2] : [slug2, slug1];
  return {
    part_a_slug: partA,
    part_b_slug: partB,
    slug: `${partA}-vs-${partB}`,
  };
}

function isFootprintCompatible(codeA, codeB) {
  if (codeA === codeB) return true;
  return FOOTPRINT_COMPATIBLE_PAIRS.has(`${codeA}|${codeB}`);
}

function evaluateExposedPad(pkgA, pkgB) {
  const epA = pkgA.exposed_pad;
  const epB = pkgB.exposed_pad;
  if (!epA.present && !epB.present) {
    return {
      match: true,
      caution: false,
      note: 'Neither package has an exposed thermal pad or electrical tab.',
    };
  }
  if (epA.present !== epB.present) {
    return {
      match: false,
      caution: false,
      note: `Exposed thermal pad/tab mismatch (${pkgA.code}: ${epA.present ? epA.net : 'NONE'} vs ${pkgB.code}: ${epB.present ? epB.net : 'NONE'}); PCB land pattern & solder-mask change required.`,
    };
  }
  if (epA.net === epB.net) {
    return {
      match: true,
      caution: false,
      note: `Both exposed thermal pads/tabs connect to ${epA.net}.`,
    };
  }
  const gndSet = new Set(['GND', 'THERMAL_GND_RECOMMENDED']);
  if (gndSet.has(epA.net) && gndSet.has(epB.net)) {
    return {
      match: true,
      caution: true,
      note: `Both exposed pads tie to ground (${epA.net} vs ${epB.net}); confirm thermal via stitching to PCB GND plane.`,
    };
  }
  return {
    match: false,
    caution: false,
    note: `CRITICAL SHORT-CIRCUIT HAZARD: Exposed thermal pad/tab net conflict (${epA.net} vs ${epB.net}) — direct swap will short power rails.`,
  };
}

function evaluateSinglePin(partA, partB, pinNum, pinA, pinB) {
  if (!pinA || !pinB) {
    return {
      pin: pinNum,
      part_a_name: pinA ? pinA.name : '— (No Pin)',
      part_a_role: pinA ? pinA.role : 'NONE',
      part_b_name: pinB ? pinB.name : '— (No Pin)',
      part_b_role: pinB ? pinB.role : 'NONE',
      status: 'MISMATCH',
      note: `Package pin-count mismatch (${partA.package.pin_count}-pin ${partA.package.code} vs ${partB.package.pin_count}-pin ${partB.package.code}).`,
      roleEquivalent: false,
      hardMismatch: true,
      pin4NcBypass: false,
      enPolarityDiff: false,
    };
  }

  const rA = pinA.role;
  const rB = pinB.role;

  // Exact role match (with electrical caveats checked below)
  if (rA === rB) {
    // Check EN polarity inversion
    if (rA === 'EN' && (partA.category === 'ldo' || partA.category === 'dcdc')) {
      const enA = partA.specs.en_active_high;
      const enB = partB.specs.en_active_high;
      if (enA !== null && enB !== null && enA !== enB) {
        return {
          pin: pinNum,
          part_a_name: pinA.name,
          part_a_role: rA,
          part_b_name: pinB.name,
          part_b_role: rB,
          status: 'CAUTION',
          note: `Enable polarity inverted: ${partA.opn} is ${enA ? 'Active-High' : 'Active-Low'} while ${partB.opn} is ${enB ? 'Active-High' : 'Active-Low'}.`,
          roleEquivalent: true,
          hardMismatch: false,
          pin4NcBypass: false,
          enPolarityDiff: true,
        };
      }
    }

    // Check Op-Amp push-pull vs Comparator open-collector on output pins
    if (
      partA.category === 'opamp' &&
      partB.category === 'opamp' &&
      (rA === 'OUT' || rA === 'OUT_A' || rA === 'OUT_B') &&
      (partA.specs.output_type !== partB.specs.output_type ||
        partA.specs.device_kind !== partB.specs.device_kind)
    ) {
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: 'CAUTION',
        note: `CRITICAL OUTPUT STAGE DIFFERENCE: ${partA.opn} is ${partA.specs.device_kind} (${partA.specs.output_type}) vs ${partB.opn} ${partB.specs.device_kind} (${partB.specs.output_type}); open-collector/drain requires external pull-up and is uncompensated for linear feedback.`,
        roleEquivalent: true,
        hardMismatch: false,
        pin4NcBypass: false,
        enPolarityDiff: false,
      };
    }

    // Check DC-DC FB pin when one is fixed and one is adjustable or Vref differs
    if (partA.category === 'dcdc' && partB.category === 'dcdc' && rA === 'FB') {
      if (partA.specs.vout_fixed !== partB.specs.vout_fixed) {
        return {
          pin: pinNum,
          part_a_name: pinA.name,
          part_a_role: rA,
          part_b_name: pinB.name,
          part_b_role: rB,
          status: 'CAUTION',
          note: `Feedback network difference: one device has fixed internal divider while the other requires external R1/R2 feedback resistors.`,
          roleEquivalent: true,
          hardMismatch: false,
          pin4NcBypass: false,
          enPolarityDiff: false,
        };
      }
      if (
        partA.specs.vref_v &&
        partB.specs.vref_v &&
        Math.abs(partA.specs.vref_v.value - partB.specs.vref_v.value) /
          Math.max(partA.specs.vref_v.value, partB.specs.vref_v.value) >
          0.02
      ) {
        return {
          pin: pinNum,
          part_a_name: pinA.name,
          part_a_role: rA,
          part_b_name: pinB.name,
          part_b_role: rB,
          status: 'CAUTION',
          note: `Reference voltage differs (${partA.specs.vref_v.value} V vs ${partB.specs.vref_v.value} V): recalculate external R1/R2 divider to maintain target VOUT.`,
          roleEquivalent: true,
          hardMismatch: false,
          pin4NcBypass: false,
          enPolarityDiff: false,
        };
      }
    }

    return {
      pin: pinNum,
      part_a_name: pinA.name,
      part_a_role: rA,
      part_b_name: pinB.name,
      part_b_role: rB,
      status: 'MATCH',
      note:
        pinA.name === pinB.name
          ? `Identical pin assignment (${pinA.name} / ${rA}).`
          : `Functionally identical ${rA} pin (${pinA.name} vs ${pinB.name}).`,
      roleEquivalent: true,
      hardMismatch: false,
      pin4NcBypass: false,
      enPolarityDiff: false,
    };
  }

  // Op-amp rail naming equivalences (GND <-> VEE, VIN <-> VCC)
  if (partA.category === 'opamp' && partB.category === 'opamp') {
    const negRails = new Set(['GND', 'VEE']);
    const posRails = new Set(['VIN', 'VCC']);
    if (negRails.has(rA) && negRails.has(rB)) {
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: 'MATCH',
        note: `Negative supply rail equivalent (${pinA.name}/${rA} vs ${pinB.name}/${rB}); verify split-rail vs single-supply voltage bounds.`,
        roleEquivalent: true,
        hardMismatch: false,
        pin4NcBypass: false,
        enPolarityDiff: false,
      };
    }
    if (posRails.has(rA) && posRails.has(rB)) {
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: 'MATCH',
        note: `Positive supply rail equivalent (${pinA.name}/${rA} vs ${pinB.name}/${rB}); verify Vs,max rating.`,
        roleEquivalent: true,
        hardMismatch: false,
        pin4NcBypass: false,
        enPolarityDiff: false,
      };
    }
  }

  // LDO SOT-23-5 / TSOT-23-5 Pin 4 NC <-> BYPASS rule (AUD-02/AUD-04)
  if (
    partA.category === 'ldo' &&
    partB.category === 'ldo' &&
    pinNum === 4 &&
    ((rA === 'NC' && rB === 'BYPASS') || (rA === 'BYPASS' && rB === 'NC'))
  ) {
    return {
      pin: pinNum,
      part_a_name: pinA.name,
      part_a_role: rA,
      part_b_name: pinB.name,
      part_b_role: rB,
      status: 'CAUTION',
      note: `Pin 4 differs (${pinA.name}/${rA} vs ${pinB.name}/${rB}): safe only if PCB leaves Pin 4 floating or decoupled via 10 nF to GND; if PCB ties NC pin directly to GND/VIN, trace cut is mandatory.`,
      roleEquivalent: false,
      hardMismatch: false,
      pin4NcBypass: true,
      enPolarityDiff: false,
    };
  }

  // LDO fixed 1117 family Pin 1 ADJ vs GND naming normalization when BOTH are fixed output
  if (
    partA.category === 'ldo' &&
    partB.category === 'ldo' &&
    partA.specs.vout_fixed &&
    partB.specs.vout_fixed &&
    ((rA === 'GND' && rB === 'ADJ') || (rA === 'ADJ' && rB === 'GND'))
  ) {
    return {
      pin: pinNum,
      part_a_name: pinA.name,
      part_a_role: rA,
      part_b_name: pinB.name,
      part_b_role: rB,
      status: 'CAUTION',
      note: `Fixed-voltage variant ground reference (${pinA.name}/${rA} vs ${pinB.name}/${rB}); confirm Pin 1 ties directly to GND with no divider resistors.`,
      roleEquivalent: true,
      hardMismatch: false,
      pin4NcBypass: false,
      enPolarityDiff: false,
    };
  }

  // DC-DC fixed VOUT sense vs adjustable FB on same pin
  if (
    partA.category === 'dcdc' &&
    partB.category === 'dcdc' &&
    ((rA === 'FB' && rB === 'VOUT') || (rA === 'VOUT' && rB === 'FB'))
  ) {
    return {
      pin: pinNum,
      part_a_name: pinA.name,
      part_a_role: rA,
      part_b_name: pinB.name,
      part_b_role: rB,
      status: 'CAUTION',
      note: `Output sense pin differs (${pinA.name}/${rA} vs ${pinB.name}/${rB}): adjustable variant requires R1/R2 divider whereas fixed variant senses VOUT directly.`,
      roleEquivalent: false,
      hardMismatch: false,
      pin4NcBypass: false,
      enPolarityDiff: false,
    };
  }

  // Otherwise hard pinout mismatch (requires PCB layout change)
  return {
    pin: pinNum,
    part_a_name: pinA.name,
    part_a_role: rA,
    part_b_name: pinB.name,
    part_b_role: rB,
    status: 'MISMATCH',
    note: `PINOUT CONFLICT on Pin ${pinNum}: ${partA.opn} assigns ${pinA.name} (${rA}) whereas ${partB.opn} assigns ${pinB.name} (${rB}) — direct drop-in risks rail short or IC destruction.`,
    roleEquivalent: false,
    hardMismatch: true,
    pin4NcBypass: false,
    enPolarityDiff: false,
  };
}

/**
 * Deterministic compatibility engine enforcing AUD-02 & AUD-04 rules.
 */
export function evaluateCompatibility(partA, partB) {
  if (partA.category !== partB.category) {
    throw new Error(
      `Cross-category comparison unsupported (${partA.opn}:${partA.category} vs ${partB.opn}:${partB.category}).`,
    );
  }

  const pkgA = partA.package;
  const pkgB = partB.package;
  const packageMatch = pkgA.code === pkgB.code;
  const footprintCompatible = isFootprintCompatible(pkgA.code, pkgB.code);
  const pinCountMatch = pkgA.pin_count === pkgB.pin_count;

  const epEval = evaluateExposedPad(pkgA, pkgB);
  const exposedPadMatch = epEval.match;

  const mapA = new Map(pkgA.pinout.map((p) => [p.pin, p]));
  const mapB = new Map(pkgB.pinout.map((p) => [p.pin, p]));
  const maxPins = Math.max(pkgA.pin_count, pkgB.pin_count);

  const pinDiff = [];
  let hardPinMismatch = false;
  let hasPin4NcBypass = false;
  let hasEnPolarityDiff = false;
  let allRolesEquivalent = pinCountMatch;

  for (let pin = 1; pin <= maxPins; pin++) {
    const res = evaluateSinglePin(partA, partB, pin, mapA.get(pin), mapB.get(pin));
    pinDiff.push({
      pin: res.pin,
      part_a_name: res.part_a_name,
      part_a_role: res.part_a_role,
      part_b_name: res.part_b_name,
      part_b_role: res.part_b_role,
      status: res.status,
      note: res.note,
    });
    if (res.hardMismatch) hardPinMismatch = true;
    if (res.pin4NcBypass) hasPin4NcBypass = true;
    if (res.enPolarityDiff) hasEnPolarityDiff = true;
    if (!res.roleEquivalent) allRolesEquivalent = false;
  }

  const pinoutExactMatch = pinCountMatch && allRolesEquivalent;
  const swapRisks = [];
  const level3Reasons = [];
  const level2Reasons = [];

  // Structural / Physical Layout checks (Level 3 triggers)
  if (!pinCountMatch || !footprintCompatible) {
    const msg = `CRITICAL PACKAGE MISMATCH: ${partA.opn} uses ${pkgA.code} (${pkgA.pin_count}-pin, ${pkgA.mfg_package_code}) while ${partB.opn} uses ${pkgB.code} (${pkgB.pin_count}-pin, ${pkgB.mfg_package_code}); PCB footprint redesign is mandatory.`;
    level3Reasons.push('package/footprint mismatch');
    swapRisks.push(msg);
  } else if (!packageMatch && footprintCompatible) {
    swapRisks.push(
      `CAUTION PACKAGE HEIGHT/PROFILE: ${partA.opn} (${pkgA.code}) vs ${partB.opn} (${pkgB.code}) share the same JEDEC land pattern pitch, but thin-profile TSOT (~1.0 mm) vs standard SOT (~1.45 mm) differs in body height; verify enclosure Z-clearance, SMT nozzle height, and solder fillet spec.`,
    );
  }

  if (pkgA.pinout_view !== pkgB.pinout_view) {
    swapRisks.push(
      `CAUTION DATASHEET VIEW ORIENTATION: ${partA.opn} pinout is drawn ${pkgA.pinout_view} (p.${pkgA.pinout_source_page}) while ${partB.opn} is drawn ${pkgB.pinout_view} (p.${pkgB.pinout_source_page}); double-check Pin 1 index mirroring in CAD footprints.`,
    );
  }

  if (hardPinMismatch) {
    const conflicts = pinDiff
      .filter((d) => d.status === 'MISMATCH')
      .map((d) => `Pin ${d.pin} (${d.part_a_role} vs ${d.part_b_role})`)
      .join(', ');
    level3Reasons.push(`pinout mismatch on ${conflicts}`);
    swapRisks.push(
      `CRITICAL PINOUT CONFLICT: Incompatible pin assignments on ${conflicts}. Soldering ${partB.opn} onto a ${partA.opn} footprint (or vice versa) without rerouting copper can short VIN/VOUT/GND and permanently damage the board.`,
    );
  }

  if (!exposedPadMatch) {
    level3Reasons.push('exposed pad / thermal tab net mismatch');
    swapRisks.push(epEval.note);
  } else if (epEval.caution) {
    swapRisks.push(`CAUTION EXPOSED PAD: ${epEval.note}`);
  }

  if (hasPin4NcBypass) {
    level2Reasons.push('Pin 4 NC vs BYPASS difference');
    swapRisks.push(
      `HIGH PIN 4 (NC vs BYPASS/NR) CHECK: One device uses Pin 4 as an internal bandgap bypass/noise-reduction node while the other is NC. Verify Pin 4 is NOT tied to GND or VIN on the existing PCB before swapping; add a 10 nF bypass cap if low noise is required.`,
    );
  }

  if (hasEnPolarityDiff) {
    level2Reasons.push('Enable (EN) polarity inversion');
    swapRisks.push(
      `CRITICAL ENABLE POLARITY: Active-High vs Active-Low EN pin mismatch — existing MCU GPIO or pull-up/pull-down resistor will invert regulator ON/OFF state.`,
    );
  }

  // Category-specific electrical & stability rules
  if (partA.category === 'ldo') {
    const sA = partA.specs;
    const sB = partB.specs;

    if (sA.vout_fixed !== sB.vout_fixed || Math.abs(sA.vout_v.value - sB.vout_v.value) > 0.05) {
      level2Reasons.push('output voltage / fixed-vs-adjustable mismatch');
      swapRisks.push(
        `CRITICAL OUTPUT VOLTAGE DIFFERENCE: ${partA.opn} regulates ${sA.vout_v.value} V (${sA.vout_fixed ? 'fixed' : 'adj'}, p.${sA.vout_v.page}) vs ${partB.opn} ${sB.vout_v.value} V (${sB.vout_fixed ? 'fixed' : 'adj'}, p.${sB.vout_v.page}).`,
      );
    }

    if (sA.ceramic_cap_stable !== sB.ceramic_cap_stable) {
      level2Reasons.push('ceramic output capacitor ESR stability difference');
      const nonCer = sA.ceramic_cap_stable ? partB : partA;
      const cer = sA.ceramic_cap_stable ? partA : partB;
      swapRisks.push(
        `CRITICAL CAPACITOR ESR OSCILLATION RISK: ${cer.opn} is stable with low-ESR ceramic MLCCs (>= ${cer.specs.min_cout_uf.value} µF, p.${cer.specs.min_cout_uf.page}), whereas ${nonCer.opn} is NOT ceramic-cap stable (ESR window: ${fmtEsrWindow(nonCer.specs)}). Using an ultra-low-ESR MLCC on ${nonCer.opn} can trigger control-loop oscillation.`,
      );
    } else if (
      Math.max(sA.min_cout_uf.value, sB.min_cout_uf.value) /
        Math.max(Math.min(sA.min_cout_uf.value, sB.min_cout_uf.value), 0.01) >=
      2.5
    ) {
      level2Reasons.push('minimum output capacitance requirement differs >= 2.5x');
      swapRisks.push(
        `CAUTION OUTPUT CAPACITANCE: Minimum Cout differs significantly (${partA.opn}: ${sA.min_cout_uf.value} µF p.${sA.min_cout_uf.page} vs ${partB.opn}: ${sB.min_cout_uf.value} µF p.${sB.min_cout_uf.page}); account for MLCC DC-bias derating.`,
      );
    }

    const vinRatio =
      Math.min(sA.vin_max_v.value, sB.vin_max_v.value) /
      Math.max(sA.vin_max_v.value, sB.vin_max_v.value);
    if (vinRatio < 0.8) {
      const lowerVin = sA.vin_max_v.value < sB.vin_max_v.value ? partA : partB;
      const higherVin = sA.vin_max_v.value < sB.vin_max_v.value ? partB : partA;
      level2Reasons.push('Vin,max rating drops >20%');
      swapRisks.push(
        `HIGH INPUT VOLTAGE RATING DROP: ${lowerVin.opn} is rated to only ${lowerVin.specs.vin_max_v.value} V rec. (${lowerVin.specs.vin_abs_max_v.value} V abs max, p.${lowerVin.specs.vin_abs_max_v.page}) vs ${higherVin.opn} at ${higherVin.specs.vin_max_v.value} V rec. (${higherVin.specs.vin_abs_max_v.value} V abs max, p.${higherVin.specs.vin_abs_max_v.page}). Verify worst-case input transient spikes.`,
      );
    }

    const ioutRatio =
      Math.min(sA.iout_max_ma.value, sB.iout_max_ma.value) /
      Math.max(sA.iout_max_ma.value, sB.iout_max_ma.value);
    if (ioutRatio < 0.8) {
      const lowerI = sA.iout_max_ma.value < sB.iout_max_ma.value ? partA : partB;
      const higherI = sA.iout_max_ma.value < sB.iout_max_ma.value ? partB : partA;
      level2Reasons.push('Iout,max rating drops >20%');
      swapRisks.push(
        `HIGH LOAD CURRENT DERATING: ${lowerI.opn} supplies up to ${lowerI.specs.iout_max_ma.value} mA (p.${lowerI.specs.iout_max_ma.page}) compared to ${higherI.opn} at ${higherI.specs.iout_max_ma.value} mA (p.${higherI.specs.iout_max_ma.page}); confirm peak inrush and thermal dissipation margin.`,
      );
    }

    if (Math.abs(sA.dropout_typ_mv.value - sB.dropout_typ_mv.value) >= 500) {
      level2Reasons.push('dropout voltage headroom differs >= 500 mV');
      swapRisks.push(
        `CAUTION DROPOUT HEADROOM: Typical dropout differs by ${Math.round(Math.abs(sA.dropout_typ_mv.value - sB.dropout_typ_mv.value))} mV (${partA.opn}: ${sA.dropout_typ_mv.value} mV p.${sA.dropout_typ_mv.page} vs ${partB.opn}: ${sB.dropout_typ_mv.value} mV p.${sB.dropout_typ_mv.page}); verify Vin,min - Vout >= Vdo at cold/hot corners.`,
      );
    }

    if (
      sA.en_active_high !== null &&
      sB.en_active_high !== null &&
      sA.en_active_high !== sB.en_active_high &&
      !hasEnPolarityDiff
    ) {
      level2Reasons.push('EN polarity differs');
      swapRisks.push(
        `CRITICAL ENABLE POLARITY: ${partA.opn} EN is ${sA.en_active_high ? 'active-high' : 'active-low'} whereas ${partB.opn} EN is ${sB.en_active_high ? 'active-high' : 'active-low'}.`,
      );
    }
  } else if (partA.category === 'dcdc') {
    const sA = partA.specs;
    const sB = partB.specs;

    if (sA.topology !== sB.topology) {
      level2Reasons.push(`topology differs (${sA.topology} vs ${sB.topology})`);
      swapRisks.push(
        `CRITICAL TOPOLOGY DIFFERENCE: ${partA.opn} is a ${sA.topology} converter whereas ${partB.opn} is a ${sB.topology} converter; power-stage architecture, inductor placement, and startup behavior differ fundamentally.`,
      );
    }

    if (sA.synchronous !== sB.synchronous) {
      level2Reasons.push('synchronous vs non-synchronous rectification differs');
      const asyncPart = sA.synchronous ? partB : partA;
      swapRisks.push(
        `HIGH RECTIFICATION DIFFERENCE: ${asyncPart.opn} is non-synchronous and requires an external Schottky catch/freewheeling diode, whereas the counterpart integrates a synchronous low-side MOSFET.`,
      );
    }

    const fswRelDiff =
      Math.abs(sA.fsw_typ_khz.value - sB.fsw_typ_khz.value) /
      Math.max(sA.fsw_typ_khz.value, sB.fsw_typ_khz.value);
    if (fswRelDiff > 0.3) {
      level2Reasons.push('switching frequency differs >30%');
      swapRisks.push(
        `HIGH SWITCHING FREQUENCY SHIFT: fsw differs by ${Math.round(fswRelDiff * 100)}% (${partA.opn}: ${sA.fsw_typ_khz.value} kHz p.${sA.fsw_typ_khz.page} vs ${partB.opn}: ${sB.fsw_typ_khz.value} kHz p.${sB.fsw_typ_khz.page}); re-evaluate inductor core loss, ripple current ΔIL, output capacitor ESR ripple, and EMI harmonics.`,
      );
    }

    const indRelDiff =
      Math.abs(sA.inductor_typ_uh.value - sB.inductor_typ_uh.value) /
      Math.max(sA.inductor_typ_uh.value, sB.inductor_typ_uh.value);
    if (indRelDiff > 0.2) {
      level2Reasons.push('recommended inductor value differs >20%');
      swapRisks.push(
        `CAUTION INDUCTOR RETUNING: Typical inductor differs (${partA.opn}: ${sA.inductor_typ_uh.value} µH p.${sA.inductor_typ_uh.page} vs ${partB.opn}: ${sB.inductor_typ_uh.value} µH p.${sB.inductor_typ_uh.page}); check inductor Isat against peak switch current limit.`,
      );
    }

    if (sA.vout_fixed !== sB.vout_fixed) {
      level2Reasons.push('fixed vs adjustable output configuration differs');
      swapRisks.push(
        `HIGH FEEDBACK CONFIGURATION: One converter is fixed-output while the other is adjustable; external R1/R2 feedback resistors and feedforward capacitor must be updated.`,
      );
    } else if (
      sA.vref_v &&
      sB.vref_v &&
      Math.abs(sA.vref_v.value - sB.vref_v.value) /
        Math.max(sA.vref_v.value, sB.vref_v.value) >
        0.02
    ) {
      level2Reasons.push('feedback reference voltage Vref differs');
      swapRisks.push(
        `HIGH VREF MISMATCH: Feedback reference differs (${partA.opn}: ${sA.vref_v.value} V p.${sA.vref_v.page} vs ${partB.opn}: ${sB.vref_v.value} V p.${sB.vref_v.page}); dropping in without recalculating R1/R2 will output the wrong voltage rail.`,
      );
    }

    const vinRatio =
      Math.min(sA.vin_max_v.value, sB.vin_max_v.value) /
      Math.max(sA.vin_max_v.value, sB.vin_max_v.value);
    if (vinRatio < 0.8) {
      level2Reasons.push('Vin,max rating drops >20%');
      swapRisks.push(
        `HIGH INPUT VOLTAGE RANGE SHIFT: Recommended Vin,max differs (${partA.opn}: ${sA.vin_max_v.value} V p.${sA.vin_max_v.page} vs ${partB.opn}: ${sB.vin_max_v.value} V p.${sB.vin_max_v.page}); verify line transients stay below Vin,abs,max.`,
      );
    }

    const iRatio =
      Math.min(sA.iout_or_isw_max_ma.value, sB.iout_or_isw_max_ma.value) /
      Math.max(sA.iout_or_isw_max_ma.value, sB.iout_or_isw_max_ma.value);
    if (iRatio < 0.8 || sA.is_switch_limit !== sB.is_switch_limit) {
      level2Reasons.push('current rating or switch-limit basis differs');
      swapRisks.push(
        `CAUTION CURRENT RATING BASIS: ${partA.opn} specifies ${sA.iout_or_isw_max_ma.value} mA (${sA.is_switch_limit ? 'switch current limit Isw' : 'continuous Iout'}, p.${sA.iout_or_isw_max_ma.page}) vs ${partB.opn} ${sB.iout_or_isw_max_ma.value} mA (${sB.is_switch_limit ? 'switch current limit Isw' : 'continuous Iout'}, p.${sB.iout_or_isw_max_ma.page}). Remember boost Iout,max is strictly less than Isw due to duty-cycle scaling.`,
      );
    }
  } else if (partA.category === 'opamp') {
    const sA = partA.specs;
    const sB = partB.specs;

    // CRITICAL Op-Amp vs Comparator guard (AUD-02/AUD-04)
    if (sA.device_kind !== sB.device_kind || sA.output_type !== sB.output_type) {
      level2Reasons.push(
        `device kind / output stage mismatch (${sA.device_kind}/${sA.output_type} vs ${sB.device_kind}/${sB.output_type})`,
      );
      swapRisks.push(
        `CRITICAL OP-AMP VS COMPARATOR TRAP: ${partA.opn} is a ${sA.device_kind} with ${sA.output_type} output while ${partB.opn} is a ${sB.device_kind} with ${sB.output_type} output. Even with identical pinouts, an open-collector comparator CANNOT pull high without an external pull-up resistor and lacks internal Miller compensation — dropping it into a linear negative-feedback op-amp circuit causes severe oscillation; conversely, using an op-amp as a comparator causes slow overdrive recovery and output saturation lag.`,
      );
    }

    const vsRatio =
      Math.min(sA.vs_max_v.value, sB.vs_max_v.value) /
      Math.max(sA.vs_max_v.value, sB.vs_max_v.value);
    if (vsRatio < 0.8) {
      const lowV = sA.vs_max_v.value < sB.vs_max_v.value ? partA : partB;
      const highV = sA.vs_max_v.value < sB.vs_max_v.value ? partB : partA;
      level2Reasons.push('supply voltage Vs,max drops >20%');
      swapRisks.push(
        `CRITICAL SUPPLY VOLTAGE RATING: ${lowV.opn} is limited to ${lowV.specs.vs_max_v.value} V max (${lowV.specs.vs_abs_max_v.value} V abs max, p.${lowV.specs.vs_abs_max_v.page}) whereas ${highV.opn} supports up to ${highV.specs.vs_max_v.value} V (${highV.specs.vs_abs_max_v.value} V abs max, p.${highV.specs.vs_abs_max_v.page}). Installing a 5.5 V CMOS op-amp on a 12 V–24 V rail causes instant breakdown.`,
      );
    }

    if (
      sA.rail_to_rail_in !== sB.rail_to_rail_in ||
      sA.rail_to_rail_out !== sB.rail_to_rail_out
    ) {
      level2Reasons.push('rail-to-rail input/output swing differs');
      swapRisks.push(
        `HIGH HEADROOM / CLIPPING RISK: Rail-to-rail capability differs (${partA.opn}: IN=${sA.rail_to_rail_in ? 'RR' : 'Non-RR'}, OUT=${sA.rail_to_rail_out ? 'RR' : 'Non-RR'} vs ${partB.opn}: IN=${sB.rail_to_rail_in ? 'RR' : 'Non-RR'}, OUT=${sB.rail_to_rail_out ? 'RR' : 'Non-RR'}); verify input common-mode range (Vicm) and output voltage swing against ADC full-scale range.`,
      );
    }

    if (sA.gbwp_mhz && sB.gbwp_mhz) {
      const gbwpRatio =
        Math.max(sA.gbwp_mhz.value, sB.gbwp_mhz.value) /
        Math.max(Math.min(sA.gbwp_mhz.value, sB.gbwp_mhz.value), 0.001);
      if (gbwpRatio >= 3.0) {
        level2Reasons.push('GBWP differs >= 3x');
        swapRisks.push(
          `CAUTION BANDWIDTH & PHASE MARGIN: GBWP differs by ${fmtNum(gbwpRatio, 1)}x (${partA.opn}: ${sA.gbwp_mhz.value} MHz p.${sA.gbwp_mhz.page} vs ${partB.opn}: ${sB.gbwp_mhz.value} MHz p.${sB.gbwp_mhz.page}); higher-bandwidth replacements can oscillate with capacitive loads or stray feedback capacitance without an isolation resistor.`,
        );
      }
    }

    if (sA.slew_rate_v_per_us && sB.slew_rate_v_per_us) {
      const srRatio =
        Math.max(sA.slew_rate_v_per_us.value, sB.slew_rate_v_per_us.value) /
        Math.max(Math.min(sA.slew_rate_v_per_us.value, sB.slew_rate_v_per_us.value), 0.001);
      if (srRatio >= 3.0) {
        level2Reasons.push('slew rate differs >= 3x');
        swapRisks.push(
          `CAUTION SLEW RATE DIFFERENCE: Slew rate differs by ${fmtNum(srRatio, 1)}x (${partA.opn}: ${sA.slew_rate_v_per_us.value} V/µs p.${sA.slew_rate_v_per_us.page} vs ${partB.opn}: ${sB.slew_rate_v_per_us.value} V/µs p.${sB.slew_rate_v_per_us.page}); check full-power bandwidth SR / (2π·Vpeak).`,
        );
      }
    }

    const vosRatio =
      Math.max(sA.vos_max_mv.value, sB.vos_max_mv.value) /
      Math.max(Math.min(sA.vos_max_mv.value, sB.vos_max_mv.value), 0.001);
    if (vosRatio >= 10) {
      level2Reasons.push('input offset voltage Vos differs >= 10x');
      swapRisks.push(
        `CAUTION PRECISION OFFSET SHIFT: Maximum Vos differs by ${fmtNum(vosRatio, 0)}x (${partA.opn}: ${sA.vos_max_mv.value} mV p.${sA.vos_max_mv.page} vs ${partB.opn}: ${sB.vos_max_mv.value} mV p.${sB.vos_max_mv.page}); high-gain DC sensor stages may lose accuracy or require zero-drift chopper filtering.`,
      );
    }
  }

  // Lifecycle status caution (NRND / EOL sourcing risk)
  for (const p of [partA, partB]) {
    if (p.lifecycle_status === 'EOL' || p.lifecycle_status === 'NRND') {
      swapRisks.push(
        `CAUTION LIFECYCLE STATUS (${p.lifecycle_status}): ${p.opn} is flagged ${p.lifecycle_status} by ${p.manufacturer}; do not design into new production layouts — evaluate Active alternatives.`,
      );
    }
  }

  // Thermal resistance caution (applies to all categories)
  const thetaDiffRatio =
    Math.abs(pkgA.theta_ja_c_per_w.value - pkgB.theta_ja_c_per_w.value) /
    Math.max(pkgA.theta_ja_c_per_w.value, pkgB.theta_ja_c_per_w.value);
  if (thetaDiffRatio >= 0.25) {
    swapRisks.push(
      `CAUTION THERMAL MARGIN: Package θJA differs by ${Math.round(thetaDiffRatio * 100)}% (${partA.opn}: ${pkgA.theta_ja_c_per_w.value} °C/W p.${pkgA.theta_ja_c_per_w.page} vs ${partB.opn}: ${pkgB.theta_ja_c_per_w.value} °C/W p.${pkgB.theta_ja_c_per_w.page}); re-check Tj = Ta + Pd × θJA against Tj,max.`,
    );
  }

  // Determine final Compatibility Level (strict AUD-02 & AUD-04 hierarchy)
  let compatibilityLevel;
  if (level3Reasons.length > 0) {
    compatibilityLevel = 'LEVEL_3_LAYOUT_CHANGE';
  } else if (level2Reasons.length > 0) {
    compatibilityLevel = 'LEVEL_2_TUNING_REQUIRED';
  } else {
    compatibilityLevel = 'LEVEL_1_CANDIDATE_DROP_IN';
  }

  // Ensure at least 2 concrete risks/checks (schema min(2))
  if (swapRisks.length < 2) {
    swapRisks.push(
      `BENCH VERIFICATION: Confirm thermal dissipation margin using θJA (${partA.opn}: ${pkgA.theta_ja_c_per_w.value} °C/W vs ${partB.opn}: ${pkgB.theta_ja_c_per_w.value} °C/W) and worst-case ambient temperature (${partA.temp_grade.ta_min_c}..${partA.temp_grade.ta_max_c} °C vs ${partB.temp_grade.ta_min_c}..${partB.temp_grade.ta_max_c} °C).`,
    );
  }
  if (swapRisks.length < 2) {
    swapRisks.push(
      `DATASHEET REVISION CHECK (AUD-04): Verify latest official manufacturer datasheets (${partA.datasheet.revision} vs ${partB.datasheet.revision}) for part-marking codes, transient load response, and qualification status before production release.`,
    );
  }

  return {
    compatibility_level: compatibilityLevel,
    compatibility_badge: COMPATIBILITY_BADGES[compatibilityLevel],
    package_match: packageMatch,
    footprint_compatible: footprintCompatible,
    pinout_exact_match: pinoutExactMatch,
    exposed_pad_match: exposedPadMatch,
    pin_diff: pinDiff,
    swap_risks: swapRisks,
    level3Reasons,
    level2Reasons,
  };
}

function buildLdoParameterMatrix(a, b) {
  const sA = a.specs;
  const sB = b.specs;
  const pA = a.package;
  const pB = b.package;

  const vinSpanA = sA.vin_max_v.value - sA.vin_min_v.value;
  const vinSpanB = sB.vin_max_v.value - sB.vin_min_v.value;

  return [
    {
      metric: 'Package & Exposed Pad',
      unit: '—',
      part_a_value: `${pA.code} (${pA.mfg_package_code}, EP: ${pA.exposed_pad.present ? pA.exposed_pad.net : 'None'}, p.${pA.pinout_source_page})`,
      part_b_value: `${pB.code} (${pB.mfg_package_code}, EP: ${pB.exposed_pad.present ? pB.exposed_pad.net : 'None'}, p.${pB.pinout_source_page})`,
      winner: pA.code === pB.code && pA.exposed_pad.net === pB.exposed_pad.net ? 'TIE' : 'CONTEXT',
      note: pA.code === pB.code ? 'Same JEDEC package outline.' : 'Check PCB land pattern & height profile.',
    },
    {
      metric: 'Input Voltage Range (Rec.)',
      unit: 'V',
      part_a_value: fmtRange(sA.vin_min_v, sA.vin_max_v, 'V'),
      part_b_value: fmtRange(sB.vin_min_v, sB.vin_max_v, 'V'),
      winner: compareHigherBetter(vinSpanA, vinSpanB, 0.05),
      note: 'Wider operating Vin window supports broader rail & battery chemistry headroom.',
    },
    {
      metric: 'Absolute Max Input Voltage',
      unit: 'V',
      part_a_value: fmtCited(sA.vin_abs_max_v, 'V'),
      part_b_value: fmtCited(sB.vin_abs_max_v, 'V'),
      winner: compareHigherBetter(sA.vin_abs_max_v.value, sB.vin_abs_max_v.value),
      note: 'Higher Vin,abs improves survivability against hot-plug and inductive bus spikes.',
    },
    {
      metric: 'Output Voltage & Accuracy',
      unit: 'V / %',
      part_a_value: `${fmtNum(sA.vout_v.value)} V ±${fmtNum(sA.vout_tolerance_pct.value)}% (p.${sA.vout_tolerance_pct.page})`,
      part_b_value: `${fmtNum(sB.vout_v.value)} V ±${fmtNum(sB.vout_tolerance_pct.value)}% (p.${sB.vout_tolerance_pct.page})`,
      winner:
        Math.abs(sA.vout_v.value - sB.vout_v.value) <= 0.05
          ? compareLowerBetter(sA.vout_tolerance_pct.value, sB.vout_tolerance_pct.value)
          : 'CONTEXT',
      note: 'Tighter Vout tolerance improves ADC reference and digital rail margin.',
    },
    {
      metric: 'Max Output Current (Iout)',
      unit: 'mA',
      part_a_value: fmtCited(sA.iout_max_ma, 'mA'),
      part_b_value: fmtCited(sB.iout_max_ma, 'mA'),
      winner: compareHigherBetter(sA.iout_max_ma.value, sB.iout_max_ma.value),
      note: 'Actual usable continuous Iout is also bounded by package θJA thermal derating.',
    },
    {
      metric: 'Quiescent Current (Iq, typ)',
      unit: 'µA',
      part_a_value: fmtCited(sA.iq_typ_ua, 'µA'),
      part_b_value: fmtCited(sB.iq_typ_ua, 'µA'),
      winner: compareLowerBetter(sA.iq_typ_ua.value, sB.iq_typ_ua.value),
      note: 'Lower Iq directly extends sleep-mode battery life in always-on IoT/portable rails.',
    },
    {
      metric: 'Dropout Voltage (Vdo, typ)',
      unit: 'mV',
      part_a_value: fmtCited(sA.dropout_typ_mv, 'mV'),
      part_b_value: fmtCited(sB.dropout_typ_mv, 'mV'),
      winner: compareLowerBetter(sA.dropout_typ_mv.value, sB.dropout_typ_mv.value),
      note: 'Lower dropout allows regulation deeper into Li-ion / 3.7 V discharge curves.',
    },
    {
      metric: 'Ceramic Cap Stability & Min Cout',
      unit: 'µF / Ω',
      part_a_value: `${sA.ceramic_cap_stable ? 'Ceramic OK' : 'ESR-Sensitive'} · >=${fmtNum(sA.min_cout_uf.value)} µF · ${fmtEsrWindow(sA)}`,
      part_b_value: `${sB.ceramic_cap_stable ? 'Ceramic OK' : 'ESR-Sensitive'} · >=${fmtNum(sB.min_cout_uf.value)} µF · ${fmtEsrWindow(sB)}`,
      winner:
        sA.ceramic_cap_stable === sB.ceramic_cap_stable
          ? compareLowerBetter(sA.min_cout_uf.value, sB.min_cout_uf.value, 0.1)
          : sA.ceramic_cap_stable
            ? 'A'
            : 'B',
      note: 'Non-ceramic-stable LDOs oscillate with low-ESR MLCCs unless series resistance or tantalum is used.',
    },
    {
      metric: 'PSRR (typ)',
      unit: 'dB',
      part_a_value: fmtCited(sA.psrr_db, 'dB'),
      part_b_value: fmtCited(sB.psrr_db, 'dB'),
      winner: compareHigherBetter(sA.psrr_db?.value, sB.psrr_db?.value),
      note: 'Higher PSRR attenuates upstream switching-converter ripple on analog/RF rails.',
    },
    {
      metric: 'Output Noise (typ)',
      unit: 'µVrms',
      part_a_value: fmtCited(sA.output_noise_uvrms, 'µVrms'),
      part_b_value: fmtCited(sB.output_noise_uvrms, 'µVrms'),
      winner: compareLowerBetter(sA.output_noise_uvrms?.value, sB.output_noise_uvrms?.value),
      note: 'Critical for RF VCOs, low-noise ADCs, and precision sensor excitation.',
    },
    {
      metric: 'Thermal Resistance (θJA)',
      unit: '°C/W',
      part_a_value: fmtCited(pA.theta_ja_c_per_w, '°C/W'),
      part_b_value: fmtCited(pB.theta_ja_c_per_w, '°C/W'),
      winner: compareLowerBetter(pA.theta_ja_c_per_w.value, pB.theta_ja_c_per_w.value),
      note: 'Lower θJA yields lower junction temperature rise ΔTj = (Vin - Vout) × Iout × θJA.',
    },
    {
      metric: 'Max Junction Temp (Tj,max)',
      unit: '°C',
      part_a_value: fmtCited(pA.tj_max_c, '°C'),
      part_b_value: fmtCited(pB.tj_max_c, '°C'),
      winner: compareHigherBetter(pA.tj_max_c.value, pB.tj_max_c.value, 0.01),
      note: 'Keep steady-state Tj at least 15–25 °C below Tj,max for production reliability.',
    },
  ];
}

function buildDcdcParameterMatrix(a, b) {
  const sA = a.specs;
  const sB = b.specs;
  const pA = a.package;
  const pB = b.package;

  return [
    {
      metric: 'Topology & Rectification',
      unit: '—',
      part_a_value: `${sA.topology} (${sA.synchronous ? 'Synchronous' : 'Non-Sync Diode'})`,
      part_b_value: `${sB.topology} (${sB.synchronous ? 'Synchronous' : 'Non-Sync Diode'})`,
      winner:
        sA.topology === sB.topology && sA.synchronous !== sB.synchronous
          ? sA.synchronous
            ? 'A'
            : 'B'
          : sA.topology === sB.topology
            ? 'TIE'
            : 'CONTEXT',
      note: 'Synchronous rectification eliminates external Schottky diode loss and PCB area.',
    },
    {
      metric: 'Package & Exposed Pad',
      unit: '—',
      part_a_value: `${pA.code} (${pA.mfg_package_code}, EP: ${pA.exposed_pad.present ? pA.exposed_pad.net : 'None'}, p.${pA.pinout_source_page})`,
      part_b_value: `${pB.code} (${pB.mfg_package_code}, EP: ${pB.exposed_pad.present ? pB.exposed_pad.net : 'None'}, p.${pB.pinout_source_page})`,
      winner: pA.code === pB.code && pA.exposed_pad.net === pB.exposed_pad.net ? 'TIE' : 'CONTEXT',
      note: 'Compact WSON/VSON/SOT-563 packages demand tight hot-loop layout and thermal vias.',
    },
    {
      metric: 'Input Voltage Range (Rec.)',
      unit: 'V',
      part_a_value: fmtRange(sA.vin_min_v, sA.vin_max_v, 'V'),
      part_b_value: fmtRange(sB.vin_min_v, sB.vin_max_v, 'V'),
      winner: compareHigherBetter(
        sA.vin_max_v.value - sA.vin_min_v.value,
        sB.vin_max_v.value - sB.vin_min_v.value,
        0.05,
      ),
      note: 'Verify cold-start minimum startup voltage and bus surge ceiling.',
    },
    {
      metric: 'Absolute Max Input Voltage',
      unit: 'V',
      part_a_value: fmtCited(sA.vin_abs_max_v, 'V'),
      part_b_value: fmtCited(sB.vin_abs_max_v, 'V'),
      winner: compareHigherBetter(sA.vin_abs_max_v.value, sB.vin_abs_max_v.value),
      note: 'Provides transient overshoot margin above nominal DC supply bus.',
    },
    {
      metric: 'Output Voltage Range',
      unit: 'V',
      part_a_value: `${fmtRange(sA.vout_min_v, sA.vout_max_v, 'V')} (${sA.vout_fixed ? 'Fixed' : 'Adj'})`,
      part_b_value: `${fmtRange(sB.vout_min_v, sB.vout_max_v, 'V')} (${sB.vout_fixed ? 'Fixed' : 'Adj'})`,
      winner: 'CONTEXT',
      note: 'Fixed-output variants save divider BOM; adjustable parts allow arbitrary rail tuning.',
    },
    {
      metric: 'Max Current (Iout or Isw Limit)',
      unit: 'mA',
      part_a_value: `${fmtCited(sA.iout_or_isw_max_ma, 'mA')} [${sA.is_switch_limit ? 'Isw limit' : 'Iout max'}]`,
      part_b_value: `${fmtCited(sB.iout_or_isw_max_ma, 'mA')} [${sB.is_switch_limit ? 'Isw limit' : 'Iout max'}]`,
      winner:
        sA.is_switch_limit === sB.is_switch_limit
          ? compareHigherBetter(sA.iout_or_isw_max_ma.value, sB.iout_or_isw_max_ma.value)
          : 'CONTEXT',
      note: 'For boost converters, usable Iout ≈ Isw × (Vin / Vout) × η minus half ripple ΔIL/2.',
    },
    {
      metric: 'Quiescent Current (Iq, typ)',
      unit: 'µA',
      part_a_value: fmtCited(sA.iq_typ_ua, 'µA'),
      part_b_value: fmtCited(sB.iq_typ_ua, 'µA'),
      winner: compareLowerBetter(sA.iq_typ_ua.value, sB.iq_typ_ua.value),
      note: 'Dominates light-load efficiency and standby battery runtime.',
    },
    {
      metric: 'Switching Frequency (fsw, typ)',
      unit: 'kHz',
      part_a_value: fmtCited(sA.fsw_typ_khz, 'kHz'),
      part_b_value: fmtCited(sB.fsw_typ_khz, 'kHz'),
      winner: 'CONTEXT',
      note: 'Higher fsw shrinks inductor footprint; lower fsw reduces switching losses & high-band EMI.',
    },
    {
      metric: 'Peak Efficiency',
      unit: '%',
      part_a_value: fmtCited(sA.efficiency_peak_pct, '%'),
      part_b_value: fmtCited(sB.efficiency_peak_pct, '%'),
      winner: compareHigherBetter(sA.efficiency_peak_pct?.value, sB.efficiency_peak_pct?.value, 0.01),
      note: 'Check datasheet efficiency curve at your exact Vin/Vout/Iout operating point.',
    },
    {
      metric: 'Recommended Inductor (L, typ)',
      unit: 'µH',
      part_a_value: fmtCited(sA.inductor_typ_uh, 'µH'),
      part_b_value: fmtCited(sB.inductor_typ_uh, 'µH'),
      winner: 'CONTEXT',
      note: 'Ensure inductor Isat exceeds worst-case peak switch current by >= 20–30%.',
    },
    {
      metric: 'Feedback Reference (Vref)',
      unit: 'V',
      part_a_value: fmtCited(sA.vref_v, 'V', 'N/A (Fixed)'),
      part_b_value: fmtCited(sB.vref_v, 'V', 'N/A (Fixed)'),
      winner: 'CONTEXT',
      note: 'Any Vref discrepancy requires recalculating feedback divider R1/R2.',
    },
    {
      metric: 'Thermal Resistance (θJA) & Tj,max',
      unit: '°C/W · °C',
      part_a_value: `${fmtNum(pA.theta_ja_c_per_w.value)} °C/W (p.${pA.theta_ja_c_per_w.page}) · ${fmtNum(pA.tj_max_c.value)} °C`,
      part_b_value: `${fmtNum(pB.theta_ja_c_per_w.value)} °C/W (p.${pB.theta_ja_c_per_w.page}) · ${fmtNum(pB.tj_max_c.value)} °C`,
      winner: compareLowerBetter(pA.theta_ja_c_per_w.value, pB.theta_ja_c_per_w.value),
      note: 'Lower θJA improves continuous load thermal headroom on compact 2-layer PCBs.',
    },
  ];
}

function buildOpampParameterMatrix(a, b) {
  const sA = a.specs;
  const sB = b.specs;
  const pA = a.package;
  const pB = b.package;

  const dynA =
    sA.device_kind === 'comparator'
      ? `tpd: ${fmtCited(sA.prop_delay_ns, 'ns')}`
      : `SR: ${fmtCited(sA.slew_rate_v_per_us, 'V/µs')}`;
  const dynB =
    sB.device_kind === 'comparator'
      ? `tpd: ${fmtCited(sB.prop_delay_ns, 'ns')}`
      : `SR: ${fmtCited(sB.slew_rate_v_per_us, 'V/µs')}`;

  const dynWinner =
    sA.device_kind === 'opamp' && sB.device_kind === 'opamp'
      ? compareHigherBetter(sA.slew_rate_v_per_us?.value, sB.slew_rate_v_per_us?.value)
      : sA.device_kind === 'comparator' && sB.device_kind === 'comparator'
        ? compareLowerBetter(sA.prop_delay_ns?.value, sB.prop_delay_ns?.value)
        : 'CONTEXT';

  const rrScore = (s) => (s.rail_to_rail_in ? 1 : 0) + (s.rail_to_rail_out ? 1 : 0);

  return [
    {
      metric: 'Device Kind & Output Stage',
      unit: '—',
      part_a_value: `${sA.device_kind} (${sA.output_type})`,
      part_b_value: `${sB.device_kind} (${sB.output_type})`,
      winner:
        sA.device_kind === sB.device_kind && sA.output_type === sB.output_type
          ? 'TIE'
          : 'CONTEXT',
      note: 'Op-amps (compensated push-pull) and comparators (uncompensated open-collector) are NOT drop-in interchangeable.',
    },
    {
      metric: 'Package & Channel Count',
      unit: '—',
      part_a_value: `${pA.code} · ${sA.channels} ch (${pA.mfg_package_code}, p.${pA.pinout_source_page})`,
      part_b_value: `${pB.code} · ${sB.channels} ch (${pB.mfg_package_code}, p.${pB.pinout_source_page})`,
      winner: pA.code === pB.code && sA.channels === sB.channels ? 'TIE' : 'CONTEXT',
      note: 'Single SOT-23-5 op-amps vary in pin ordering across vendors; verify Pin 1–5.',
    },
    {
      metric: 'Supply Voltage Range (Rec.)',
      unit: 'V',
      part_a_value: fmtRange(sA.vs_min_v, sA.vs_max_v, 'V'),
      part_b_value: fmtRange(sB.vs_min_v, sB.vs_max_v, 'V'),
      winner: compareHigherBetter(
        sA.vs_max_v.value - sA.vs_min_v.value,
        sB.vs_max_v.value - sB.vs_min_v.value,
        0.05,
      ),
      note: 'Confirm total supply span (V+ - V-) stays within recommended limits.',
    },
    {
      metric: 'Absolute Max Supply (Vs,abs)',
      unit: 'V',
      part_a_value: fmtCited(sA.vs_abs_max_v, 'V'),
      part_b_value: fmtCited(sB.vs_abs_max_v, 'V'),
      winner: compareHigherBetter(sA.vs_abs_max_v.value, sB.vs_abs_max_v.value),
      note: 'Exceeding Vs,abs causes immediate gate-oxide or junction breakdown.',
    },
    {
      metric: 'Gain-Bandwidth Product (GBWP)',
      unit: 'MHz',
      part_a_value: fmtCited(
        sA.gbwp_mhz,
        'MHz',
        sA.device_kind === 'comparator' ? 'N/A (Comparator)' : 'Not specified',
      ),
      part_b_value: fmtCited(
        sB.gbwp_mhz,
        'MHz',
        sB.device_kind === 'comparator' ? 'N/A (Comparator)' : 'Not specified',
      ),
      winner:
        sA.device_kind === 'opamp' && sB.device_kind === 'opamp'
          ? compareHigherBetter(sA.gbwp_mhz?.value, sB.gbwp_mhz?.value)
          : 'CONTEXT',
      note: 'Closed-loop -3 dB bandwidth scales as f_-3dB = GBWP / Acl.',
    },
    {
      metric: 'Slew Rate / Propagation Delay',
      unit: 'V/µs · ns',
      part_a_value: dynA,
      part_b_value: dynB,
      winner: dynWinner,
      note: 'Controls large-signal full-power bandwidth SR / (2π·Vpeak) or comparator switching speed.',
    },
    {
      metric: 'Input Offset Voltage (Vos, max)',
      unit: 'mV',
      part_a_value: fmtCited(sA.vos_max_mv, 'mV'),
      part_b_value: fmtCited(sB.vos_max_mv, 'mV'),
      winner: compareLowerBetter(sA.vos_max_mv.value, sB.vos_max_mv.value),
      note: 'Lower Vos minimizes DC error in current-shunt and sensor bridge amplifiers.',
    },
    {
      metric: 'Input Bias Current (Ib, typ)',
      unit: 'pA',
      part_a_value: fmtCited(sA.ib_typ_pa, 'pA'),
      part_b_value: fmtCited(sB.ib_typ_pa, 'pA'),
      winner: compareLowerBetter(sA.ib_typ_pa.value, sB.ib_typ_pa.value),
      note: 'CMOS/JFET pA-class inputs avoid offset voltage drops across high-impedance (>100 kΩ) sensors.',
    },
    {
      metric: 'Quiescent Current / Ch (Iq)',
      unit: 'µA/ch',
      part_a_value: fmtCited(sA.iq_per_ch_typ_ua, 'µA/ch'),
      part_b_value: fmtCited(sB.iq_per_ch_typ_ua, 'µA/ch'),
      winner: compareLowerBetter(sA.iq_per_ch_typ_ua.value, sB.iq_per_ch_typ_ua.value),
      note: 'Multiply by channel count for total IC standby current draw.',
    },
    {
      metric: 'Rail-to-Rail Input / Output',
      unit: '—',
      part_a_value: `IN: ${sA.rail_to_rail_in ? 'Yes' : 'No'} · OUT: ${sA.rail_to_rail_out ? 'Yes' : 'No'}`,
      part_b_value: `IN: ${sB.rail_to_rail_in ? 'Yes' : 'No'} · OUT: ${sB.rail_to_rail_out ? 'Yes' : 'No'}`,
      winner:
        rrScore(sA) === rrScore(sB) ? 'TIE' : rrScore(sA) > rrScore(sB) ? 'A' : 'B',
      note: 'RRIO prevents clipping on low-voltage 3.3 V single-supply ADC buffers.',
    },
    {
      metric: 'CMRR (typ) & Input Noise',
      unit: 'dB · nV/√Hz',
      part_a_value: `${fmtCited(sA.cmrr_typ_db, 'dB')} · ${fmtCited(sA.input_noise_nv_rt_hz, 'nV/√Hz')}`,
      part_b_value: `${fmtCited(sB.cmrr_typ_db, 'dB')} · ${fmtCited(sB.input_noise_nv_rt_hz, 'nV/√Hz')}`,
      winner: compareHigherBetter(sA.cmrr_typ_db?.value, sB.cmrr_typ_db?.value),
      note: 'Higher CMRR rejects common-mode noise; lower voltage noise improves SNR.',
    },
    {
      metric: 'Thermal Resistance (θJA) & Tj,max',
      unit: '°C/W · °C',
      part_a_value: `${fmtNum(pA.theta_ja_c_per_w.value)} °C/W (p.${pA.theta_ja_c_per_w.page}) · ${fmtNum(pA.tj_max_c.value)} °C`,
      part_b_value: `${fmtNum(pB.theta_ja_c_per_w.value)} °C/W (p.${pB.theta_ja_c_per_w.page}) · ${fmtNum(pB.tj_max_c.value)} °C`,
      winner: compareLowerBetter(pA.theta_ja_c_per_w.value, pB.theta_ja_c_per_w.value),
      note: 'Important when driving heavy resistive loads or high supply rails.',
    },
  ];
}

function buildEngineeringVerdict(partA, partB, evalRes) {
  const level = evalRes.compatibility_level;
  const pA = partA.package;
  const pB = partB.package;

  let lead = '';
  if (level === 'LEVEL_1_CANDIDATE_DROP_IN') {
    lead = `${partA.opn} (${partA.manufacturer}, ${pA.code}) and ${partB.opn} (${partB.manufacturer}, ${pB.code}) qualify as Level 1 Candidate Drop-In alternatives with matching pin assignments, compatible exposed-pad nets, and aligned core operating ratings.`;
  } else if (level === 'LEVEL_2_TUNING_REQUIRED') {
    const reasons = evalRes.level2Reasons.slice(0, 3).join('; ');
    lead = `${partA.opn} (${partA.manufacturer}, ${pA.code}) and ${partB.opn} (${partB.manufacturer}, ${pB.code}) are Level 2 Functional / Tuning Required replacements: while the footprint is physically compatible, engineering review and passive/circuit adjustments are mandatory due to ${reasons}.`;
  } else {
    const reasons = evalRes.level3Reasons.slice(0, 3).join('; ');
    lead = `${partA.opn} (${partA.manufacturer}, ${pA.code}) and ${partB.opn} (${partB.manufacturer}, ${pB.code}) are NOT pin-to-pin drop-in compatible (Level 3 PCB Layout Change Required) due to ${reasons}.`;
  }

  let detail = '';
  if (partA.category === 'ldo') {
    const sA = partA.specs;
    const sB = partB.specs;
    detail = ` Key datasheet deltas: Iq is ${fmtCited(sA.iq_typ_ua, 'µA')} vs ${fmtCited(sB.iq_typ_ua, 'µA')}, max output current is ${fmtCited(sA.iout_max_ma, 'mA')} vs ${fmtCited(sB.iout_max_ma, 'mA')}, recommended Vin,max is ${fmtCited(sA.vin_max_v, 'V')} vs ${fmtCited(sB.vin_max_v, 'V')}, typical dropout is ${fmtCited(sA.dropout_typ_mv, 'mV')} vs ${fmtCited(sB.dropout_typ_mv, 'mV')}, and ceramic capacitor stability is ${sA.ceramic_cap_stable ? 'supported' : 'ESR-constrained'} vs ${sB.ceramic_cap_stable ? 'supported' : 'ESR-constrained'}.`;
  } else if (partA.category === 'dcdc') {
    const sA = partA.specs;
    const sB = partB.specs;
    detail = ` Key datasheet deltas: topology is ${sA.topology} (${sA.synchronous ? 'sync' : 'non-sync'}) vs ${sB.topology} (${sB.synchronous ? 'sync' : 'non-sync'}), switching frequency is ${fmtCited(sA.fsw_typ_khz, 'kHz')} vs ${fmtCited(sB.fsw_typ_khz, 'kHz')}, rated current is ${fmtCited(sA.iout_or_isw_max_ma, 'mA')} vs ${fmtCited(sB.iout_or_isw_max_ma, 'mA')}, typical inductor is ${fmtCited(sA.inductor_typ_uh, 'µH')} vs ${fmtCited(sB.inductor_typ_uh, 'µH')}, and Iq is ${fmtCited(sA.iq_typ_ua, 'µA')} vs ${fmtCited(sB.iq_typ_ua, 'µA')}.`;
  } else {
    const sA = partA.specs;
    const sB = partB.specs;
    detail = ` Key datasheet deltas: device type is ${sA.device_kind} (${sA.output_type}) vs ${sB.device_kind} (${sB.output_type}), supply limit is ${fmtCited(sA.vs_max_v, 'V')} vs ${fmtCited(sB.vs_max_v, 'V')}, max Vos is ${fmtCited(sA.vos_max_mv, 'mV')} vs ${fmtCited(sB.vos_max_mv, 'mV')}, input bias current is ${fmtCited(sA.ib_typ_pa, 'pA')} vs ${fmtCited(sB.ib_typ_pa, 'pA')}, and Iq/ch is ${fmtCited(sA.iq_per_ch_typ_ua, 'µA')} vs ${fmtCited(sB.iq_per_ch_typ_ua, 'µA')}.`;
  }

  const tail = ` Always validate pinout orientation (${pA.pinout_view} p.${pA.pinout_source_page} vs ${pB.pinout_view} p.${pB.pinout_source_page}), thermal margin (θJA ${pA.theta_ja_c_per_w.value} vs ${pB.theta_ja_c_per_w.value} °C/W), and official manufacturer datasheets on hardware prototypes before production release.`;
  return `${lead}${detail}${tail}`;
}

export function buildVsComparison(partA, partB, generatedAt) {
  const norm = normalizeVsPair(partA.slug, partB.slug);
  const [first, second] =
    partA.slug === norm.part_a_slug ? [partA, partB] : [partB, partA];

  const evalRes = evaluateCompatibility(first, second);
  let parameterMatrix;
  if (first.category === 'ldo') {
    parameterMatrix = buildLdoParameterMatrix(first, second);
  } else if (first.category === 'dcdc') {
    parameterMatrix = buildDcdcParameterMatrix(first, second);
  } else {
    parameterMatrix = buildOpampParameterMatrix(first, second);
  }

  const record = {
    schema_version: '2.0.0',
    slug: norm.slug,
    category: first.category,
    part_a_slug: first.slug,
    part_b_slug: second.slug,
    part_a_opn: first.opn,
    part_b_opn: second.opn,
    compatibility_level: evalRes.compatibility_level,
    compatibility_badge: evalRes.compatibility_badge,
    package_match: evalRes.package_match,
    pinout_exact_match: evalRes.pinout_exact_match,
    exposed_pad_match: evalRes.exposed_pad_match,
    pin_diff: evalRes.pin_diff,
    parameter_matrix: parameterMatrix,
    swap_risks: evalRes.swap_risks,
    engineering_verdict: buildEngineeringVerdict(first, second, evalRes),
    generated_at: generatedAt,
  };

  return VsComparisonSchema.parse(record);
}

function scoreCandidate(target, cand, evalRes) {
  let score = 0;
  if (evalRes.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN') {
    score = 78;
    if (evalRes.package_match) score += 6;
    if (evalRes.pinout_exact_match) score += 5;
  } else if (evalRes.compatibility_level === 'LEVEL_2_TUNING_REQUIRED') {
    score = 56;
    if (evalRes.package_match) score += 5;
    if (evalRes.pinout_exact_match) score += 4;
  } else {
    score = 32;
    if (target.sub_topology === cand.sub_topology) score += 8;
    if (evalRes.package_match) score += 4;
  }

  if (target.category === 'ldo') {
    const t = target.specs;
    const c = cand.specs;
    if (c.iout_max_ma.value >= t.iout_max_ma.value) score += 3;
    else if (c.iout_max_ma.value < 0.7 * t.iout_max_ma.value) score -= 5;

    if (c.vin_max_v.value >= t.vin_max_v.value) score += 3;
    else if (c.vin_max_v.value < 0.7 * t.vin_max_v.value) score -= 5;

    if (c.iq_typ_ua.value < t.iq_typ_ua.value * 0.5) score += 3;
    if (c.dropout_typ_mv.value < t.dropout_typ_mv.value * 0.8) score += 2;
    if (c.ceramic_cap_stable && !t.ceramic_cap_stable) score += 3;
    if (!c.ceramic_cap_stable && t.ceramic_cap_stable) score -= 5;
  } else if (target.category === 'dcdc') {
    const t = target.specs;
    const c = cand.specs;
    if (c.topology === t.topology) score += 4;
    else score -= 8;

    if (c.synchronous && !t.synchronous) score += 3;
    if (c.vin_max_v.value >= t.vin_max_v.value) score += 2;
    if (c.iout_or_isw_max_ma.value >= t.iout_or_isw_max_ma.value) score += 2;
    if (c.iq_typ_ua.value < t.iq_typ_ua.value * 0.5) score += 2;
  } else {
    const t = target.specs;
    const c = cand.specs;
    if (c.device_kind !== t.device_kind || c.output_type !== t.output_type) {
      score -= 18;
    } else {
      score += 4;
    }
    if (c.channels === t.channels) score += 3;
    if (c.vs_max_v.value >= t.vs_max_v.value) score += 2;
    else if (c.vs_max_v.value < 0.5 * t.vs_max_v.value) score -= 6;
    if (c.rail_to_rail_in && c.rail_to_rail_out) score += 2;
    if (c.vos_max_mv.value < t.vos_max_mv.value) score += 2;
  }

  return Math.max(10, Math.min(99, Math.round(score)));
}

function classifyTierTag(target, cand, evalRes, isTopDropIn) {
  if (evalRes.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE') {
    return 'Functional Alternative (Layout Change)';
  }
  if (evalRes.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN' && isTopDropIn) {
    return 'Candidate Drop-In';
  }

  if (target.category === 'ldo') {
    if (cand.specs.iq_typ_ua.value <= target.specs.iq_typ_ua.value * 0.35) {
      return 'Ultra-Low Iq Upgrade';
    }
    if (
      cand.specs.iout_max_ma.value >= target.specs.iout_max_ma.value * 1.25 ||
      cand.specs.vin_max_v.value >= target.specs.vin_max_v.value * 1.25
    ) {
      return 'Higher Current / Margin';
    }
  } else if (target.category === 'dcdc') {
    if (cand.specs.iq_typ_ua.value <= target.specs.iq_typ_ua.value * 0.35) {
      return 'Ultra-Low Iq Upgrade';
    }
    if (
      cand.specs.iout_or_isw_max_ma.value >= target.specs.iout_or_isw_max_ma.value * 1.25 ||
      cand.specs.vin_max_v.value >= target.specs.vin_max_v.value * 1.25
    ) {
      return 'Higher Current / Margin';
    }
  } else {
    if (cand.specs.iq_per_ch_typ_ua.value <= target.specs.iq_per_ch_typ_ua.value * 0.35) {
      return 'Ultra-Low Iq Upgrade';
    }
    if (
      cand.specs.vs_max_v.value >= target.specs.vs_max_v.value * 1.3 ||
      (cand.specs.gbwp_mhz &&
        target.specs.gbwp_mhz &&
        cand.specs.gbwp_mhz.value >= target.specs.gbwp_mhz.value * 2)
    ) {
      return 'Higher Current / Margin';
    }
  }

  return evalRes.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN'
    ? 'Candidate Drop-In'
    : 'Value / Second-Source';
}

function summarizeAdvantageAndTradeoff(target, cand, evalRes) {
  const adv = [];
  const trade = [];

  if (target.category === 'ldo') {
    const t = target.specs;
    const c = cand.specs;
    if (c.iq_typ_ua.value < t.iq_typ_ua.value * 0.8) {
      adv.push(`Lower Iq (${fmtNum(c.iq_typ_ua.value)} µA vs ${fmtNum(t.iq_typ_ua.value)} µA)`);
    } else if (c.iq_typ_ua.value > t.iq_typ_ua.value * 1.3) {
      trade.push(`Higher Iq (${fmtNum(c.iq_typ_ua.value)} µA vs ${fmtNum(t.iq_typ_ua.value)} µA)`);
    }

    if (c.iout_max_ma.value > t.iout_max_ma.value * 1.15) {
      adv.push(`Higher Iout (${fmtNum(c.iout_max_ma.value)} mA vs ${fmtNum(t.iout_max_ma.value)} mA)`);
    } else if (c.iout_max_ma.value < t.iout_max_ma.value * 0.85) {
      trade.push(`Lower Iout (${fmtNum(c.iout_max_ma.value)} mA vs ${fmtNum(t.iout_max_ma.value)} mA)`);
    }

    if (c.vin_max_v.value > t.vin_max_v.value * 1.15) {
      adv.push(`Higher Vin,max (${fmtNum(c.vin_max_v.value)} V vs ${fmtNum(t.vin_max_v.value)} V)`);
    } else if (c.vin_max_v.value < t.vin_max_v.value * 0.85) {
      trade.push(`Lower Vin,max (${fmtNum(c.vin_max_v.value)} V vs ${fmtNum(t.vin_max_v.value)} V)`);
    }

    if (c.dropout_typ_mv.value < t.dropout_typ_mv.value * 0.75) {
      adv.push(`Lower dropout (${fmtNum(c.dropout_typ_mv.value)} mV vs ${fmtNum(t.dropout_typ_mv.value)} mV)`);
    } else if (c.dropout_typ_mv.value > t.dropout_typ_mv.value * 1.35) {
      trade.push(`Higher dropout (${fmtNum(c.dropout_typ_mv.value)} mV vs ${fmtNum(t.dropout_typ_mv.value)} mV)`);
    }

    if (c.ceramic_cap_stable && !t.ceramic_cap_stable) {
      adv.push('Ceramic MLCC stable (no tantalum ESR floor)');
    } else if (!c.ceramic_cap_stable && t.ceramic_cap_stable) {
      trade.push('ESR-sensitive output cap required (not ceramic stable)');
    }
  } else if (target.category === 'dcdc') {
    const t = target.specs;
    const c = cand.specs;
    if (c.iq_typ_ua.value < t.iq_typ_ua.value * 0.75) {
      adv.push(`Lower Iq (${fmtNum(c.iq_typ_ua.value)} µA vs ${fmtNum(t.iq_typ_ua.value)} µA)`);
    } else if (c.iq_typ_ua.value > t.iq_typ_ua.value * 1.35) {
      trade.push(`Higher Iq (${fmtNum(c.iq_typ_ua.value)} µA vs ${fmtNum(t.iq_typ_ua.value)} µA)`);
    }

    if (c.iout_or_isw_max_ma.value > t.iout_or_isw_max_ma.value * 1.15) {
      adv.push(`Higher current rating (${fmtNum(c.iout_or_isw_max_ma.value)} mA vs ${fmtNum(t.iout_or_isw_max_ma.value)} mA)`);
    } else if (c.iout_or_isw_max_ma.value < t.iout_or_isw_max_ma.value * 0.85) {
      trade.push(`Lower current rating (${fmtNum(c.iout_or_isw_max_ma.value)} mA vs ${fmtNum(t.iout_or_isw_max_ma.value)} mA)`);
    }

    if (c.synchronous && !t.synchronous) {
      adv.push('Synchronous rectification (no external Schottky)');
    } else if (!c.synchronous && t.synchronous) {
      trade.push('Non-synchronous (requires external catch diode)');
    }

    if (c.topology !== t.topology) {
      trade.push(`Different topology (${c.topology} vs ${t.topology})`);
    }
    if (c.vin_max_v.value > t.vin_max_v.value * 1.15) {
      adv.push(`Wider Vin,max (${fmtNum(c.vin_max_v.value)} V vs ${fmtNum(t.vin_max_v.value)} V)`);
    } else if (c.vin_max_v.value < t.vin_max_v.value * 0.85) {
      trade.push(`Lower Vin,max (${fmtNum(c.vin_max_v.value)} V vs ${fmtNum(t.vin_max_v.value)} V)`);
    }
  } else {
    const t = target.specs;
    const c = cand.specs;
    if (c.device_kind !== t.device_kind || c.output_type !== t.output_type) {
      trade.push(
        `Different device/output (${c.device_kind} ${c.output_type} vs ${t.device_kind} ${t.output_type})`,
      );
    }
    if (c.vos_max_mv.value < t.vos_max_mv.value * 0.7) {
      adv.push(`Tighter Vos (${fmtNum(c.vos_max_mv.value)} mV vs ${fmtNum(t.vos_max_mv.value)} mV)`);
    } else if (c.vos_max_mv.value > t.vos_max_mv.value * 1.5) {
      trade.push(`Wider Vos (${fmtNum(c.vos_max_mv.value)} mV vs ${fmtNum(t.vos_max_mv.value)} mV)`);
    }

    if (c.gbwp_mhz && t.gbwp_mhz && c.gbwp_mhz.value > t.gbwp_mhz.value * 1.3) {
      adv.push(`Higher GBWP (${fmtNum(c.gbwp_mhz.value)} MHz vs ${fmtNum(t.gbwp_mhz.value)} MHz)`);
    }
    if (c.rail_to_rail_in && c.rail_to_rail_out && (!t.rail_to_rail_in || !t.rail_to_rail_out)) {
      adv.push('Full Rail-to-Rail I/O swing');
    }
    if (c.iq_per_ch_typ_ua.value < t.iq_per_ch_typ_ua.value * 0.75) {
      adv.push(`Lower Iq/ch (${fmtNum(c.iq_per_ch_typ_ua.value)} µA vs ${fmtNum(t.iq_per_ch_typ_ua.value)} µA)`);
    }
    if (c.vs_max_v.value < t.vs_max_v.value * 0.8) {
      trade.push(`Lower Vs,max (${fmtNum(c.vs_max_v.value)} V vs ${fmtNum(t.vs_max_v.value)} V)`);
    } else if (c.vs_max_v.value > t.vs_max_v.value * 1.2) {
      adv.push(`Higher Vs,max (${fmtNum(c.vs_max_v.value)} V vs ${fmtNum(t.vs_max_v.value)} V)`);
    }
  }

  if (evalRes.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE') {
    trade.unshift(
      evalRes.package_match
        ? 'Pinout or exposed-pad mismatch requires PCB rerouting'
        : `Package change (${target.package.code} → ${cand.package.code}) requires PCB layout mod`,
    );
  } else if (evalRes.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN' && adv.length === 0) {
    adv.push(`Matching ${cand.package.code} pinout & ratings for second-sourcing`);
  }

  if (adv.length === 0) {
    adv.push(`${cand.manufacturer} multi-source option in ${cand.package.code}`);
  }
  if (trade.length === 0) {
    trade.push(
      `Verify θJA (${cand.package.theta_ja_c_per_w.value} °C/W) and latest ${cand.manufacturer} datasheet revision`,
    );
  }

  return {
    key_advantage: adv.slice(0, 2).join('; '),
    key_tradeoff: trade.slice(0, 2).join('; '),
  };
}

function buildSelectionChecklist(target) {
  if (target.category === 'ldo') {
    return [
      `Verify exact pin numbering on ${target.package.code} (${target.package.pinout.map((p) => `${p.pin}=${p.role}`).join(', ')}) and exposed pad net (${target.package.exposed_pad.present ? target.package.exposed_pad.net : 'None'}).`,
      `Confirm output capacitor ESR stability (${target.specs.ceramic_cap_stable ? 'MLCC stable' : `ESR window ${fmtEsrWindow(target.specs)}`}) and DC-bias derated capacitance >= ${target.specs.min_cout_uf.value} µF.`,
      `Check worst-case junction temperature Tj = Ta + (Vin,max - ${target.specs.vout_v.value} V) × Iout × θJA stays >= 15 °C below Tj,max (${target.package.tj_max_c.value} °C).`,
      `Validate input transient headroom against Vin,max (${target.specs.vin_max_v.value} V rec / ${target.specs.vin_abs_max_v.value} V abs) and Pin 4 (NC vs BYPASS) PCB net connectivity.`,
    ];
  }
  if (target.category === 'dcdc') {
    return [
      `Confirm topology (${target.specs.topology}, ${target.specs.synchronous ? 'synchronous' : 'external Schottky diode'}), pinout, and exposed thermal pad (${target.package.exposed_pad.present ? target.package.exposed_pad.net : 'None'}) on ${target.package.code}.`,
      `Re-verify switching frequency (${target.specs.fsw_typ_khz.value} kHz), inductor value (${target.specs.inductor_typ_uh.value} µH), and inductor Isat margin (>= 25% above peak switch current).`,
      `Check feedback reference Vref (${target.specs.vref_v ? `${target.specs.vref_v.value} V` : 'Fixed internal divider'}) and recalculate R1/R2 divider plus feedforward cap before power-up.`,
      `Audit hot-loop ceramic input/output capacitance placement and thermal dissipation at worst-case Vin and ambient temperature.`,
    ];
  }
  return [
    `Verify device class (${target.specs.device_kind}) and output stage (${target.specs.output_type}) — never substitute an uncompensated open-collector comparator for a push-pull op-amp without circuit redesign.`,
    `Confirm supply rail span (${target.specs.vs_min_v.value}–${target.specs.vs_max_v.value} V rec, ${target.specs.vs_abs_max_v.value} V abs max) and exact ${target.package.code} pinout (${target.package.pinout.map((p) => `${p.pin}=${p.role}`).join(', ')}).`,
    `Verify input common-mode headroom (${target.specs.rail_to_rail_in ? 'RR-In' : 'Non-RR-In'}), output swing (${target.specs.rail_to_rail_out ? 'RR-Out' : 'Non-RR-Out'}), and Vos (${target.specs.vos_max_mv.value} mV max) against signal chain budget.`,
    `Check closed-loop bandwidth (GBWP / Acl), full-power slew rate (SR / 2π·Vpeak), and capacitive-load phase margin on the bench.`,
  ];
}

export function buildAltHub(target, allCategoryParts, existingVsSlugs, generatedAt) {
  const scored = [];
  for (const cand of allCategoryParts) {
    if (cand.slug === target.slug) continue;
    const evalRes = evaluateCompatibility(target, cand);
    const norm = normalizeVsPair(target.slug, cand.slug);
    const vsSlug = existingVsSlugs.has(norm.slug) ? norm.slug : null;
    const score = scoreCandidate(target, cand, evalRes);
    scored.push({ cand, evalRes, vsSlug, score });
  }

  scored.sort((x, y) => {
    const lp =
      LEVEL_PRIORITY[x.evalRes.compatibility_level] -
      LEVEL_PRIORITY[y.evalRes.compatibility_level];
    if (lp !== 0) return lp;
    if (y.score !== x.score) return y.score - x.score;
    const xHasVs = x.vsSlug ? 1 : 0;
    const yHasVs = y.vsSlug ? 1 : 0;
    if (yHasVs !== xHasVs) return yHasVs - xHasVs;
    return x.cand.slug.localeCompare(y.cand.slug);
  });

  // Include all candidates that have a dedicated /en/vs/ page, plus fill up to 8 top-ranked
  const selectedSet = new Set();
  const selected = [];
  for (const item of scored) {
    if (selected.length < 8) {
      selected.push(item);
      selectedSet.add(item.cand.slug);
    }
  }
  for (const item of scored) {
    if (item.vsSlug && !selectedSet.has(item.cand.slug)) {
      selected.push(item);
      selectedSet.add(item.cand.slug);
    }
  }

  let l1Count = 0;
  let l2Count = 0;
  let l3Count = 0;
  let seenTopDropIn = false;

  const candidates = selected.map((item) => {
    const lvl = item.evalRes.compatibility_level;
    if (lvl === 'LEVEL_1_CANDIDATE_DROP_IN') l1Count++;
    else if (lvl === 'LEVEL_2_TUNING_REQUIRED') l2Count++;
    else l3Count++;

    const isTopDropIn = lvl === 'LEVEL_1_CANDIDATE_DROP_IN' && !seenTopDropIn;
    if (isTopDropIn) seenTopDropIn = true;

    const tierTag = classifyTierTag(target, item.cand, item.evalRes, isTopDropIn);
    const { key_advantage, key_tradeoff } = summarizeAdvantageAndTradeoff(
      target,
      item.cand,
      item.evalRes,
    );

    return {
      alt_slug: item.cand.slug,
      alt_opn: item.cand.opn,
      manufacturer: item.cand.manufacturer,
      package_code: item.cand.package.code,
      compatibility_level: lvl,
      compatibility_badge: item.evalRes.compatibility_badge,
      tier_tag: tierTag,
      score: item.score,
      key_advantage,
      key_tradeoff,
      vs_slug: item.vsSlug,
    };
  });

  const summary = `Datasheet-verified cross-reference alternatives for ${target.opn} (${target.manufacturer}, ${target.package.code}, ${target.sub_topology}): evaluated ${scored.length} same-category OPNs, surfacing ${l1Count} Level 1 Candidate Drop-In, ${l2Count} Level 2 Tuning Required, and ${l3Count} Level 3 Layout Change options. Verify pinout, thermal margin, and official manufacturer datasheets before production.`;

  const record = {
    schema_version: '2.0.0',
    slug: `${target.slug}-alternatives`,
    target_slug: target.slug,
    target_opn: target.opn,
    category: target.category,
    summary,
    candidates,
    selection_checklist: buildSelectionChecklist(target),
    generated_at: generatedAt,
  };

  return AltHubSchema.parse(record);
}

export function runXrefEngine({
  partsDir = path.resolve('data/parts'),
  manifestPath = path.resolve('data/pilot-manifest.json'),
  outDir = path.resolve('data/generated'),
  allowPartial = false,
} = {}) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const partFiles = collectJsonFiles(partsDir);
  if (partFiles.length === 0) {
    throw new Error(`No Golden Part JSON files found in ${partsDir}`);
  }

  const partsBySlug = new Map();
  const partsByCategory = { ldo: [], dcdc: [], opamp: [] };
  const validationFailures = [];

  for (const file of partFiles) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const check = verifyGoldenPart(raw, path.relative(process.cwd(), file));
    if (!check.ok) {
      validationFailures.push({ file, errors: check.errors });
      continue;
    }
    if (partsBySlug.has(raw.slug)) {
      validationFailures.push({
        file,
        errors: [`DUPLICATE_SLUG: '${raw.slug}' already loaded.`],
      });
      continue;
    }
    partsBySlug.set(raw.slug, raw);
    partsByCategory[raw.category].push(raw);
  }

  if (validationFailures.length > 0) {
    const msg = validationFailures
      .map((f) => `${f.file}:\n  - ${f.errors.join('\n  - ')}`)
      .join('\n');
    throw new Error(`Stage 2 verification failed for ${validationFailures.length} part(s):\n${msg}`);
  }

  // Ensure every manifest part is present unless allowPartial
  const missingManifestParts = (manifest.parts || [])
    .filter((p) => !partsBySlug.has(p.slug))
    .map((p) => p.slug);
  if (missingManifestParts.length > 0 && !allowPartial) {
    throw new Error(
      `Missing ${missingManifestParts.length} manifest part(s) in ${partsDir}: ${missingManifestParts.join(', ')}`,
    );
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const vsDir = path.join(outDir, 'vs');
  const altDir = path.join(outDir, 'alt');
  fs.mkdirSync(vsDir, { recursive: true });
  fs.mkdirSync(altDir, { recursive: true });

  // Clean stale generated files in vs/ and alt/ so output matches current manifest cleanly
  for (const existing of collectJsonFiles(vsDir)) fs.unlinkSync(existing);
  for (const existing of collectJsonFiles(altDir)) fs.unlinkSync(existing);

  const generatedVsSlugs = new Set();
  const vsIndex = [];
  const levelCounts = {
    LEVEL_1_CANDIDATE_DROP_IN: 0,
    LEVEL_2_TUNING_REQUIRED: 0,
    LEVEL_3_LAYOUT_CHANGE: 0,
  };

  for (const pair of manifest.vs_pairs || []) {
    const norm = normalizeVsPair(pair.part_a, pair.part_b);
    if (pair.slug && pair.slug !== norm.slug) {
      throw new Error(
        `AUD-06 Violation: Manifest vs_pair slug '${pair.slug}' is not canonically normalized to '${norm.slug}' (part_a < part_b required).`,
      );
    }
    if (generatedVsSlugs.has(norm.slug)) {
      throw new Error(`Duplicate normalized vs_pair slug '${norm.slug}' in manifest.`);
    }

    const partA = partsBySlug.get(norm.part_a_slug);
    const partB = partsBySlug.get(norm.part_b_slug);
    if (!partA || !partB) {
      if (allowPartial) continue;
      throw new Error(
        `Missing part(s) for vs_pair '${norm.slug}': ${!partA ? norm.part_a_slug : ''} ${!partB ? norm.part_b_slug : ''}`.trim(),
      );
    }

    const vsDoc = buildVsComparison(partA, partB, generatedAt);
    fs.writeFileSync(
      path.join(vsDir, `${vsDoc.slug}.json`),
      `${JSON.stringify(vsDoc, null, 2)}\n`,
      'utf8',
    );
    generatedVsSlugs.add(vsDoc.slug);
    levelCounts[vsDoc.compatibility_level]++;
    vsIndex.push({
      slug: vsDoc.slug,
      category: vsDoc.category,
      part_a_slug: vsDoc.part_a_slug,
      part_b_slug: vsDoc.part_b_slug,
      part_a_opn: vsDoc.part_a_opn,
      part_b_opn: vsDoc.part_b_opn,
      compatibility_level: vsDoc.compatibility_level,
      package_match: vsDoc.package_match,
      pinout_exact_match: vsDoc.pinout_exact_match,
      exposed_pad_match: vsDoc.exposed_pad_match,
    });
  }

  const altIndex = [];
  const orderedParts = [...partsBySlug.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );
  for (const part of orderedParts) {
    const catParts = partsByCategory[part.category];
    const altDoc = buildAltHub(part, catParts, generatedVsSlugs, generatedAt);
    fs.writeFileSync(
      path.join(altDir, `${altDoc.slug}.json`),
      `${JSON.stringify(altDoc, null, 2)}\n`,
      'utf8',
    );
    altIndex.push({
      slug: altDoc.slug,
      target_slug: altDoc.target_slug,
      target_opn: altDoc.target_opn,
      category: altDoc.category,
      candidate_count: altDoc.candidates.length,
      top_candidate: altDoc.candidates[0]?.alt_opn || null,
      top_level: altDoc.candidates[0]?.compatibility_level || null,
    });
  }

  const xrefIndex = {
    schema_version: '2.0.0',
    generated_at: generatedAt,
    counts: {
      parts_verified: orderedParts.length,
      vs_comparisons: vsIndex.length,
      alt_hubs: altIndex.length,
      by_category: {
        ldo: partsByCategory.ldo.length,
        dcdc: partsByCategory.dcdc.length,
        opamp: partsByCategory.opamp.length,
      },
      vs_by_compatibility_level: levelCounts,
    },
    vs_index: vsIndex,
    alt_index: altIndex,
  };

  fs.writeFileSync(
    path.join(outDir, 'xref-index.json'),
    `${JSON.stringify(xrefIndex, null, 2)}\n`,
    'utf8',
  );

  return xrefIndex;
}

function parseCliArgs(argv) {
  const opts = {
    partsDir: path.resolve('data/parts'),
    manifestPath: path.resolve('data/pilot-manifest.json'),
    outDir: path.resolve('data/generated'),
    allowPartial: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--parts-dir' && argv[i + 1]) {
      opts.partsDir = path.resolve(argv[++i]);
    } else if (arg === '--manifest' && argv[i + 1]) {
      opts.manifestPath = path.resolve(argv[++i]);
    } else if (arg === '--out-dir' && argv[i + 1]) {
      opts.outDir = path.resolve(argv[++i]);
    } else if (arg === '--allow-partial') {
      opts.allowPartial = true;
    }
  }
  return opts;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    const summary = runXrefEngine(opts);
    console.log(
      `Stage 3 XRef Engine PASS: ${summary.counts.parts_verified} parts verified -> ${summary.counts.vs_comparisons} vs comparisons + ${summary.counts.alt_hubs} alt hubs generated.`,
    );
    console.log(
      `Compatibility breakdown: L1=${summary.counts.vs_by_compatibility_level.LEVEL_1_CANDIDATE_DROP_IN}, L2=${summary.counts.vs_by_compatibility_level.LEVEL_2_TUNING_REQUIRED}, L3=${summary.counts.vs_by_compatibility_level.LEVEL_3_LAYOUT_CHANGE}`,
    );
    process.exit(0);
  } catch (err) {
    console.error(`Stage 3 XRef Engine FAIL:\n${err.message}`);
    process.exit(1);
  }
}
