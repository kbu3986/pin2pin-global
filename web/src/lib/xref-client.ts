import type {
  CompatibilityLevel,
  GoldenPartV2,
  LdoSpecs,
  PackageCode,
  PackageInfo,
  ParameterMatrixRow,
  PartCategory,
  PinDiffRow,
  PinEntry,
  PinRole,
} from '@/types/schema';
import { fmtNum } from '@/lib/format';

export type EpDiffStatus = 'MATCH' | 'MISMATCH' | 'CAUTION';

export const COMPATIBILITY_BADGES: Record<CompatibilityLevel, string> = {
  LEVEL_1_CANDIDATE_DROP_IN:
    'Candidate Drop-In (Verify Datasheet Before Production)',
  LEVEL_2_TUNING_REQUIRED:
    'Functional / Tuning Required (Check Passives & Ratings)',
  LEVEL_3_LAYOUT_CHANGE:
    'PCB Layout Change Required (Pinout or Package Mismatch)',
};

/**
 * Package pairs sharing a JEDEC PCB land pattern with differing body height/profile.
 * `packageMatch` remains strictly `a.package.code === b.package.code`.
 */
const FOOTPRINT_COMPATIBLE_PAIRS = new Set<string>([
  'SOT-23-5|TSOT-23-5',
  'TSOT-23-5|SOT-23-5',
  'SOT-23-6|TSOT-23-6',
  'TSOT-23-6|SOT-23-6',
  'SOT-23-3|SOT-23A-3',
  'SOT-23A-3|SOT-23-3',
]);

const OUTPUT_PIN_ROLES = new Set<string>(['OUT', 'OUT_A', 'OUT_B']);
const GND_EP_SET = new Set<string>(['GND', 'THERMAL_GND_RECOMMENDED']);

export interface ClientComparisonResult {
  compatibilityLevel: CompatibilityLevel;
  compatibilityBadge: string;
  sameCategory: boolean;
  packageMatch: boolean;
  footprintCompatible: boolean;
  pinoutExactMatch: boolean;
  exposedPadMatch: boolean;
  epDiffStatus: EpDiffStatus;
  epNote: string;
  pinDiff: PinDiffRow[];
  diffHighlightsA: Record<number, 'MATCH' | 'MISMATCH' | 'CAUTION'>;
  diffHighlightsB: Record<number, 'MATCH' | 'MISMATCH' | 'CAUTION'>;
  parameterRows: ParameterMatrixRow[];
  swapRisks: string[];
  engineeringVerdict: string;
  canonicalVsSlug: string;
}

function isFootprintCompatible(codeA: PackageCode, codeB: PackageCode): boolean {
  return codeA === codeB || FOOTPRINT_COMPATIBLE_PAIRS.has(`${codeA}|${codeB}`);
}

function isOpenOutput(outputType: string): boolean {
  return outputType === 'open-collector' || outputType === 'open-drain';
}

function normalizePinName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function fmtEsrWindow(specs: LdoSpecs): string {
  const minE = specs.esr_min_ohm;
  const maxE = specs.esr_max_ohm;
  if (minE && maxE) {
    const pNote = minE.page === maxE.page ? `p.${minE.page}` : `p.${minE.page}/p.${maxE.page}`;
    return `${fmtNum(minE.value)}–${fmtNum(maxE.value)} Ω (${pNote})`;
  }
  if (minE) return `≥ ${fmtNum(minE.value)} Ω (p.${minE.page})`;
  if (maxE) return `≤ ${fmtNum(maxE.value)} Ω (p.${maxE.page})`;
  return specs.ceramic_cap_stable ? 'Low-ESR MLCC compatible' : 'See datasheet ESR curve';
}

function compareHigherBetter(
  aVal: number | null | undefined,
  bVal: number | null | undefined,
  relTieTol = 0.03,
): 'A' | 'B' | 'TIE' | 'CONTEXT' {
  if (aVal === null || aVal === undefined || !Number.isFinite(aVal)) {
    return bVal !== null && bVal !== undefined && Number.isFinite(bVal) ? 'B' : 'CONTEXT';
  }
  if (bVal === null || bVal === undefined || !Number.isFinite(bVal)) return 'A';
  const maxAbs = Math.max(Math.abs(aVal), Math.abs(bVal), 1e-9);
  if (Math.abs(aVal - bVal) / maxAbs <= relTieTol) return 'TIE';
  return aVal > bVal ? 'A' : 'B';
}

function compareLowerBetter(
  aVal: number | null | undefined,
  bVal: number | null | undefined,
  relTieTol = 0.03,
): 'A' | 'B' | 'TIE' | 'CONTEXT' {
  if (aVal === null || aVal === undefined || !Number.isFinite(aVal)) {
    return bVal !== null && bVal !== undefined && Number.isFinite(bVal) ? 'B' : 'CONTEXT';
  }
  if (bVal === null || bVal === undefined || !Number.isFinite(bVal)) return 'A';
  const maxAbs = Math.max(Math.abs(aVal), Math.abs(bVal), 1e-9);
  if (Math.abs(aVal - bVal) / maxAbs <= relTieTol) return 'TIE';
  return aVal < bVal ? 'A' : 'B';
}

function evaluateExposedPad(pkgA: PackageInfo, pkgB: PackageInfo): {
  match: boolean;
  status: EpDiffStatus;
  note: string;
} {
  const epA = pkgA.exposed_pad;
  const epB = pkgB.exposed_pad;

  if (!epA.present && !epB.present) {
    return {
      match: true,
      status: 'MATCH',
      note: 'Neither package has an exposed thermal pad or electrical tab.',
    };
  }
  if (epA.present !== epB.present) {
    return {
      match: false,
      status: 'MISMATCH',
      note: `Exposed thermal pad/tab mismatch (${pkgA.code}: ${epA.present ? epA.net : 'NONE'} vs ${pkgB.code}: ${epB.present ? epB.net : 'NONE'}); PCB land pattern & solder-mask change required.`,
    };
  }
  if (epA.net === epB.net) {
    return {
      match: true,
      status: 'MATCH',
      note: `Both exposed thermal pads/tabs connect to ${epA.net}.`,
    };
  }
  if (GND_EP_SET.has(epA.net) && GND_EP_SET.has(epB.net)) {
    return {
      match: true,
      status: 'CAUTION',
      note: `Both exposed pads tie to ground (${epA.net} vs ${epB.net}); confirm thermal via stitching to PCB GND plane.`,
    };
  }
  return {
    match: false,
    status: 'MISMATCH',
    note: `CRITICAL SHORT-CIRCUIT HAZARD: Exposed thermal pad/tab net conflict (${epA.net} vs ${epB.net}) — direct swap will short power rails.`,
  };
}

interface SinglePinEval extends PinDiffRow {
  roleEquivalent: boolean;
  hardMismatch: boolean;
  pin4NcBypass: boolean;
  enPolarityDiff: boolean;
}

function evaluateSinglePin(
  partA: GoldenPartV2,
  partB: GoldenPartV2,
  pinNum: number,
  pinA: PinEntry | undefined,
  pinB: PinEntry | undefined,
): SinglePinEval {
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

  if (rA === rB) {
    // AUD-02 guard: OTHER === OTHER only matches if normalized pin names match; otherwise CAUTION & not exact
    if (rA === 'OTHER') {
      const normA = normalizePinName(pinA.name);
      const normB = normalizePinName(pinB.name);
      const sameName = normA.length > 0 && normA === normB;
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: 'CAUTION',
        note: sameName
          ? `Shared auxiliary pin name (${pinA.name}, role OTHER): confirm electrical timing/threshold equivalence in both datasheets.`
          : `Unclassified pin function (${pinA.name} vs ${pinB.name}, role OTHER): electrical equivalence is NOT verified — inspect both datasheets before assuming compatibility.`,
        roleEquivalent: false,
        hardMismatch: false,
        pin4NcBypass: false,
        enPolarityDiff: false,
      };
    }

    // Check EN polarity inversion
    if (
      rA === 'EN' &&
      (partA.category === 'ldo' || partA.category === 'dcdc') &&
      (partB.category === 'ldo' || partB.category === 'dcdc')
    ) {
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

    // Check Op-Amp vs Comparator / Output stage mismatch on output pins
    if (
      partA.category === 'opamp' &&
      partB.category === 'opamp' &&
      OUTPUT_PIN_ROLES.has(rA) &&
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
        note: `CRITICAL OUTPUT STAGE DIFFERENCE: ${partA.opn} is ${partA.specs.device_kind} (${partA.specs.output_type}) vs ${partB.opn} ${partB.specs.device_kind} (${partB.specs.output_type}).`,
        roleEquivalent: partA.specs.device_kind === partB.specs.device_kind,
        hardMismatch: false,
        pin4NcBypass: false,
        enPolarityDiff: false,
      };
    }

    // Check DC-DC FB pin fixed/adj or Vref mismatch
    if (partA.category === 'dcdc' && partB.category === 'dcdc' && rA === 'FB') {
      if (partA.specs.vout_fixed !== partB.specs.vout_fixed) {
        return {
          pin: pinNum,
          part_a_name: pinA.name,
          part_a_role: rA,
          part_b_name: pinB.name,
          part_b_role: rB,
          status: 'CAUTION',
          note: 'Feedback network difference: fixed internal divider vs external R1/R2 feedback resistors.',
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
          note: `Reference voltage differs (${partA.specs.vref_v.value} V vs ${partB.specs.vref_v.value} V): recalculate R1/R2 divider.`,
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
    const negRails = new Set<string>(['GND', 'VEE']);
    const posRails = new Set<string>(['VIN', 'VCC']);
    if (negRails.has(rA) && negRails.has(rB)) {
      return {
        pin: pinNum,
        part_a_name: pinA.name,
        part_a_role: rA,
        part_b_name: pinB.name,
        part_b_role: rB,
        status: 'MATCH',
        note: `Negative supply rail equivalent (${pinA.name}/${rA} vs ${pinB.name}/${rB}); verify split vs single-supply limits.`,
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

  // LDO Pin 4 NC <-> BYPASS rule
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
      note: `Pin 4 differs (${pinA.name}/${rA} vs ${pinB.name}/${rB}): safe only if PCB leaves Pin 4 floating or decoupled via 10 nF to GND; never tie BYPASS directly to GND/VIN.`,
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
      note: `Fixed-voltage variant ground reference (${pinA.name}/${rA} vs ${pinB.name}/${rB}); confirm Pin 1 ties directly to GND.`,
      roleEquivalent: true,
      hardMismatch: false,
      pin4NcBypass: false,
      enPolarityDiff: false,
    };
  }

  // DC-DC fixed VOUT sense vs adjustable FB
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
      note: `Output sense pin differs (${pinA.name}/${rA} vs ${pinB.name}/${rB}): adjustable variant needs R1/R2 divider while fixed senses VOUT directly.`,
      roleEquivalent: false,
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
    note: `PINOUT CONFLICT on Pin ${pinNum}: ${partA.opn} assigns ${pinA.name} (${rA}) whereas ${partB.opn} assigns ${pinB.name} (${rB}) — direct drop-in risks rail short or IC damage.`,
    roleEquivalent: false,
    hardMismatch: true,
    pin4NcBypass: false,
    enPolarityDiff: false,
  };
}

function buildParameterRows(a: GoldenPartV2, b: GoldenPartV2): ParameterMatrixRow[] {
  const rows: ParameterMatrixRow[] = [];

  if (a.category === 'ldo' && b.category === 'ldo') {
    const sA = a.specs;
    const sB = b.specs;
    rows.push(
      {
        metric: 'Output Voltage (Vout)',
        unit: 'V',
        part_a_value: `${fmtNum(sA.vout_v.value, 2)} (${sA.vout_fixed ? 'Fixed' : 'Adj Vref'})`,
        part_b_value: `${fmtNum(sB.vout_v.value, 2)} (${sB.vout_fixed ? 'Fixed' : 'Adj Vref'})`,
        winner: 'CONTEXT',
        note: `p.${sA.vout_v.page} vs p.${sB.vout_v.page}`,
      },
      {
        metric: 'Recommended Vin Range',
        unit: 'V',
        part_a_value: `${fmtNum(sA.vin_min_v.value, 2)}–${fmtNum(sA.vin_max_v.value, 2)}`,
        part_b_value: `${fmtNum(sB.vin_min_v.value, 2)}–${fmtNum(sB.vin_max_v.value, 2)}`,
        winner: compareHigherBetter(sA.vin_max_v.value, sB.vin_max_v.value),
        note: 'Higher Vin,max adds transient margin; check Vin,min for low-battery startup.',
      },
      {
        metric: 'Absolute Max Vin',
        unit: 'V',
        part_a_value: `${fmtNum(sA.vin_abs_max_v.value, 1)} (p.${sA.vin_abs_max_v.page})`,
        part_b_value: `${fmtNum(sB.vin_abs_max_v.value, 1)} (p.${sB.vin_abs_max_v.page})`,
        winner: compareHigherBetter(sA.vin_abs_max_v.value, sB.vin_abs_max_v.value),
        note: 'Never exceed under hot-plug or inductive spikes.',
      },
      {
        metric: 'Max Output Current (Iout)',
        unit: 'mA',
        part_a_value: fmtNum(sA.iout_max_ma.value, 0),
        part_b_value: fmtNum(sB.iout_max_ma.value, 0),
        winner: compareHigherBetter(sA.iout_max_ma.value, sB.iout_max_ma.value),
        note: 'Derate thermally using θJA and worst-case (Vin − Vout).',
      },
      {
        metric: 'Typical Dropout (Vdo)',
        unit: 'mV',
        part_a_value: fmtNum(sA.dropout_typ_mv.value, 0),
        part_b_value: fmtNum(sB.dropout_typ_mv.value, 0),
        winner: compareLowerBetter(sA.dropout_typ_mv.value, sB.dropout_typ_mv.value),
        note: 'Lower dropout preserves regulation near end-of-discharge.',
      },
      {
        metric: 'Quiescent Current (Iq)',
        unit: 'µA',
        part_a_value: fmtNum(sA.iq_typ_ua.value, 2),
        part_b_value: fmtNum(sB.iq_typ_ua.value, 2),
        winner: compareLowerBetter(sA.iq_typ_ua.value, sB.iq_typ_ua.value),
        note: 'Critical for always-on battery/sleep rails.',
      },
      {
        metric: 'Ceramic MLCC Stability',
        unit: 'ESR',
        part_a_value: sA.ceramic_cap_stable
          ? `Stable (≥${fmtNum(sA.min_cout_uf.value)} µF)`
          : `ESR-Bound (${fmtEsrWindow(sA)})`,
        part_b_value: sB.ceramic_cap_stable
          ? `Stable (≥${fmtNum(sB.min_cout_uf.value)} µF)`
          : `ESR-Bound (${fmtEsrWindow(sB)})`,
        winner:
          sA.ceramic_cap_stable === sB.ceramic_cap_stable
            ? 'TIE'
            : sA.ceramic_cap_stable
              ? 'A'
              : 'B',
        note: 'Low-ESR ceramic capacitors can cause legacy LDOs to oscillate.',
      },
      {
        metric: 'PSRR (Typical)',
        unit: 'dB',
        part_a_value: sA.psrr_db ? fmtNum(sA.psrr_db.value, 0) : '—',
        part_b_value: sB.psrr_db ? fmtNum(sB.psrr_db.value, 0) : '—',
        winner: compareHigherBetter(sA.psrr_db?.value, sB.psrr_db?.value),
        note: 'Verify test frequency (1 kHz vs 100 kHz) in datasheet.',
      },
    );
  } else if (a.category === 'dcdc' && b.category === 'dcdc') {
    const sA = a.specs;
    const sB = b.specs;
    rows.push(
      {
        metric: 'Topology & Rectification',
        unit: 'Arch',
        part_a_value: `${sA.topology.toUpperCase()} (${sA.synchronous ? 'Sync' : 'Async'})`,
        part_b_value: `${sB.topology.toUpperCase()} (${sB.synchronous ? 'Sync' : 'Async'})`,
        winner: 'CONTEXT',
        note: 'Async requires an external Schottky catch/freewheeling diode.',
      },
      {
        metric: 'Recommended Vin Range',
        unit: 'V',
        part_a_value: `${fmtNum(sA.vin_min_v.value, 2)}–${fmtNum(sA.vin_max_v.value, 2)}`,
        part_b_value: `${fmtNum(sB.vin_min_v.value, 2)}–${fmtNum(sB.vin_max_v.value, 2)}`,
        winner: compareHigherBetter(sA.vin_max_v.value, sB.vin_max_v.value),
        note: `Abs max: ${fmtNum(sA.vin_abs_max_v.value, 1)} V vs ${fmtNum(sB.vin_abs_max_v.value, 1)} V.`,
      },
      {
        metric: 'Output Voltage Range',
        unit: 'V',
        part_a_value: sA.vout_fixed
          ? `Fixed ${fmtNum(sA.vout_nom_v?.value ?? sA.vout_min_v.value, 2)}`
          : `Adj ${fmtNum(sA.vout_min_v.value, 2)}–${fmtNum(sA.vout_max_v.value, 1)}`,
        part_b_value: sB.vout_fixed
          ? `Fixed ${fmtNum(sB.vout_nom_v?.value ?? sB.vout_min_v.value, 2)}`
          : `Adj ${fmtNum(sB.vout_min_v.value, 2)}–${fmtNum(sB.vout_max_v.value, 1)}`,
        winner: 'CONTEXT',
        note: 'Confirm target rail lies inside operating envelope.',
      },
      {
        metric: 'Feedback Vref',
        unit: 'V',
        part_a_value: sA.vref_v ? fmtNum(sA.vref_v.value, 3) : 'Fixed/N/A',
        part_b_value: sB.vref_v ? fmtNum(sB.vref_v.value, 3) : 'Fixed/N/A',
        winner: 'CONTEXT',
        note: 'Different Vref requires recalculating R1/R2 divider.',
      },
      {
        metric: 'Current Limit / Output Rating',
        unit: 'mA',
        part_a_value: `${fmtNum(sA.iout_or_isw_max_ma.value, 0)} (${sA.is_switch_limit ? 'Isw' : 'Iout'})`,
        part_b_value: `${fmtNum(sB.iout_or_isw_max_ma.value, 0)} (${sB.is_switch_limit ? 'Isw' : 'Iout'})`,
        winner:
          sA.is_switch_limit === sB.is_switch_limit
            ? compareHigherBetter(sA.iout_or_isw_max_ma.value, sB.iout_or_isw_max_ma.value)
            : 'CONTEXT',
        note: 'Do not confuse peak switch limit (Isw) with continuous output current.',
      },
      {
        metric: 'Switching Frequency (fsw)',
        unit: 'kHz',
        part_a_value: fmtNum(sA.fsw_typ_khz.value, 0),
        part_b_value: fmtNum(sB.fsw_typ_khz.value, 0),
        winner: 'CONTEXT',
        note: 'Higher fsw shrinks magnetics; lower fsw reduces switching losses.',
      },
      {
        metric: 'Typical Inductor (L)',
        unit: 'µH',
        part_a_value: fmtNum(sA.inductor_typ_uh.value, 2),
        part_b_value: fmtNum(sB.inductor_typ_uh.value, 2),
        winner: 'CONTEXT',
        note: 'Check Isat margin against peak inductor current.',
      },
      {
        metric: 'Quiescent Current (Iq)',
        unit: 'µA',
        part_a_value: fmtNum(sA.iq_typ_ua.value, 1),
        part_b_value: fmtNum(sB.iq_typ_ua.value, 1),
        winner: compareLowerBetter(sA.iq_typ_ua.value, sB.iq_typ_ua.value),
        note: 'Determines light-load battery efficiency.',
      },
    );
  } else if (a.category === 'opamp' && b.category === 'opamp') {
    const sA = a.specs;
    const sB = b.specs;
    rows.push(
      {
        metric: 'Device Kind & Output Stage',
        unit: 'Type',
        part_a_value: `${sA.channels}ch ${sA.device_kind} (${sA.output_type})`,
        part_b_value: `${sB.channels}ch ${sB.device_kind} (${sB.output_type})`,
        winner: 'CONTEXT',
        note: 'Comparators are uncompensated; open-collector/drain needs pull-up.',
      },
      {
        metric: 'Supply Voltage Range (Vs)',
        unit: 'V',
        part_a_value: `${fmtNum(sA.vs_min_v.value, 2)}–${fmtNum(sA.vs_max_v.value, 1)}`,
        part_b_value: `${fmtNum(sB.vs_min_v.value, 2)}–${fmtNum(sB.vs_max_v.value, 1)}`,
        winner: compareHigherBetter(sA.vs_max_v.value, sB.vs_max_v.value),
        note: `Abs max: ${fmtNum(sA.vs_abs_max_v.value, 1)} V vs ${fmtNum(sB.vs_abs_max_v.value, 1)} V.`,
      },
      {
        metric: 'Gain-Bandwidth (GBWP)',
        unit: 'MHz',
        part_a_value: sA.gbwp_mhz ? fmtNum(sA.gbwp_mhz.value, 2) : 'N/A (Comp)',
        part_b_value: sB.gbwp_mhz ? fmtNum(sB.gbwp_mhz.value, 2) : 'N/A (Comp)',
        winner: compareHigherBetter(sA.gbwp_mhz?.value, sB.gbwp_mhz?.value),
        note: 'Closed-loop bandwidth = GBWP / Noise Gain.',
      },
      {
        metric: 'Slew Rate / Prop. Delay',
        unit: 'V/µs | ns',
        part_a_value:
          sA.device_kind === 'comparator'
            ? sA.prop_delay_ns
              ? `${fmtNum(sA.prop_delay_ns.value, 0)} ns tpd`
              : '—'
            : sA.slew_rate_v_per_us
              ? `${fmtNum(sA.slew_rate_v_per_us.value, 2)} V/µs`
              : '—',
        part_b_value:
          sB.device_kind === 'comparator'
            ? sB.prop_delay_ns
              ? `${fmtNum(sB.prop_delay_ns.value, 0)} ns tpd`
              : '—'
            : sB.slew_rate_v_per_us
              ? `${fmtNum(sB.slew_rate_v_per_us.value, 2)} V/µs`
              : '—',
        winner:
          sA.device_kind === 'comparator' && sB.device_kind === 'comparator'
            ? compareLowerBetter(sA.prop_delay_ns?.value, sB.prop_delay_ns?.value)
            : sA.device_kind === 'opamp' && sB.device_kind === 'opamp'
              ? compareHigherBetter(sA.slew_rate_v_per_us?.value, sB.slew_rate_v_per_us?.value)
              : 'CONTEXT',
        note: 'Comparators specify propagation delay; op-amps specify slew rate.',
      },
      {
        metric: 'Max Input Offset (Vos)',
        unit: 'mV',
        part_a_value: fmtNum(sA.vos_max_mv.value, 3),
        part_b_value: fmtNum(sB.vos_max_mv.value, 3),
        winner: compareLowerBetter(sA.vos_max_mv.value, sB.vos_max_mv.value),
        note: 'Lower Vos improves DC sensor and shunt-sense accuracy.',
      },
      {
        metric: 'Rail-to-Rail Swing',
        unit: 'IN / OUT',
        part_a_value: `${sA.rail_to_rail_in ? 'RR-In' : 'Non-RR'} / ${sA.rail_to_rail_out ? 'RR-Out' : 'Non-RR'}`,
        part_b_value: `${sB.rail_to_rail_in ? 'RR-In' : 'Non-RR'} / ${sB.rail_to_rail_out ? 'RR-Out' : 'Non-RR'}`,
        winner: 'CONTEXT',
        note: 'Non-RR outputs clip ~1–1.5 V before the supply rails.',
      },
      {
        metric: 'Quiescent Current / Ch',
        unit: 'µA',
        part_a_value: fmtNum(sA.iq_per_ch_typ_ua.value, 1),
        part_b_value: fmtNum(sB.iq_per_ch_typ_ua.value, 1),
        winner: compareLowerBetter(sA.iq_per_ch_typ_ua.value, sB.iq_per_ch_typ_ua.value),
        note: 'Multiply by channel count for total IC standby draw.',
      },
    );
  } else {
    rows.push({
      metric: 'Device Category',
      unit: 'Class',
      part_a_value: `${a.category.toUpperCase()} (${a.sub_topology})`,
      part_b_value: `${b.category.toUpperCase()} (${b.sub_topology})`,
      winner: 'CONTEXT',
      note: 'Cross-category comparison — parts serve different circuit functions.',
    });
  }

  // Common thermal, package, temp grade & lifecycle rows for ALL categories
  rows.push(
    {
      metric: 'Package & Exposed Pad',
      unit: 'Pkg',
      part_a_value: `${a.package.code} (EP: ${a.package.exposed_pad.present ? a.package.exposed_pad.net : 'None'})`,
      part_b_value: `${b.package.code} (EP: ${b.package.exposed_pad.present ? b.package.exposed_pad.net : 'None'})`,
      winner: 'CONTEXT',
      note: `${a.package.mfg_package_code} vs ${b.package.mfg_package_code}`,
    },
    {
      metric: 'Thermal Resistance (θJA)',
      unit: '°C/W',
      part_a_value: fmtNum(a.package.theta_ja_c_per_w.value, 1),
      part_b_value: fmtNum(b.package.theta_ja_c_per_w.value, 1),
      winner: compareLowerBetter(
        a.package.theta_ja_c_per_w.value,
        b.package.theta_ja_c_per_w.value,
      ),
      note: 'Lower θJA runs cooler at equal power dissipation (check JEDEC board basis).',
    },
    {
      metric: 'Max Junction Temp (Tj,max)',
      unit: '°C',
      part_a_value: fmtNum(a.package.tj_max_c.value, 0),
      part_b_value: fmtNum(b.package.tj_max_c.value, 0),
      winner: compareHigherBetter(a.package.tj_max_c.value, b.package.tj_max_c.value),
      note: 'Maintain ≥ 15–25 °C thermal margin in production designs.',
    },
    {
      metric: 'Ambient Temp Grade',
      unit: '°C',
      part_a_value: `${a.temp_grade.ta_min_c}..${a.temp_grade.ta_max_c} (${a.temp_grade.grade_label})`,
      part_b_value: `${b.temp_grade.ta_min_c}..${b.temp_grade.ta_max_c} (${b.temp_grade.grade_label})`,
      winner: compareHigherBetter(
        a.temp_grade.ta_max_c - a.temp_grade.ta_min_c,
        b.temp_grade.ta_max_c - b.temp_grade.ta_min_c,
      ),
      note: 'Verify cold-start and hot-enclosure ambient bounds.',
    },
    {
      metric: 'Lifecycle Status',
      unit: 'Status',
      part_a_value: a.lifecycle_status,
      part_b_value: b.lifecycle_status,
      winner:
        a.lifecycle_status === b.lifecycle_status
          ? 'TIE'
          : a.lifecycle_status === 'Active'
            ? 'A'
            : b.lifecycle_status === 'Active'
              ? 'B'
              : 'CONTEXT',
      note: 'Avoid EOL/NRND devices for new production designs.',
    },
  );

  return rows;
}

/**
 * Deterministic client-side comparison engine mirroring AUD-02 & AUD-04 rules.
 */
export function comparePartsClient(
  partA: GoldenPartV2,
  partB: GoldenPartV2,
): ClientComparisonResult {
  const pkgA = partA.package;
  const pkgB = partB.package;
  const sameCategory = partA.category === partB.category;
  const packageMatch = pkgA.code === pkgB.code;
  const footprintCompatible = isFootprintCompatible(pkgA.code, pkgB.code);
  const pinCountMatch = pkgA.pin_count === pkgB.pin_count;

  const epEval = evaluateExposedPad(pkgA, pkgB);
  const exposedPadMatch = epEval.match;

  const mapA = new Map(pkgA.pinout.map((p) => [p.pin, p]));
  const mapB = new Map(pkgB.pinout.map((p) => [p.pin, p]));
  const maxPins = Math.max(pkgA.pin_count, pkgB.pin_count);

  const pinDiff: PinDiffRow[] = [];
  const diffHighlightsA: Record<number, 'MATCH' | 'MISMATCH' | 'CAUTION'> = {};
  const diffHighlightsB: Record<number, 'MATCH' | 'MISMATCH' | 'CAUTION'> = {};

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
    if (pin <= pkgA.pin_count) diffHighlightsA[pin] = res.status;
    if (pin <= pkgB.pin_count) diffHighlightsB[pin] = res.status;
    if (res.hardMismatch) hardPinMismatch = true;
    if (res.pin4NcBypass) hasPin4NcBypass = true;
    if (res.enPolarityDiff) hasEnPolarityDiff = true;
    if (!res.roleEquivalent) allRolesEquivalent = false;
  }

  const pinoutExactMatch =
    sameCategory &&
    pinCountMatch &&
    allRolesEquivalent &&
    !(
      partA.category === 'opamp' &&
      partB.category === 'opamp' &&
      partA.specs.device_kind !== partB.specs.device_kind
    );

  const swapRisks: string[] = [];
  const level3Reasons: string[] = [];
  const level2Reasons: string[] = [];

  if (!sameCategory) {
    level3Reasons.push(`cross-category (${partA.category} vs ${partB.category})`);
    swapRisks.push(
      `CRITICAL CATEGORY MISMATCH: ${partA.opn} (${partA.category.toUpperCase()}) and ${partB.opn} (${partB.category.toUpperCase()}) belong to different IC families and are not direct substitutes.`,
    );
  }

  if (!pinCountMatch || !footprintCompatible) {
    level3Reasons.push('package/footprint mismatch');
    swapRisks.push(
      `CRITICAL PACKAGE MISMATCH: ${partA.opn} uses ${pkgA.code} (${pkgA.pin_count}-pin, ${pkgA.mfg_package_code}) while ${partB.opn} uses ${pkgB.code} (${pkgB.pin_count}-pin, ${pkgB.mfg_package_code}); PCB footprint redesign is mandatory.`,
    );
  } else if (!packageMatch && footprintCompatible) {
    level2Reasons.push(`package code differs (${pkgA.code} vs ${pkgB.code})`);
    swapRisks.push(
      `CAUTION PACKAGE HEIGHT/PROFILE: ${pkgA.code} vs ${pkgB.code} share a JEDEC land pattern pitch but differ in body height (~1.0 mm vs ~1.45 mm); verify enclosure Z-clearance and SMT profile.`,
    );
  }

  if (pkgA.pinout_view !== pkgB.pinout_view) {
    swapRisks.push(
      `CAUTION DATASHEET VIEW ORIENTATION: ${partA.opn} is drawn ${pkgA.pinout_view} (p.${pkgA.pinout_source_page}) while ${partB.opn} is drawn ${pkgB.pinout_view} (p.${pkgB.pinout_source_page}); double-check Pin 1 mirroring.`,
    );
  }

  if (hardPinMismatch) {
    const conflicts = pinDiff
      .filter((d) => d.status === 'MISMATCH')
      .map((d) => `Pin ${d.pin} (${d.part_a_role} vs ${d.part_b_role})`)
      .join(', ');
    level3Reasons.push(`pinout mismatch on ${conflicts}`);
    swapRisks.push(
      `CRITICAL PINOUT CONFLICT: Incompatible pin assignments on ${conflicts}. Direct drop-in without copper rerouting risks rail short or IC destruction.`,
    );
  }

  if (!exposedPadMatch) {
    level3Reasons.push('exposed pad / thermal tab net mismatch');
    swapRisks.push(epEval.note);
  } else if (epEval.status === 'CAUTION') {
    swapRisks.push(`CAUTION EXPOSED PAD: ${epEval.note}`);
  }

  if (hasPin4NcBypass) {
    level2Reasons.push('Pin 4 NC vs BYPASS difference');
    swapRisks.push(
      'HIGH PIN 4 (NC vs BYPASS/NR) CHECK: Verify Pin 4 is NOT tied to GND or VIN on the PCB; add a 10 nF bypass cap if low noise is required.',
    );
  }

  if (hasEnPolarityDiff) {
    level2Reasons.push('Enable (EN) polarity inversion');
    swapRisks.push(
      'CRITICAL ENABLE POLARITY: Active-High vs Active-Low EN pin mismatch — existing MCU GPIO or pull resistor will invert regulator ON/OFF state.',
    );
  }

  // Category-specific checks
  if (partA.category === 'ldo' && partB.category === 'ldo') {
    const sA = partA.specs;
    const sB = partB.specs;

    if (sA.vout_fixed !== sB.vout_fixed || Math.abs(sA.vout_v.value - sB.vout_v.value) > 0.05) {
      level2Reasons.push('output voltage / fixed-vs-adjustable mismatch');
      swapRisks.push(
        `CRITICAL OUTPUT VOLTAGE DIFFERENCE: ${partA.opn} regulates ${sA.vout_v.value} V (${sA.vout_fixed ? 'fixed' : 'adj'}) vs ${partB.opn} ${sB.vout_v.value} V (${sB.vout_fixed ? 'fixed' : 'adj'}).`,
      );
    }

    if (sA.ceramic_cap_stable !== sB.ceramic_cap_stable) {
      level2Reasons.push('ceramic capacitor ESR stability difference');
      const nonCer = sA.ceramic_cap_stable ? partB : partA;
      const cer = sA.ceramic_cap_stable ? partA : partB;
      swapRisks.push(
        `CRITICAL CAPACITOR ESR OSCILLATION RISK: ${cer.opn} is ceramic-MLCC stable (≥ ${cer.specs.min_cout_uf.value} µF), whereas ${nonCer.opn} is NOT ceramic-cap stable (ESR window: ${fmtEsrWindow(nonCer.specs)}).`,
      );
    } else if (
      sA.ceramic_cap_stable &&
      Math.max(sA.min_cout_uf.value, sB.min_cout_uf.value) /
        Math.max(Math.min(sA.min_cout_uf.value, sB.min_cout_uf.value), 0.01) >=
        2.5
    ) {
      level2Reasons.push('minimum Cout differs ≥ 2.5x');
      swapRisks.push(
        `CAUTION OUTPUT CAPACITANCE: Minimum Cout differs (${partA.opn}: ${sA.min_cout_uf.value} µF vs ${partB.opn}: ${sB.min_cout_uf.value} µF); account for MLCC DC-bias derating.`,
      );
    } else if (!sA.ceramic_cap_stable && !sB.ceramic_cap_stable) {
      const loA = sA.esr_min_ohm?.value ?? 0;
      const hiA = sA.esr_max_ohm?.value ?? Number.POSITIVE_INFINITY;
      const loB = sB.esr_min_ohm?.value ?? 0;
      const hiB = sB.esr_max_ohm?.value ?? Number.POSITIVE_INFINITY;
      if (Math.max(loA, loB) > Math.min(hiA, hiB)) {
        level2Reasons.push('ESR stability windows do not overlap');
        swapRisks.push(
          `CRITICAL ESR STABILITY WINDOW: ${partA.opn} (${fmtEsrWindow(sA)}) and ${partB.opn} (${fmtEsrWindow(sB)}) have non-overlapping ESR windows.`,
        );
      }
    }

    const vinRatio =
      Math.min(sA.vin_max_v.value, sB.vin_max_v.value) /
      Math.max(sA.vin_max_v.value, sB.vin_max_v.value, 1e-9);
    if (vinRatio < 0.8) {
      level2Reasons.push('Vin,max rating drops >20%');
      swapRisks.push(
        `HIGH INPUT VOLTAGE RATING DROP: ${partA.opn} (${sA.vin_max_v.value} V rec / ${sA.vin_abs_max_v.value} V abs) vs ${partB.opn} (${sB.vin_max_v.value} V rec / ${sB.vin_abs_max_v.value} V abs).`,
      );
    }

    const absRatio =
      Math.min(sA.vin_abs_max_v.value, sB.vin_abs_max_v.value) /
      Math.max(sA.vin_abs_max_v.value, sB.vin_abs_max_v.value, 1e-9);
    if (absRatio < 0.75 && vinRatio >= 0.8) {
      swapRisks.push(
        `CAUTION ABS MAX VIN MARGIN: Absolute maximum Vin differs (${partA.opn}: ${sA.vin_abs_max_v.value} V vs ${partB.opn}: ${sB.vin_abs_max_v.value} V); verify hot-plug transient spikes.`,
      );
    }

    const ioutRatio =
      Math.min(sA.iout_max_ma.value, sB.iout_max_ma.value) /
      Math.max(sA.iout_max_ma.value, sB.iout_max_ma.value, 1e-9);
    if (ioutRatio < 0.8) {
      level2Reasons.push('Iout,max rating drops >20%');
      swapRisks.push(
        `HIGH LOAD CURRENT DERATING: ${partA.opn} (${sA.iout_max_ma.value} mA) vs ${partB.opn} (${sB.iout_max_ma.value} mA); confirm peak inrush and thermal margin.`,
      );
    }

    if (Math.abs(sA.dropout_typ_mv.value - sB.dropout_typ_mv.value) >= 500) {
      level2Reasons.push('dropout headroom differs ≥ 500 mV');
      swapRisks.push(
        `CAUTION DROPOUT HEADROOM: Typical Vdo differs by ${Math.round(Math.abs(sA.dropout_typ_mv.value - sB.dropout_typ_mv.value))} mV (${sA.dropout_typ_mv.value} mV vs ${sB.dropout_typ_mv.value} mV).`,
      );
    }
  } else if (partA.category === 'dcdc' && partB.category === 'dcdc') {
    const sA = partA.specs;
    const sB = partB.specs;

    if (sA.topology !== sB.topology) {
      level3Reasons.push(`DC-DC topology mismatch (${sA.topology} vs ${sB.topology})`);
      swapRisks.push(
        `CRITICAL TOPOLOGY DIFFERENCE: ${partA.opn} is ${sA.topology.toUpperCase()} vs ${partB.opn} ${sB.topology.toUpperCase()}; power-stage architecture and inductor placement require redesign.`,
      );
    }

    if (sA.vout_fixed && sB.vout_fixed) {
      const vA = sA.vout_nom_v?.value ?? (sA.vout_min_v.value + sA.vout_max_v.value) / 2;
      const vB = sB.vout_nom_v?.value ?? (sB.vout_min_v.value + sB.vout_max_v.value) / 2;
      const relDiff = Math.abs(vA - vB) / Math.max(vA, vB, 1e-9);
      if (relDiff > 0.2) {
        level3Reasons.push(`fixed Vout mismatch (${fmtNum(vA)} V vs ${fmtNum(vB)} V)`);
        swapRisks.push(
          `CRITICAL OUTPUT VOLTAGE RAIL MISMATCH: Fixed ${fmtNum(vA)} V vs fixed ${fmtNum(vB)} V converter — swapping delivers the wrong rail voltage.`,
        );
      } else if (relDiff > 0.02) {
        level2Reasons.push(`fixed Vout differs (${fmtNum(vA)} V vs ${fmtNum(vB)} V)`);
        swapRisks.push(
          `HIGH FIXED OUTPUT VOLTAGE DIFFERENCE: ${partA.opn} (${fmtNum(vA)} V) vs ${partB.opn} (${fmtNum(vB)} V).`,
        );
      }
    } else if (!sA.vout_fixed && !sB.vout_fixed) {
      const voutMaxRatio =
        Math.min(sA.vout_max_v.value, sB.vout_max_v.value) /
        Math.max(sA.vout_max_v.value, sB.vout_max_v.value, 1e-9);
      if (voutMaxRatio < 0.8) {
        level2Reasons.push('adjustable Vout,max drops >20%');
        swapRisks.push(
          `HIGH OUTPUT RANGE LIMIT: Max programmable Vout differs (${partA.opn}: ${sA.vout_max_v.value} V vs ${partB.opn}: ${sB.vout_max_v.value} V).`,
        );
      }
    }

    if (sA.synchronous !== sB.synchronous) {
      level2Reasons.push('synchronous vs non-synchronous rectification differs');
      const asyncPart = sA.synchronous ? partB : partA;
      swapRisks.push(
        `HIGH RECTIFICATION DIFFERENCE: ${asyncPart.opn} is non-synchronous and requires an external Schottky catch/freewheeling diode.`,
      );
    }

    const fswRelDiff =
      Math.abs(sA.fsw_typ_khz.value - sB.fsw_typ_khz.value) /
      Math.max(sA.fsw_typ_khz.value, sB.fsw_typ_khz.value, 1);
    if (fswRelDiff > 0.3) {
      level2Reasons.push('switching frequency differs >30%');
      swapRisks.push(
        `HIGH SWITCHING FREQUENCY SHIFT: fsw differs by ${Math.round(fswRelDiff * 100)}% (${sA.fsw_typ_khz.value} kHz vs ${sB.fsw_typ_khz.value} kHz); re-verify inductor ripple, core loss, and EMI.`,
      );
    }

    if (sA.vout_fixed !== sB.vout_fixed) {
      level2Reasons.push('fixed vs adjustable feedback configuration differs');
      swapRisks.push(
        'HIGH FEEDBACK CONFIGURATION: One converter is fixed-output while the other requires an external R1/R2 divider.',
      );
    } else if (
      sA.vref_v &&
      sB.vref_v &&
      Math.abs(sA.vref_v.value - sB.vref_v.value) /
        Math.max(sA.vref_v.value, sB.vref_v.value) >
        0.02
    ) {
      level2Reasons.push('feedback Vref differs');
      swapRisks.push(
        `HIGH VREF MISMATCH: Feedback reference differs (${sA.vref_v.value} V vs ${sB.vref_v.value} V); recalculate R1/R2 before swapping.`,
      );
    }

    const vinRatio =
      Math.min(sA.vin_max_v.value, sB.vin_max_v.value) /
      Math.max(sA.vin_max_v.value, sB.vin_max_v.value, 1e-9);
    if (vinRatio < 0.8) {
      level2Reasons.push('Vin,max drops >20%');
      swapRisks.push(
        `HIGH INPUT VOLTAGE RANGE SHIFT: Recommended Vin,max differs (${sA.vin_max_v.value} V vs ${sB.vin_max_v.value} V).`,
      );
    }
  } else if (partA.category === 'opamp' && partB.category === 'opamp') {
    const sA = partA.specs;
    const sB = partB.specs;

    if (sA.device_kind !== sB.device_kind) {
      level3Reasons.push(`device kind mismatch (${sA.device_kind} vs ${sB.device_kind})`);
      const anyOpen = isOpenOutput(sA.output_type) || isOpenOutput(sB.output_type);
      swapRisks.push(
        `CRITICAL OP-AMP VS COMPARATOR TRAP: ${partA.opn} (${sA.device_kind}, ${sA.output_type}) vs ${partB.opn} (${sB.device_kind}, ${sB.output_type}). Comparators are uncompensated and oscillate in linear negative feedback; op-amps suffer slow overdrive recovery as comparators.${anyOpen ? ' Open-collector/drain outputs also require an external pull-up resistor.' : ''}`,
      );
    } else if (sA.output_type !== sB.output_type) {
      level2Reasons.push(`output stage differs (${sA.output_type} vs ${sB.output_type})`);
      swapRisks.push(
        `CRITICAL OUTPUT STAGE DIFFERENCE: ${partA.opn} (${sA.output_type}) vs ${partB.opn} (${sB.output_type}) — verify external pull-up resistor requirements and back-drive risk.`,
      );
    }

    const vsRatio =
      Math.min(sA.vs_max_v.value, sB.vs_max_v.value) /
      Math.max(sA.vs_max_v.value, sB.vs_max_v.value, 1e-9);
    if (vsRatio < 0.8) {
      level2Reasons.push('Vs,max drops >20%');
      swapRisks.push(
        `CRITICAL SUPPLY VOLTAGE RATING: ${partA.opn} (${sA.vs_max_v.value} V max) vs ${partB.opn} (${sB.vs_max_v.value} V max); installing a 5.5 V CMOS part on a 12–24 V rail causes instant breakdown.`,
      );
    }

    if (sA.rail_to_rail_in !== sB.rail_to_rail_in || sA.rail_to_rail_out !== sB.rail_to_rail_out) {
      level2Reasons.push('rail-to-rail swing differs');
      swapRisks.push(
        `HIGH HEADROOM / CLIPPING RISK: Rail-to-rail capability differs (${partA.opn}: IN=${sA.rail_to_rail_in ? 'RR' : 'Non-RR'}, OUT=${sA.rail_to_rail_out ? 'RR' : 'Non-RR'} vs ${partB.opn}: IN=${sB.rail_to_rail_in ? 'RR' : 'Non-RR'}, OUT=${sB.rail_to_rail_out ? 'RR' : 'Non-RR'}).`,
      );
    }

    if (sA.gbwp_mhz && sB.gbwp_mhz) {
      const ratio =
        Math.max(sA.gbwp_mhz.value, sB.gbwp_mhz.value) /
        Math.max(Math.min(sA.gbwp_mhz.value, sB.gbwp_mhz.value), 0.001);
      if (ratio >= 3) {
        level2Reasons.push('GBWP differs ≥ 3x');
        swapRisks.push(
          `CAUTION BANDWIDTH & PHASE MARGIN: GBWP differs ${fmtNum(ratio, 1)}x (${sA.gbwp_mhz.value} MHz vs ${sB.gbwp_mhz.value} MHz); check capacitive-load stability.`,
        );
      }
    }
  }

  // Lifecycle, Thermal θJA & Temp Grade guards (all categories)
  for (const p of [partA, partB]) {
    if (p.lifecycle_status === 'EOL' || p.lifecycle_status === 'NRND') {
      swapRisks.push(
        `CAUTION LIFECYCLE STATUS (${p.lifecycle_status}): ${p.opn} is flagged ${p.lifecycle_status} by ${p.manufacturer}; prefer Active alternatives for new designs.`,
      );
    }
  }

  const thetaLo = Math.min(pkgA.theta_ja_c_per_w.value, pkgB.theta_ja_c_per_w.value);
  const thetaHi = Math.max(pkgA.theta_ja_c_per_w.value, pkgB.theta_ja_c_per_w.value);
  const thetaIncrease = (thetaHi - thetaLo) / Math.max(thetaLo, 1e-9);
  if (thetaIncrease >= 0.25) {
    const worseP = pkgA.theta_ja_c_per_w.value > pkgB.theta_ja_c_per_w.value ? partA : partB;
    if (thetaIncrease >= 0.4) {
      level2Reasons.push(`θJA worsens ${Math.round(thetaIncrease * 100)}%`);
    }
    swapRisks.push(
      `${thetaIncrease >= 0.4 ? 'HIGH' : 'CAUTION'} THERMAL MARGIN: Package θJA is ${Math.round(thetaIncrease * 100)}% higher on ${worseP.opn} (${pkgA.theta_ja_c_per_w.value} °C/W vs ${pkgB.theta_ja_c_per_w.value} °C/W); re-check Tj = Ta + Pd × θJA.`,
    );
  }

  const tgA = partA.temp_grade;
  const tgB = partB.temp_grade;
  if (tgA.ta_min_c !== tgB.ta_min_c || tgA.ta_max_c !== tgB.ta_max_c) {
    swapRisks.push(
      `CAUTION TEMPERATURE GRADE: Ambient range differs (${partA.opn}: ${tgA.ta_min_c}..${tgA.ta_max_c} °C vs ${partB.opn}: ${tgB.ta_min_c}..${tgB.ta_max_c} °C); confirm cold/hot enclosure limits.`,
    );
  }

  let compatibilityLevel: CompatibilityLevel;
  if (level3Reasons.length > 0) {
    compatibilityLevel = 'LEVEL_3_LAYOUT_CHANGE';
  } else if (level2Reasons.length > 0) {
    compatibilityLevel = 'LEVEL_2_TUNING_REQUIRED';
  } else {
    compatibilityLevel = 'LEVEL_1_CANDIDATE_DROP_IN';
  }

  if (swapRisks.length === 0) {
    swapRisks.push(
      `BENCH VERIFICATION: Confirm thermal dissipation margin (θJA ${pkgA.theta_ja_c_per_w.value} vs ${pkgB.theta_ja_c_per_w.value} °C/W) and latest datasheet revisions (${partA.datasheet.revision} vs ${partB.datasheet.revision}) prior to production release.`,
    );
  }

  const engineeringVerdict =
    compatibilityLevel === 'LEVEL_1_CANDIDATE_DROP_IN'
      ? `${partA.opn} and ${partB.opn} share an identical ${pkgA.code} footprint, pinout, and core electrical envelope — evaluated as a Candidate Drop-In pair. Bench-verify thermal margin, transient response, and latest official datasheets before production release.`
      : compatibilityLevel === 'LEVEL_2_TUNING_REQUIRED'
        ? `${partA.opn} vs ${partB.opn} shares compatible pad geometry, but passive tuning or rating verification is required (${level2Reasons.slice(0, 3).join('; ')}). Review every swap risk below before testing on hardware.`
        : `${partA.opn} vs ${partB.opn} is NOT drop-in compatible (${level3Reasons.slice(0, 3).join('; ')}). PCB layout or circuit redesign is required before substitution.`;

  const canonicalVsSlug = [partA.slug, partB.slug].sort().join('-vs-');

  return {
    compatibilityLevel,
    compatibilityBadge: COMPATIBILITY_BADGES[compatibilityLevel],
    sameCategory,
    packageMatch,
    footprintCompatible,
    pinoutExactMatch,
    exposedPadMatch,
    epDiffStatus: epEval.status,
    epNote: epEval.note,
    pinDiff,
    diffHighlightsA,
    diffHighlightsB,
    parameterRows: buildParameterRows(partA, partB),
    swapRisks,
    engineeringVerdict,
    canonicalVsSlug,
  };
}

/* -------------------------------------------------------------------------- */
/* Reverse Pinout Matcher & PCB Footprint Finder                              */
/* -------------------------------------------------------------------------- */

export interface PinoutQuery {
  packageCode: PackageCode | 'ALL';
  allowFootprintCompat?: boolean;
  /** Pin number (1-indexed) -> required PinRole or 'ANY' */
  pinRoles: Record<number, PinRole | 'ANY'>;
  exposedPadNet?: 'ANY' | 'NONE' | 'GND_ANY' | 'VOUT' | 'VIN' | 'SW' | 'FLOATING';
  category?: PartCategory | 'ALL';
  activeOnly?: boolean;
  ceramicOnly?: boolean;
  minIoutMa?: number | null;
  maxIqUa?: number | null;
  minVinMaxV?: number | null;
}

export interface PinoutMatchItem {
  part: GoldenPartV2;
  matchKind: 'EXACT' | 'PARTIAL';
  matchedPins: number;
  constrainedPins: number;
  cautionPins: number[];
  mismatchPins: number[];
  epMatched: boolean;
  footprintVariantNote: string | null;
  score: number;
}

function pinRoleMatchesQuery(part: GoldenPartV2, pinRole: PinRole, wanted: PinRole): 'EXACT' | 'CAUTION' | 'MISMATCH' {
  if (pinRole === wanted) return 'EXACT';
  // Op-amp supply rail aliases
  if (part.category === 'opamp') {
    if ((pinRole === 'VEE' && wanted === 'GND') || (pinRole === 'GND' && wanted === 'VEE')) return 'EXACT';
    if ((pinRole === 'VCC' && wanted === 'VIN') || (pinRole === 'VIN' && wanted === 'VCC')) return 'EXACT';
  }
  // Fixed LDO GND/ADJ alias
  if (
    part.category === 'ldo' &&
    part.specs.vout_fixed &&
    ((pinRole === 'ADJ' && wanted === 'GND') || (pinRole === 'GND' && wanted === 'ADJ'))
  ) {
    return 'CAUTION';
  }
  // Pin 4 NC <-> BYPASS caution match
  if ((pinRole === 'NC' && wanted === 'BYPASS') || (pinRole === 'BYPASS' && wanted === 'NC')) {
    return 'CAUTION';
  }
  // DC-DC FB <-> VOUT caution match
  if (
    part.category === 'dcdc' &&
    ((pinRole === 'FB' && wanted === 'VOUT') || (pinRole === 'VOUT' && wanted === 'FB'))
  ) {
    return 'CAUTION';
  }
  return 'MISMATCH';
}

function getPartCurrentMa(p: GoldenPartV2): number | null {
  if (p.category === 'ldo') return p.specs.iout_max_ma.value;
  if (p.category === 'dcdc') return p.specs.iout_or_isw_max_ma.value;
  return p.specs.iout_short_ma?.value ?? null;
}

function getPartIqUa(p: GoldenPartV2): number {
  if (p.category === 'opamp') return p.specs.iq_per_ch_typ_ua.value;
  return p.specs.iq_typ_ua.value;
}

function getPartVinMax(p: GoldenPartV2): number {
  if (p.category === 'opamp') return p.specs.vs_max_v.value;
  return p.specs.vin_max_v.value;
}

export function matchPinoutQuery(
  parts: GoldenPartV2[],
  query: PinoutQuery,
): { exact: PinoutMatchItem[]; partial: PinoutMatchItem[] } {
  const exact: PinoutMatchItem[] = [];
  const partial: PinoutMatchItem[] = [];

  const activePinConstraints = Object.entries(query.pinRoles)
    .map(([k, v]) => [Number(k), v] as [number, PinRole | 'ANY'])
    .filter(([, v]) => v !== 'ANY');

  for (const part of parts) {
    if (query.category && query.category !== 'ALL' && part.category !== query.category) {
      continue;
    }
    if (query.activeOnly && part.lifecycle_status !== 'Active') {
      continue;
    }
    if (query.ceramicOnly && (part.category !== 'ldo' || !part.specs.ceramic_cap_stable)) {
      continue;
    }
    if (query.minIoutMa !== null && query.minIoutMa !== undefined && query.minIoutMa > 0) {
      const cur = getPartCurrentMa(part);
      if (cur === null || cur < query.minIoutMa) continue;
    }
    if (query.maxIqUa !== null && query.maxIqUa !== undefined && query.maxIqUa > 0) {
      if (getPartIqUa(part) > query.maxIqUa) continue;
    }
    if (query.minVinMaxV !== null && query.minVinMaxV !== undefined && query.minVinMaxV > 0) {
      if (getPartVinMax(part) < query.minVinMaxV) continue;
    }

    // Package filter
    let footprintVariantNote: string | null = null;
    if (query.packageCode !== 'ALL') {
      if (part.package.code !== query.packageCode) {
        if (
          query.allowFootprintCompat !== false &&
          isFootprintCompatible(part.package.code, query.packageCode)
        ) {
          footprintVariantNote = `Shared JEDEC land pattern (${part.package.code} vs ${query.packageCode} — verify body height)`;
        } else {
          continue;
        }
      }
    }

    // Exposed pad filter
    let epMatched = true;
    const epPresent = part.package.exposed_pad.present;
    const epNet = part.package.exposed_pad.net;
    if (query.exposedPadNet && query.exposedPadNet !== 'ANY') {
      if (query.exposedPadNet === 'NONE') {
        epMatched = !epPresent;
      } else if (query.exposedPadNet === 'GND_ANY') {
        epMatched = epPresent && GND_EP_SET.has(epNet);
      } else {
        epMatched = epPresent && epNet === query.exposedPadNet;
      }
    }

    const pinMap = new Map(part.package.pinout.map((p) => [p.pin, p]));
    let matchedPins = 0;
    const cautionPins: number[] = [];
    const mismatchPins: number[] = [];

    for (const [pinNum, wantedRole] of activePinConstraints) {
      if (wantedRole === 'ANY') continue;
      const entry = pinMap.get(pinNum);
      if (!entry) {
        mismatchPins.push(pinNum);
        continue;
      }
      const res = pinRoleMatchesQuery(part, entry.role, wantedRole);
      if (res === 'EXACT') {
        matchedPins += 1;
      } else if (res === 'CAUTION') {
        matchedPins += 1;
        cautionPins.push(pinNum);
      } else {
        mismatchPins.push(pinNum);
      }
    }

    const constrainedPins = activePinConstraints.length;
    const isExact =
      mismatchPins.length === 0 &&
      cautionPins.length === 0 &&
      epMatched &&
      footprintVariantNote === null;

    // Exclude parts with 0 pin matches when user constrained >= 2 pins
    if (constrainedPins >= 2 && matchedPins === 0) {
      continue;
    }
    // Exclude if > 2 pins mismatch on small packages
    if (constrainedPins >= 3 && mismatchPins.length > Math.ceil(constrainedPins / 2)) {
      continue;
    }

    const lifecycleBonus = part.lifecycle_status === 'Active' ? 10 : part.lifecycle_status === 'NRND' ? -10 : -20;
    const score =
      (constrainedPins > 0 ? (matchedPins / constrainedPins) * 100 : 100) -
      cautionPins.length * 8 -
      mismatchPins.length * 25 -
      (epMatched ? 0 : 30) -
      (footprintVariantNote ? 5 : 0) +
      lifecycleBonus;

    const item: PinoutMatchItem = {
      part,
      matchKind: isExact ? 'EXACT' : 'PARTIAL',
      matchedPins,
      constrainedPins,
      cautionPins,
      mismatchPins,
      epMatched,
      footprintVariantNote,
      score,
    };

    if (isExact) {
      exact.push(item);
    } else {
      partial.push(item);
    }
  }

  exact.sort((a, b) => b.score - a.score || a.part.opn.localeCompare(b.part.opn));
  partial.sort((a, b) => b.score - a.score || a.part.opn.localeCompare(b.part.opn));

  return { exact, partial };
}
