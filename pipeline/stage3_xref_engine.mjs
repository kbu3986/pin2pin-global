#!/usr/bin/env node
/**
 * Stage 3: Deterministic Cross-Reference & Comparison Engine (AUD-02, AUD-04, AUD-06)
 *
 * Loads Golden Parts from `data/parts/**\/*.json`, verifies each part through Stage 2
 * (`verifyGoldenPart`), and deterministically generates:
 *   - N normalized 1:1 comparisons from manifest vs_pairs (`data/generated/vs/<part_a>-vs-<part_b>.json`)
 *   - 1 alternative hub per verified part (`data/generated/alt/<slug>-alternatives.json`)
 *   - 1 summary index (`data/generated/xref-index.json`)
 *
 * Every output record is validated with `VsComparisonSchema` and `AltHubSchema`
 * from `schemas/part-schema.v2.mjs` before being written to disk.
 *
 * Usage:
 *   node pipeline/stage3_xref_engine.mjs
 *   node pipeline/stage3_xref_engine.mjs --check   (dry-run into a temp dir + invariant assertions; data/generated untouched)
 *   node pipeline/stage3_xref_engine.mjs --parts-dir data/parts --manifest data/pilot-manifest.json --out-dir data/generated
 */

import fs from 'node:fs';
import os from 'node:os';
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
 * `package_match` remains strictly `a.package.code === b.package.code`; per AUD-02,
 * cross-package pairs can NEVER be Level 1 Candidate Drop-In (at best Level 2).
 */
const FOOTPRINT_COMPATIBLE_PAIRS = new Set([
  'SOT-23-5|TSOT-23-5',
  'TSOT-23-5|SOT-23-5',
  'SOT-23-6|TSOT-23-6',
  'TSOT-23-6|SOT-23-6',
  'SOT-23-3|SOT-23A-3',
  'SOT-23A-3|SOT-23-3',
]);

const OUTPUT_PIN_ROLES = new Set(['OUT', 'OUT_A', 'OUT_B', 'OUT_C', 'OUT_D']);

const LIFECYCLE_PENALTY = { EOL: 35, OBSOLETE: 35, NRND: 20 };

function normalizePinName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isOpenOutput(outputType) {
  return outputType === 'open-collector' || outputType === 'open-drain';
}

function isLifecycleRestricted(status) {
  const up = String(status || '').toUpperCase();
  return up === 'EOL' || up === 'OBSOLETE' || up === 'NRND';
}

/**
 * Accurately describe an op-amp/comparator output-stage difference.
 * Only mentions external pull-up requirements when at least one part actually has an
 * open-collector/open-drain output (push-pull comparators drive both rails actively).
 */
function describeOutputStageDifference(sA, sB) {
  const parts = [];
  const anyOpen = isOpenOutput(sA.output_type) || isOpenOutput(sB.output_type);
  if (sA.device_kind !== sB.device_kind) {
    parts.push(
      'a comparator is an uncompensated open-loop switching device (no internal Miller/dominant-pole compensation) and will oscillate or latch in a linear negative-feedback op-amp circuit, while an op-amp used as a comparator suffers slow saturation/overdrive recovery and propagation delay far worse than its slew rate implies',
    );
  }
  if (anyOpen) {
    if (sA.output_type !== sB.output_type) {
      parts.push(
        'the open-collector/open-drain output can only sink current and requires an external pull-up resistor to reach logic-high, whereas the push-pull output actively drives both rails (a pull-up tied to a different rail can back-drive a push-pull stage)',
      );
    } else {
      parts.push(
        'both outputs are open-collector/open-drain and require an external pull-up resistor sized for sink current and RC rise time',
      );
    }
  } else if (sA.device_kind !== sB.device_kind) {
    parts.push(
      'both output stages are push-pull (no pull-up resistor required), so the incompatibility is loop compensation, input clamp behavior, and switching dynamics rather than pull-up drive',
    );
  }
  return `${parts.join('; ')}.`;
}

function vinFloorOf(part) {
  return part.category === 'opamp' ? part.specs.vs_min_v : part.specs.vin_min_v;
}

function vinAbsMaxOf(part) {
  return part.category === 'opamp' ? part.specs.vs_abs_max_v : part.specs.vin_abs_max_v;
}

function dcdcNominalVout(specs) {
  if (specs.vout_nom_v && Number.isFinite(specs.vout_nom_v.value)) {
    return { value: specs.vout_nom_v.value, page: specs.vout_nom_v.page, basis: 'vout_nom_v' };
  }
  return {
    value: (specs.vout_min_v.value + specs.vout_max_v.value) / 2,
    page: specs.vout_min_v.page,
    basis: 'midpoint of vout_min_v/vout_max_v',
  };
}

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

/**
 * Winner for voltage range [min, max]: A wins ONLY if A strictly covers B's full span
 * (minA <= minB && maxA >= maxB) and is wider on at least one end; B wins symmetrically;
 * identical ranges tie; crossing ranges return 'CONTEXT'.
 */
function compareVoltageRangeCoverage(minA, maxA, minB, maxB) {
  const tolMin = 0.02;
  const tolMax = Math.max(Math.max(maxA, maxB) * 0.01, 0.05);
  const sameMin = Math.abs(minA - minB) <= tolMin;
  const sameMax = Math.abs(maxA - maxB) <= tolMax;
  if (sameMin && sameMax) return 'TIE';
  const aCoversB = minA <= minB + tolMin && maxA >= maxB - tolMax;
  const bCoversA = minB <= minA + tolMin && maxB >= maxA - tolMax;
  if (aCoversB && !bCoversA) return 'A';
  if (bCoversA && !aCoversB) return 'B';
  return 'CONTEXT';
}

/**
 * Combined CMRR (higher better) & Input Noise (lower better) winner:
 * A wins only if A is better-or-tie on both populated metrics and strictly better on at least one.
 */
function compareCmrrAndNoise(sA, sB) {
  const cmrrW = compareHigherBetter(sA.cmrr_typ_db?.value, sB.cmrr_typ_db?.value);
  const noiseW = compareLowerBetter(
    sA.input_noise_nv_rt_hz?.value,
    sB.input_noise_nv_rt_hz?.value,
  );
  const hasCmrr = sA.cmrr_typ_db && sB.cmrr_typ_db;
  const hasNoise = sA.input_noise_nv_rt_hz && sB.input_noise_nv_rt_hz;
  if (!hasCmrr && !hasNoise) return 'CONTEXT';
  if (hasCmrr && !hasNoise) return cmrrW;
  if (!hasCmrr && hasNoise) return noiseW;
  if (cmrrW === 'TIE' && noiseW === 'TIE') return 'TIE';
  if ((cmrrW === 'A' || cmrrW === 'TIE') && (noiseW === 'A' || noiseW === 'TIE')) return 'A';
  if ((cmrrW === 'B' || cmrrW === 'TIE') && (noiseW === 'B' || noiseW === 'TIE')) return 'B';
  return 'CONTEXT';
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
    // PinRole === 'OTHER': only MATCH if normalized pin names match; otherwise hard MISMATCH
    if (rA === 'OTHER') {
      const normA = normalizePinName(pinA.name);
      const normB = normalizePinName(pinB.name);
      if (normA && normA === normB) {
        return {
          pin: pinNum,
          part_a_name: pinA.name,
          part_a_role: rA,
          part_b_name: pinB.name,
          part_b_role: rB,
          status: 'MATCH',
          note: `Matching specialized pin (${pinA.name} / ${pinB.name}, role OTHER); verify pin electrical threshold in both datasheets.`,
          roleEquivalent: true,
          hardMismatch: false,
          pin4NcBypass: false,
          enPolarityDiff: false,
        };
      }
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: 'MISMATCH',
        note: `PINOUT CONFLICT on specialized pin ${pinNum}: ${partA.opn} assigns ${pinA.name} (OTHER) whereas ${partB.opn} assigns ${pinB.name} (OTHER) — incompatible auxiliary functions require PCB modification.`,
        roleEquivalent: false,
        hardMismatch: true,
        pin4NcBypass: false,
        enPolarityDiff: false,
      };
    }

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

    // Check Op-Amp vs Comparator or output-stage difference on output pins
    if (
      partA.category === 'opamp' &&
      partB.category === 'opamp' &&
      OUTPUT_PIN_ROLES.has(rA) &&
      (partA.specs.output_type !== partB.specs.output_type ||
        partA.specs.device_kind !== partB.specs.device_kind)
    ) {
      const kindMismatch = partA.specs.device_kind !== partB.specs.device_kind;
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: kindMismatch ? 'MISMATCH' : 'CAUTION',
        note: `CRITICAL OUTPUT STAGE DIFFERENCE: ${partA.opn} is ${partA.specs.device_kind} (${partA.specs.output_type}) vs ${partB.opn} ${partB.specs.device_kind} (${partB.specs.output_type}); ${describeOutputStageDifference(partA.specs, partB.specs)}`,
        roleEquivalent: !kindMismatch,
        hardMismatch: kindMismatch,
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
          note: `Feedback network difference: one device has fixed internal divider while the other requires external R1/R2 feedback resistors (PCB divider footprint change).`,
          roleEquivalent: false,
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
      note: `Output sense pin differs (${pinA.name}/${rA} vs ${pinB.name}/${rB}): adjustable variant requires R1/R2 divider footprint whereas fixed variant senses VOUT directly.`,
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
 *
 * When `directional === false` (default, used for symmetric 1:1 `/en/vs/` comparisons),
 * downgrades in either direction (A->B or B->A) trigger Level 2 cautions.
 * When `directional === true` (via `evaluateReplacement(target, cand)` for `/en/alt/` hubs),
 * strictly superior upgrades (higher Iout/Vin/Vabs, lower θJA/Vdo/Vin_min/Ib/Iq, wider temp
 * grade, ceramic-stable replacing ESR-sensitive) are NOT falsely penalized into Level 2,
 * while downgrades ARE penalized.
 */
export function evaluateCompatibility(partA, partB, { directional = false } = {}) {
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

  const isOpampVsComparator =
    partA.category === 'opamp' && partA.specs.device_kind !== partB.specs.device_kind;
  // Op-Amp vs Comparator MUST NEVER report pinout_exact_match = true
  const pinoutExactMatch = pinCountMatch && allRolesEquivalent && !isOpampVsComparator;

  const swapRisks = [];
  const level3Reasons = [];
  const level2Reasons = [];

  // Structural / Physical Layout checks (Level 3 triggers)
  if (!pinCountMatch || !footprintCompatible) {
    const msg = `CRITICAL PACKAGE MISMATCH: ${partA.opn} uses ${pkgA.code} (${pkgA.pin_count}-pin, ${pkgA.mfg_package_code}) while ${partB.opn} uses ${pkgB.code} (${pkgB.pin_count}-pin, ${pkgB.mfg_package_code}); PCB footprint redesign is mandatory.`;
    level3Reasons.push('package/footprint mismatch');
    swapRisks.push(msg);
  } else if (!packageMatch && footprintCompatible) {
    // AUD-02: different package codes can NEVER be Level 1 Candidate Drop-In, even when
    // the JEDEC land pattern is shared (e.g. TSOT-23-5 vs SOT-23-5).
    level2Reasons.push(
      `package code differs (${pkgA.code} vs ${pkgB.code}; same land pattern, different body profile)`,
    );
    swapRisks.push(
      `CAUTION PACKAGE HEIGHT/PROFILE: ${partA.opn} (${pkgA.code}) vs ${partB.opn} (${pkgB.code}) share the same JEDEC land pattern pitch, but thin-profile TSOT (~1.0 mm) vs standard SOT (~1.45 mm) differs in body height; verify enclosure Z-clearance, SMT nozzle height, and solder fillet spec.`,
    );
  }

  if (pkgA.pinout_view !== pkgB.pinout_view) {
    swapRisks.push(
      `CAUTION DATASHEET VIEW ORIENTATION: ${partA.opn} pinout is drawn ${pkgA.pinout_view} (p.${pkgA.pinout_source_page}) while ${partB.opn} is drawn ${pkgB.pinout_view} (p.${pkgB.pinout_source_page}); double-check Pin 1 index mirroring in CAD footprints.`,
    );
  }

  if (hardPinMismatch && !isOpampVsComparator) {
    const conflicts = pinDiff
      .filter((d) => d.status === 'MISMATCH')
      .map((d) => `Pin ${d.pin} (${d.part_a_role} vs ${d.part_b_role})`)
      .join(', ');
    level3Reasons.push(`pinout mismatch on ${conflicts}`);
    swapRisks.push(
      `CRITICAL PINOUT CONFLICT: Incompatible pin assignments on ${conflicts}. Soldering ${partB.opn} onto a ${partA.opn} footprint (or vice versa) without rerouting copper can short VIN/VOUT/GND and permanently damage the board.`,
    );
  } else if (hardPinMismatch && isOpampVsComparator) {
    const nonOutputConflicts = pinDiff
      .filter((d) => d.status === 'MISMATCH' && !OUTPUT_PIN_ROLES.has(d.part_a_role))
      .map((d) => `Pin ${d.pin} (${d.part_a_role} vs ${d.part_b_role})`);
    if (nonOutputConflicts.length > 0) {
      level3Reasons.push(`pinout mismatch on ${nonOutputConflicts.join(', ')}`);
      swapRisks.push(
        `CRITICAL PINOUT CONFLICT: Incompatible pin assignments on ${nonOutputConflicts.join(', ')} in addition to the op-amp vs comparator class conflict.`,
      );
    }
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

    // Fixed-vs-adjustable or fixed Vout rail mismatch (> 0.05 V) -> LEVEL_3_LAYOUT_CHANGE
    if (sA.vout_fixed !== sB.vout_fixed) {
      level3Reasons.push('fixed vs adjustable LDO feedback configuration mismatch');
      swapRisks.push(
        `CRITICAL OUTPUT CONFIGURATION MISMATCH: ${partA.opn} is ${sA.vout_fixed ? `fixed ${sA.vout_v.value} V` : `adjustable (Vref=${sA.vout_v.value} V)`} (p.${sA.vout_v.page}) whereas ${partB.opn} is ${sB.vout_fixed ? `fixed ${sB.vout_v.value} V` : `adjustable (Vref=${sB.vout_v.value} V)`} (p.${sB.vout_v.page}); PCB resistor-divider footprint change is required.`,
      );
    } else if (sA.vout_fixed && sB.vout_fixed && Math.abs(sA.vout_v.value - sB.vout_v.value) > 0.05) {
      level3Reasons.push(
        `fixed LDO output voltage rail mismatch (${fmtNum(sA.vout_v.value)} V vs ${fmtNum(sB.vout_v.value)} V)`,
      );
      swapRisks.push(
        `CRITICAL OUTPUT VOLTAGE RAIL MISMATCH: ${partA.opn} is a fixed ${fmtNum(sA.vout_v.value)} V LDO (p.${sA.vout_v.page}) vs ${partB.opn} at fixed ${fmtNum(sB.vout_v.value)} V (p.${sB.vout_v.page}); swapping delivers the wrong rail voltage and risks damaging downstream loads.`,
      );
    }

    // Ceramic capacitor stability & Min Cout (>= 2.0x)
    const ceramicDowngrade = directional
      ? sA.ceramic_cap_stable && !sB.ceramic_cap_stable
      : sA.ceramic_cap_stable !== sB.ceramic_cap_stable;
    if (ceramicDowngrade) {
      level2Reasons.push('ceramic output capacitor ESR stability difference');
      const nonCer = sA.ceramic_cap_stable ? partB : partA;
      const cer = sA.ceramic_cap_stable ? partA : partB;
      swapRisks.push(
        `CRITICAL CAPACITOR ESR OSCILLATION RISK: ${cer.opn} is stable with low-ESR ceramic MLCCs (>= ${cer.specs.min_cout_uf.value} µF, p.${cer.specs.min_cout_uf.page}), whereas ${nonCer.opn} is NOT ceramic-cap stable (ESR window: ${fmtEsrWindow(nonCer.specs)}). Using an ultra-low-ESR MLCC on ${nonCer.opn} can trigger control-loop oscillation.`,
      );
    } else if (directional && !sA.ceramic_cap_stable && sB.ceramic_cap_stable) {
      swapRisks.push(
        `INFO CAPACITOR UPGRADE: ${partB.opn} is ceramic MLCC stable (>= ${sB.min_cout_uf.value} µF, p.${sB.min_cout_uf.page}); confirm any legacy high-ESR tantalum output capacitor remains within ${partB.opn}'s upper ESR limit (${fmtEsrWindow(sB)}).`,
      );
    }

    const coutTriggered = directional
      ? sB.min_cout_uf.value / Math.max(sA.min_cout_uf.value, 0.01) >= 2.0
      : Math.max(sA.min_cout_uf.value, sB.min_cout_uf.value) /
          Math.max(Math.min(sA.min_cout_uf.value, sB.min_cout_uf.value), 0.01) >=
        2.0;
    if (coutTriggered) {
      const coutRatio = directional
        ? sB.min_cout_uf.value / Math.max(sA.min_cout_uf.value, 0.01)
        : Math.max(sA.min_cout_uf.value, sB.min_cout_uf.value) /
          Math.max(Math.min(sA.min_cout_uf.value, sB.min_cout_uf.value), 0.01);
      level2Reasons.push(`minimum output capacitance requirement differs ${fmtNum(coutRatio, 1)}x`);
      swapRisks.push(
        `CAUTION OUTPUT CAPACITANCE: Minimum Cout differs by ${fmtNum(coutRatio, 1)}x (${partA.opn}: ${sA.min_cout_uf.value} µF p.${sA.min_cout_uf.page} vs ${partB.opn}: ${sB.min_cout_uf.value} µF p.${sB.min_cout_uf.page}); account for MLCC DC-bias derating.`,
      );
    }

    // Numeric ESR window overlap check whenever BOTH parts publish numeric ESR bounds
    const hasBoundsA = !!(sA.esr_min_ohm || sA.esr_max_ohm);
    const hasBoundsB = !!(sB.esr_min_ohm || sB.esr_max_ohm);
    if (hasBoundsA && hasBoundsB) {
      const loA = sA.esr_min_ohm?.value ?? 0;
      const hiA = sA.esr_max_ohm?.value ?? Number.POSITIVE_INFINITY;
      const loB = sB.esr_min_ohm?.value ?? 0;
      const hiB = sB.esr_max_ohm?.value ?? Number.POSITIVE_INFINITY;
      if (Math.max(loA, loB) > Math.min(hiA, hiB)) {
        level2Reasons.push('output capacitor ESR stability windows do not overlap');
        swapRisks.push(
          `CRITICAL ESR STABILITY WINDOW: ${partA.opn} (${fmtEsrWindow(sA)}) and ${partB.opn} (${fmtEsrWindow(sB)}) have non-overlapping ESR stability windows — no single output capacitor satisfies both parts.`,
        );
      }
    } else if (!sA.ceramic_cap_stable && !sB.ceramic_cap_stable && hasBoundsA !== hasBoundsB) {
      const unpub = hasBoundsA ? partB : partA;
      level2Reasons.push('ESR-constrained output capacitor window unverified on one part');
      swapRisks.push(
        `CAUTION ESR STABILITY WINDOW: Both parts are ESR-constrained, but ${unpub.opn} omits explicit numeric ESR bounds (${fmtEsrWindow(sA)} vs ${fmtEsrWindow(sB)}); verify the datasheet ESR-vs-Iout curve.`,
      );
    }

    // Vin,max rating check (<= 0.8)
    const vinTriggered = directional
      ? sB.vin_max_v.value / Math.max(sA.vin_max_v.value, 1e-9) <= 0.8
      : Math.min(sA.vin_max_v.value, sB.vin_max_v.value) /
          Math.max(sA.vin_max_v.value, sB.vin_max_v.value, 1e-9) <=
        0.8;
    if (vinTriggered) {
      const lowerVin = sA.vin_max_v.value < sB.vin_max_v.value ? partA : partB;
      const higherVin = lowerVin === partA ? partB : partA;
      level2Reasons.push('Vin,max rating drops >=20%');
      swapRisks.push(
        `HIGH INPUT VOLTAGE RATING DROP: ${lowerVin.opn} is rated to only ${lowerVin.specs.vin_max_v.value} V rec. (${lowerVin.specs.vin_abs_max_v.value} V abs max, p.${lowerVin.specs.vin_abs_max_v.page}) vs ${higherVin.opn} at ${higherVin.specs.vin_max_v.value} V rec. (${higherVin.specs.vin_abs_max_v.value} V abs max, p.${higherVin.specs.vin_abs_max_v.page}). Verify worst-case input transient spikes.`,
      );
    }

    // Iout,max rating check (<= 0.8)
    const ioutTriggered = directional
      ? sB.iout_max_ma.value / Math.max(sA.iout_max_ma.value, 1e-9) <= 0.8
      : Math.min(sA.iout_max_ma.value, sB.iout_max_ma.value) /
          Math.max(sA.iout_max_ma.value, sB.iout_max_ma.value, 1e-9) <=
        0.8;
    if (ioutTriggered) {
      const lowerI = sA.iout_max_ma.value < sB.iout_max_ma.value ? partA : partB;
      const higherI = lowerI === partA ? partB : partA;
      level2Reasons.push('Iout,max rating drops >=20%');
      swapRisks.push(
        `HIGH LOAD CURRENT DERATING: ${lowerI.opn} supplies up to ${lowerI.specs.iout_max_ma.value} mA (p.${lowerI.specs.iout_max_ma.page}) compared to ${higherI.opn} at ${higherI.specs.iout_max_ma.value} mA (p.${higherI.specs.iout_max_ma.page}); confirm peak inrush and thermal dissipation margin.`,
      );
    }

    // Dropout voltage check (>= 150 mV OR >= 1.8x)
    const dropDiff = directional
      ? sB.dropout_typ_mv.value - sA.dropout_typ_mv.value
      : Math.abs(sA.dropout_typ_mv.value - sB.dropout_typ_mv.value);
    const dropRatio = directional
      ? sB.dropout_typ_mv.value / Math.max(sA.dropout_typ_mv.value, 1)
      : Math.max(sA.dropout_typ_mv.value, sB.dropout_typ_mv.value) /
        Math.max(Math.min(sA.dropout_typ_mv.value, sB.dropout_typ_mv.value), 1);
    if (dropDiff >= 150 || dropRatio >= 1.8) {
      level2Reasons.push(
        `dropout voltage headroom differs (${Math.round(Math.abs(sA.dropout_typ_mv.value - sB.dropout_typ_mv.value))} mV / ${fmtNum(dropRatio, 1)}x)`,
      );
      swapRisks.push(
        `CAUTION DROPOUT HEADROOM: Typical dropout differs (${partA.opn}: ${sA.dropout_typ_mv.value} mV p.${sA.dropout_typ_mv.page} vs ${partB.opn}: ${sB.dropout_typ_mv.value} mV p.${sB.dropout_typ_mv.page}); verify Vin,min - Vout >= Vdo across temperature and load corners.`,
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
      level3Reasons.push(`DC-DC topology mismatch (${sA.topology} vs ${sB.topology})`);
      swapRisks.push(
        `CRITICAL TOPOLOGY DIFFERENCE: ${partA.opn} is a ${sA.topology} converter whereas ${partB.opn} is a ${sB.topology} converter; power-stage architecture, inductor placement, and startup behavior differ fundamentally — this is a power-path redesign, not a component swap.`,
      );
    }

    // Synchronous vs non-synchronous -> LEVEL_3_LAYOUT_CHANGE (external Schottky diode footprint)
    if (sA.synchronous !== sB.synchronous) {
      const asyncPart = sA.synchronous ? partB : partA;
      level3Reasons.push('synchronous vs non-synchronous rectification mismatch (external Schottky footprint)');
      swapRisks.push(
        `CRITICAL RECTIFICATION LAYOUT DIFFERENCE: ${asyncPart.opn} is non-synchronous and requires an external Schottky catch/freewheeling diode footprint near SW, whereas the counterpart integrates a synchronous low-side MOSFET.`,
      );
    }

    // Fixed vs adjustable output configuration -> LEVEL_3_LAYOUT_CHANGE (R1/R2 divider footprint)
    if (sA.vout_fixed !== sB.vout_fixed) {
      level3Reasons.push('fixed vs adjustable output feedback footprint mismatch (R1/R2 divider)');
      swapRisks.push(
        `CRITICAL FEEDBACK LAYOUT DIFFERENCE: One converter is fixed-output while the other is adjustable; adding or removing the external R1/R2 feedback divider and feedforward capacitor requires a PCB layout change.`,
      );
    } else if (sA.vout_fixed && sB.vout_fixed) {
      // Fixed DC-DC Vout diff > 0.05 V -> LEVEL_3_LAYOUT_CHANGE
      const vA = dcdcNominalVout(sA);
      const vB = dcdcNominalVout(sB);
      if (Math.abs(vA.value - vB.value) > 0.05) {
        level3Reasons.push(
          `fixed DC-DC output voltage rail mismatch (${fmtNum(vA.value)} V vs ${fmtNum(vB.value)} V)`,
        );
        swapRisks.push(
          `CRITICAL OUTPUT VOLTAGE RAIL MISMATCH: ${partA.opn} is a fixed ${fmtNum(vA.value)} V converter (${vA.basis}, p.${vA.page}) whereas ${partB.opn} is a fixed ${fmtNum(vB.value)} V converter (${vB.basis}, p.${vB.page}); swapping delivers the wrong rail voltage and can destroy downstream loads.`,
        );
      }
    } else if (!sA.vout_fixed && !sB.vout_fixed) {
      // Adjustable DC-DC: Vout,max drop (<= 0.8) -> L2 + explicit switch-voltage overstress risk
      const voutMaxTriggered = directional
        ? sB.vout_max_v.value / Math.max(sA.vout_max_v.value, 1e-9) <= 0.8
        : Math.min(sA.vout_max_v.value, sB.vout_max_v.value) /
            Math.max(sA.vout_max_v.value, sB.vout_max_v.value, 1e-9) <=
          0.8;
      if (voutMaxTriggered) {
        const lowP = sA.vout_max_v.value < sB.vout_max_v.value ? partA : partB;
        const highP = lowP === partA ? partB : partA;
        level2Reasons.push(
          `adjustable Vout,max ceiling drops >=20% (${fmtNum(lowP.specs.vout_max_v.value)} V vs ${fmtNum(highP.specs.vout_max_v.value)} V — switch-voltage overstress risk)`,
        );
        swapRisks.push(
          `CRITICAL SWITCH-VOLTAGE OVERSTRESS RISK: ${lowP.opn} is rated up to only ${fmtNum(lowP.specs.vout_max_v.value)} V output (p.${lowP.specs.vout_max_v.page}) vs ${highP.opn} up to ${fmtNum(highP.specs.vout_max_v.value)} V (p.${highP.specs.vout_max_v.page}); exceeding the internal switch BVdss ceiling destroys the SW MOSFET.`,
        );
      }

      // Adjustable DC-DC: Vout,min increase (>= 0.1 V)
      const voutMinTriggered = directional
        ? sB.vout_min_v.value - sA.vout_min_v.value >= 0.1
        : Math.abs(sA.vout_min_v.value - sB.vout_min_v.value) >= 0.1;
      if (voutMinTriggered) {
        const hiMinP = sA.vout_min_v.value > sB.vout_min_v.value ? partA : partB;
        const loMinP = hiMinP === partA ? partB : partA;
        level2Reasons.push(
          `minimum programmable Vout,min rises (${fmtNum(loMinP.specs.vout_min_v.value)} V vs ${fmtNum(hiMinP.specs.vout_min_v.value)} V)`,
        );
        swapRisks.push(
          `HIGH MINIMUM OUTPUT VOLTAGE FLOOR: ${hiMinP.opn} cannot regulate below ${fmtNum(hiMinP.specs.vout_min_v.value)} V (p.${hiMinP.specs.vout_min_v.page}) vs ${loMinP.opn} down to ${fmtNum(loMinP.specs.vout_min_v.value)} V (p.${loMinP.specs.vout_min_v.page}); verify your target rail sits above the higher Vout,min floor.`,
        );
      }

      // Adjustable Vref mismatch (> 2%)
      if (
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
    }

    if (
      sA.en_active_high !== null &&
      sB.en_active_high !== null &&
      sA.en_active_high !== sB.en_active_high &&
      !hasEnPolarityDiff
    ) {
      level2Reasons.push('EN polarity differs');
      swapRisks.push(
        `CRITICAL ENABLE POLARITY: ${partA.opn} EN is ${sA.en_active_high ? 'active-high' : 'active-low'} whereas ${partB.opn} EN is ${sB.en_active_high ? 'active-high' : 'active-low'}; the existing enable drive will invert converter ON/OFF state.`,
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

    const vinTriggered = directional
      ? sB.vin_max_v.value / Math.max(sA.vin_max_v.value, 1e-9) <= 0.8
      : Math.min(sA.vin_max_v.value, sB.vin_max_v.value) /
          Math.max(sA.vin_max_v.value, sB.vin_max_v.value, 1e-9) <=
        0.8;
    if (vinTriggered) {
      level2Reasons.push('Vin,max rating drops >=20%');
      swapRisks.push(
        `HIGH INPUT VOLTAGE RANGE SHIFT: Recommended Vin,max differs (${partA.opn}: ${sA.vin_max_v.value} V p.${sA.vin_max_v.page} vs ${partB.opn}: ${sB.vin_max_v.value} V p.${sB.vin_max_v.page}); verify line transients stay below Vin,abs,max.`,
      );
    }

    const basisMismatch = sA.is_switch_limit !== sB.is_switch_limit;
    const iTriggered = basisMismatch
      ? true
      : directional
        ? sB.iout_or_isw_max_ma.value / Math.max(sA.iout_or_isw_max_ma.value, 1e-9) <= 0.8
        : Math.min(sA.iout_or_isw_max_ma.value, sB.iout_or_isw_max_ma.value) /
            Math.max(sA.iout_or_isw_max_ma.value, sB.iout_or_isw_max_ma.value, 1e-9) <=
          0.8;
    if (iTriggered) {
      level2Reasons.push('current rating or switch-limit basis differs');
      const hasBoostOrIsw =
        sA.topology === 'boost' ||
        sB.topology === 'boost' ||
        sA.is_switch_limit ||
        sB.is_switch_limit;
      const boostNote = hasBoostOrIsw
        ? ' Remember boost/switch-limited Iout,max is strictly less than Isw due to duty-cycle and inductor ripple scaling.'
        : ' Verify continuous load current and peak inductor saturation margin (Isat >= Iout + ΔIL/2).';
      swapRisks.push(
        `CAUTION CURRENT RATING BASIS: ${partA.opn} specifies ${sA.iout_or_isw_max_ma.value} mA (${sA.is_switch_limit ? 'switch current limit Isw' : 'continuous Iout'}, p.${sA.iout_or_isw_max_ma.page}) vs ${partB.opn} ${sB.iout_or_isw_max_ma.value} mA (${sB.is_switch_limit ? 'switch current limit Isw' : 'continuous Iout'}, p.${sB.iout_or_isw_max_ma.page}).${boostNote}`,
      );
    }
  } else if (partA.category === 'opamp') {
    const sA = partA.specs;
    const sB = partB.specs;

    // CRITICAL Op-Amp vs Comparator guard (AUD-02/AUD-04) -> LEVEL_3_LAYOUT_CHANGE
    if (sA.device_kind !== sB.device_kind) {
      level3Reasons.push(
        `device kind mismatch (${sA.device_kind}/${sA.output_type} vs ${sB.device_kind}/${sB.output_type}) — circuit redesign required`,
      );
      const anyOpen = isOpenOutput(sA.output_type) || isOpenOutput(sB.output_type);
      swapRisks.push(
        `CRITICAL OP-AMP VS COMPARATOR TRAP: ${partA.opn} is a ${sA.device_kind} with ${sA.output_type} output while ${partB.opn} is a ${sB.device_kind} with ${sB.output_type} output. Even with identical pinouts, a comparator is an uncompensated switching device: dropping it into a linear negative-feedback op-amp circuit (buffer, gain stage, filter) causes oscillation or latch-up, and an op-amp used as a comparator suffers slow overdrive/saturation recovery.${anyOpen ? ' In addition, the open-collector/open-drain output requires an external pull-up resistor to swing high.' : ' Both outputs are push-pull (no external pull-up required) — the incompatibility is loop compensation and switching behavior, not pull-up drive.'}`,
      );
    } else if (sA.output_type !== sB.output_type) {
      level2Reasons.push(`output stage differs (${sA.output_type} vs ${sB.output_type})`);
      swapRisks.push(
        `CRITICAL OUTPUT STAGE DIFFERENCE: ${partA.opn} (${sA.output_type}) vs ${partB.opn} (${sB.output_type}): ${describeOutputStageDifference(sA, sB)}`,
      );
    }

    const vsTriggered = directional
      ? sB.vs_max_v.value / Math.max(sA.vs_max_v.value, 1e-9) <= 0.8
      : Math.min(sA.vs_max_v.value, sB.vs_max_v.value) /
          Math.max(sA.vs_max_v.value, sB.vs_max_v.value, 1e-9) <=
        0.8;
    if (vsTriggered) {
      const lowV = sA.vs_max_v.value < sB.vs_max_v.value ? partA : partB;
      const highV = lowV === partA ? partB : partA;
      level2Reasons.push('supply voltage Vs,max drops >=20%');
      swapRisks.push(
        `CRITICAL SUPPLY VOLTAGE RATING: ${lowV.opn} is limited to ${lowV.specs.vs_max_v.value} V max (${lowV.specs.vs_abs_max_v.value} V abs max, p.${lowV.specs.vs_abs_max_v.page}) whereas ${highV.opn} supports up to ${highV.specs.vs_max_v.value} V (${highV.specs.vs_abs_max_v.value} V abs max, p.${highV.specs.vs_abs_max_v.page}). Installing a 5.5 V CMOS part on a 12 V–24 V rail causes instant breakdown.`,
      );
    }

    const rrDowngrade = directional
      ? (sA.rail_to_rail_in && !sB.rail_to_rail_in) ||
        (sA.rail_to_rail_out && !sB.rail_to_rail_out)
      : sA.rail_to_rail_in !== sB.rail_to_rail_in ||
        sA.rail_to_rail_out !== sB.rail_to_rail_out;
    if (rrDowngrade) {
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
        level2Reasons.push(`GBWP differs ${fmtNum(gbwpRatio, 1)}x`);
        swapRisks.push(
          `CAUTION BANDWIDTH & PHASE MARGIN: GBWP differs by ${fmtNum(gbwpRatio, 1)}x (${partA.opn}: ${sA.gbwp_mhz.value} MHz p.${sA.gbwp_mhz.page} vs ${partB.opn}: ${sB.gbwp_mhz.value} MHz p.${sB.gbwp_mhz.page}); higher-bandwidth replacements can oscillate with capacitive loads or stray feedback capacitance without an isolation resistor.`,
        );
      }
    }

    if (sA.slew_rate_v_per_us && sB.slew_rate_v_per_us) {
      const srTriggered = directional
        ? sA.slew_rate_v_per_us.value / Math.max(sB.slew_rate_v_per_us.value, 0.001) >= 3.0
        : Math.max(sA.slew_rate_v_per_us.value, sB.slew_rate_v_per_us.value) /
            Math.max(Math.min(sA.slew_rate_v_per_us.value, sB.slew_rate_v_per_us.value), 0.001) >=
          3.0;
      if (srTriggered) {
        const srRatio =
          Math.max(sA.slew_rate_v_per_us.value, sB.slew_rate_v_per_us.value) /
          Math.max(Math.min(sA.slew_rate_v_per_us.value, sB.slew_rate_v_per_us.value), 0.001);
        level2Reasons.push(`slew rate differs ${fmtNum(srRatio, 1)}x`);
        swapRisks.push(
          `CAUTION SLEW RATE DIFFERENCE: Slew rate differs by ${fmtNum(srRatio, 1)}x (${partA.opn}: ${sA.slew_rate_v_per_us.value} V/µs p.${sA.slew_rate_v_per_us.page} vs ${partB.opn}: ${sB.slew_rate_v_per_us.value} V/µs p.${sB.slew_rate_v_per_us.page}); check full-power bandwidth SR / (2π·Vpeak).`,
        );
      }
    }

    // Comparator propagation delay gate (>= 2.0x)
    if (sA.device_kind === 'comparator' && sB.device_kind === 'comparator' && sA.prop_delay_ns && sB.prop_delay_ns) {
      const tpdTriggered = directional
        ? sB.prop_delay_ns.value / Math.max(sA.prop_delay_ns.value, 0.1) >= 2.0
        : Math.max(sA.prop_delay_ns.value, sB.prop_delay_ns.value) /
            Math.max(Math.min(sA.prop_delay_ns.value, sB.prop_delay_ns.value), 0.1) >=
          2.0;
      if (tpdTriggered) {
        const tpdRatio =
          Math.max(sA.prop_delay_ns.value, sB.prop_delay_ns.value) /
          Math.max(Math.min(sA.prop_delay_ns.value, sB.prop_delay_ns.value), 0.1);
        level2Reasons.push(`comparator propagation delay differs ${fmtNum(tpdRatio, 1)}x`);
        swapRisks.push(
          `HIGH SWITCHING TIMING SHIFT: Propagation delay differs by ${fmtNum(tpdRatio, 1)}x (${partA.opn}: ${sA.prop_delay_ns.value} ns p.${sA.prop_delay_ns.page} vs ${partB.opn}: ${sB.prop_delay_ns.value} ns p.${sB.prop_delay_ns.page}); verify overcurrent/zero-crossing trip latency and hysteresis timing.`,
        );
      }
    }

    const vosTriggered = directional
      ? sB.vos_max_mv.value / Math.max(sA.vos_max_mv.value, 0.001) >= 10
      : Math.max(sA.vos_max_mv.value, sB.vos_max_mv.value) /
          Math.max(Math.min(sA.vos_max_mv.value, sB.vos_max_mv.value), 0.001) >=
        10;
    if (vosTriggered) {
      const vosRatio =
        Math.max(sA.vos_max_mv.value, sB.vos_max_mv.value) /
        Math.max(Math.min(sA.vos_max_mv.value, sB.vos_max_mv.value), 0.001);
      level2Reasons.push(`input offset voltage Vos differs ${fmtNum(vosRatio, 0)}x`);
      swapRisks.push(
        `CAUTION PRECISION OFFSET SHIFT: Maximum Vos differs by ${fmtNum(vosRatio, 0)}x (${partA.opn}: ${sA.vos_max_mv.value} mV p.${sA.vos_max_mv.page} vs ${partB.opn}: ${sB.vos_max_mv.value} mV p.${sB.vos_max_mv.page}); high-gain DC sensor stages may lose accuracy or require zero-drift chopper filtering.`,
      );
    }

    // Input bias current gate (>= 10x — catches CMOS pA vs Bipolar nA!)
    const ibTriggered = directional
      ? sB.ib_typ_pa.value / Math.max(sA.ib_typ_pa.value, 0.1) >= 10
      : Math.max(sA.ib_typ_pa.value, sB.ib_typ_pa.value) /
          Math.max(Math.min(sA.ib_typ_pa.value, sB.ib_typ_pa.value), 0.1) >=
        10;
    if (ibTriggered) {
      const ibRatio =
        Math.max(sA.ib_typ_pa.value, sB.ib_typ_pa.value) /
        Math.max(Math.min(sA.ib_typ_pa.value, sB.ib_typ_pa.value), 0.1);
      level2Reasons.push(`input bias current Ib differs ${fmtNum(ibRatio, 0)}x (CMOS vs bipolar input stage)`);
      swapRisks.push(
        `HIGH INPUT BIAS CURRENT SHIFT: Typical Ib differs by ${fmtNum(ibRatio, 0)}x (${partA.opn}: ${fmtNum(sA.ib_typ_pa.value)} pA p.${sA.ib_typ_pa.page} vs ${partB.opn}: ${fmtNum(sB.ib_typ_pa.value)} pA p.${sB.ib_typ_pa.page}); high-impedance sensor dividers (>100 kΩ) suffer severe Ib·R DC offset error when swapping from CMOS/JFET to bipolar inputs.`,
      );
    }

    // Quiescent current per channel gate (>= 2.0x)
    const iqTriggered = directional
      ? sB.iq_per_ch_typ_ua.value / Math.max(sA.iq_per_ch_typ_ua.value, 0.01) >= 2.0
      : Math.max(sA.iq_per_ch_typ_ua.value, sB.iq_per_ch_typ_ua.value) /
          Math.max(Math.min(sA.iq_per_ch_typ_ua.value, sB.iq_per_ch_typ_ua.value), 0.01) >=
        2.0;
    if (iqTriggered) {
      const iqRatio =
        Math.max(sA.iq_per_ch_typ_ua.value, sB.iq_per_ch_typ_ua.value) /
        Math.max(Math.min(sA.iq_per_ch_typ_ua.value, sB.iq_per_ch_typ_ua.value), 0.01);
      level2Reasons.push(`quiescent supply current Iq/ch differs ${fmtNum(iqRatio, 1)}x`);
      swapRisks.push(
        `CAUTION QUIESCENT CURRENT SHIFT: Supply current per channel differs by ${fmtNum(iqRatio, 1)}x (${partA.opn}: ${fmtNum(sA.iq_per_ch_typ_ua.value)} µA/ch p.${sA.iq_per_ch_typ_ua.page} vs ${partB.opn}: ${fmtNum(sB.iq_per_ch_typ_ua.value)} µA/ch p.${sB.iq_per_ch_typ_ua.page}); verify battery budget and total power dissipation across all channels.`,
      );
    }
  }

  // Cross-category engineering gates (applies to LDO, DC-DC, Op-Amp)

  // 1. Absolute maximum input/supply voltage gate (>= 15% diff)
  const absA = vinAbsMaxOf(partA);
  const absB = vinAbsMaxOf(partB);
  if (absA && absB) {
    const absTriggered = directional
      ? absB.value / Math.max(absA.value, 1e-9) <= 0.85
      : Math.min(absA.value, absB.value) / Math.max(absA.value, absB.value, 1e-9) <= 0.85;
    if (absTriggered) {
      const lowAbs = absA.value < absB.value ? partA : partB;
      const highAbs = lowAbs === partA ? partB : partA;
      const lowCited = lowAbs === partA ? absA : absB;
      const highCited = highAbs === partA ? absA : absB;
      const absLabel = partA.category === 'opamp' ? 'Vs,abs,max' : 'Vin,abs,max';
      level2Reasons.push(
        `${absLabel} drops >=15% (${fmtNum(lowCited.value)} V vs ${fmtNum(highCited.value)} V)`,
      );
      swapRisks.push(
        `HIGH ABSOLUTE-MAX SURGE MARGIN: ${lowAbs.opn} has a lower ${absLabel} rating (${fmtNum(lowCited.value)} V, p.${lowCited.page}) than ${highAbs.opn} (${fmtNum(highCited.value)} V, p.${highCited.page}); verify hot-plug, inductive kickback, and TVS clamp peaks stay safely below ${fmtNum(lowCited.value)} V.`,
      );
    }
  }

  // 2. Thermal resistance gate (>= 25% diff -> Level 2)
  const thetaA = pkgA.theta_ja_c_per_w.value;
  const thetaB = pkgB.theta_ja_c_per_w.value;
  const thetaDiffRatio = directional
    ? (thetaB - thetaA) / Math.max(thetaA, 1e-9)
    : (Math.max(thetaA, thetaB) - Math.min(thetaA, thetaB)) /
      Math.max(Math.min(thetaA, thetaB), 1e-9);
  if (thetaDiffRatio >= 0.25) {
    const worseP = thetaA > thetaB ? partA : partB;
    level2Reasons.push(
      `θJA worsens ${Math.round(thetaDiffRatio * 100)}% (thermal derating verification required)`,
    );
    swapRisks.push(
      `HIGH THERMAL MARGIN: Package θJA is ${Math.round(thetaDiffRatio * 100)}% higher on ${worseP.opn} (${partA.opn}: ${thetaA} °C/W p.${pkgA.theta_ja_c_per_w.page} vs ${partB.opn}: ${thetaB} °C/W p.${pkgB.theta_ja_c_per_w.page}); re-check Tj = Ta + Pd × θJA against Tj,max.`,
    );
  }

  // 3. Minimum supply / input floor gate (Vin,min or Vs,min diff >= 0.5 V -> Level 2)
  const floorA = vinFloorOf(partA);
  const floorB = vinFloorOf(partB);
  if (floorA && floorB) {
    const floorDelta = directional
      ? floorB.value - floorA.value
      : Math.abs(floorA.value - floorB.value);
    if (floorDelta >= 0.5) {
      const higherFloorP = floorA.value > floorB.value ? partA : partB;
      const hf = higherFloorP === partA ? floorA : floorB;
      const lf = higherFloorP === partA ? floorB : floorA;
      const label = partA.category === 'opamp' ? 'Vs,min' : 'Vin,min';
      level2Reasons.push(`${label} floor rises ${fmtNum(floorDelta, 2)} V`);
      swapRisks.push(
        `HIGH MINIMUM SUPPLY FLOOR: ${higherFloorP.opn} requires ${label} >= ${fmtNum(hf.value)} V (p.${hf.page}) vs ${fmtNum(lf.value)} V on the counterpart; confirm low-battery / brown-out operation still clears the higher floor.`,
      );
    }
  }

  // 4. Operating ambient temperature grade gate (any ta_min or ta_max diff -> Level 2)
  const tgA = partA.temp_grade;
  const tgB = partB.temp_grade;
  const tempGradeTriggered = directional
    ? tgB.ta_min_c > tgA.ta_min_c || tgB.ta_max_c < tgA.ta_max_c
    : tgA.ta_min_c !== tgB.ta_min_c || tgA.ta_max_c !== tgB.ta_max_c;
  if (tempGradeTriggered) {
    const narrower = [];
    if (tgA.ta_min_c !== tgB.ta_min_c) {
      const p = tgA.ta_min_c > tgB.ta_min_c ? partA : partB;
      narrower.push(`${p.opn} cold limit only ${p.temp_grade.ta_min_c} °C`);
    }
    if (tgA.ta_max_c !== tgB.ta_max_c) {
      const p = tgA.ta_max_c < tgB.ta_max_c ? partA : partB;
      narrower.push(`${p.opn} hot limit only ${p.temp_grade.ta_max_c} °C`);
    }
    level2Reasons.push(
      `ambient temperature grade differs (${tgA.ta_min_c}..${tgA.ta_max_c} °C vs ${tgB.ta_min_c}..${tgB.ta_max_c} °C)`,
    );
    swapRisks.push(
      `HIGH TEMPERATURE GRADE MISMATCH: Rated ambient range differs (${partA.opn}: ${tgA.ta_min_c}..${tgA.ta_max_c} °C ${tgA.grade_label} vs ${partB.opn}: ${tgB.ta_min_c}..${tgB.ta_max_c} °C ${tgB.grade_label}); ${narrower.join(', ')} — verify product ambient qualification before swapping.`,
    );
  }

  // 5. Lifecycle status caution (NRND / EOL sourcing risk)
  for (const p of [partA, partB]) {
    if (isLifecycleRestricted(p.lifecycle_status)) {
      swapRisks.push(
        `CAUTION LIFECYCLE STATUS (${p.lifecycle_status}): ${p.opn} is flagged ${p.lifecycle_status} by ${p.manufacturer}; do not design into new production layouts — evaluate Active alternatives.`,
      );
    }
  }

  // 6. v2.1 optional trap fields (compared when both parts publish them)
  if (partA.category === 'ldo' || partA.category === 'dcdc') {
    const sA = partA.specs;
    const sB = partB.specs;
    if (
      sA.en_default_floating &&
      sB.en_default_floating &&
      sA.en_default_floating !== sB.en_default_floating
    ) {
      level2Reasons.push('EN floating default differs');
      swapRisks.push(
        `CRITICAL EN FLOATING BEHAVIOR: An unconnected EN pin defaults to '${sA.en_default_floating}' on ${partA.opn} but '${sB.en_default_floating}' on ${partB.opn}; boards relying on internal EN pull resistors will change power-up state.`,
      );
    }
    if (sA.en_abs_max_v && sB.en_abs_max_v) {
      const lo = Math.min(sA.en_abs_max_v.value, sB.en_abs_max_v.value);
      const hi = Math.max(sA.en_abs_max_v.value, sB.en_abs_max_v.value);
      if (hi - lo >= 0.5) {
        swapRisks.push(
          `CAUTION EN ABS MAX: EN pin absolute maximum differs (${partA.opn}: ${fmtNum(sA.en_abs_max_v.value)} V vs ${partB.opn}: ${fmtNum(sB.en_abs_max_v.value)} V); tying EN directly to VIN may exceed the lower rating.`,
        );
      }
    }
    if (
      typeof sA.active_discharge === 'boolean' &&
      typeof sB.active_discharge === 'boolean' &&
      sA.active_discharge !== sB.active_discharge
    ) {
      swapRisks.push(
        `CAUTION OUTPUT DISCHARGE: Active output discharge is ${sA.active_discharge ? 'present' : 'absent'} on ${partA.opn} vs ${sB.active_discharge ? 'present' : 'absent'} on ${partB.opn}; power-sequencing and shutdown-to-restart timing will differ.`,
      );
    }
    for (const [p, other] of [
      [partA, partB],
      [partB, partA],
    ]) {
      if (p.specs.max_cout_uf && other.specs.min_cout_uf.value > p.specs.max_cout_uf.value) {
        level2Reasons.push('output capacitance outside stable Cout window');
        swapRisks.push(
          `CRITICAL COUT WINDOW: ${other.opn} requires >= ${fmtNum(other.specs.min_cout_uf.value)} µF but ${p.opn} is only stable up to ${fmtNum(p.specs.max_cout_uf.value)} µF (p.${p.specs.max_cout_uf.page}).`,
        );
      }
    }
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

/**
 * Directional replacement evaluator for `/en/alt/` hubs ("replace `target` with `cand`").
 */
export function evaluateReplacement(target, cand) {
  return evaluateCompatibility(target, cand, { directional: true });
}

function buildLdoParameterMatrix(a, b) {
  const sA = a.specs;
  const sB = b.specs;
  const pA = a.package;
  const pB = b.package;

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
      winner: compareVoltageRangeCoverage(
        sA.vin_min_v.value,
        sA.vin_max_v.value,
        sB.vin_min_v.value,
        sB.vin_max_v.value,
      ),
      note: 'A part wins only if its operating Vin range strictly encompasses the counterpart on both ends.',
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
        sA.vout_fixed === sB.vout_fixed && Math.abs(sA.vout_v.value - sB.vout_v.value) <= 0.05
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
  const hasBoostOrIsw =
    sA.topology === 'boost' ||
    sB.topology === 'boost' ||
    sA.is_switch_limit ||
    sB.is_switch_limit;

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
      winner: compareVoltageRangeCoverage(
        sA.vin_min_v.value,
        sA.vin_max_v.value,
        sB.vin_min_v.value,
        sB.vin_max_v.value,
      ),
      note: 'A part wins only if its operating Vin range strictly encompasses the counterpart on both ends.',
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
      winner:
        !sA.vout_fixed && !sB.vout_fixed
          ? compareVoltageRangeCoverage(
              sA.vout_min_v.value,
              sA.vout_max_v.value,
              sB.vout_min_v.value,
              sB.vout_max_v.value,
            )
          : 'CONTEXT',
      note: 'Fixed-output variants save divider BOM; adjustable parts allow arbitrary rail tuning up to switch BVdss limits.',
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
      note: hasBoostOrIsw
        ? 'For boost/switch-limited converters, usable Iout ≈ Isw × (Vin / Vout) × η minus half ripple ΔIL/2.'
        : 'Continuous DC output current rating; verify inductor Isat >= Iout + ΔIL/2 and thermal margin.',
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
      note: 'Op-amps (internally compensated for linear feedback) and comparators (uncompensated open-loop switching) are NOT drop-in interchangeable.',
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
      winner: compareVoltageRangeCoverage(
        sA.vs_min_v.value,
        sA.vs_max_v.value,
        sB.vs_min_v.value,
        sB.vs_max_v.value,
      ),
      note: 'A part wins only if its recommended Vs range strictly encompasses the counterpart on both ends.',
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
      winner: compareCmrrAndNoise(sA, sB),
      note: 'Winner requires superiority on both CMRR (higher) and input voltage noise (lower); mixed tradeoffs stay CONTEXT.',
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

function summarizeGotcha(part) {
  const g = part.design_gotchas?.[0];
  if (!g) return `${part.opn} datasheet constraints`;
  const pg = typeof g.page === 'number' ? ` (p.${g.page})` : '';
  return `${part.opn} "${g.title}"${pg}`;
}

function chooseWhenClause(part, other) {
  const reasons = [];
  if (part.category === 'ldo') {
    const s = part.specs;
    const o = other.specs;
    if (s.iout_max_ma.value > o.iout_max_ma.value * 1.15) {
      reasons.push(`load current exceeds ${fmtNum(o.iout_max_ma.value)} mA (up to ${fmtNum(s.iout_max_ma.value)} mA)`);
    }
    if (s.iq_typ_ua.value < o.iq_typ_ua.value * 0.6) {
      reasons.push(`battery sleep budget demands ${fmtNum(s.iq_typ_ua.value)} µA Iq`);
    }
    if (s.vin_max_v.value > o.vin_max_v.value * 1.15) {
      reasons.push(`input rails climb above ${fmtNum(o.vin_max_v.value)} V (rated to ${fmtNum(s.vin_max_v.value)} V)`);
    }
    if (s.ceramic_cap_stable && !o.ceramic_cap_stable) {
      reasons.push('your BOM standardizes on low-ESR MLCC ceramic output capacitors');
    }
    if (s.dropout_typ_mv.value < o.dropout_typ_mv.value * 0.7) {
      reasons.push(`low Vin-Vout headroom requires ${fmtNum(s.dropout_typ_mv.value)} mV dropout`);
    }
    if (part.package.theta_ja_c_per_w.value < other.package.theta_ja_c_per_w.value * 0.85) {
      reasons.push(`lower package θJA (${fmtNum(part.package.theta_ja_c_per_w.value)} °C/W) is needed for thermal margin`);
    }
  } else if (part.category === 'dcdc') {
    const s = part.specs;
    const o = other.specs;
    if (s.topology !== o.topology) {
      reasons.push(`your power stage requires a ${s.topology} topology`);
    }
    if (s.synchronous && !o.synchronous) {
      reasons.push('you want synchronous rectification without an external Schottky diode');
    }
    if (s.vin_max_v.value > o.vin_max_v.value * 1.15) {
      reasons.push(`bus voltage exceeds ${fmtNum(o.vin_max_v.value)} V (rated to ${fmtNum(s.vin_max_v.value)} V)`);
    }
    if (s.is_switch_limit === o.is_switch_limit && s.iout_or_isw_max_ma.value > o.iout_or_isw_max_ma.value * 1.15) {
      reasons.push(`higher ${s.is_switch_limit ? 'switch current' : 'load current'} capacity (${fmtNum(s.iout_or_isw_max_ma.value)} mA) is required`);
    }
    if (!s.vout_fixed && !o.vout_fixed && s.vout_max_v.value > o.vout_max_v.value * 1.15) {
      reasons.push(`programmed output rails exceed ${fmtNum(o.vout_max_v.value)} V (up to ${fmtNum(s.vout_max_v.value)} V)`);
    }
    if (s.iq_typ_ua.value < o.iq_typ_ua.value * 0.6) {
      reasons.push(`light-load battery standby needs ${fmtNum(s.iq_typ_ua.value)} µA Iq`);
    }
  } else {
    const s = part.specs;
    const o = other.specs;
    if (s.device_kind !== o.device_kind) {
      reasons.push(
        s.device_kind === 'opamp'
          ? 'the circuit is a linear closed-loop amplifier, buffer, or active filter'
          : `the circuit is an open-loop threshold/window comparator (${s.output_type} output)`,
      );
    }
    if (s.vs_max_v.value > o.vs_max_v.value * 1.15) {
      reasons.push(`supply rails exceed ${fmtNum(o.vs_max_v.value)} V (rated up to ${fmtNum(s.vs_max_v.value)} V)`);
    }
    if (s.gbwp_mhz && o.gbwp_mhz && s.gbwp_mhz.value > o.gbwp_mhz.value * 1.5) {
      reasons.push(`closed-loop signal bandwidth requires ${fmtNum(s.gbwp_mhz.value)} MHz GBWP`);
    }
    if (s.vos_max_mv.value < o.vos_max_mv.value * 0.5) {
      reasons.push(`DC precision demands <= ${fmtNum(s.vos_max_mv.value)} mV max Vos`);
    }
    if (s.ib_typ_pa.value < o.ib_typ_pa.value * 0.1) {
      reasons.push(`high-impedance sensors require pA-class input bias (${fmtNum(s.ib_typ_pa.value)} pA)`);
    }
    if (s.rail_to_rail_in && s.rail_to_rail_out && (!o.rail_to_rail_in || !o.rail_to_rail_out)) {
      reasons.push('single-supply ADC headroom demands full Rail-to-Rail I/O swing');
    }
    if (s.iq_per_ch_typ_ua.value < o.iq_per_ch_typ_ua.value * 0.6) {
      reasons.push(`ultra-low supply current (${fmtNum(s.iq_per_ch_typ_ua.value)} µA/ch) is prioritized`);
    }
    if (s.device_kind === 'comparator' && o.device_kind === 'comparator' && s.prop_delay_ns && o.prop_delay_ns && s.prop_delay_ns.value < o.prop_delay_ns.value * 0.7) {
      reasons.push(`fast trip response requires ${fmtNum(s.prop_delay_ns.value)} ns propagation delay`);
    }
  }
  if (reasons.length === 0) {
    reasons.push(
      `matching your existing ${part.manufacturer} ${part.package.code} (${part.package.mfg_package_code}) qualification and ${part.temp_grade.ta_min_c}..${part.temp_grade.ta_max_c} °C grade`,
    );
  }
  return reasons.slice(0, 2).join(' or ');
}

/**
 * Rich, pair-specific engineering analysis (>100 words, zero boilerplate template repetition):
 * (a) Compatibility class & concrete root cause (exact pin/EP conflict, thermal ΔTj delta at a realistic rail, Iq/GBWP/noise gap),
 * (b) Primary datasheet gotchas from both parts,
 * (c) Directional BOM decision ("Choose A when..., choose B when...").
 */
function buildEngineeringVerdict(partA, partB, evalRes) {
  const level = evalRes.compatibility_level;
  const pA = partA.package;
  const pB = partB.package;

  // (a) Compatibility class & root cause
  let rootCause = '';
  if (level === 'LEVEL_1_CANDIDATE_DROP_IN') {
    rootCause = `${partA.opn} (${partA.manufacturer}, ${pA.code}) and ${partB.opn} (${partB.manufacturer}, ${pB.code}) qualify as Level 1 Candidate Drop-In peers: all ${pA.pin_count} pins share identical electrical roles, exposed-pad nets match (${pA.exposed_pad.present ? pA.exposed_pad.net : 'no EP'}), and thermal/voltage/temperature-grade margins remain aligned.`;
  } else if (level === 'LEVEL_2_TUNING_REQUIRED') {
    const reasons = evalRes.level2Reasons.slice(0, 3).join('; ');
    rootCause = `${partA.opn} (${partA.manufacturer}, ${pA.code}) and ${partB.opn} (${partB.manufacturer}, ${pB.code}) are Level 2 Functional / Tuning Required alternatives: the PCB land pattern is compatible, but passive retuning or rating derating is mandatory because ${reasons}.`;
  } else {
    const reasons = evalRes.level3Reasons.slice(0, 3).join('; ');
    const conflictPins = evalRes.pin_diff
      .filter((d) => d.status === 'MISMATCH')
      .map((d) => `Pin ${d.pin} (${d.part_a_role} vs ${d.part_b_role})`);
    const pinSummary =
      conflictPins.length > 0 ? ` Specific pin conflicts: ${conflictPins.slice(0, 4).join(', ')}.` : '';
    rootCause = `${partA.opn} (${partA.manufacturer}, ${pA.code}) and ${partB.opn} (${partB.manufacturer}, ${pB.code}) are NOT drop-in interchangeable (Level 3 PCB Layout / Circuit Change Required) due to ${reasons}.${pinSummary}`;
  }

  // Pair-specific quantitative physics & thermal delta
  let physicsInsight = '';
  if (partA.category === 'ldo') {
    const sA = partA.specs;
    const sB = partB.specs;
    const voutRef = Math.min(sA.vout_v.value, sB.vout_v.value);
    const vinTest = Math.max(
      Math.min(sA.vin_max_v.value, sB.vin_max_v.value),
      voutRef + 1.0,
    );
    const realisticVin = vinTest >= 5.0 && voutRef <= 3.6 ? 5.0 : Number((voutRef + 1.5).toFixed(1));
    const iTestMa = Math.min(sA.iout_max_ma.value, sB.iout_max_ma.value, 150);
    const pdW = Math.max(realisticVin - voutRef, 0.5) * (iTestMa / 1000);
    const dtA = pdW * pA.theta_ja_c_per_w.value;
    const dtB = pdW * pB.theta_ja_c_per_w.value;
    const iqRatio =
      Math.max(sA.iq_typ_ua.value, sB.iq_typ_ua.value) /
      Math.max(Math.min(sA.iq_typ_ua.value, sB.iq_typ_ua.value), 0.01);
    physicsInsight = ` Under a representative ${fmtNum(realisticVin, 1)} V → ${fmtNum(voutRef, 2)} V rail at ${fmtNum(iTestMa, 0)} mA (${fmtNum(pdW * 1000, 0)} mW), estimated self-heating is ΔTj ≈ ${fmtNum(dtA, 1)} °C on ${partA.opn} (θJA ${fmtNum(pA.theta_ja_c_per_w.value)} °C/W) vs ${fmtNum(dtB, 1)} °C on ${partB.opn} (θJA ${fmtNum(pB.theta_ja_c_per_w.value)} °C/W), while quiescent draw spans a ${fmtNum(iqRatio, 1)}x ratio (${fmtCited(sA.iq_typ_ua, 'µA')} vs ${fmtCited(sB.iq_typ_ua, 'µA')}).`;
  } else if (partA.category === 'dcdc') {
    const sA = partA.specs;
    const sB = partB.specs;
    const fswRatio =
      Math.max(sA.fsw_typ_khz.value, sB.fsw_typ_khz.value) /
      Math.max(Math.min(sA.fsw_typ_khz.value, sB.fsw_typ_khz.value), 1);
    const vrefNote =
      sA.vref_v && sB.vref_v
        ? `feedback Vref ${fmtCited(sA.vref_v, 'V')} vs ${fmtCited(sB.vref_v, 'V')}`
        : `output mode ${sA.vout_fixed ? 'fixed' : 'adjustable'} vs ${sB.vout_fixed ? 'fixed' : 'adjustable'}`;
    physicsInsight = ` Power-stage deltas: ${sA.topology} (${sA.synchronous ? 'sync' : 'non-sync'}) vs ${sB.topology} (${sB.synchronous ? 'sync' : 'non-sync'}), switching frequency ${fmtCited(sA.fsw_typ_khz, 'kHz')} vs ${fmtCited(sB.fsw_typ_khz, 'kHz')} (${fmtNum(fswRatio, 1)}x ratio), typical inductor ${fmtCited(sA.inductor_typ_uh, 'µH')} vs ${fmtCited(sB.inductor_typ_uh, 'µH')}, ${vrefNote}, and package θJA ${fmtNum(pA.theta_ja_c_per_w.value)} vs ${fmtNum(pB.theta_ja_c_per_w.value)} °C/W.`;
  } else {
    const sA = partA.specs;
    const sB = partB.specs;
    const ibRatio =
      Math.max(sA.ib_typ_pa.value, sB.ib_typ_pa.value) /
      Math.max(Math.min(sA.ib_typ_pa.value, sB.ib_typ_pa.value), 0.1);
    const speedPart =
      sA.device_kind === 'opamp' && sB.device_kind === 'opamp' && sA.gbwp_mhz && sB.gbwp_mhz
        ? `GBWP ${fmtCited(sA.gbwp_mhz, 'MHz')} vs ${fmtCited(sB.gbwp_mhz, 'MHz')}`
        : sA.device_kind === 'comparator' && sB.device_kind === 'comparator' && sA.prop_delay_ns && sB.prop_delay_ns
          ? `propagation delay ${fmtCited(sA.prop_delay_ns, 'ns')} vs ${fmtCited(sB.prop_delay_ns, 'ns')}`
          : `${sA.device_kind} (${sA.output_type}) vs ${sB.device_kind} (${sB.output_type})`;
    const noisePart =
      sA.input_noise_nv_rt_hz && sB.input_noise_nv_rt_hz
        ? `, voltage noise ${fmtNum(sA.input_noise_nv_rt_hz.value)} vs ${fmtNum(sB.input_noise_nv_rt_hz.value)} nV/√Hz`
        : '';
    physicsInsight = ` Signal-chain deltas: ${speedPart}, supply ceiling ${fmtCited(sA.vs_max_v, 'V')} vs ${fmtCited(sB.vs_max_v, 'V')}, Vos ${fmtCited(sA.vos_max_mv, 'mV')} vs ${fmtCited(sB.vos_max_mv, 'mV')}, Ib ${fmtNum(ibRatio, 0)}x gap (${fmtNum(sA.ib_typ_pa.value)} vs ${fmtNum(sB.ib_typ_pa.value)} pA)${noisePart}.`;
  }

  // (b) Concrete primary design gotchas
  const gotchaLine = ` Primary bench gotchas to watch: ${summarizeGotcha(partA)} and ${summarizeGotcha(partB)}.`;

  // (c) Clear directional BOM decision + AUD-04 verification reminder
  const decisionLine = ` BOM decision: Choose ${partA.opn} when ${chooseWhenClause(partA, partB)}; choose ${partB.opn} when ${chooseWhenClause(partB, partA)}. Always verify Pin 1 orientation (${pA.pinout_view} p.${pA.pinout_source_page} vs ${pB.pinout_view} p.${pB.pinout_source_page}) and official datasheets on hardware prototypes prior to production.`;

  return `${rootCause}${physicsInsight}${gotchaLine}${decisionLine}`;
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
    // Never compare iout_or_isw_max_ma across mismatched is_switch_limit
    if (
      c.is_switch_limit === t.is_switch_limit &&
      c.iout_or_isw_max_ma.value >= t.iout_or_isw_max_ma.value
    ) {
      score += 2;
    }
    if (c.iq_typ_ua.value < t.iq_typ_ua.value * 0.5) score += 2;
  } else {
    const t = target.specs;
    const c = cand.specs;
    if (c.device_kind !== t.device_kind) {
      score -= 45;
    } else if (c.output_type !== t.output_type) {
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

  // Lifecycle sourcing risk penalty (EOL -35, NRND -20)
  const lifecyclePenalty = LIFECYCLE_PENALTY[String(cand.lifecycle_status || '').toUpperCase()] || 0;
  score -= lifecyclePenalty;

  // Level 3 candidates cap at 45 so Active L2 options always outrank L3
  if (evalRes.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE') {
    score = Math.min(score, 45);
  }

  return Math.max(10, Math.min(99, Math.round(score)));
}

function isCrossKind(target, cand) {
  if (target.category === 'opamp') return target.specs.device_kind !== cand.specs.device_kind;
  if (target.category === 'dcdc') return target.specs.topology !== cand.specs.topology;
  return false;
}

function classifyTierTag(target, cand, evalRes, isTopDropIn) {
  if (isLifecycleRestricted(cand.lifecycle_status)) {
    return 'Lifecycle Warning (EOL/NRND)';
  }
  if (evalRes.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE' || isCrossKind(target, cand)) {
    return 'Functional Alternative (Layout Change)';
  }
  if (evalRes.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN' && isTopDropIn) {
    return 'Candidate Drop-In';
  }

  if (target.category === 'ldo') {
    if (cand.specs.iq_typ_ua.value <= target.specs.iq_typ_ua.value * 0.35) {
      return 'Ultra-Low Iq Upgrade';
    }
    if (cand.specs.iout_max_ma.value >= target.specs.iout_max_ma.value * 1.25) {
      return 'Higher Current / Margin';
    }
    if (cand.specs.vin_max_v.value >= target.specs.vin_max_v.value * 1.25) {
      return 'Higher Voltage Margin';
    }
  } else if (target.category === 'dcdc') {
    if (cand.specs.iq_typ_ua.value <= target.specs.iq_typ_ua.value * 0.35) {
      return 'Ultra-Low Iq Upgrade';
    }
    if (
      cand.specs.is_switch_limit === target.specs.is_switch_limit &&
      cand.specs.iout_or_isw_max_ma.value >= target.specs.iout_or_isw_max_ma.value * 1.25
    ) {
      return 'Higher Current / Margin';
    }
    if (cand.specs.vin_max_v.value >= target.specs.vin_max_v.value * 1.25) {
      return 'Higher Voltage Margin';
    }
  } else {
    if (cand.specs.iq_per_ch_typ_ua.value <= target.specs.iq_per_ch_typ_ua.value * 0.35) {
      return 'Ultra-Low Iq Upgrade';
    }
    if (
      cand.specs.iout_short_ma &&
      target.specs.iout_short_ma &&
      cand.specs.iout_short_ma.value >= target.specs.iout_short_ma.value * 1.25
    ) {
      return 'Higher Current / Margin';
    }
    if (cand.specs.vs_max_v.value >= target.specs.vs_max_v.value * 1.3) {
      return 'Higher Voltage Margin';
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

    // Only compare current ratings when both share the same basis (Iout vs Isw)
    if (c.is_switch_limit === t.is_switch_limit) {
      const basis = c.is_switch_limit ? 'Isw limit' : 'Iout rating';
      if (c.iout_or_isw_max_ma.value > t.iout_or_isw_max_ma.value * 1.15) {
        adv.push(
          `Higher ${basis} (${fmtNum(c.iout_or_isw_max_ma.value)} mA vs ${fmtNum(t.iout_or_isw_max_ma.value)} mA)`,
        );
      } else if (c.iout_or_isw_max_ma.value < t.iout_or_isw_max_ma.value * 0.85) {
        trade.push(
          `Lower ${basis} (${fmtNum(c.iout_or_isw_max_ma.value)} mA vs ${fmtNum(t.iout_or_isw_max_ma.value)} mA)`,
        );
      }
    } else {
      trade.push(
        `Different current rating basis (${c.is_switch_limit ? 'Isw limit' : 'Iout max'} vs ${t.is_switch_limit ? 'Isw limit' : 'Iout max'})`,
      );
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
    const crossReason = evalRes.level3Reasons.find((r) =>
      /device kind mismatch|topology mismatch|voltage rail mismatch|rectification mismatch|feedback/.test(r),
    );
    trade.unshift(
      crossReason
        ? `Not drop-in: ${crossReason}`
        : evalRes.package_match
          ? 'Pinout or exposed-pad mismatch requires PCB rerouting'
          : `Package change (${target.package.code} → ${cand.package.code}) requires PCB layout mod`,
    );
  } else if (evalRes.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN' && adv.length === 0) {
    adv.push(`Matching ${cand.package.code} pinout & ratings for second-sourcing`);
  }

  if (isLifecycleRestricted(cand.lifecycle_status)) {
    trade.unshift(`[${cand.lifecycle_status}] Not recommended for new production designs`);
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
    `Verify device class (${target.specs.device_kind}) and output stage (${target.specs.output_type}) — never substitute an uncompensated comparator for a compensated op-amp, or vice versa, without circuit redesign; only open-collector/open-drain outputs require an external pull-up.`,
    `Confirm supply rail span (${target.specs.vs_min_v.value}–${target.specs.vs_max_v.value} V rec, ${target.specs.vs_abs_max_v.value} V abs max) and exact ${target.package.code} pinout (${target.package.pinout.map((p) => `${p.pin}=${p.role}`).join(', ')}).`,
    `Verify input common-mode headroom (${target.specs.rail_to_rail_in ? 'RR-In' : 'Non-RR-In'}), output swing (${target.specs.rail_to_rail_out ? 'RR-Out' : 'Non-RR-Out'}), and Vos (${target.specs.vos_max_mv.value} mV max) against signal chain budget.`,
    `Check closed-loop bandwidth (GBWP / Acl), full-power slew rate (SR / 2π·Vpeak), and capacitive-load phase margin on the bench.`,
  ];
}

export function buildAltHub(target, allCategoryParts, existingVsSlugs, generatedAt) {
  const scored = [];
  for (const cand of allCategoryParts) {
    if (cand.slug === target.slug) continue;
    // Directional replacement evaluation: upgrading target -> cand is not falsely penalized
    const evalRes = evaluateReplacement(target, cand);
    const norm = normalizeVsPair(target.slug, cand.slug);
    const vsSlug = existingVsSlugs.has(norm.slug) ? norm.slug : null;
    const score = scoreCandidate(target, cand, evalRes);
    scored.push({ cand, evalRes, vsSlug, score });
  }

  const hasSameKind = scored.some((s) => !isCrossKind(target, s.cand));
  scored.sort((x, y) => {
    if (hasSameKind) {
      const xk = isCrossKind(target, x.cand) ? 1 : 0;
      const yk = isCrossKind(target, y.cand) ? 1 : 0;
      if (xk !== yk) return xk - yk;
    }
    const lp =
      LEVEL_PRIORITY[x.evalRes.compatibility_level] -
      LEVEL_PRIORITY[y.evalRes.compatibility_level];
    if (lp !== 0) return lp;
    // Active parts rank ahead of EOL/NRND within the same compatibility level
    const xRestr = isLifecycleRestricted(x.cand.lifecycle_status) ? 1 : 0;
    const yRestr = isLifecycleRestricted(y.cand.lifecycle_status) ? 1 : 0;
    if (xRestr !== yRestr) return xRestr - yRestr;
    if (y.score !== x.score) return y.score - x.score;
    const xHasVs = x.vsSlug ? 1 : 0;
    const yHasVs = y.vsSlug ? 1 : 0;
    if (yHasVs !== xHasVs) return yHasVs - xHasVs;
    return x.cand.slug.localeCompare(y.cand.slug);
  });

  // Include top 8 ranked candidates plus any additional candidates with a dedicated /en/vs/ page
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

    const isTopDropIn =
      lvl === 'LEVEL_1_CANDIDATE_DROP_IN' &&
      !isLifecycleRestricted(item.cand.lifecycle_status) &&
      !seenTopDropIn;
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
      lifecycle_status: item.cand.lifecycle_status,
      compatibility_level: lvl,
      compatibility_badge: item.evalRes.compatibility_badge,
      tier_tag: tierTag,
      score: item.score,
      key_advantage,
      key_tradeoff,
      vs_slug: item.vsSlug,
    };
  });

  const summary = `Datasheet-verified cross-reference alternatives for ${target.opn} (${target.manufacturer}, ${target.package.code}, ${target.sub_topology}): evaluated ${scored.length} same-category OPNs and shortlisted the top ${candidates.length} ranked replacements (${l1Count} Level 1 Candidate Drop-In, ${l2Count} Level 2 Tuning Required, and ${l3Count} Level 3 Layout Change). Verify pinout, thermal margin, lifecycle status, and official manufacturer datasheets before production.`;

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

/**
 * Hard engineering invariants (AUD-02/AUD-04). Any violation fails Stage 3.
 */
export function checkVsInvariants(partA, partB, doc) {
  const v = [];
  const lvl = doc.compatibility_level;
  const [a, b] = partA.slug === doc.part_a_slug ? [partA, partB] : [partB, partA];
  if (lvl === 'LEVEL_1_CANDIDATE_DROP_IN') {
    if (!doc.package_match) v.push(`${doc.slug}: L1 with package mismatch (AUD-02).`);
    if (doc.pin_diff.some((d) => d.status !== 'MATCH'))
      v.push(`${doc.slug}: L1 with non-MATCH pin rows.`);
    if (
      doc.pin_diff.some(
        (d) =>
          d.part_a_role === 'OTHER' &&
          d.status === 'MATCH' &&
          normalizePinName(d.part_a_name) !== normalizePinName(d.part_b_name),
      )
    ) {
      v.push(`${doc.slug}: OTHER===OTHER with different pin names counted as MATCH.`);
    }
  }
  if (a.category === 'opamp') {
    if (a.specs.device_kind !== b.specs.device_kind) {
      if (lvl !== 'LEVEL_3_LAYOUT_CHANGE')
        v.push(`${doc.slug}: op-amp vs comparator not Level 3.`);
      if (doc.pinout_exact_match)
        v.push(`${doc.slug}: op-amp vs comparator reported pinout_exact_match=true.`);
    }
    const anyOpen = isOpenOutput(a.specs.output_type) || isOpenOutput(b.specs.output_type);
    const text = [...doc.swap_risks, ...doc.pin_diff.map((d) => d.note)].join(' ');
    if (!anyOpen && /requires external pull-up|CANNOT pull high/i.test(text))
      v.push(`${doc.slug}: false open-collector/pull-up claim on push-pull pair.`);
  }
  if (a.category === 'dcdc') {
    if (a.specs.topology !== b.specs.topology && lvl !== 'LEVEL_3_LAYOUT_CHANGE')
      v.push(`${doc.slug}: DC-DC topology mismatch not Level 3.`);
    if (a.specs.synchronous !== b.specs.synchronous && lvl !== 'LEVEL_3_LAYOUT_CHANGE')
      v.push(`${doc.slug}: DC-DC sync vs non-sync mismatch not Level 3.`);
    if (a.specs.vout_fixed !== b.specs.vout_fixed && lvl !== 'LEVEL_3_LAYOUT_CHANGE')
      v.push(`${doc.slug}: DC-DC fixed vs adj mismatch not Level 3.`);
    if (a.specs.vout_fixed && b.specs.vout_fixed) {
      const va = dcdcNominalVout(a.specs).value;
      const vb = dcdcNominalVout(b.specs).value;
      if (Math.abs(va - vb) > 0.05 && lvl !== 'LEVEL_3_LAYOUT_CHANGE')
        v.push(`${doc.slug}: fixed DC-DC Vout mismatch (${va} vs ${vb}) not Level 3.`);
    }
    const hasBoostOrIsw =
      a.specs.topology === 'boost' ||
      b.specs.topology === 'boost' ||
      a.specs.is_switch_limit ||
      b.specs.is_switch_limit;
    const text = [
      ...doc.swap_risks,
      ...doc.parameter_matrix.map((m) => m.note),
      doc.engineering_verdict,
    ].join(' ');
    if (!hasBoostOrIsw && /boost Iout,max|boost\/switch-limited/i.test(text)) {
      v.push(`${doc.slug}: false boost Iout<Isw text emitted on non-boost continuous-Iout pair.`);
    }
  }
  if (a.category === 'ldo') {
    if (
      (a.specs.vout_fixed !== b.specs.vout_fixed ||
        (a.specs.vout_fixed && Math.abs(a.specs.vout_v.value - b.specs.vout_v.value) > 0.05)) &&
      lvl !== 'LEVEL_3_LAYOUT_CHANGE'
    ) {
      v.push(`${doc.slug}: fixed LDO Vout or fixed/adj mismatch not Level 3.`);
    }
  }
  // Verdict quality & safety invariants
  const wordCount = doc.engineering_verdict.trim().split(/\s+/).length;
  if (wordCount < 70) {
    v.push(`${doc.slug}: engineering_verdict too short (${wordCount} words).`);
  }
  if (/\bNaN\b|\bundefined\b/i.test(doc.engineering_verdict)) {
    v.push(`${doc.slug}: NaN/undefined leaked into engineering_verdict.`);
  }
  if (/100%\s*drop-?in|guaranteed\s*drop-?in/i.test(doc.engineering_verdict)) {
    v.push(`${doc.slug}: AUD-04 banned absolute drop-in guarantee in verdict.`);
  }
  return v;
}

export function checkAltInvariants(target, altDoc, partsBySlug) {
  const v = [];
  let maxActiveL2 = -Infinity;
  let maxL3 = -Infinity;
  const sameKindExists = altDoc.candidates.some((c) => {
    const p = partsBySlug.get(c.alt_slug);
    return p && !isCrossKind(target, p);
  });
  for (const c of altDoc.candidates) {
    const p = partsBySlug.get(c.alt_slug);
    if (c.compatibility_level === 'LEVEL_2_TUNING_REQUIRED' && !isLifecycleRestricted(c.lifecycle_status)) {
      maxActiveL2 = Math.max(maxActiveL2, c.score);
    }
    if (c.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE') {
      maxL3 = Math.max(maxL3, c.score);
      if (c.score > 45) v.push(`${altDoc.slug}: L3 candidate ${c.alt_slug} score ${c.score} > 45.`);
    }
    if (p && isCrossKind(target, p)) {
      if (c.compatibility_level !== 'LEVEL_3_LAYOUT_CHANGE' && sameKindExists)
        v.push(`${altDoc.slug}: cross-kind ${c.alt_slug} placed in ${c.compatibility_level}.`);
      if (c.tier_tag === 'Ultra-Low Iq Upgrade')
        v.push(`${altDoc.slug}: cross-kind ${c.alt_slug} labelled Ultra-Low Iq Upgrade.`);
    }
    if (isLifecycleRestricted(c.lifecycle_status) && c.tier_tag !== 'Lifecycle Warning (EOL/NRND)') {
      v.push(`${altDoc.slug}: EOL/NRND candidate ${c.alt_slug} missing Lifecycle Warning tier_tag.`);
    }
  }
  if (maxL3 > maxActiveL2 && maxActiveL2 !== -Infinity) {
    v.push(`${altDoc.slug}: L3 score ${maxL3} outranks best Active L2 ${maxActiveL2}.`);
  }
  return v;
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

  for (const existing of collectJsonFiles(vsDir)) fs.unlinkSync(existing);
  for (const existing of collectJsonFiles(altDir)) fs.unlinkSync(existing);

  const generatedVsSlugs = new Set();
  const invariantViolations = [];
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
    invariantViolations.push(...checkVsInvariants(partA, partB, vsDoc));
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
    invariantViolations.push(...checkAltInvariants(part, altDoc, partsBySlug));
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

  if (invariantViolations.length > 0) {
    throw new Error(
      `Stage 3 engineering invariant violation(s) (${invariantViolations.length}):\n  - ${invariantViolations.join('\n  - ')}`,
    );
  }

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
    check: false,
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
    } else if (arg === '--check' || arg === '--dry-run') {
      opts.check = true;
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
    let tmpOut = null;
    if (opts.check) {
      tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'p2p-xref-check-'));
      opts.outDir = tmpOut;
    }
    let summary;
    try {
      summary = runXrefEngine(opts);
    } finally {
      if (tmpOut) fs.rmSync(tmpOut, { recursive: true, force: true });
    }
    if (opts.check) {
      console.log('Stage 3 --check (dry-run): all invariants hold; data/generated left untouched.');
    }
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
