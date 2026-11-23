'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { CompatibilityLevel, PackageInfo, PartRecord, PinEntry, PinRole } from '@/types/schema';
import { trackEvent } from '@/lib/analytics';
import { categoryShortLabel, fmtNum, getCompatibilityStyle } from '@/lib/format';
import { VsPinoutComparisonView, type DiffStatus, type EpDiffStatus } from '@/components/PackagePinoutSvg';

export interface CompareWorkbenchProps {
  parts: PartRecord[];
  existingVsSlugs: string[];
}

/* ------------------------------------------------------------------------------------------------
 * Pure comparison helpers (exported for reuse by PackageTrapMatrixClient)
 * ---------------------------------------------------------------------------------------------- */

export interface WorkbenchPinDiffRow {
  pin: number;
  a: PinEntry | null;
  b: PinEntry | null;
  status: DiffStatus;
  note: string;
}

export function normalizeEpNet(pkg: PackageInfo): string {
  if (!pkg.exposed_pad.present) return 'NONE';
  return pkg.exposed_pad.net === 'THERMAL_GND_RECOMMENDED' ? 'GND' : pkg.exposed_pad.net;
}

/** Role-based normalized pinout signature: `1:VIN,2:GND,...|EP:GND`. */
export function pinoutSignature(pkg: PackageInfo): string {
  const pins = [...pkg.pinout].sort((x, y) => x.pin - y.pin).map((p) => `${p.pin}:${p.role}`);
  return `${pins.join(',')}|EP:${normalizeEpNet(pkg)}`;
}

const NC_TOLERANT_ROLES: PinRole[] = ['EN', 'BYPASS', 'SS', 'PG', 'MODE', 'SYNC', 'PS', 'OTHER', 'COMP', 'VREF'];
const CAUTION_ROLE_PAIRS: Array<[PinRole, PinRole, string]> = [
  ['ADJ', 'FB', 'ADJ vs FB — both set Vout through a divider, but reference voltage may differ; recalculate resistors.'],
  ['GND', 'VEE', 'GND vs VEE — equivalent only in single-supply designs.'],
  ['VIN', 'VCC', 'VIN vs VCC — supply pin naming differs; confirm voltage range.'],
  ['MODE', 'SYNC', 'MODE vs SYNC — mode/sync function differs; check tie-off level.'],
  ['MODE', 'PS', 'MODE vs PS — power-save control semantics differ; check tie-off level.'],
  ['BYPASS', 'NC', 'BYPASS vs NC — noise-bypass capacitor becomes unused / missing.'],
];

function rolePairCaution(ra: PinRole, rb: PinRole): string | null {
  for (const [x, y, note] of CAUTION_ROLE_PAIRS) {
    if ((ra === x && rb === y) || (ra === y && rb === x)) return note;
  }
  return null;
}

export function computePinDiff(pkgA: PackageInfo, pkgB: PackageInfo): WorkbenchPinDiffRow[] {
  const maxPin = Math.max(
    pkgA.pin_count,
    pkgB.pin_count,
    ...pkgA.pinout.map((p) => p.pin),
    ...pkgB.pinout.map((p) => p.pin),
  );
  const rows: WorkbenchPinDiffRow[] = [];
  for (let n = 1; n <= maxPin; n++) {
    const a = pkgA.pinout.find((p) => p.pin === n) ?? null;
    const b = pkgB.pinout.find((p) => p.pin === n) ?? null;
    if (!a || !b) {
      rows.push({
        pin: n,
        a,
        b,
        status: 'MISMATCH',
        note: `Pin ${n} does not exist on Part ${a ? 'B' : 'A'} (${pkgA.pin_count}-pin vs ${pkgB.pin_count}-pin) — footprint change required.`,
      });
      continue;
    }
    if (a.role === b.role) {
      const sameName = a.name.trim().toUpperCase() === b.name.trim().toUpperCase();
      rows.push({
        pin: n,
        a,
        b,
        status: 'MATCH',
        note: sameName ? 'Same function.' : `Same function (datasheet name differs: ${a.name} vs ${b.name}).`,
      });
      continue;
    }
    const pairNote = rolePairCaution(a.role, b.role);
    if (pairNote) {
      rows.push({ pin: n, a, b, status: 'CAUTION', note: pairNote });
      continue;
    }
    if (a.role === 'NC' || b.role === 'NC') {
      const other = a.role === 'NC' ? b : a;
      const ncSide = a.role === 'NC' ? 'A' : 'B';
      if (NC_TOLERANT_ROLES.includes(other.role)) {
        rows.push({
          pin: n,
          a,
          b,
          status: 'CAUTION',
          note: `Part ${ncSide} is NC where the other part has ${other.role} (${other.name}) — verify the existing PCB tie-off is safe for both parts.`,
        });
        continue;
      }
    }
    rows.push({
      pin: n,
      a,
      b,
      status: 'MISMATCH',
      note: `Function conflict: ${a.role} (${a.name}) vs ${b.role} (${b.name}) — PCB re-route required.`,
    });
  }
  return rows;
}

export function computeEpStatus(pkgA: PackageInfo, pkgB: PackageInfo): { status: EpDiffStatus; note: string } {
  const na = normalizeEpNet(pkgA);
  const nb = normalizeEpNet(pkgB);
  if (na === 'NONE' && nb === 'NONE') return { status: 'MATCH', note: 'Neither part has an exposed pad or thermal tab.' };
  if (na === nb) return { status: 'MATCH', note: `Both pads/tabs are tied to ${na}.` };
  const soft = (n: string) => n === 'GND' || n === 'FLOATING' || n === 'NONE';
  if (soft(na) && soft(nb)) {
    return {
      status: 'CAUTION',
      note: `Pad/tab differs (A: ${na}, B: ${nb}) — electrically tolerable on a GND pour, but θJA and thermal copper differ.`,
    };
  }
  return {
    status: 'MISMATCH',
    note: `Pad/tab net conflict (A: ${na}, B: ${nb}) — a live ${[na, nb].find((n) => !soft(n))} tab on a GND pour (or vice versa) shorts the rail.`,
  };
}

interface VerdictReason {
  severity: 'L3' | 'L2' | 'INFO';
  text: string;
}

function pct(a: number, b: number): number {
  if (!a) return 0;
  return ((b - a) / Math.abs(a)) * 100;
}

function electricalReasons(a: PartRecord, b: PartRecord): VerdictReason[] {
  const r: VerdictReason[] = [];
  if (a.category !== b.category) {
    r.push({ severity: 'L3', text: `Different device categories (${categoryShortLabel(a.category)} vs ${categoryShortLabel(b.category)}) — not functionally interchangeable.` });
    return r;
  }
  if (a.category === 'ldo' && b.category === 'ldo') {
    const sa = a.specs;
    const sb = b.specs;
    if (sa.vout_fixed !== sb.vout_fixed) r.push({ severity: 'L2', text: 'Fixed vs adjustable output — feedback divider must be added/removed.' });
    else if (sa.vout_fixed && Math.abs(sa.vout_v.value - sb.vout_v.value) > 0.01)
      r.push({ severity: 'L3', text: `Fixed output voltage differs (${fmtNum(sa.vout_v.value)} V vs ${fmtNum(sb.vout_v.value)} V).` });
    if (sb.iout_max_ma.value < sa.iout_max_ma.value)
      r.push({ severity: 'L2', text: `Part B rated output current is lower (${fmtNum(sb.iout_max_ma.value, 0)} mA vs ${fmtNum(sa.iout_max_ma.value, 0)} mA).` });
    if (sb.vin_max_v.value < sa.vin_max_v.value)
      r.push({ severity: 'L2', text: `Part B max input is lower (${fmtNum(sb.vin_max_v.value)} V vs ${fmtNum(sa.vin_max_v.value)} V).` });
    if (sb.vin_min_v.value > sa.vin_min_v.value + 0.05)
      r.push({ severity: 'L2', text: `Part B min input is higher (${fmtNum(sb.vin_min_v.value)} V vs ${fmtNum(sa.vin_min_v.value)} V).` });
    if (sb.dropout_typ_mv.value > sa.dropout_typ_mv.value * 1.25)
      r.push({ severity: 'L2', text: `Part B dropout is higher (${fmtNum(sb.dropout_typ_mv.value, 0)} mV vs ${fmtNum(sa.dropout_typ_mv.value, 0)} mV typ).` });
    if (sa.ceramic_cap_stable && !sb.ceramic_cap_stable)
      r.push({ severity: 'L2', text: 'Part B is not ceramic-cap stable — output capacitor ESR window must be re-checked.' });
    if (sb.min_cout_uf.value > sa.min_cout_uf.value)
      r.push({ severity: 'L2', text: `Part B needs larger min Cout (${fmtNum(sb.min_cout_uf.value)} µF vs ${fmtNum(sa.min_cout_uf.value)} µF).` });
    if (sa.en_active_high !== null && sb.en_active_high !== null && sa.en_active_high !== sb.en_active_high)
      r.push({ severity: 'L2', text: 'Enable (EN) polarity differs.' });
    if (sb.iq_typ_ua.value > sa.iq_typ_ua.value * 2)
      r.push({ severity: 'INFO', text: `Part B quiescent current is higher (${fmtNum(sb.iq_typ_ua.value)} µA vs ${fmtNum(sa.iq_typ_ua.value)} µA).` });
  } else if (a.category === 'dcdc' && b.category === 'dcdc') {
    const sa = a.specs;
    const sb = b.specs;
    if (sa.topology !== sb.topology) r.push({ severity: 'L3', text: `Topology differs (${sa.topology} vs ${sb.topology}).` });
    if (sb.iout_or_isw_max_ma.value < sa.iout_or_isw_max_ma.value)
      r.push({ severity: 'L2', text: `Part B current rating is lower (${fmtNum(sb.iout_or_isw_max_ma.value, 0)} mA vs ${fmtNum(sa.iout_or_isw_max_ma.value, 0)} mA).` });
    if (sa.is_switch_limit !== sb.is_switch_limit)
      r.push({ severity: 'L2', text: 'One rating is a switch-current limit, the other an output-current rating — recompute Ipeak headroom.' });
    if (sb.vin_max_v.value < sa.vin_max_v.value)
      r.push({ severity: 'L2', text: `Part B max input is lower (${fmtNum(sb.vin_max_v.value)} V vs ${fmtNum(sa.vin_max_v.value)} V).` });
    if (sb.vin_min_v.value > sa.vin_min_v.value + 0.05)
      r.push({ severity: 'L2', text: `Part B min input is higher (${fmtNum(sb.vin_min_v.value)} V vs ${fmtNum(sa.vin_min_v.value)} V).` });
    if (Math.abs(pct(sa.fsw_typ_khz.value, sb.fsw_typ_khz.value)) > 25)
      r.push({ severity: 'L2', text: `Switching frequency differs (${fmtNum(sa.fsw_typ_khz.value, 0)} kHz vs ${fmtNum(sb.fsw_typ_khz.value, 0)} kHz) — inductor & Cout retune.` });
    if (Math.abs(pct(sa.inductor_typ_uh.value, sb.inductor_typ_uh.value)) > 30)
      r.push({ severity: 'L2', text: `Recommended inductor differs (${fmtNum(sa.inductor_typ_uh.value)} µH vs ${fmtNum(sb.inductor_typ_uh.value)} µH).` });
    if (sa.vref_v && sb.vref_v && Math.abs(pct(sa.vref_v.value, sb.vref_v.value)) > 1)
      r.push({ severity: 'L2', text: `Feedback reference differs (${fmtNum(sa.vref_v.value, 3)} V vs ${fmtNum(sb.vref_v.value, 3)} V) — recalculate FB divider.` });
    if (sa.vout_fixed && sb.vout_fixed && sa.vout_nom_v && sb.vout_nom_v && Math.abs(sa.vout_nom_v.value - sb.vout_nom_v.value) > 0.01)
      r.push({ severity: 'L3', text: `Fixed output voltage differs (${fmtNum(sa.vout_nom_v.value)} V vs ${fmtNum(sb.vout_nom_v.value)} V).` });
    if (sa.vout_fixed !== sb.vout_fixed) r.push({ severity: 'L2', text: 'Fixed vs adjustable output — feedback network differs.' });
    if (sb.min_cout_uf.value > sa.min_cout_uf.value)
      r.push({ severity: 'L2', text: `Part B needs larger min Cout (${fmtNum(sb.min_cout_uf.value)} µF vs ${fmtNum(sa.min_cout_uf.value)} µF).` });
    if (sa.en_active_high !== null && sb.en_active_high !== null && sa.en_active_high !== sb.en_active_high)
      r.push({ severity: 'L2', text: 'Enable (EN) polarity differs.' });
    if (sa.synchronous !== sb.synchronous)
      r.push({ severity: 'INFO', text: `Rectification differs (${sa.synchronous ? 'synchronous' : 'async'} vs ${sb.synchronous ? 'synchronous' : 'async / external diode'}).` });
  } else if (a.category === 'opamp' && b.category === 'opamp') {
    const sa = a.specs;
    const sb = b.specs;
    if (sa.device_kind !== sb.device_kind)
      r.push({ severity: 'L3', text: `Device kind differs (${sa.device_kind} vs ${sb.device_kind}) — an op-amp is not a comparator substitute.` });
    if (sa.channels !== sb.channels) r.push({ severity: 'L3', text: `Channel count differs (${sa.channels} vs ${sb.channels}).` });
    if (sa.gbwp_mhz && sb.gbwp_mhz && sb.gbwp_mhz.value < sa.gbwp_mhz.value * 0.8)
      r.push({ severity: 'L2', text: `Part B GBW is lower (${fmtNum(sb.gbwp_mhz.value)} MHz vs ${fmtNum(sa.gbwp_mhz.value)} MHz).` });
    if (sa.slew_rate_v_per_us && sb.slew_rate_v_per_us && sb.slew_rate_v_per_us.value < sa.slew_rate_v_per_us.value * 0.8)
      r.push({ severity: 'L2', text: `Part B slew rate is lower (${fmtNum(sb.slew_rate_v_per_us.value)} V/µs vs ${fmtNum(sa.slew_rate_v_per_us.value)} V/µs).` });
    if (sa.prop_delay_ns && sb.prop_delay_ns && sb.prop_delay_ns.value > sa.prop_delay_ns.value * 1.5)
      r.push({ severity: 'L2', text: `Part B propagation delay is longer (${fmtNum(sb.prop_delay_ns.value, 0)} ns vs ${fmtNum(sa.prop_delay_ns.value, 0)} ns).` });
    if (sb.vs_max_v.value < sa.vs_max_v.value)
      r.push({ severity: 'L2', text: `Part B max supply is lower (${fmtNum(sb.vs_max_v.value)} V vs ${fmtNum(sa.vs_max_v.value)} V).` });
    if (sb.vs_min_v.value > sa.vs_min_v.value + 0.05)
      r.push({ severity: 'L2', text: `Part B min supply is higher (${fmtNum(sb.vs_min_v.value)} V vs ${fmtNum(sa.vs_min_v.value)} V).` });
    if (sa.rail_to_rail_in && !sb.rail_to_rail_in) r.push({ severity: 'L2', text: 'Part B input is not rail-to-rail.' });
    if (sa.rail_to_rail_out && !sb.rail_to_rail_out) r.push({ severity: 'L2', text: 'Part B output is not rail-to-rail.' });
    if (sa.output_type !== sb.output_type)
      r.push({ severity: 'L2', text: `Output stage differs (${sa.output_type} vs ${sb.output_type}) — pull-up resistor requirement changes.` });
    if (sb.vos_max_mv.value > sa.vos_max_mv.value * 2)
      r.push({ severity: 'L2', text: `Part B offset voltage is higher (${fmtNum(sb.vos_max_mv.value)} mV vs ${fmtNum(sa.vos_max_mv.value)} mV max).` });
  }
  // Common thermal & environmental checks
  if (b.package.theta_ja_c_per_w.value > a.package.theta_ja_c_per_w.value * 1.15)
    r.push({ severity: 'L2', text: `Part B θJA is higher (${fmtNum(b.package.theta_ja_c_per_w.value, 1)} °C/W vs ${fmtNum(a.package.theta_ja_c_per_w.value, 1)} °C/W) — re-run thermal budget.` });
  if (b.package.tj_max_c.value < a.package.tj_max_c.value)
    r.push({ severity: 'L2', text: `Part B Tj,max is lower (${fmtNum(b.package.tj_max_c.value, 0)} °C vs ${fmtNum(a.package.tj_max_c.value, 0)} °C).` });
  if (b.temp_grade.ta_max_c < a.temp_grade.ta_max_c || b.temp_grade.ta_min_c > a.temp_grade.ta_min_c)
    r.push({ severity: 'L2', text: `Part B ambient range is narrower (${b.temp_grade.ta_min_c}…${b.temp_grade.ta_max_c} °C vs ${a.temp_grade.ta_min_c}…${a.temp_grade.ta_max_c} °C).` });
  if (b.lifecycle_status !== 'Active')
    r.push({ severity: 'INFO', text: `Part B lifecycle status: ${b.lifecycle_status}.` });
  return r;
}

export interface WorkbenchVerdict {
  level: CompatibilityLevel;
  reasons: VerdictReason[];
  pinRows: WorkbenchPinDiffRow[];
  ep: { status: EpDiffStatus; note: string };
  packageMatch: boolean;
}

export function computeVerdict(a: PartRecord, b: PartRecord): WorkbenchVerdict {
  const pinRows = computePinDiff(a.package, b.package);
  const ep = computeEpStatus(a.package, b.package);
  const packageMatch = a.package.code === b.package.code;
  const reasons: VerdictReason[] = [];
  if (!packageMatch) reasons.push({ severity: 'L3', text: `Package differs (${a.package.code} vs ${b.package.code}) — Level 1 is never assigned across packages.` });
  const mismatches = pinRows.filter((r) => r.status === 'MISMATCH').length;
  const cautions = pinRows.filter((r) => r.status === 'CAUTION').length;
  if (mismatches > 0) reasons.push({ severity: 'L3', text: `${mismatches} pin function mismatch${mismatches > 1 ? 'es' : ''}.` });
  if (ep.status === 'MISMATCH') reasons.push({ severity: 'L3', text: ep.note });
  if (cautions > 0) reasons.push({ severity: 'L2', text: `${cautions} pin${cautions > 1 ? 's' : ''} need tie-off / naming review.` });
  if (ep.status === 'CAUTION') reasons.push({ severity: 'L2', text: ep.note });
  reasons.push(...electricalReasons(a, b));
  const level: CompatibilityLevel = reasons.some((r) => r.severity === 'L3')
    ? 'LEVEL_3_LAYOUT_CHANGE'
    : reasons.some((r) => r.severity === 'L2')
      ? 'LEVEL_2_TUNING_REQUIRED'
      : 'LEVEL_1_CANDIDATE_DROP_IN';
  return { level, reasons, pinRows, ep, packageMatch };
}

/* ------------------------------------------------------------------------------------------------
 * Parameter diff table
 * ---------------------------------------------------------------------------------------------- */

type Better = 'higher' | 'lower' | 'context';
interface ParamRow {
  group: string;
  metric: string;
  unit: string;
  a: number | string | null;
  b: number | string | null;
  better: Better;
}

function specRows(p: PartRecord | null, other: PartRecord | null): Map<string, ParamRow> {
  void other;
  const m = new Map<string, ParamRow>();
  if (!p) return m;
  const add = (group: string, metric: string, unit: string, val: number | string | null | undefined, better: Better) =>
    m.set(`${group}|${metric}`, { group, metric, unit, a: val ?? null, b: null, better });
  add('General', 'Manufacturer', '', p.manufacturer, 'context');
  add('General', 'Category', '', categoryShortLabel(p.category), 'context');
  add('General', 'Lifecycle', '', p.lifecycle_status, 'context');
  add('Package', 'Package', '', `${p.package.code} (${p.package.mfg_package_code})`, 'context');
  add('Package', 'Pin count', '', p.package.pin_count, 'context');
  add('Package', 'Exposed pad / tab net', '', normalizeEpNet(p.package), 'context');
  add('Thermal', 'θJA', '°C/W', p.package.theta_ja_c_per_w.value, 'lower');
  add('Thermal', 'Tj,max', '°C', p.package.tj_max_c.value, 'higher');
  add('Thermal', 'Ta range', '°C', `${p.temp_grade.ta_min_c} … ${p.temp_grade.ta_max_c}`, 'context');
  if (p.category === 'ldo') {
    const s = p.specs;
    add('LDO', 'Vin min', 'V', s.vin_min_v.value, 'lower');
    add('LDO', 'Vin max', 'V', s.vin_max_v.value, 'higher');
    add('LDO', 'Vout', 'V', s.vout_fixed ? s.vout_v.value : `${fmtNum(s.vout_v.value)} (adj)`, 'context');
    add('LDO', 'Iout max', 'mA', s.iout_max_ma.value, 'higher');
    add('LDO', 'Dropout typ', 'mV', s.dropout_typ_mv.value, 'lower');
    add('LDO', 'Iq typ', 'µA', s.iq_typ_ua.value, 'lower');
    add('LDO', 'PSRR', 'dB', s.psrr_db?.value ?? null, 'higher');
    add('LDO', 'Output noise', 'µVrms', s.output_noise_uvrms?.value ?? null, 'lower');
    add('LDO', 'Ceramic-cap stable', '', s.ceramic_cap_stable ? 'Yes' : 'No', 'context');
    add('LDO', 'Min Cout', 'µF', s.min_cout_uf.value, 'lower');
  } else if (p.category === 'dcdc') {
    const s = p.specs;
    add('DC-DC', 'Topology', '', s.topology, 'context');
    add('DC-DC', 'Vin min', 'V', s.vin_min_v.value, 'lower');
    add('DC-DC', 'Vin max', 'V', s.vin_max_v.value, 'higher');
    add('DC-DC', 'Vout range', 'V', `${fmtNum(s.vout_min_v.value)} … ${fmtNum(s.vout_max_v.value)}`, 'context');
    add('DC-DC', s.is_switch_limit ? 'Switch current limit' : 'Output current', 'mA', s.iout_or_isw_max_ma.value, 'higher');
    add('DC-DC', 'fsw typ', 'kHz', s.fsw_typ_khz.value, 'context');
    add('DC-DC', 'Vref', 'V', s.vref_v?.value ?? null, 'context');
    add('DC-DC', 'Iq typ', 'µA', s.iq_typ_ua.value, 'lower');
    add('DC-DC', 'Peak efficiency', '%', s.efficiency_peak_pct?.value ?? null, 'higher');
    add('DC-DC', 'Inductor typ', 'µH', s.inductor_typ_uh.value, 'context');
    add('DC-DC', 'Synchronous', '', s.synchronous ? 'Yes' : 'No', 'context');
  } else {
    const s = p.specs;
    add('Op-Amp / Comparator', 'Device kind', '', s.device_kind, 'context');
    add('Op-Amp / Comparator', 'Channels', '', s.channels, 'context');
    add('Op-Amp / Comparator', 'Supply min', 'V', s.vs_min_v.value, 'lower');
    add('Op-Amp / Comparator', 'Supply max', 'V', s.vs_max_v.value, 'higher');
    add('Op-Amp / Comparator', 'GBW', 'MHz', s.gbwp_mhz?.value ?? null, 'higher');
    add('Op-Amp / Comparator', 'Slew rate', 'V/µs', s.slew_rate_v_per_us?.value ?? null, 'higher');
    add('Op-Amp / Comparator', 'Propagation delay', 'ns', s.prop_delay_ns?.value ?? null, 'lower');
    add('Op-Amp / Comparator', 'Vos max', 'mV', s.vos_max_mv.value, 'lower');
    add('Op-Amp / Comparator', 'Iq per channel', 'µA', s.iq_per_ch_typ_ua.value, 'lower');
    add('Op-Amp / Comparator', 'Rail-to-rail in / out', '', `${s.rail_to_rail_in ? 'Yes' : 'No'} / ${s.rail_to_rail_out ? 'Yes' : 'No'}`, 'context');
    add('Op-Amp / Comparator', 'Output type', '', s.output_type, 'context');
  }
  return m;
}

function buildParamRows(a: PartRecord, b: PartRecord): ParamRow[] {
  const ma = specRows(a, b);
  const mb = specRows(b, a);
  const keys = [...ma.keys(), ...[...mb.keys()].filter((k) => !ma.has(k))];
  return keys.map((k) => {
    const ra = ma.get(k);
    const rb = mb.get(k);
    const base = (ra ?? rb) as ParamRow;
    return { ...base, a: ra?.a ?? null, b: rb?.a ?? null };
  });
}

function winnerOf(row: ParamRow): 'A' | 'B' | 'TIE' | 'CONTEXT' {
  if (row.better === 'context' || typeof row.a !== 'number' || typeof row.b !== 'number') return 'CONTEXT';
  if (row.a === row.b) return 'TIE';
  if (row.better === 'higher') return row.a > row.b ? 'A' : 'B';
  return row.a < row.b ? 'A' : 'B';
}

function fmtCell(v: number | string | null, unit: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return unit ? `${fmtNum(v, 3)} ${unit}` : fmtNum(v, 3);
  return v;
}

/* ------------------------------------------------------------------------------------------------
 * Searchable part picker (combobox)
 * ---------------------------------------------------------------------------------------------- */

function partSearchText(p: PartRecord): string {
  return `${p.opn} ${p.family} ${p.manufacturer} ${p.package.code} ${p.category} ${p.sub_topology} ${p.slug}`.toLowerCase();
}

function PartPicker({
  label,
  accent,
  parts,
  value,
  onChange,
}: {
  label: string;
  accent: 'sky' | 'violet';
  parts: PartRecord[];
  value: PartRecord | null;
  onChange: (slug: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = `picker-${label.replace(/\W/g, '').toLowerCase()}`;

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = tokens.length
      ? parts.filter((p) => {
          const t = partSearchText(p);
          return tokens.every((tok) => t.includes(tok));
        })
      : parts;
    return filtered.slice(0, 80);
  }, [parts, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setQuery('');
  };

  const ring = accent === 'sky' ? 'border-sky-400 focus:ring-sky-200' : 'border-violet-400 focus:ring-violet-200';
  const chip = accent === 'sky' ? 'bg-sky-700' : 'bg-violet-700';

  return (
    <div ref={wrapRef} className="relative">
      <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
        <span className={`rounded px-1.5 py-0.5 text-white ${chip}`}>{label}</span>
        {value && <span className="font-mono normal-case text-slate-500">{value.manufacturer} · {value.package.code}</span>}
      </label>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? query : value?.opn ?? ''}
        placeholder="Search OPN, family, manufacturer, package…"
        onFocus={() => {
          setOpen(true);
          setCursor(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setCursor((c) => Math.min(c + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const pick = results[cursor];
            if (pick) choose(pick.slug);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
        className={`w-full rounded-md border-2 bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-900 outline-none focus:ring-2 ${ring}`}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg"
        >
          {results.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">No parts match “{query}”.</li>}
          {results.map((p, idx) => (
            <li
              key={p.slug}
              role="option"
              aria-selected={value?.slug === p.slug}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p.slug);
              }}
              onMouseEnter={() => setCursor(idx)}
              className={`cursor-pointer px-3 py-1.5 text-xs ${idx === cursor ? 'bg-slate-100' : ''} ${
                value?.slug === p.slug ? 'font-bold' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-slate-900">{p.opn}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-600">{p.package.code}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {p.manufacturer} · {categoryShortLabel(p.category)} · {p.family}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Workbench
 * ---------------------------------------------------------------------------------------------- */

interface Preset {
  a: string;
  b: string;
  label: string;
  kind: 'trap' | 'candidate';
}

function buildPresets(parts: PartRecord[]): Preset[] {
  const byPkg = new Map<string, Map<string, PartRecord[]>>();
  for (const p of parts) {
    const sig = pinoutSignature(p.package);
    const pk = byPkg.get(p.package.code) ?? new Map<string, PartRecord[]>();
    const arr = pk.get(sig) ?? [];
    arr.push(p);
    pk.set(sig, arr);
    byPkg.set(p.package.code, pk);
  }
  const traps: Preset[] = [];
  const candidates: Preset[] = [];
  const pkgs = [...byPkg.entries()].sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]));
  for (const [code, clusters] of pkgs) {
    const sorted = [...clusters.values()].sort((x, y) => y.length - x.length);
    if (sorted.length >= 2) {
      // Prefer a same-category pair (the realistic trap: "same package, same function, different pinout").
      let pair: [PartRecord, PartRecord] | null = null;
      outer: for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const hit = sorted[j].find((q) => q.category === sorted[i][0].category);
          if (hit) {
            pair = [sorted[i][0], hit];
            break outer;
          }
        }
      }
      pair ??= [sorted[0][0], sorted[1][0]];
      const epTrap = normalizeEpNet(pair[0].package) !== normalizeEpNet(pair[1].package);
      traps.push({ a: pair[0].slug, b: pair[1].slug, label: `${code} ${epTrap ? 'tab/EP' : 'pinout'} trap`, kind: 'trap' });
    }
    for (const cluster of sorted) {
      const same = cluster.filter((q) => q.category === cluster[0].category);
      if (same.length >= 2 && candidates.length < 3) {
        candidates.push({ a: same[0].slug, b: same[1].slug, label: `${code} same pinout`, kind: 'candidate' });
        break;
      }
    }
  }
  return [...traps.slice(0, 6), ...candidates.slice(0, 3)];
}

const DISCLAIMER =
  '“Candidate Drop-In” is a review-candidate classification computed from parsed official-datasheet fields — it is not a guarantee of form, fit or function. Always verify pinout, absolute maximum ratings, stability and thermal limits against the latest official manufacturer datasheet revision before PCB release. Not for use in safety-critical (medical, automotive, aerospace, life-support) circuits without independent engineering qualification.';

export function CompareWorkbenchClient({ parts, existingVsSlugs }: CompareWorkbenchProps) {
  const sortedParts = useMemo(
    () => [...parts].sort((x, y) => x.category.localeCompare(y.category) || x.opn.localeCompare(y.opn)),
    [parts],
  );
  const bySlug = useMemo(() => new Map(parts.map((p) => [p.slug, p])), [parts]);
  const vsSet = useMemo(() => new Set(existingVsSlugs), [existingVsSlugs]);
  const presets = useMemo(() => buildPresets(parts), [parts]);

  const fallbackA = presets[0]?.a ?? sortedParts[0]?.slug ?? '';
  const fallbackB = presets[0]?.b ?? sortedParts[1]?.slug ?? sortedParts[0]?.slug ?? '';
  const [slugA, setSlugA] = useState<string>(fallbackA);
  const [slugB, setSlugB] = useState<string>(fallbackB);
  const [urlReady, setUrlReady] = useState(false);

  // Initial URL → state (client only, avoids useSearchParams Suspense requirement on static export)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const qa = sp.get('a');
      const qb = sp.get('b');
      if (qa && bySlug.has(qa)) setSlugA(qa);
      if (qb && bySlug.has(qb)) setSlugB(qb);
      if (qa && bySlug.has(qa) && !(qb && bySlug.has(qb))) {
        // Only Part A supplied (e.g. from a part page) → pick the best same-package counterpart.
        const pa = bySlug.get(qa)!;
        const counterpart =
          parts.find((p) => p.slug !== qa && p.category === pa.category && p.package.code === pa.package.code) ??
          parts.find((p) => p.slug !== qa && p.category === pa.category);
        if (counterpart) setSlugB(counterpart.slug);
      }
      if (qa || qb) trackEvent('compare_launch', { a: qa ?? '', b: qb ?? '', source: 'url' });
    } catch {
      // ignore malformed URLs
    }
    setUrlReady(true);
  }, [bySlug, parts]);

  // State → URL (shareable)
  useEffect(() => {
    if (!urlReady) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('a', slugA);
      url.searchParams.set('b', slugB);
      window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
    } catch {
      // ignore
    }
  }, [slugA, slugB, urlReady]);

  const partA = bySlug.get(slugA) ?? null;
  const partB = bySlug.get(slugB) ?? null;

  const verdict = useMemo(() => (partA && partB ? computeVerdict(partA, partB) : null), [partA, partB]);
  const paramRows = useMemo(() => (partA && partB ? buildParamRows(partA, partB) : []), [partA, partB]);
  const diffHighlights = useMemo(() => {
    const m: Record<number, DiffStatus> = {};
    for (const r of verdict?.pinRows ?? []) m[r.pin] = r.status;
    return m;
  }, [verdict]);

  const canonicalVs = useMemo(() => {
    if (!partA || !partB) return null;
    const ab = `${partA.slug}-vs-${partB.slug}`;
    const ba = `${partB.slug}-vs-${partA.slug}`;
    if (vsSet.has(ab)) return ab;
    if (vsSet.has(ba)) return ba;
    return null;
  }, [partA, partB, vsSet]);

  const [copied, setCopied] = useState(false);

  const pick = useCallback((side: 'a' | 'b', slug: string, source: string) => {
    if (side === 'a') setSlugA(slug);
    else setSlugB(slug);
    trackEvent('compare_select', { side, slug, source });
  }, []);

  const swap = () => {
    setSlugA(slugB);
    setSlugB(slugA);
    trackEvent('compare_swap', { a: slugB, b: slugA });
  };

  const applyPreset = (p: Preset) => {
    setSlugA(p.a);
    setSlugB(p.b);
    trackEvent('compare_preset', { a: p.a, b: p.b, kind: p.kind, label: p.label });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
    trackEvent('compare_copy_link', { a: slugA, b: slugB });
  };

  const printPage = () => {
    trackEvent('compare_print', { a: slugA, b: slugB, level: verdict?.level ?? '' });
    window.print();
  };

  if (parts.length < 2) {
    return <div className="rounded-lg border border-slate-300 bg-white p-6 text-sm text-slate-600">At least two parts are required to compare.</div>;
  }

  const style = verdict ? getCompatibilityStyle(verdict.level) : null;
  const counts = {
    match: verdict?.pinRows.filter((r) => r.status === 'MATCH').length ?? 0,
    caution: verdict?.pinRows.filter((r) => r.status === 'CAUTION').length ?? 0,
    mismatch: verdict?.pinRows.filter((r) => r.status === 'MISMATCH').length ?? 0,
  };
  const verdictTitle =
    verdict?.level === 'LEVEL_1_CANDIDATE_DROP_IN'
      ? 'Candidate Drop-In (Verify Datasheet Before Production)'
      : verdict?.level === 'LEVEL_2_TUNING_REQUIRED'
        ? 'Functional / Tuning Required (Check Passives & Ratings)'
        : 'PCB Layout Change Required (Pinout, Package or Function Mismatch)';

  return (
    <div className="space-y-5">
      {/* Selector panel */}
      <section aria-label="Select parts to compare" className="print:hidden space-y-3 rounded-lg border border-slate-300 bg-white p-4">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
          <PartPicker label="Part A (existing)" accent="sky" parts={sortedParts} value={partA} onChange={(s) => pick('a', s, 'picker')} />
          <button
            type="button"
            onClick={swap}
            className="h-10 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
            aria-label="Swap Part A and Part B"
          >
            ⇄ Swap A↔B
          </button>
          <PartPicker label="Part B (replacement)" accent="violet" parts={sortedParts} value={partB} onChange={(s) => pick('b', s, 'picker')} />
        </div>
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Curated presets:</span>
            {presets.map((p) => {
              const pa = bySlug.get(p.a);
              const pb = bySlug.get(p.b);
              const active = p.a === slugA && p.b === slugB;
              return (
                <button
                  key={`${p.a}-${p.b}`}
                  type="button"
                  onClick={() => applyPreset(p)}
                  title={`${pa?.opn} vs ${pb?.opn}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : p.kind === 'trap'
                        ? 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  }`}
                >
                  {p.kind === 'trap' ? '⚠ ' : '✓ '}
                  {p.label}: <span className="font-mono">{pa?.opn}</span> vs <span className="font-mono">{pb?.opn}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copyLink} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            {copied ? '✓ Link copied' : 'Copy Comparison Link'}
          </button>
          <button type="button" onClick={printPage} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Print Comparison / Save PDF
          </button>
        </div>
      </section>

      {partA && partB && verdict && style && (
        <>
          {/* Print header */}
          <div className="hidden print:block text-sm">
            <strong>Pin2Pin Freeform Comparison:</strong> {partA.opn} ({partA.package.code}) vs {partB.opn} ({partB.package.code})
          </div>

          {slugA === slugB && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-700">
              Part A and Part B are the same OPN — pick a different Part B to run a real comparison.
            </div>
          )}

          {canonicalVs && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-sky-400 bg-sky-50 px-4 py-3">
              <div className="text-sm text-sky-950">
                <strong>Pre-audited comparison available.</strong> This pair has a canonical, human-auditable VS page with verified
                pin-diff notes and swap risks.
              </div>
              <Link
                href={`/en/vs/${canonicalVs}/`}
                onClick={() => trackEvent('compare_open_canonical_vs', { slug: canonicalVs })}
                className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-800"
              >
                Open /en/vs/{canonicalVs}/ →
              </Link>
            </div>
          )}

          {/* Verdict */}
          <section aria-label="Compatibility summary" className={`rounded-lg border-2 p-4 ${style.bannerBg} ${style.bannerBorder}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}>
                    <span className={`h-2 w-2 rounded-full ${style.dotColor}`} />
                    {style.tierCode} · {style.shortLabel}
                  </span>
                  <span className="text-sm font-bold text-slate-950 sm:text-base">{verdictTitle}</span>
                </div>
                <p className="font-mono text-xs text-slate-700">
                  Pin audit: <strong className="text-emerald-800">{counts.match} Match</strong> ·{' '}
                  <strong className="text-amber-800">{counts.caution} Caution</strong> ·{' '}
                  <strong className="text-rose-800">{counts.mismatch} Mismatch</strong> · EP/Tab:{' '}
                  <strong
                    className={
                      verdict.ep.status === 'MATCH' ? 'text-emerald-800' : verdict.ep.status === 'CAUTION' ? 'text-amber-800' : 'text-rose-800'
                    }
                  >
                    {verdict.ep.status}
                  </strong>{' '}
                  · Package: <strong className={verdict.packageMatch ? 'text-emerald-800' : 'text-rose-800'}>{verdict.packageMatch ? 'Same' : 'Different'}</strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <a href={partA.datasheet.pdf_url} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-sky-800 hover:bg-slate-50" onClick={() => trackEvent('datasheet_pdf_click', { opn: partA.opn, source: 'compare' })}>
                  A: Official PDF ↗
                </a>
                <a href={partB.datasheet.pdf_url} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-violet-800 hover:bg-slate-50" onClick={() => trackEvent('datasheet_pdf_click', { opn: partB.opn, source: 'compare' })}>
                  B: Official PDF ↗
                </a>
              </div>
            </div>
            {verdict.reasons.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs">
                {verdict.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1 font-mono text-[10px] font-bold text-white ${
                        r.severity === 'L3' ? 'bg-rose-600' : r.severity === 'L2' ? 'bg-amber-600' : 'bg-slate-500'
                      }`}
                    >
                      {r.severity === 'L3' ? 'LAYOUT' : r.severity === 'L2' ? 'TUNE' : 'INFO'}
                    </span>
                    <span className="text-slate-800">{r.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-800">
                No pinout, package, pad or parsed electrical conflicts detected — treat as a review candidate only and confirm every
                rating against both official datasheets.
              </p>
            )}
            <p className="mt-3 border-t border-slate-300/70 pt-2 text-[11px] leading-relaxed text-slate-600">{DISCLAIMER}</p>
          </section>

          {/* Side-by-side interactive pinouts */}
          <section aria-label="Side-by-side pinout diagrams" className="space-y-2">
            <h2 className="text-lg font-bold text-slate-950">Side-by-Side Pinout Diff</h2>
            <VsPinoutComparisonView
              partAOpn={partA.opn}
              partAPkg={partA.package}
              partBOpn={partB.opn}
              partBPkg={partB.package}
              exposedPadMatch={verdict.ep.status !== 'MISMATCH'}
              epDiffStatus={verdict.ep.status}
              diffHighlights={diffHighlights}
              partAHref={`/en/part/${partA.slug}/`}
              partBHref={`/en/part/${partB.slug}/`}
              partAManufacturer={partA.manufacturer}
              partBManufacturer={partB.manufacturer}
            />
          </section>

          {/* Pin table */}
          <section aria-label="Pin-by-pin diff table" className="space-y-2">
            <h2 className="text-lg font-bold text-slate-950">Pin-by-Pin Diff</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-900 font-mono text-[11px] uppercase text-slate-100">
                  <tr>
                    <th className="w-14 px-3 py-2 text-left">Pin</th>
                    <th className="px-3 py-2 text-left">{partA.opn} (A)</th>
                    <th className="px-3 py-2 text-left">{partB.opn} (B)</th>
                    <th className="w-24 px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Engineering note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {verdict.pinRows.map((r) => (
                    <tr key={r.pin} className={r.status === 'MISMATCH' ? 'bg-rose-50/70' : r.status === 'CAUTION' ? 'bg-amber-50/70' : ''}>
                      <td className="px-3 py-1.5 font-mono font-bold">{r.pin}</td>
                      <td className="px-3 py-1.5 font-mono">{r.a ? `${r.a.name} (${r.a.role})` : '— (no pin)'}</td>
                      <td className="px-3 py-1.5 font-mono">{r.b ? `${r.b.name} (${r.b.role})` : '— (no pin)'}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white ${
                            r.status === 'MATCH' ? 'bg-emerald-600' : r.status === 'CAUTION' ? 'bg-amber-600' : 'bg-rose-600'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">{r.note}</td>
                    </tr>
                  ))}
                  <tr className={verdict.ep.status === 'MISMATCH' ? 'bg-rose-50/70' : verdict.ep.status === 'CAUTION' ? 'bg-amber-50/70' : ''}>
                    <td className="px-3 py-1.5 font-mono font-bold">EP</td>
                    <td className="px-3 py-1.5 font-mono">{normalizeEpNet(partA.package)}</td>
                    <td className="px-3 py-1.5 font-mono">{normalizeEpNet(partB.package)}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white ${
                          verdict.ep.status === 'MATCH' ? 'bg-emerald-600' : verdict.ep.status === 'CAUTION' ? 'bg-amber-600' : 'bg-rose-600'
                        }`}
                      >
                        {verdict.ep.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-700">{verdict.ep.note}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Parameter table */}
          <section aria-label="Electrical and thermal parameter diff" className="space-y-2">
            <h2 className="text-lg font-bold text-slate-950">Electrical &amp; Thermal Parameter Diff</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 font-mono text-[11px] uppercase text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Group</th>
                    <th className="px-3 py-2 text-left">Metric</th>
                    <th className="px-3 py-2 text-left">{partA.opn} (A)</th>
                    <th className="px-3 py-2 text-left">{partB.opn} (B)</th>
                    <th className="px-3 py-2 text-left">Better</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paramRows.map((row) => {
                    const w = winnerOf(row);
                    return (
                      <tr key={`${row.group}-${row.metric}`}>
                        <td className="px-3 py-1.5 text-[11px] text-slate-500">{row.group}</td>
                        <td className="px-3 py-1.5 font-semibold text-slate-800">{row.metric}</td>
                        <td className={`px-3 py-1.5 font-mono ${w === 'A' ? 'font-bold text-emerald-800' : ''}`}>{fmtCell(row.a, row.unit)}</td>
                        <td className={`px-3 py-1.5 font-mono ${w === 'B' ? 'font-bold text-emerald-800' : ''}`}>{fmtCell(row.b, row.unit)}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">
                          {w === 'CONTEXT' ? '—' : w === 'TIE' ? 'Tie' : `Part ${w}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500">
              Values parsed from official manufacturer datasheets (A: {partA.datasheet.revision}, p.{partA.package.pinout_source_page}; B:{' '}
              {partB.datasheet.revision}, p.{partB.package.pinout_source_page}). “Better” is a directional hint only — the right choice depends on your circuit.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default CompareWorkbenchClient;
