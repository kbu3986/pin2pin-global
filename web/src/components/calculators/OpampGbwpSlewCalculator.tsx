'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Flame,
  Gauge,
  Link2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export interface OpampPreset {
  opn: string;
  deviceKind: 'opamp' | 'comparator';
  gbwpMhz: number | null;
  slewRateVus: number | null;
  propDelayNs: number | null;
  vsMax: number;
  vsMin?: number;
  outputType?: 'push-pull' | 'open-collector' | 'open-drain';
  railToRailOut?: boolean;
  railToRailIn?: boolean;
  ioutShortMa?: number | null;
}

export interface OpampGbwpSlewCalculatorProps {
  initialPreset: OpampPreset | null;
  presets: OpampPreset[];
  /**
   * Compact (embedded) mode: hides URL-state reading and the share-link action.
   * Defaults to `true` when `presets` is empty (part-page embed), else `false`.
   */
  compact?: boolean;
}

type OpampTopology = 'non-inverting' | 'inverting';
type OutputStageType = 'push-pull' | 'open-collector' | 'open-drain';

interface CalcViolation {
  severity: 'DANGER' | 'CAUTION';
  code: string;
  title: string;
  detail: string;
}

const CALC_ID = 'opamp_gbwp';

const CUSTOM_OPAMP: OpampPreset = {
  opn: 'Custom Op-Amp',
  deviceKind: 'opamp',
  gbwpMhz: 1.0,
  slewRateVus: 0.5,
  propDelayNs: null,
  vsMax: 16,
  vsMin: 3.0,
  outputType: 'push-pull',
  railToRailOut: false,
  railToRailIn: false,
};

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) ? n : fallback;
}

function defaultVsFor(p: OpampPreset): number {
  const minV = p.vsMin ?? 2.7;
  if (p.vsMax >= 12) return 12;
  if (p.vsMax >= 5) return 5;
  return Number(Math.max(minV, Math.min(3.3, p.vsMax)).toFixed(1));
}

function defaultVpeakFor(p: OpampPreset, vs: number): number {
  const headroom = p.railToRailOut ? 0.5 : 1.7;
  const safeMax = Math.max(0.2, vs / 2 - headroom);
  return Number(Math.min(1.0, safeMax).toFixed(2));
}

function defaultCompFreqKhz(propDelayNs: number | null): number {
  const tpd = Math.max(5, propDelayNs ?? 300);
  const fMax = 1e6 / (4 * tpd);
  return Math.max(1, Math.min(5000, Math.round(fMax * 0.25)));
}

function formatFreqKhz(khz: number): string {
  if (khz >= 1000) return `${(khz / 1000).toFixed(2)} MHz`;
  if (khz >= 10) return `${khz.toFixed(1)} kHz`;
  return `${khz.toFixed(2)} kHz`;
}

function formatTimeNs(ns: number): string {
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  if (ns >= 1000) return `${(ns / 1000).toFixed(2)} µs`;
  return `${ns.toFixed(1)} ns`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Full-DB searchable OPN selector                                     */
/* ------------------------------------------------------------------ */

interface PresetSearchBarProps<T extends { opn: string }> {
  presets: T[];
  selectedOpn: string;
  describe: (p: T) => string;
  onSelect: (p: T) => void;
}

function PresetSearchBar<T extends { opn: string }>({
  presets,
  selectedOpn,
  describe,
  onSelect,
}: PresetSearchBarProps<T>) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) => p.opn.toLowerCase().includes(q) || describe(p).toLowerCase().includes(q),
    );
  }, [presets, query, describe]);

  const pills = useMemo(() => {
    const top = filtered.slice(0, 6);
    const sel = presets.find((p) => p.opn === selectedOpn);
    if (sel && !top.some((p) => p.opn === sel.opn)) return [sel, ...top.slice(0, 5)];
    return top;
  }, [filtered, presets, selectedOpn]);

  const selectValue = filtered.some((p) => p.opn === selectedOpn) ? selectedOpn : '';

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Datasheet Preset ({presets.length} OPNs):
        </span>
        <label className="relative flex-1 min-w-[160px] max-w-xs">
          <span className="sr-only">Search OPN</span>
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) {
                e.preventDefault();
                onSelect(filtered[0]);
              }
            }}
            placeholder={`Search ${presets.length} OPNs…`}
            className="w-full rounded-md border border-slate-300 bg-white py-1 pl-7 pr-2 font-mono text-xs text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </label>
        <label className="flex-1 min-w-[180px] max-w-sm">
          <span className="sr-only">Select OPN preset</span>
          <select
            value={selectValue}
            onChange={(e) => {
              const p = presets.find((x) => x.opn === e.target.value);
              if (p) onSelect(p);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer"
          >
            <option value="">
              {filtered.length === 0
                ? '— No OPN matches —'
                : `— Select OPN (${filtered.length} of ${presets.length}) —`}
            </option>
            {filtered.map((p) => (
              <option key={p.opn} value={p.opn}>
                {p.opn} · {describe(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quick:</span>
          {pills.map((p) => (
            <button
              key={p.opn}
              type="button"
              onClick={() => onSelect(p)}
              className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                selectedOpn === p.opn
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'
              }`}
            >
              {p.opn}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main calculator                                                     */
/* ------------------------------------------------------------------ */

export function OpampGbwpSlewCalculator({
  initialPreset,
  presets,
  compact,
}: OpampGbwpSlewCalculatorProps) {
  const isCompact = compact ?? presets.length === 0;
  const base: OpampPreset = initialPreset ?? CUSTOM_OPAMP;
  const initVs = defaultVsFor(base);

  const [activePreset, setActivePreset] = useState<OpampPreset>(base);
  const [isCustom, setIsCustom] = useState<boolean>(initialPreset === null);
  const [deviceKind, setDeviceKind] = useState<'opamp' | 'comparator'>(base.deviceKind);

  // Op-amp mode states
  const [opampTopology, setOpampTopology] = useState<OpampTopology>('non-inverting');
  const [aclStr, setAclStr] = useState<string>('10');
  const [fSigStr, setFSigStr] = useState<string>('20');
  const [vsStr, setVsStr] = useState<string>(String(initVs));
  const [vPeakStr, setVPeakStr] = useState<string>(String(defaultVpeakFor(base, initVs)));
  const [gbwpStr, setGbwpStr] = useState<string>(String(base.gbwpMhz ?? 1.0));
  const [srStr, setSrStr] = useState<string>(String(base.slewRateVus ?? 0.5));
  const [railToRailOut, setRailToRailOut] = useState<boolean>(Boolean(base.railToRailOut));

  // Comparator mode states
  const [tpdStr, setTpdStr] = useState<string>(String(base.propDelayNs ?? 300));
  const [compFreqStr, setCompFreqStr] = useState<string>(String(defaultCompFreqKhz(base.propDelayNs)));
  const [outputStage, setOutputStage] = useState<OutputStageType>(
    base.outputType ?? (base.deviceKind === 'comparator' ? 'open-collector' : 'push-pull'),
  );
  const [vpuStr, setVpuStr] = useState<string>(String(Math.min(3.3, base.vsMax)));
  const [rpuStr, setRpuStr] = useState<string>('4.7');
  const [cloadStr, setCloadStr] = useState<string>('20');
  const [volStr, setVolStr] = useState<string>('0.2');

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPreset = (
    p: OpampPreset,
    source: 'preset' | 'reset' | 'url' = 'preset',
    custom = false,
  ) => {
    const nextVs = defaultVsFor(p);
    setActivePreset(p);
    setIsCustom(custom);
    setDeviceKind(p.deviceKind);
    setVsStr(String(nextVs));

    if (p.deviceKind === 'comparator') {
      setTpdStr(String(p.propDelayNs ?? 300));
      setCompFreqStr(String(defaultCompFreqKhz(p.propDelayNs)));
      setOutputStage(p.outputType ?? 'open-collector');
      setVpuStr(String(Math.min(3.3, p.vsMax)));
      setRpuStr('4.7');
      setCloadStr('20');
      setVolStr('0.2');
    } else {
      setOpampTopology('non-inverting');
      setAclStr('10');
      setFSigStr('20');
      setVPeakStr(String(defaultVpeakFor(p, nextVs)));
      setGbwpStr(String(p.gbwpMhz ?? 1.0));
      setSrStr(String(p.slewRateVus ?? 0.5));
      setRailToRailOut(Boolean(p.railToRailOut));
    }

    if (source !== 'url') {
      trackEvent(source === 'reset' ? 'calculator_reset' : 'calculator_preset_select', {
        calculator: CALC_ID,
        opn: p.opn,
        device_kind: p.deviceKind,
      });
    }
  };

  useEffect(() => {
    const nextBase = initialPreset ?? CUSTOM_OPAMP;
    applyPreset(nextBase, 'url', initialPreset === null);
    // Sync when embedded page navigates between part slugs.
  }, [initialPreset?.opn]);

  // Shareable URL state (standalone only)
  useEffect(() => {
    if (isCompact || typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.toString() === '') return;
    const opnParam = qs.get('opn');
    if (opnParam) {
      const match = presets.find((p) => p.opn.toLowerCase() === opnParam.toLowerCase());
      if (match) applyPreset(match, 'url', false);
    }
    const topo = qs.get('topo');
    if (topo === 'inverting' || topo === 'non-inverting') setOpampTopology(topo);
    const out = qs.get('out');
    if (out === 'push-pull' || out === 'open-collector' || out === 'open-drain') setOutputStage(out);
    const num = (key: string, set: (v: string) => void) => {
      const raw = qs.get(key);
      if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) set(raw);
    };
    num('av', setAclStr);
    num('fsig', setFSigStr);
    num('vs', setVsStr);
    num('vp', setVPeakStr);
    num('gbwp', setGbwpStr);
    num('sr', setSrStr);
    num('tpd', setTpdStr);
    num('fin', setCompFreqStr);
    num('vpu', setVpuStr);
    num('rpu', setRpuStr);
    num('cload', setCloadStr);
    num('vol', setVolStr);
    trackEvent('calculator_url_state_load', { calculator: CALC_ID, opn: opnParam ?? undefined });
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const selectedOpn = activePreset.opn;

  /* ---------------------------------------------------------------- */
  /* Op-Amp Linear Bandwidth, Slew Rate & Headroom Calculations        */
  /* ---------------------------------------------------------------- */
  const opampResults = useMemo(() => {
    const minGain = opampTopology === 'inverting' ? 0.1 : 1;
    const av = Math.max(minGain, parseFinite(aclStr, 10));
    const noiseGain = opampTopology === 'inverting' ? 1 + av : av;
    const fSigKhz = Math.max(0.01, parseFinite(fSigStr, 20));
    const vs = Math.max(0.5, parseFinite(vsStr, 5.0));
    const vPeak = Math.max(0.01, parseFinite(vPeakStr, 1.0));
    const gbwpMhz = Math.max(0.01, parseFinite(gbwpStr, 1.0));
    const srVus = Math.max(0.005, parseFinite(srStr, 0.5));

    // Closed-loop -3 dB bandwidth governed by Noise Gain (NG = 1 + |Av| for inverting, Av for non-inverting)
    const f3dbKhz = (gbwpMhz * 1000) / noiseGain;
    // Required slew rate (V/µs) = 2π · f_sig · Vpeak
    const requiredSrVus = (2 * Math.PI * fSigKhz * vPeak) / 1000;
    // Full-power bandwidth (kHz) = SR / (2π · Vpeak)
    const fpbwKhz = (srVus * 1000) / (2 * Math.PI * vPeak);

    const bwRatio = f3dbKhz / fSigKhz;
    const srRatio = srVus / requiredSrVus;

    const halfVs = vs / 2;
    const headroomToRailV = halfVs - vPeak;
    const rroRequiredHeadroomV = railToRailOut ? 0.15 : 1.5;

    const overVsMax = !isCustom && vs > activePreset.vsMax;
    const underVsMin = !isCustom && activePreset.vsMin !== undefined && vs < activePreset.vsMin;
    const clipsSupply = vPeak > halfVs || (!isCustom && vPeak > activePreset.vsMax / 2);
    const tightRailHeadroom = !clipsSupply && headroomToRailV < rroRequiredHeadroomV;

    const violations: CalcViolation[] = [];

    if (overVsMax) {
      violations.push({
        severity: 'DANGER',
        code: 'VS_OVER_MAX',
        title: 'Supply Span Vs Exceeds Rated Vs,max',
        detail: `Supply Vs (${vs.toFixed(1)} V) exceeds rated operating maximum (${activePreset.vsMax} V) for ${selectedOpn}.`,
      });
    }
    if (clipsSupply) {
      violations.push({
        severity: 'DANGER',
        code: 'RAIL_CLIP',
        title: 'Output Amplitude Exceeds Supply Rails (Hard Clipping)',
        detail: `Symmetric sine swing 2·Vpeak (${(2 * vPeak).toFixed(2)} Vpp) exceeds total supply span Vs (${vs.toFixed(1)} V, ±${halfVs.toFixed(2)} V from mid-rail). Reduce Vpeak or increase Vs.`,
      });
    }
    if (srVus < requiredSrVus) {
      violations.push({
        severity: 'DANGER',
        code: 'SLEW_LIMIT',
        title: 'Slew-Rate Limiting (Triangle-Wave Distortion)',
        detail: `Required slew rate (${requiredSrVus.toFixed(3)} V/µs) exceeds amplifier SR (${srVus.toFixed(3)} V/µs). Output sine wave distorts above FPBW = ${formatFreqKhz(fpbwKhz)}.`,
      });
    }
    if (fSigKhz > f3dbKhz) {
      violations.push({
        severity: 'DANGER',
        code: 'BW_EXCEEDED',
        title: 'Signal Exceeds Closed-Loop −3 dB Bandwidth',
        detail: `At ${opampTopology} |Av| = ${av} (Noise Gain NG = ${noiseGain.toFixed(1)}), −3 dB cutoff is ${formatFreqKhz(f3dbKhz)}, below f_sig = ${formatFreqKhz(fSigKhz)}.`,
      });
    }
    if (underVsMin && activePreset.vsMin !== undefined) {
      violations.push({
        severity: 'CAUTION',
        code: 'VS_UNDER_MIN',
        title: 'Supply Span Vs Below Rated Vs,min',
        detail: `Supply Vs (${vs.toFixed(1)} V) is below rated minimum (${activePreset.vsMin} V) for ${selectedOpn}.`,
      });
    }
    if (tightRailHeadroom) {
      violations.push({
        severity: 'CAUTION',
        code: 'OUTPUT_HEADROOM',
        title: railToRailOut
          ? 'Tight Rail-to-Rail Output Swing Margin'
          : 'Non-RRO Output Headroom Warning (< 1.5 V to Rail)',
        detail: railToRailOut
          ? `Vpeak (${vPeak.toFixed(2)} V) leaves only ${headroomToRailV.toFixed(2)} V to each rail (±${halfVs.toFixed(2)} V from mid-rail). Verify datasheet VOH/VOL under your load resistance.`
          : `${selectedOpn} is not rail-to-rail output (RRO). At Vs = ${vs.toFixed(1)} V (±${halfVs.toFixed(2)} V from mid-rail), Vpeak = ${vPeak.toFixed(2)} V leaves only ${headroomToRailV.toFixed(2)} V to each rail (< 1.5 V typical VOH/VOL drop) and is likely to clip.`,
      });
    }
    if (fSigKhz <= f3dbKhz && bwRatio < 5) {
      violations.push({
        severity: 'CAUTION',
        code: 'NARROW_BW',
        title: 'Narrow Closed-Loop Bandwidth Margin (< 5× f_sig)',
        detail: `f_-3dB is only ${bwRatio.toFixed(1)}× above f_sig (Noise Gain NG = ${noiseGain.toFixed(1)}), introducing noticeable gain roll-off and phase lag.`,
      });
    }
    if (srVus >= requiredSrVus && srRatio < 1.5) {
      violations.push({
        severity: 'CAUTION',
        code: 'NARROW_SR',
        title: 'Tight Slew-Rate Headroom (< 1.5×)',
        detail: `Slew-rate margin is ${srRatio.toFixed(2)}× above required minimum (${requiredSrVus.toFixed(3)} V/µs); process/temperature variation may cause distortion.`,
      });
    }

    const dangerCount = violations.filter((v) => v.severity === 'DANGER').length;
    const cautionCount = violations.filter((v) => v.severity === 'CAUTION').length;

    let status: 'PASS' | 'CAUTION' | 'DISTORTION' = 'PASS';
    let statusTitle = 'Candidate Operating Point — Within Estimated Bandwidth, Slew & Headroom Limits';
    let statusDetail = `Closed-loop −3 dB bandwidth (${formatFreqKhz(f3dbKhz)} at NG = ${noiseGain.toFixed(1)}) and Full-Power Bandwidth (${formatFreqKhz(fpbwKhz)}) cleanly exceed ${formatFreqKhz(fSigKhz)}, with ${headroomToRailV.toFixed(2)} V per-rail output headroom.`;

    if (dangerCount > 0) {
      status = 'DISTORTION';
      statusTitle =
        violations.length === 1
          ? violations[0].title
          : `Distortion / Clipping Risks (${dangerCount} Critical${cautionCount > 0 ? `, ${cautionCount} Caution` : ''})`;
      statusDetail = violations[0].detail;
    } else if (cautionCount > 0) {
      status = 'CAUTION';
      statusTitle =
        violations.length === 1
          ? violations[0].title
          : `Caution — ${cautionCount} Headroom / Margin Warnings`;
      statusDetail = violations[0].detail;
    }

    return {
      av,
      noiseGain,
      fSigKhz,
      vs,
      vPeak,
      gbwpMhz,
      srVus,
      f3dbKhz,
      requiredSrVus,
      fpbwKhz,
      bwRatio,
      srRatio,
      headroomToRailV,
      violations,
      status,
      statusTitle,
      statusDetail,
    };
  }, [
    opampTopology,
    aclStr,
    fSigStr,
    vsStr,
    vPeakStr,
    gbwpStr,
    srStr,
    railToRailOut,
    isCustom,
    activePreset,
    selectedOpn,
  ]);

  /* ---------------------------------------------------------------- */
  /* Dedicated Comparator Mode Calculations                            */
  /* ---------------------------------------------------------------- */
  const compResults = useMemo(() => {
    const tpdNs = Math.max(1, parseFinite(tpdStr, activePreset.propDelayNs ?? 300));
    const fInKhz = Math.max(0.01, parseFinite(compFreqStr, 100));
    const vs = Math.max(0.5, parseFinite(vsStr, 5.0));
    const cloadPf = Math.max(1, parseFinite(cloadStr, 20));
    const isOpenCollector = outputStage === 'open-collector' || outputStage === 'open-drain';
    const vpu = Math.max(0.5, parseFinite(vpuStr, 3.3));
    const rpuKohm = Math.max(0.1, parseFinite(rpuStr, 4.7));
    const vol = Math.max(0, parseFinite(volStr, 0.2));

    // Propagation-delay toggle ceiling: f_max ≈ 1 / (4 · t_pd)
    const fMaxKhz = 1e6 / (4 * tpdNs);
    const periodNs = 1e6 / fInKhz;

    // Open-collector / open-drain pull-up RC rise time & sink current
    // t_r (10%-90%) ≈ 2.2 · R_pu · C_load  (kΩ * pF = ns!)
    const trNs = isOpenCollector ? 2.2 * rpuKohm * cloadPf : 0;
    const iSinkMa = isOpenCollector ? Math.max(0, vpu - vol) / rpuKohm : 0;
    const fEffKhz = isOpenCollector ? 1e6 / (4 * tpdNs + 2 * trNs) : fMaxKhz;
    const timingMargin = fMaxKhz / fInKhz;

    // Recommended R_pu range:
    // Lower bound: keep I_sink <= 4 mA (typical guaranteed sink current for LM393/LM339/TLV3701)
    const maxRecommendedSinkMa = activePreset.ioutShortMa
      ? Math.min(6, Math.max(2, activePreset.ioutShortMa * 0.35))
      : 4;
    const rpuMinKohm = Math.max(0.47, Math.max(0.2, vpu - vol) / maxRecommendedSinkMa);
    // Upper bound: keep t_r <= 25% of input period (and <= 100 kΩ for noise immunity)
    const rpuMaxForFreqKohm = (0.25 * periodNs) / (2.2 * cloadPf);
    const rpuMaxKohm = Math.min(100, rpuMaxForFreqKohm);
    const rpuWindowValid = rpuMaxKohm >= rpuMinKohm;

    const overVsMax = !isCustom && vs > activePreset.vsMax;
    const underVsMin = !isCustom && activePreset.vsMin !== undefined && vs < activePreset.vsMin;
    const overVpuMax = !isCustom && isOpenCollector && vpu > activePreset.vsMax;

    const violations: CalcViolation[] = [];

    if (fInKhz > fMaxKhz) {
      violations.push({
        severity: 'DANGER',
        code: 'COMP_FREQ_OVER_FMAX',
        title: 'Input Frequency Exceeds Propagation-Delay Ceiling f_max',
        detail: `f_in (${formatFreqKhz(fInKhz)}) exceeds estimated f_max ≈ 1/(4·t_pd) = ${formatFreqKhz(fMaxKhz)} for t_pd = ${tpdNs.toFixed(0)} ns. Output pulses will be severely delayed or missed.`,
      });
    }
    if (overVsMax) {
      violations.push({
        severity: 'DANGER',
        code: 'COMP_VS_OVER_MAX',
        title: 'Supply Vs Exceeds Rated Vs,max',
        detail: `Supply Vs (${vs.toFixed(1)} V) exceeds rated operating maximum (${activePreset.vsMax} V) for ${selectedOpn}.`,
      });
    }
    if (overVpuMax) {
      violations.push({
        severity: 'DANGER',
        code: 'COMP_VPU_OVER_MAX',
        title: 'Pull-Up Voltage Vpu Exceeds Rated Vs,max',
        detail: `Pull-up Vpu (${vpu.toFixed(1)} V) exceeds ${selectedOpn} maximum rating (${activePreset.vsMax} V). Verify datasheet open-collector/drain standoff limit.`,
      });
    }
    if (isOpenCollector && iSinkMa > 10) {
      violations.push({
        severity: 'DANGER',
        code: 'COMP_SINK_HIGH',
        title: 'Excessive Output Sink Current (> 10 mA)',
        detail: `Pull-up sink current I_sink = (Vpu − Vol)/R_pu = ${iSinkMa.toFixed(2)} mA exceeds typical comparator output sink capability (4–6 mA guaranteed). Output VOL will rise sharply; increase R_pu ≥ ${rpuMinKohm.toFixed(1)} kΩ.`,
      });
    }
    if (underVsMin && activePreset.vsMin !== undefined) {
      violations.push({
        severity: 'CAUTION',
        code: 'COMP_VS_UNDER_MIN',
        title: 'Supply Vs Below Rated Vs,min',
        detail: `Supply Vs (${vs.toFixed(1)} V) is below rated minimum (${activePreset.vsMin} V) for ${selectedOpn}.`,
      });
    }
    if (fInKhz <= fMaxKhz && fInKhz > fMaxKhz * 0.5) {
      violations.push({
        severity: 'CAUTION',
        code: 'COMP_TIGHT_TIMING',
        title: 'Tight Comparator Switching Margin (< 2× f_max)',
        detail: `f_in (${formatFreqKhz(fInKhz)}) is above 50% of f_max (${formatFreqKhz(fMaxKhz)}). Propagation delay skew at low overdrive may distort duty cycle.`,
      });
    }
    if (isOpenCollector && trNs > 0.25 * periodNs) {
      violations.push({
        severity: 'CAUTION',
        code: 'COMP_SLOW_RISE',
        title: 'Pull-Up RC Rise Time Exceeds 25% of Signal Period',
        detail: `t_r ≈ 2.2·R_pu·C_load = ${formatTimeNs(trNs)} exceeds 25% of the ${formatTimeNs(periodNs)} period (combined f_eff ≈ ${formatFreqKhz(fEffKhz)}). Lower R_pu, reduce C_load, or select a push-pull comparator.`,
      });
    }
    if (isOpenCollector && iSinkMa > 4 && iSinkMa <= 10) {
      violations.push({
        severity: 'CAUTION',
        code: 'COMP_SINK_WARN',
        title: 'Moderate Output Sink Current (> 4 mA)',
        detail: `I_sink = ${iSinkMa.toFixed(2)} mA. Check the datasheet VOL vs I_sink curve to confirm valid logic-LOW voltage.`,
      });
    }
    if (isOpenCollector && rpuKohm > 100) {
      violations.push({
        severity: 'CAUTION',
        code: 'COMP_WEAK_RPU',
        title: 'Weak Pull-Up Resistor (> 100 kΩ)',
        detail: `R_pu = ${rpuKohm.toFixed(1)} kΩ increases sensitivity to board leakage and capacitive coupling.`,
      });
    }

    const dangerCount = violations.filter((v) => v.severity === 'DANGER').length;
    const cautionCount = violations.filter((v) => v.severity === 'CAUTION').length;

    let status: 'PASS' | 'CAUTION' | 'DISTORTION' = 'PASS';
    let statusTitle = 'Candidate Comparator Operating Point — Within Timing & Pull-Up Targets';
    let statusDetail = isOpenCollector
      ? `Target f_in (${formatFreqKhz(fInKhz)}) stays within propagation ceiling f_max (${formatFreqKhz(fMaxKhz)}), RC rise time t_r = ${formatTimeNs(trNs)}, and sink current I_sink = ${iSinkMa.toFixed(2)} mA.`
      : `Target f_in (${formatFreqKhz(fInKhz)}) stays cleanly below propagation ceiling f_max = ${formatFreqKhz(fMaxKhz)} with active push-pull drive (no external pull-up required).`;

    if (dangerCount > 0) {
      status = 'DISTORTION';
      statusTitle =
        violations.length === 1
          ? violations[0].title
          : `Comparator Timing / Rating Violations (${dangerCount} Critical${cautionCount > 0 ? `, ${cautionCount} Caution` : ''})`;
      statusDetail = violations[0].detail;
    } else if (cautionCount > 0) {
      status = 'CAUTION';
      statusTitle =
        violations.length === 1
          ? violations[0].title
          : `Caution — ${cautionCount} Comparator Margin Warnings`;
      statusDetail = violations[0].detail;
    }

    return {
      tpdNs,
      fInKhz,
      vs,
      cloadPf,
      isOpenCollector,
      vpu,
      rpuKohm,
      vol,
      fMaxKhz,
      fEffKhz,
      trNs,
      iSinkMa,
      timingMargin,
      rpuMinKohm,
      rpuMaxKohm,
      rpuWindowValid,
      violations,
      status,
      statusTitle,
      statusDetail,
    };
  }, [
    tpdStr,
    compFreqStr,
    vsStr,
    cloadStr,
    outputStage,
    vpuStr,
    rpuStr,
    volStr,
    isCustom,
    activePreset,
    selectedOpn,
  ]);

  const activeStatus = deviceKind === 'comparator' ? compResults.status : opampResults.status;
  const activeStatusTitle =
    deviceKind === 'comparator' ? compResults.statusTitle : opampResults.statusTitle;
  const activeStatusDetail =
    deviceKind === 'comparator' ? compResults.statusDetail : opampResults.statusDetail;
  const activeViolations =
    deviceKind === 'comparator' ? compResults.violations : opampResults.violations;

  const statusClasses =
    activeStatus === 'DISTORTION'
      ? 'border-rose-400 bg-rose-50 text-rose-950'
      : activeStatus === 'CAUTION'
        ? 'border-amber-400 bg-amber-50 text-amber-950'
        : 'border-emerald-400 bg-emerald-50 text-emerald-950';

  const copySimulationLink = async () => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams();
    if (!isCustom) qs.set('opn', selectedOpn);
    qs.set('vs', vsStr);
    if (deviceKind === 'comparator') {
      qs.set('tpd', tpdStr);
      qs.set('fin', compFreqStr);
      qs.set('out', outputStage);
      qs.set('cload', cloadStr);
      if (outputStage !== 'push-pull') {
        qs.set('vpu', vpuStr);
        qs.set('rpu', rpuStr);
        qs.set('vol', volStr);
      }
    } else {
      qs.set('topo', opampTopology);
      qs.set('av', aclStr);
      qs.set('fsig', fSigStr);
      qs.set('vp', vPeakStr);
      qs.set('gbwp', gbwpStr);
      qs.set('sr', srStr);
    }
    const url = `${window.location.origin}${window.location.pathname}?${qs.toString()}`;
    try {
      window.history.replaceState(null, '', url);
    } catch {
      // ignore
    }
    const ok = await copyText(url);
    setCopyState(ok ? 'copied' : 'error');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2200);
    trackEvent('calculator_share_link', {
      calculator: CALC_ID,
      opn: selectedOpn,
      device_kind: deviceKind,
      status: activeStatus,
      copied: ok,
    });
  };

  const inputCls =
    'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600';

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    step: string,
    min?: string,
    hint?: string,
  ) => (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={inputCls}
      />
      {hint && <span className="mt-0.5 block text-xs font-mono text-slate-600">{hint}</span>}
    </label>
  );

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          {deviceKind === 'comparator' ? (
            <Gauge className="h-4 w-4 text-violet-300" aria-hidden="true" />
          ) : (
            <Activity className="h-4 w-4 text-sky-400" aria-hidden="true" />
          )}
          <h3 className="text-sm font-bold tracking-tight">
            {deviceKind === 'comparator'
              ? 'Interactive Comparator Timing & Pull-Up Output Stage Calculator'
              : 'Interactive Op-Amp GBWP, Noise Gain & Slew Rate Checker'}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
              deviceKind === 'comparator'
                ? 'bg-violet-900/80 text-violet-100 border border-violet-600'
                : 'bg-slate-800 text-sky-200'
            }`}
          >
            {selectedOpn} · {deviceKind === 'comparator' ? 'Comparator Mode' : 'Op-Amp Mode'}
          </span>
          {!isCompact && (
            <button
              type="button"
              onClick={copySimulationLink}
              className="inline-flex items-center gap-1 rounded border border-sky-700 bg-sky-900/60 px-2 py-1 text-xs font-medium text-sky-100 hover:bg-sky-800 cursor-pointer print:hidden"
              title="Copy a shareable link with the current OPN and inputs"
            >
              {copyState === 'copied' ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copyState === 'copied' ? 'Link Copied' : copyState === 'error' ? 'Copy Failed' : 'Copy Link'}
            </button>
          )}
          <button
            type="button"
            onClick={() => applyPreset(activePreset, 'reset', isCustom)}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer print:hidden"
            title={`Restore ${selectedOpn} datasheet defaults`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      {presets.length > 0 && (
        <PresetSearchBar
          presets={presets}
          selectedOpn={isCustom ? '' : selectedOpn}
          describe={(p) =>
            p.deviceKind === 'comparator'
              ? `Comparator · t_pd ${p.propDelayNs ?? '?'} ns · ${p.outputType ?? 'open-collector'}`
              : `Op-Amp · ${p.gbwpMhz ?? '?'} MHz · ${p.slewRateVus ?? '?'} V/µs${p.railToRailOut ? ' · RRO' : ''}`
          }
          onSelect={(p) => applyPreset(p, 'preset', false)}
        />
      )}

      <div className="p-4 sm:p-5 space-y-5">
        {deviceKind === 'comparator' ? (
          /* ============================================================== */
          /* DEDICATED COMPARATOR MODE (no fabricated GBWP / SR math)       */
          /* ============================================================== */
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 mr-1">Output Stage:</span>
              {(['open-collector', 'open-drain', 'push-pull'] as const).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    setOutputStage(stage);
                    trackEvent('calculator_interact', {
                      calculator: CALC_ID,
                      opn: selectedOpn,
                      device_kind: 'comparator',
                      output_stage: stage,
                    });
                  }}
                  className={`rounded-md border px-3 py-1 text-xs font-mono font-bold uppercase cursor-pointer transition-colors ${
                    outputStage === stage
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {stage}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-600">
                Auto-switched: comparators are open-loop switching devices (t_pd &amp; output pull-up govern speed).
              </span>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              onBlur={(e) => {
                if (e.target instanceof HTMLInputElement) {
                  trackEvent('calculator_interact', {
                    calculator: CALC_ID,
                    opn: selectedOpn,
                    device_kind: 'comparator',
                    status: compResults.status,
                  });
                }
              }}
            >
              {field('Prop. Delay t_pd (ns)', tpdStr, setTpdStr, '10', '1', 'datasheet typ')}
              {field('Input Signal f_in (kHz)', compFreqStr, setCompFreqStr, '10', '0.01')}
              {field(
                'Supply Span Vs (V)',
                vsStr,
                setVsStr,
                '0.5',
                '0.5',
                isCustom
                  ? undefined
                  : `rated ${activePreset.vsMin ?? 2}–${activePreset.vsMax} V`,
              )}
              {field('Load Cap C_load (pF)', cloadStr, setCloadStr, '5', '1', 'pin + trace + probe')}

              {compResults.isOpenCollector && (
                <>
                  {field(
                    'Pull-Up Voltage Vpu (V)',
                    vpuStr,
                    setVpuStr,
                    '0.1',
                    '0.5',
                    isCustom ? undefined : `≤ ${activePreset.vsMax} V`,
                  )}
                  {field('Pull-Up Resistor R_pu (kΩ)', rpuStr, setRpuStr, '0.5', '0.1')}
                  {field('Output Low Vol (V)', volStr, setVolStr, '0.05', '0', 'typ 0.15–0.4 V')}
                </>
              )}
            </div>

            {/* Comparator Status Banner */}
            <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
              {activeStatus === 'DISTORTION' ? (
                <Flame className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
              ) : activeStatus === 'CAUTION' ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-bold">{activeStatusTitle}</p>
                {activeViolations.length === 0 ? (
                  <p className="text-xs leading-relaxed">{activeStatusDetail}</p>
                ) : (
                  <ul className="space-y-1.5 text-xs leading-relaxed">
                    {activeViolations.map((v) => (
                      <li key={v.code} className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                            v.severity === 'DANGER'
                              ? 'bg-rose-700 text-white'
                              : 'bg-amber-700 text-white'
                          }`}
                        >
                          {v.severity === 'DANGER' ? 'Critical' : 'Caution'}
                        </span>
                        <span>
                          <strong className="font-semibold">{v.title}:</strong> {v.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Comparator KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Propagation Delay t_pd</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                  {formatTimeNs(compResults.tpdNs)}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Max Toggle f_max (1/4·t_pd)</div>
                <div
                  className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                    compResults.fInKhz > compResults.fMaxKhz ? 'text-rose-700' : 'text-slate-950'
                  }`}
                >
                  {formatFreqKhz(compResults.fMaxKhz)}
                </div>
                <div className="mt-0.5 text-xs font-mono text-slate-600">
                  {compResults.timingMargin.toFixed(1)}× vs f_in
                </div>
              </div>

              {compResults.isOpenCollector ? (
                <>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Pull-Up Rise Time t_r</div>
                    <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                      {formatTimeNs(compResults.trNs)}
                    </div>
                    <div className="mt-0.5 text-xs font-mono text-slate-600">
                      combined f_eff ≈ {formatFreqKhz(compResults.fEffKhz)}
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Output Sink Current I_sink</div>
                    <div
                      className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                        compResults.iSinkMa > 10
                          ? 'text-rose-700'
                          : compResults.iSinkMa > 4
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {compResults.iSinkMa.toFixed(2)} <span className="text-xs font-normal">mA</span>
                    </div>
                    <div className="mt-0.5 text-xs font-mono text-slate-600">
                      Rec. R_pu:{' '}
                      {compResults.rpuWindowValid
                        ? `${compResults.rpuMinKohm.toFixed(1)}–${compResults.rpuMaxKohm.toFixed(1)} kΩ`
                        : `≥ ${compResults.rpuMinKohm.toFixed(1)} kΩ (speed-limited)`}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Output Stage</div>
                    <div className="mt-1 font-mono text-lg font-bold text-emerald-700">Push-Pull</div>
                    <div className="mt-0.5 text-xs font-mono text-slate-600">No external R_pu needed</div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Timing Margin</div>
                    <div
                      className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                        compResults.timingMargin < 1
                          ? 'text-rose-700'
                          : compResults.timingMargin < 2
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {compResults.timingMargin.toFixed(2)}×
                    </div>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs font-mono text-slate-600">
              Comparator Equations: f_max ≈ 1 / (4·t_pd)
              {compResults.isOpenCollector
                ? ' · t_r ≈ 2.2·R_pu·C_load · I_sink = (Vpu − Vol) / R_pu'
                : ' · Active push-pull output drives both rising and falling edges'}
            </p>
          </>
        ) : (
          /* ============================================================== */
          /* LINEAR OP-AMP MODE (Topology + Noise Gain + Rail Headroom)     */
          /* ============================================================== */
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 mr-1">Topology:</span>
              {(
                [
                  { id: 'non-inverting', label: 'Non-Inverting (NG = Av)' },
                  { id: 'inverting', label: 'Inverting (NG = 1 + |Av|)' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setOpampTopology(t.id);
                    trackEvent('calculator_interact', {
                      calculator: CALC_ID,
                      opn: selectedOpn,
                      device_kind: 'opamp',
                      topology: t.id,
                    });
                  }}
                  className={`rounded-md border px-3 py-1 text-xs font-mono font-bold cursor-pointer transition-colors ${
                    opampTopology === t.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={railToRailOut}
                  onChange={(e) => setRailToRailOut(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Rail-to-Rail Output (RRO)
              </label>
            </div>

            {/* Op-Amp Inputs */}
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
              onBlur={(e) => {
                if (e.target instanceof HTMLInputElement) {
                  trackEvent('calculator_interact', {
                    calculator: CALC_ID,
                    opn: selectedOpn,
                    device_kind: 'opamp',
                    topology: opampTopology,
                    status: opampResults.status,
                  });
                }
              }}
            >
              {field(
                opampTopology === 'inverting' ? 'Signal Gain |Av|' : 'Closed-Loop Av',
                aclStr,
                setAclStr,
                '1',
                opampTopology === 'inverting' ? '0.1' : '1',
                `NG = ${opampResults.noiseGain.toFixed(1)} V/V`,
              )}
              {field('Signal f_sig (kHz)', fSigStr, setFSigStr, '1', '0.01')}
              {field(
                'Supply Span Vs (V)',
                vsStr,
                setVsStr,
                '0.5',
                '0.5',
                isCustom
                  ? undefined
                  : `rated ${activePreset.vsMin ?? 2.7}–${activePreset.vsMax} V`,
              )}
              {field(
                'Output Vpeak (V)',
                vPeakStr,
                setVPeakStr,
                '0.1',
                '0.01',
                `±${(opampResults.vs / 2).toFixed(1)} V rail`,
              )}
              {field('Op-Amp GBWP (MHz)', gbwpStr, setGbwpStr, '0.1', '0.01')}
              {field('Slew Rate SR (V/µs)', srStr, setSrStr, '0.1', '0.005')}
            </div>

            {/* Status Banner (ALL simultaneous violations) */}
            <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
              {activeStatus === 'DISTORTION' ? (
                <Flame className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
              ) : activeStatus === 'CAUTION' ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-bold">{activeStatusTitle}</p>
                {activeViolations.length === 0 ? (
                  <p className="text-xs leading-relaxed">{activeStatusDetail}</p>
                ) : (
                  <ul className="space-y-1.5 text-xs leading-relaxed">
                    {activeViolations.map((v) => (
                      <li key={v.code} className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                            v.severity === 'DANGER'
                              ? 'bg-rose-700 text-white'
                              : 'bg-amber-700 text-white'
                          }`}
                        >
                          {v.severity === 'DANGER' ? 'Critical' : 'Caution'}
                        </span>
                        <span>
                          <strong className="font-semibold">{v.title}:</strong> {v.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Op-Amp KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Closed-Loop −3 dB BW</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                  {formatFreqKhz(opampResults.f3dbKhz)}
                </div>
                <div className="mt-0.5 text-xs font-mono text-slate-600">
                  NG = {opampResults.noiseGain.toFixed(1)} · {opampResults.bwRatio.toFixed(1)}× f_sig
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Required Slew Rate</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                  {opampResults.requiredSrVus.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-slate-600">V/µs</span>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Full-Power BW (FPBW)</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                  {formatFreqKhz(opampResults.fpbwKhz)}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Slew Rate Margin</div>
                <div
                  className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                    opampResults.srRatio < 1
                      ? 'text-rose-700'
                      : opampResults.srRatio < 1.5
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                  }`}
                >
                  {opampResults.srRatio.toFixed(2)}×
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 col-span-2 sm:col-span-1">
                <div className="text-xs font-semibold text-slate-600">Output Rail Headroom</div>
                <div
                  className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                    opampResults.headroomToRailV < 0
                      ? 'text-rose-700'
                      : opampResults.headroomToRailV < (railToRailOut ? 0.15 : 1.5)
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                  }`}
                >
                  {opampResults.headroomToRailV >= 0 ? '+' : ''}
                  {opampResults.headroomToRailV.toFixed(2)} <span className="text-xs font-normal">V</span>
                </div>
                <div className="mt-0.5 text-xs font-mono text-slate-600">
                  {railToRailOut ? 'RRO (≥ 0.15 V)' : 'Non-RRO (≥ 1.5 V)'}
                </div>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-600">
              Equations: Noise Gain NG = {opampTopology === 'inverting' ? '1 + |Av|' : 'Av'} · f_-3dB = GBWP / NG ·
              SR_req = 2π·f_sig·Vpeak · FPBW = SR / (2π·Vpeak)
            </p>
          </>
        )}

        <p className="text-xs text-slate-600 leading-relaxed">
          Engineering estimate only — results are review candidates, not a guarantee of AC stability or switching
          performance. Verify open-loop phase margin, VOH/VOL swing under load, and overdrive dispersion in the
          official datasheet; safety-critical designs require independent qualification.
        </p>
      </div>
    </div>
  );
}
