'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  FileCode2,
  RotateCcw,
  Search,
  Sliders,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export interface FeedbackPreset {
  opn: string;
  slug: string;
  category: 'dcdc' | 'ldo';
  manufacturer: string;
  packageCode: string;
  vrefV: number;
  voutMinV: number;
  voutMaxV: number;
  vrefPage: number;
  fswKhz: number | null;
}

export interface FeedbackDividerClientProps {
  presets: FeedbackPreset[];
}

type SeriesKey = 'E96' | 'E48' | 'E24';
type R2RangeKey = 'low_z' | 'standard' | 'low_iq';

const SERIES_META: Record<SeriesKey, { label: string; tolPct: number; values: number[] }> = {
  E96: {
    label: 'E96 (1% Precision)',
    tolPct: 1.0,
    values: [
      1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.30,
      1.33, 1.37, 1.40, 1.43, 1.47, 1.50, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,
      1.78, 1.82, 1.87, 1.91, 1.96, 2.00, 2.05, 2.10, 2.15, 2.21, 2.26, 2.32,
      2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.80, 2.87, 2.94, 3.01, 3.09,
      3.16, 3.24, 3.32, 3.40, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12,
      4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49,
      5.62, 5.76, 5.90, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32,
      7.50, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
    ],
  },
  E48: {
    label: 'E48 (2% Standard)',
    tolPct: 2.0,
    values: [
      1.00, 1.05, 1.10, 1.15, 1.21, 1.27, 1.33, 1.40, 1.47, 1.54, 1.62, 1.69,
      1.78, 1.87, 1.96, 2.05, 2.15, 2.26, 2.37, 2.49, 2.61, 2.74, 2.87, 3.01,
      3.16, 3.32, 3.48, 3.65, 3.83, 4.02, 4.22, 4.42, 4.64, 4.87, 5.11, 5.36,
      5.62, 5.90, 6.19, 6.49, 6.81, 7.15, 7.50, 7.87, 8.25, 8.66, 9.09, 9.53,
    ],
  },
  E24: {
    label: 'E24 (5% General)',
    tolPct: 5.0,
    values: [
      1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
      3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
    ],
  },
};

const R2_RANGES: Record<R2RangeKey, { label: string; minOhm: number; maxOhm: number }> = {
  low_z: { label: 'Low-Z / Noise-Immune (500 Ω – 10 kΩ)', minOhm: 500, maxOhm: 10_000 },
  standard: { label: 'Standard (1 kΩ – 100 kΩ)', minOhm: 1_000, maxOhm: 100_000 },
  low_iq: { label: 'Ultra-Low Iq Battery (100 kΩ – 1 MΩ)', minOhm: 100_000, maxOhm: 1_000_000 },
};

const COMMON_RAILS = [1.2, 1.8, 2.5, 3.3, 5.0, 9.0, 12.0, 15.0, 24.0];

function formatOhms(ohms: number): string {
  if (ohms >= 1_000_000) return `${Number((ohms / 1_000_000).toFixed(3))} MΩ`;
  if (ohms >= 1_000) return `${Number((ohms / 1_000).toFixed(3))} kΩ`;
  return `${Number(ohms.toFixed(1))} Ω`;
}

function formatOhmsKiCad(ohms: number): string {
  if (ohms >= 1_000_000) return `${Number((ohms / 1_000_000).toFixed(2))}M`;
  if (ohms >= 1_000) return `${Number((ohms / 1_000).toFixed(2))}k`;
  return `${Number(ohms.toFixed(1))}R`;
}

function formatCapPf(pf: number): string {
  if (pf >= 1000) return `${Number((pf / 1000).toFixed(2))} nF`;
  return `${Math.round(pf)} pF`;
}

function buildStandardValues(series: SeriesKey, minOhm: number, maxOhm: number): number[] {
  const mantissas = SERIES_META[series].values;
  const out: number[] = [];
  for (let exp = 1; exp <= 7; exp++) {
    const mult = Math.pow(10, exp);
    for (const m of mantissas) {
      const val = Number((m * mult).toPrecision(4));
      if (val >= minOhm && val <= maxOhm) {
        out.push(val);
      }
    }
  }
  return out;
}

function findNearestIndex(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface DividerSolution {
  r1Ohm: number;
  r2Ohm: number;
  voutActual: number;
  errorPct: number;
  voutMinWorst: number;
  voutMaxWorst: number;
  iDivUa: number;
  powerMw: number;
  ifbShiftMv: number;
  ifbShiftPct: number;
  cffLowPf: number;
  cffHighPf: number;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
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

export function FeedbackDividerClient({ presets }: FeedbackDividerClientProps) {
  const defaultPreset = presets[0] ?? null;

  const [presetQuery, setPresetQuery] = useState('');
  const [selectedOpn, setSelectedOpn] = useState<string>(defaultPreset?.opn ?? 'CUSTOM');
  const [targetVoutStr, setTargetVoutStr] = useState<string>('3.3');
  const [vrefStr, setVrefStr] = useState<string>(defaultPreset ? String(defaultPreset.vrefV) : '0.8');
  const [vrefTolStr, setVrefTolStr] = useState<string>('1.5');
  const [series, setSeries] = useState<SeriesKey>('E96');
  const [r2Range, setR2Range] = useState<R2RangeKey>('standard');
  const [ifbNaStr, setIfbNaStr] = useState<string>('50');
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [copyMode, setCopyMode] = useState<'idle' | 'kicad' | 'md'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const filteredPresets = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.opn.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q) ||
        String(p.vrefV).includes(q),
    );
  }, [presets, presetQuery]);

  const activePreset = useMemo(
    () => presets.find((p) => p.opn === selectedOpn) ?? null,
    [presets, selectedOpn],
  );

  const applyPreset = (p: FeedbackPreset) => {
    setSelectedOpn(p.opn);
    setVrefStr(String(p.vrefV));
    const currentTarget = Number(targetVoutStr);
    if (!Number.isFinite(currentTarget) || currentTarget <= p.vrefV || currentTarget > p.voutMaxV) {
      const sensible = Math.min(Math.max(3.3, p.voutMinV), p.voutMaxV);
      setTargetVoutStr(String(Number(sensible.toFixed(2))));
    }
    setSelectedIdx(0);
    trackEvent('feedback_divider_preset', { opn: p.opn, vref: p.vrefV });
  };

  const resetDefaults = () => {
    if (defaultPreset) {
      applyPreset(defaultPreset);
    } else {
      setSelectedOpn('CUSTOM');
      setVrefStr('0.8');
    }
    setTargetVoutStr('3.3');
    setVrefTolStr('1.5');
    setSeries('E96');
    setR2Range('standard');
    setIfbNaStr('50');
    setSelectedIdx(0);
  };

  const targetVout = Number.isFinite(Number(targetVoutStr)) ? Number(targetVoutStr) : 3.3;
  const vref = Number.isFinite(Number(vrefStr)) ? Number(vrefStr) : 0.8;
  const vrefTolPct = Math.max(0, Number.isFinite(Number(vrefTolStr)) ? Number(vrefTolStr) : 1.5);
  const ifbNa = Math.max(0, Number.isFinite(Number(ifbNaStr)) ? Number(ifbNaStr) : 0);

  const invalidRatio = !(vref > 0) || !(targetVout > vref);
  const voutExceedsPreset =
    activePreset !== null &&
    (targetVout < activePreset.voutMinV - 0.01 || targetVout > activePreset.voutMaxV + 0.01);

  const solutions = useMemo<DividerSolution[]>(() => {
    if (invalidRatio) return [];
    const { minOhm, maxOhm } = R2_RANGES[r2Range];
    const r2Candidates = buildStandardValues(series, minOhm, maxOhm);
    const r1Pool = buildStandardValues(series, 10, 10_000_000);
    const ratioTarget = targetVout / vref - 1;
    const rTol = SERIES_META[series].tolPct / 100;
    const vrefTol = vrefTolPct / 100;

    const results: DividerSolution[] = [];
    const seen = new Set<string>();

    for (const r2 of r2Candidates) {
      const idealR1 = r2 * ratioTarget;
      const idx = findNearestIndex(r1Pool, idealR1);
      const neighbors = [r1Pool[idx - 1], r1Pool[idx], r1Pool[idx + 1]].filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v),
      );

      for (const r1 of neighbors) {
        const key = `${r1}|${r2}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const voutActual = vref * (1 + r1 / r2);
        const errorPct = ((voutActual - targetVout) / targetVout) * 100;

        // Worst-case Vout band (resistor tolerance + Vref tolerance + Ifb bias shift)
        const ifbShiftV = (ifbNa * 1e-9) * r1;
        const voutMinWorst =
          vref * (1 - vrefTol) * (1 + (r1 * (1 - rTol)) / (r2 * (1 + rTol))) - ifbShiftV;
        const voutMaxWorst =
          vref * (1 + vrefTol) * (1 + (r1 * (1 + rTol)) / (r2 * (1 - rTol))) + ifbShiftV;

        const iDivA = voutActual / (r1 + r2);
        const iDivUa = iDivA * 1e6;
        const powerMw = voutActual * iDivA * 1000;
        const ifbShiftMv = ifbShiftV * 1000;
        const ifbShiftPct = (ifbShiftV / targetVout) * 100;

        // Feed-forward zero fz = 1 / (2*pi*R1*Cff) => Cff = 1 / (2*pi*R1*fz)
        // Typical practical fz band: 10 kHz (higher Cff) to 50 kHz (lower Cff)
        const cffLowPf = (1 / (2 * Math.PI * r1 * 50_000)) * 1e12;
        const cffHighPf = (1 / (2 * Math.PI * r1 * 10_000)) * 1e12;

        results.push({
          r1Ohm: r1,
          r2Ohm: r2,
          voutActual,
          errorPct,
          voutMinWorst,
          voutMaxWorst,
          iDivUa,
          powerMw,
          ifbShiftMv,
          ifbShiftPct,
          cffLowPf,
          cffHighPf,
        });
      }
    }

    // Sort by lowest absolute % error, then prefer mid-band divider current (around ~30-150 uA)
    results.sort((a, b) => {
      const diff = Math.abs(a.errorPct) - Math.abs(b.errorPct);
      if (Math.abs(diff) > 0.0005) return diff;
      return Math.abs(Math.log10(Math.max(a.iDivUa, 0.1)) - 2) - Math.abs(Math.log10(Math.max(b.iDivUa, 0.1)) - 2);
    });

    return results.slice(0, 10);
  }, [invalidRatio, r2Range, series, targetVout, vref, vrefTolPct, ifbNa]);

  const activeSolution = solutions[selectedIdx] ?? solutions[0] ?? null;

  const copyBom = async (format: 'kicad' | 'md') => {
    if (!activeSolution) return;
    const tolLabel = `${SERIES_META[series].tolPct}%`;
    const partLabel = activePreset ? activePreset.opn : `Custom Vref=${vref}V`;
    const cffMid = Math.round((activeSolution.cffLowPf + activeSolution.cffHighPf) / 2);

    const text =
      format === 'kicad'
        ? [
            `# Pin2Pin Feedback Divider BOM — ${partLabel} (Target Vout=${targetVout}V, Actual=${activeSolution.voutActual.toFixed(4)}V, Err=${activeSolution.errorPct >= 0 ? '+' : ''}${activeSolution.errorPct.toFixed(3)}%)`,
            `R_FB1\t${formatOhmsKiCad(activeSolution.r1Ohm)}\tResistor_SMD:R_0603_1608Metric\t${tolLabel} ${series} Top Feedback Resistor`,
            `R_FB2\t${formatOhmsKiCad(activeSolution.r2Ohm)}\tResistor_SMD:R_0603_1608Metric\t${tolLabel} ${series} Bottom Feedback Resistor`,
            `C_FF\t${formatCapPf(cffMid)}\tCapacitor_SMD:C_0603_1608Metric\tOptional Feed-Forward Cap (${formatCapPf(activeSolution.cffLowPf)}-${formatCapPf(activeSolution.cffHighPf)}, DNP unless bench-tuned)`,
          ].join('\n')
        : [
            `### Feedback Divider BOM (${partLabel} → ${targetVout} V)`,
            '| RefDes | Value | Tolerance | Series | Note |',
            '| --- | --- | --- | --- | --- |',
            `| R1 (Top) | ${formatOhms(activeSolution.r1Ohm)} | ±${tolLabel} | ${series} | VOUT to FB |`,
            `| R2 (Bottom) | ${formatOhms(activeSolution.r2Ohm)} | ±${tolLabel} | ${series} | FB to GND |`,
            `| Cff (Opt.) | ${formatCapPf(activeSolution.cffLowPf)} – ${formatCapPf(activeSolution.cffHighPf)} | C0G/NP0 | — | Parallel with R1 (10–50 kHz zero) |`,
            '',
            `- Nominal Vout: **${activeSolution.voutActual.toFixed(4)} V** (${activeSolution.errorPct >= 0 ? '+' : ''}${activeSolution.errorPct.toFixed(3)}%)`,
            `- Worst-Case Band: **${activeSolution.voutMinWorst.toFixed(3)} V – ${activeSolution.voutMaxWorst.toFixed(3)} V** (±${vrefTolPct}% Vref, ±${tolLabel} R, ${ifbNa} nA Ifb)`,
            `- Divider Current: **${activeSolution.iDivUa.toFixed(1)} µA** (${activeSolution.powerMw.toFixed(2)} mW)`,
          ].join('\n');

    const ok = await copyText(text);
    if (ok) {
      setCopyMode(format);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopyMode('idle'), 2200);
      trackEvent('feedback_divider_copy_bom', { format, opn: partLabel });
    }
  };

  return (
    <div className="space-y-6">
      {/* Preset & Parameters Card */}
      <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <h2 className="text-sm font-bold">
              Adjustable Regulator Feedback Divider (R1 / R2) Solver
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-sky-200">
              {activePreset ? `${activePreset.opn} · Vref ${activePreset.vrefV} V` : `Custom Vref ${vref} V`}
            </span>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>

        {/* Verified Adjustable Part Selector */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Verified Adjustable IC Preset ({presets.length} OPNs):
            </span>
            <label className="relative flex-1 min-w-[160px] max-w-xs">
              <span className="sr-only">Search adjustable OPN</span>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={presetQuery}
                onChange={(e) => setPresetQuery(e.target.value)}
                placeholder="Search OPN or Vref (e.g. 0.6, 0.8, 1.25)…"
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 font-mono text-xs text-slate-900"
              />
            </label>
            <label className="flex-1 min-w-[200px] max-w-md">
              <span className="sr-only">Select adjustable IC preset</span>
              <select
                value={selectedOpn}
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setSelectedOpn('CUSTOM');
                  } else {
                    const p = presets.find((x) => x.opn === e.target.value);
                    if (p) applyPreset(p);
                  }
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900 cursor-pointer"
              >
                <option value="CUSTOM">— Custom Vref Input —</option>
                {filteredPresets.map((p) => (
                  <option key={p.opn} value={p.opn}>
                    {p.opn} · Vref {p.vrefV} V ({p.category.toUpperCase()}, {p.packageCode}, p.{p.vrefPage})
                  </option>
                ))}
              </select>
            </label>
            {activePreset && (
              <Link
                href={`/en/part/${activePreset.slug}`}
                className="text-xs font-semibold text-sky-700 hover:underline"
              >
                Datasheet →
              </Link>
            )}
          </div>
          {/* Quick-pick target rail pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600">Common Rails:</span>
            {COMMON_RAILS.map((rail) => (
              <button
                key={rail}
                type="button"
                onClick={() => {
                  setTargetVoutStr(String(rail));
                  setSelectedIdx(0);
                }}
                className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold cursor-pointer ${
                  Math.abs(targetVout - rail) < 0.001
                    ? 'border-sky-700 bg-sky-700 text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'
                }`}
              >
                {rail.toFixed(1)} V
              </button>
            ))}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Target Vout (V)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={targetVoutStr}
                onChange={(e) => {
                  setTargetVoutStr(e.target.value);
                  setSelectedIdx(0);
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Reference Vref (V)</span>
              <input
                type="number"
                step="0.005"
                min="0.1"
                value={vrefStr}
                onChange={(e) => {
                  setVrefStr(e.target.value);
                  setSelectedOpn('CUSTOM');
                  setSelectedIdx(0);
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Vref Tolerance (±%)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={vrefTolStr}
                onChange={(e) => setVrefTolStr(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Resistor Series</span>
              <select
                value={series}
                onChange={(e) => {
                  setSeries(e.target.value as SeriesKey);
                  setSelectedIdx(0);
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900"
              >
                {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SERIES_META[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Bottom R2 Range</span>
              <select
                value={r2Range}
                onChange={(e) => {
                  setR2Range(e.target.value as R2RangeKey);
                  setSelectedIdx(0);
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900"
              >
                {(Object.keys(R2_RANGES) as R2RangeKey[]).map((k) => (
                  <option key={k} value={k}>
                    {R2_RANGES[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">FB Bias I_fb (nA)</span>
              <input
                type="number"
                step="10"
                min="0"
                value={ifbNaStr}
                onChange={(e) => setIfbNaStr(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
              />
            </label>
          </div>

          {invalidRatio && (
            <div className="rounded-md border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-950 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
              Target Vout ({targetVout} V) must be strictly greater than Vref ({vref} V) for a standard non-inverting feedback divider.
            </div>
          )}

          {voutExceedsPreset && activePreset && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              Target Vout ({targetVout} V) sits outside {activePreset.opn}&apos;s datasheet operating envelope ({activePreset.voutMinV}–{activePreset.voutMaxV} V). Verify datasheet limits before hardware testing.
            </div>
          )}
        </div>
      </div>

      {/* Selected Solution Spotlight + Live Interactive Schematic SVG */}
      {activeSolution && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Interactive SVG Schematic */}
          <section
            aria-label="Live feedback divider schematic"
            className="lg:col-span-5 rounded-lg border border-slate-300 bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-950">
                Live Feedback Network Schematic
              </h2>
              <span className="font-mono text-[11px] text-slate-600">
                Vout = Vref × (1 + R1/R2)
              </span>
            </div>

            <svg
              viewBox="0 0 380 265"
              className="w-full h-auto rounded-md border border-slate-200 bg-slate-50"
              role="img"
              aria-label={`Feedback divider schematic: VOUT ${activeSolution.voutActual.toFixed(3)} V through R1 ${formatOhms(activeSolution.r1Ohm)} in parallel with optional Cff to FB node at ${vref} V, then R2 ${formatOhms(activeSolution.r2Ohm)} to GND.`}
            >
              {/* VOUT Rail */}
              <line x1="60" y1="30" x2="290" y2="30" stroke="#0f172a" strokeWidth="2.5" />
              <circle cx="60" cy="30" r="4" fill="#0284c7" />
              <text x="68" y="21" fontSize="12" fontWeight="700" fontFamily="monospace" fill="#0369a1">
                VOUT = {activeSolution.voutActual.toFixed(3)} V
              </text>
              <text x="290" y="21" textAnchor="end" fontSize="10" fontFamily="monospace" fill="#475569">
                (err {activeSolution.errorPct >= 0 ? '+' : ''}{activeSolution.errorPct.toFixed(2)}%)
              </text>

              {/* Wire down to R1 */}
              <line x1="140" y1="30" x2="140" y2="56" stroke="#0f172a" strokeWidth="2" />
              {/* R1 box */}
              <rect x="124" y="56" width="32" height="58" rx="3" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
              <text x="140" y="89" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="monospace" fill="#0f172a">
                R1
              </text>
              <text x="116" y="79" textAnchor="end" fontSize="11" fontWeight="700" fontFamily="monospace" fill="#0369a1">
                {formatOhms(activeSolution.r1Ohm)}
              </text>
              <text x="116" y="95" textAnchor="end" fontSize="9.5" fontFamily="monospace" fill="#475569">
                ±{SERIES_META[series].tolPct}% {series}
              </text>

              {/* Parallel Optional Cff branch */}
              <line x1="140" y1="42" x2="235" y2="42" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" />
              <line x1="235" y1="42" x2="235" y2="76" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" />
              <line x1="221" y1="76" x2="249" y2="76" stroke="#0f766e" strokeWidth="2.5" />
              <line x1="221" y1="86" x2="249" y2="86" stroke="#0f766e" strokeWidth="2.5" />
              <line x1="235" y1="86" x2="235" y2="128" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" />
              <line x1="140" y1="128" x2="235" y2="128" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x="256" y="76" fontSize="10.5" fontWeight="700" fontFamily="monospace" fill="#0f766e">
                Cff (opt.)
              </text>
              <text x="256" y="91" fontSize="9.5" fontFamily="monospace" fill="#334155">
                {formatCapPf(activeSolution.cffLowPf)}–{formatCapPf(activeSolution.cffHighPf)}
              </text>

              {/* FB Node */}
              <line x1="140" y1="114" x2="140" y2="152" stroke="#0f172a" strokeWidth="2" />
              <circle cx="140" cy="136" r="4.5" fill="#d97706" />
              <line x1="140" y1="136" x2="285" y2="136" stroke="#d97706" strokeWidth="2" />
              <rect x="285" y="120" width="84" height="32" rx="4" fill="#fffbeb" stroke="#d97706" strokeWidth="1.8" />
              <text x="327" y="134" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="monospace" fill="#92400e">
                IC FB PIN
              </text>
              <text x="327" y="146" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#78350f">
                Vref {vref} V
              </text>

              {/* R2 box */}
              <rect x="124" y="152" width="32" height="58" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
              <text x="140" y="185" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="monospace" fill="#0f172a">
                R2
              </text>
              <text x="116" y="176" textAnchor="end" fontSize="11" fontWeight="700" fontFamily="monospace" fill="#0f172a">
                {formatOhms(activeSolution.r2Ohm)}
              </text>
              <text x="116" y="192" textAnchor="end" fontSize="9.5" fontFamily="monospace" fill="#475569">
                ±{SERIES_META[series].tolPct}% {series}
              </text>

              {/* Ground Symbol */}
              <line x1="140" y1="210" x2="140" y2="232" stroke="#0f172a" strokeWidth="2" />
              <line x1="122" y1="232" x2="158" y2="232" stroke="#0f172a" strokeWidth="2.5" />
              <line x1="128" y1="239" x2="152" y2="239" stroke="#0f172a" strokeWidth="2" />
              <line x1="134" y1="246" x2="146" y2="246" stroke="#0f172a" strokeWidth="1.8" />
              <text x="166" y="238" fontSize="10.5" fontWeight="700" fontFamily="monospace" fill="#334155">
                AGND
              </text>
            </svg>

            {/* Copy BOM Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyBom('kicad')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                {copyMode === 'kicad' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copyMode === 'kicad' ? 'Copied KiCad BOM' : 'Copy KiCad BOM Lines'}
              </button>
              <button
                type="button"
                onClick={() => copyBom('md')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                {copyMode === 'md' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copyMode === 'md' ? 'Copied Markdown' : 'Copy Markdown Table'}
              </button>
            </div>
          </section>

          {/* Selected Pair Telemetry & Worst-Case Band */}
          <section
            aria-label="Selected pair accuracy and worst-case tolerance"
            className="lg:col-span-7 rounded-lg border border-slate-300 bg-white p-4 sm:p-5 space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-950">
              Selected Pair Analysis (Row #{selectedIdx + 1}: R1 = {formatOhms(activeSolution.r1Ohm)}, R2 = {formatOhms(activeSolution.r2Ohm)})
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-600">Achieved Nominal Vout</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                  {activeSolution.voutActual.toFixed(4)} V
                </div>
                <div
                  className={`font-mono text-[11px] font-semibold ${
                    Math.abs(activeSolution.errorPct) <= 0.5 ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  {activeSolution.errorPct >= 0 ? '+' : ''}
                  {activeSolution.errorPct.toFixed(3)}% nominal
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-600">Worst-Case Vout Band</div>
                <div className="mt-1 font-mono text-base font-bold tabular-nums text-slate-950">
                  {activeSolution.voutMinWorst.toFixed(3)}–{activeSolution.voutMaxWorst.toFixed(3)} V
                </div>
                <div className="font-mono text-[11px] text-slate-600">
                  ±{vrefTolPct}% Vref + ±{SERIES_META[series].tolPct}% R
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-600">Divider Quiescent I_div</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
                  {activeSolution.iDivUa.toFixed(1)} µA
                </div>
                <div className="font-mono text-[11px] text-slate-600">
                  Pd = {activeSolution.powerMw.toFixed(3)} mW
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-600">FB Bias Current Shift</div>
                <div
                  className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                    activeSolution.ifbShiftPct > 0.5 ? 'text-amber-800' : 'text-slate-950'
                  }`}
                >
                  ±{activeSolution.ifbShiftMv.toFixed(2)} mV
                </div>
                <div className="font-mono text-[11px] text-slate-600">
                  I_fb·R1 ({activeSolution.ifbShiftPct.toFixed(3)}%)
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 col-span-2">
                <div className="text-[11px] font-semibold text-slate-600">
                  Recommended Feed-Forward Cap C_ff (fz = 10–50 kHz)
                </div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-teal-900">
                  {formatCapPf(activeSolution.cffLowPf)} – {formatCapPf(activeSolution.cffHighPf)}
                </div>
                <div className="text-[11px] text-slate-600">
                  C0G/NP0 in parallel with R1 boosts phase margin on high-impedance dividers; verify step response on bench.
                </div>
              </div>
            </div>

            {activeSolution.ifbShiftPct > 0.5 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                <span>
                  High-impedance divider warning: {ifbNa} nA FB leakage across R1 ({formatOhms(activeSolution.r1Ohm)}) shifts Vout by ±{activeSolution.ifbShiftMv.toFixed(1)} mV ({activeSolution.ifbShiftPct.toFixed(2)}%). Switch to a lower R2 range unless ultra-low Iq is required.
                </span>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Top 10 Ranked Standard Resistor Pairs Table */}
      {solutions.length > 0 && (
        <section aria-label="Top 10 standard resistor pairs" className="rounded-lg border border-slate-300 bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-950">
              Top {solutions.length} {series} Standard Resistor Pairs (Click any row to update schematic &amp; BOM)
            </h2>
            <span className="text-xs text-slate-600">Sorted by lowest |Vout error %|</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <th scope="col" className="px-3 py-2 font-bold">#</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">R1 (Top)</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">R2 (Bottom)</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">Actual Vout</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">Error %</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">Worst-Case Band</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">I_div</th>
                  <th scope="col" className="px-3 py-2 font-mono font-bold">C_ff (10–50 kHz)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {solutions.map((sol, idx) => {
                  const selected = idx === selectedIdx;
                  return (
                    <tr
                      key={`${sol.r1Ohm}-${sol.r2Ohm}`}
                      onClick={() => setSelectedIdx(idx)}
                      className={`cursor-pointer transition-colors ${
                        selected ? 'bg-sky-50 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-slate-700">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-sky-900">{formatOhms(sol.r1Ohm)}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-950">{formatOhms(sol.r2Ohm)}</td>
                      <td className="px-3 py-2.5 text-slate-950">{sol.voutActual.toFixed(4)} V</td>
                      <td
                        className={`px-3 py-2.5 font-bold ${
                          Math.abs(sol.errorPct) <= 0.25
                            ? 'text-emerald-700'
                            : Math.abs(sol.errorPct) <= 1.0
                              ? 'text-sky-800'
                              : 'text-amber-800'
                        }`}
                      >
                        {sol.errorPct >= 0 ? '+' : ''}
                        {sol.errorPct.toFixed(3)}%
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {sol.voutMinWorst.toFixed(3)}–{sol.voutMaxWorst.toFixed(3)} V
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{sol.iDivUa.toFixed(1)} µA</td>
                      <td className="px-3 py-2.5 text-teal-900">
                        {formatCapPf(sol.cffLowPf)}–{formatCapPf(sol.cffHighPf)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
