'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Flame,
  Link2,
  RotateCcw,
  Search,
  Zap,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export interface DcdcPreset {
  opn: string;
  topology: 'buck' | 'boost' | 'buck-boost';
  vinMin: number;
  vinMax: number;
  voutNom: number;
  fswKhz: number;
  inductorUh: number;
  ratedCurrentMa: number;
  isSwitchLimit: boolean;
  synchronous: boolean;
  efficiencyPct: number;
  minCoutUf?: number;
}

export interface DcdcEfficiencyRippleCalculatorProps {
  initialPreset: DcdcPreset | null;
  presets: DcdcPreset[];
  /**
   * Compact (embedded) mode: hides URL-state reading and the share-link action.
   * Defaults to `true` when `presets` is empty (part-page embed), else `false`.
   */
  compact?: boolean;
}

type Topology = 'buck' | 'boost' | 'buck-boost';

interface DcdcViolation {
  severity: 'DANGER' | 'CAUTION';
  code: string;
  title: string;
  detail: string;
}

const CALC_ID = 'dcdc_ripple';

const CUSTOM_DCDC: DcdcPreset = {
  opn: 'Custom DC-DC',
  topology: 'buck',
  vinMin: 4.5,
  vinMax: 28,
  voutNom: 3.3,
  fswKhz: 500,
  inductorUh: 4.7,
  ratedCurrentMa: 2000,
  isSwitchLimit: false,
  synchronous: true,
  efficiencyPct: 90,
  minCoutUf: 22,
};

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) ? n : fallback;
}

function defaultVinFor(preset: DcdcPreset): number {
  if (preset.topology === 'buck') {
    const candidate = Math.max(preset.voutNom * 2.2, preset.vinMin + 1);
    return Number(Math.min(candidate, preset.vinMax).toFixed(1));
  }
  if (preset.topology === 'boost') {
    const candidate = Math.min(preset.voutNom * 0.65, preset.vinMax);
    return Number(Math.max(candidate, preset.vinMin).toFixed(2));
  }
  // buck-boost (e.g. single Li-Ion 3.6V)
  return Number(Math.min(Math.max(3.6, preset.vinMin), preset.vinMax).toFixed(2));
}

function defaultIoutFor(preset: DcdcPreset): number {
  const scale = preset.isSwitchLimit ? 0.35 : 0.6;
  return Math.max(50, Math.round(preset.ratedCurrentMa * scale));
}

function defaultCoutFor(preset: DcdcPreset): number {
  return Math.max(4.7, preset.minCoutUf ?? 22);
}

function niceCeil(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
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
/* Inductor current waveform (2 switching cycles)                      */
/* ------------------------------------------------------------------ */

interface WaveformProps {
  fswKhz: number;
  tOnUs: number;
  tOffUs: number;
  iAvgMa: number;
  iPeakMa: number;
  iValleyMa: number;
  isDcm: boolean;
  limitMa: number | null;
  limitLabel: string;
  overLimit: boolean;
}

function InductorCurrentWaveform({
  fswKhz,
  tOnUs,
  tOffUs,
  iAvgMa,
  iPeakMa,
  iValleyMa,
  isDcm,
  limitMa,
  limitLabel,
  overLimit,
}: WaveformProps) {
  const W = 640;
  const H = 240;
  const PL = 54;
  const PR = 116;
  const PT = 16;
  const PB = 36;
  const pw = W - PL - PR;
  const ph = H - PT - PB;

  const periodUs = 1000 / fswKhz;
  const tMax = 2 * periodUs;
  const yMax = niceCeil(Math.max(iPeakMa, limitMa ?? 0, iAvgMa, 1) * 1.15);

  const sx = (tUs: number) => PL + (Math.min(Math.max(tUs, 0), tMax) / tMax) * pw;
  const sy = (iMa: number) => PT + (1 - Math.min(Math.max(iMa, 0), yMax) / yMax) * ph;

  const onUs = Math.min(tOnUs, periodUs);
  const offUs = Math.min(tOffUs, periodUs - onUs);
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 2; k++) {
    const t0 = k * periodUs;
    if (isDcm) {
      pts.push([t0, 0], [t0 + onUs, iPeakMa], [t0 + onUs + offUs, 0]);
    } else {
      pts.push([t0, iValleyMa], [t0 + onUs, iPeakMa]);
    }
  }
  pts.push([tMax, isDcm ? 0 : iValleyMa]);
  const path = pts.map(([t, i], idx) => `${idx === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(i).toFixed(1)}`).join(' ');

  const yTicks = [0, 1, 2, 3, 4].map((k) => (yMax * k) / 4);
  const fmtUs = (v: number) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
  const labelX = PL + pw + 6;

  // Stagger right-side labels to avoid overlap.
  const rawLabels: Array<{ y: number; text: string; color: string; weight?: number }> = [
    { y: sy(iPeakMa), text: `Ipeak ${iPeakMa.toFixed(0)} mA`, color: '#0f172a', weight: 700 },
    { y: sy(iAvgMa), text: `IL,avg ${iAvgMa.toFixed(0)} mA`, color: '#0369a1' },
    { y: sy(iValleyMa), text: isDcm ? 'Ivalley 0 mA (DCM)' : `Ivalley ${iValleyMa.toFixed(0)} mA`, color: '#334155' },
  ];
  if (limitMa !== null) {
    rawLabels.push({ y: sy(limitMa), text: `${limitLabel} ${limitMa.toFixed(0)}`, color: '#dc2626', weight: 700 });
  }
  const sorted = [...rawLabels].sort((a, b) => a.y - b.y);
  let lastY = -Infinity;
  const placed = sorted.map((l) => {
    const y = Math.max(l.y + 3, lastY + 13);
    lastY = y;
    return { ...l, ly: Math.min(y, PT + ph + 4) };
  });

  return (
    <figure className="rounded-md border border-slate-200 bg-white p-2.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Inductor current waveform over two switching cycles: peak ${iPeakMa.toFixed(0)} mA, average ${iAvgMa.toFixed(0)} mA, valley ${iValleyMa.toFixed(0)} mA${isDcm ? ', discontinuous conduction mode' : ''}.`}
      >
        {/* On-time shading */}
        {[0, 1].map((k) => (
          <rect
            key={`on${k}`}
            x={sx(k * periodUs)}
            y={PT}
            width={Math.max(0, sx(k * periodUs + onUs) - sx(k * periodUs))}
            height={ph}
            fill="#f59e0b"
            opacity={0.08}
          />
        ))}
        {/* Grid */}
        {yTicks.map((i) => (
          <g key={`y${i}`}>
            <line x1={PL} x2={PL + pw} y1={sy(i)} y2={sy(i)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PL - 6} y={sy(i) + 3} textAnchor="end" fontSize={10} fill="#475569" fontFamily="monospace">
              {Number(i.toFixed(0))}
            </text>
          </g>
        ))}
        {[0, 1, 2].map((k) => (
          <g key={`t${k}`}>
            <line x1={sx(k * periodUs)} x2={sx(k * periodUs)} y1={PT} y2={PT + ph} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
            <text x={sx(k * periodUs)} y={PT + ph + 14} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="monospace">
              {k === 0 ? '0' : `${fmtUs(k * periodUs)} µs`}
            </text>
          </g>
        ))}
        <text x={sx(onUs / 2)} y={PT + 11} textAnchor="middle" fontSize={10} fill="#b45309" fontFamily="monospace">
          ON
        </text>
        {offUs > 0 && (
          <text x={sx(onUs + offUs / 2)} y={PT + 11} textAnchor="middle" fontSize={10} fill="#334155" fontFamily="monospace">
            OFF
          </text>
        )}
        {isDcm && onUs + offUs < periodUs - 1e-9 && (
          <text x={sx((onUs + offUs + periodUs) / 2)} y={sy(0) - 5} textAnchor="middle" fontSize={10} fill="#6d28d9" fontFamily="monospace">
            0 A idle
          </text>
        )}

        {/* Limit line */}
        {limitMa !== null && (
          <line x1={PL} x2={PL + pw} y1={sy(limitMa)} y2={sy(limitMa)} stroke="#dc2626" strokeWidth={2} strokeDasharray={overLimit ? undefined : '6 3'} />
        )}
        {overLimit && limitMa !== null && (
          <rect x={PL} y={PT} width={pw} height={Math.max(0, sy(limitMa) - PT)} fill="#e11d48" opacity={0.08} />
        )}

        {/* Avg / peak / valley reference lines */}
        <line x1={PL} x2={PL + pw} y1={sy(iAvgMa)} y2={sy(iAvgMa)} stroke="#0284c7" strokeWidth={1.25} strokeDasharray="5 3" />
        <line x1={PL} x2={PL + pw} y1={sy(iPeakMa)} y2={sy(iPeakMa)} stroke="#0f172a" strokeWidth={0.75} strokeDasharray="1 3" />
        {!isDcm && (
          <line x1={PL} x2={PL + pw} y1={sy(iValleyMa)} y2={sy(iValleyMa)} stroke="#475569" strokeWidth={0.75} strokeDasharray="1 3" />
        )}

        {/* Waveform */}
        <path d={path} fill="none" stroke={overLimit ? '#e11d48' : '#d97706'} strokeWidth={2.5} strokeLinejoin="round" />

        {/* Right-side labels */}
        {placed.map((l) => (
          <text key={l.text} x={labelX} y={l.ly} fontSize={10} fontWeight={l.weight ?? 500} fill={l.color} fontFamily="monospace">
            {l.text}
          </text>
        ))}

        {/* Axes */}
        <line x1={PL} x2={PL} y1={PT} y2={PT + ph} stroke="#334155" strokeWidth={1} />
        <line x1={PL} x2={PL + pw} y1={PT + ph} y2={PT + ph} stroke="#334155" strokeWidth={1} />
        <text x={PL + pw / 2} y={H - 4} textAnchor="middle" fontSize={10.5} fill="#334155" fontWeight={600}>
          Time (2 switching cycles @ {fswKhz.toFixed(0)} kHz)
        </text>
        <text x={12} y={PT + ph / 2} textAnchor="middle" fontSize={10.5} fill="#334155" fontWeight={600} transform={`rotate(-90 12 ${PT + ph / 2})`}>
          Inductor current IL (mA)
        </text>
      </svg>
      <figcaption className="px-1 pt-1.5 text-xs text-slate-600">
        Idealized piecewise-linear IL(t) {isDcm ? '(DCM: current clamps at 0 A before the next ON phase)' : '(CCM)'}. Real waveforms
        include ESR, dead-time and slope-compensation effects — use as a review candidate and confirm on the bench.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Main calculator                                                     */
/* ------------------------------------------------------------------ */

export function DcdcEfficiencyRippleCalculator({
  initialPreset,
  presets,
  compact,
}: DcdcEfficiencyRippleCalculatorProps) {
  const isCompact = compact ?? presets.length === 0;
  const base: DcdcPreset = initialPreset ?? CUSTOM_DCDC;

  const [activePreset, setActivePreset] = useState<DcdcPreset>(base);
  const [isCustom, setIsCustom] = useState<boolean>(initialPreset === null);
  const [topology, setTopology] = useState<Topology>(base.topology);
  const [vinStr, setVinStr] = useState<string>(String(defaultVinFor(base)));
  const [voutStr, setVoutStr] = useState<string>(String(base.voutNom));
  const [ioutStr, setIoutStr] = useState<string>(String(defaultIoutFor(base)));
  const [fswStr, setFswStr] = useState<string>(String(base.fswKhz));
  const [inductorStr, setInductorStr] = useState<string>(String(base.inductorUh));
  const [coutStr, setCoutStr] = useState<string>(String(defaultCoutFor(base)));
  const [esrStr, setEsrStr] = useState<string>('10');
  const [effStr, setEffStr] = useState<string>(String(base.efficiencyPct));
  const [ratedStr, setRatedStr] = useState<string>(String(base.ratedCurrentMa));
  const [isSwitchLimit, setIsSwitchLimit] = useState<boolean>(base.isSwitchLimit);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextBase = initialPreset ?? CUSTOM_DCDC;
    setActivePreset(nextBase);
    setIsCustom(initialPreset === null);
    setTopology(nextBase.topology);
    setVinStr(String(defaultVinFor(nextBase)));
    setVoutStr(String(nextBase.voutNom));
    setIoutStr(String(defaultIoutFor(nextBase)));
    setFswStr(String(nextBase.fswKhz));
    setInductorStr(String(nextBase.inductorUh));
    setCoutStr(String(defaultCoutFor(nextBase)));
    setEsrStr('10');
    setEffStr(String(nextBase.efficiencyPct));
    setRatedStr(String(nextBase.ratedCurrentMa));
    setIsSwitchLimit(nextBase.isSwitchLimit);
  }, [initialPreset?.opn]);

  const selectedOpn = activePreset.opn;

  const applyPreset = (
    p: DcdcPreset,
    source: 'preset' | 'reset' | 'url' = 'preset',
    custom = false,
  ) => {
    setActivePreset(p);
    setIsCustom(custom);
    setTopology(p.topology);
    setVinStr(String(defaultVinFor(p)));
    setVoutStr(String(p.voutNom));
    setIoutStr(String(defaultIoutFor(p)));
    setFswStr(String(p.fswKhz));
    setInductorStr(String(p.inductorUh));
    setCoutStr(String(defaultCoutFor(p)));
    setEsrStr('10');
    setEffStr(String(p.efficiencyPct));
    setRatedStr(String(p.ratedCurrentMa));
    setIsSwitchLimit(p.isSwitchLimit);
    if (source !== 'url') {
      trackEvent(source === 'reset' ? 'calculator_reset' : 'calculator_preset_select', {
        calculator: CALC_ID,
        opn: p.opn,
        topology: p.topology,
      });
    }
  };

  // Shareable URL state (standalone only) — window.location avoids useSearchParams/Suspense in static export.
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
    if (topo === 'buck' || topo === 'boost' || topo === 'buck-boost') setTopology(topo);
    const num = (key: string, set: (v: string) => void) => {
      const raw = qs.get(key);
      if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) set(raw);
    };
    num('vin', setVinStr);
    num('vout', setVoutStr);
    num('iout', setIoutStr);
    num('fsw', setFswStr);
    num('l', setInductorStr);
    num('cout', setCoutStr);
    num('esr', setEsrStr);
    num('eff', setEffStr);
    num('rated', setRatedStr);
    const isw = qs.get('isw');
    if (isw === '1' || isw === '0') setIsSwitchLimit(isw === '1');
    trackEvent('calculator_url_state_load', { calculator: CALC_ID, opn: opnParam ?? undefined });
    // Mount-only by design.
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const results = useMemo(() => {
    const vin = Math.max(0.1, parseFinite(vinStr, 5.0));
    const vout = Math.max(0.1, parseFinite(voutStr, 3.3));
    const ioutMa = Math.max(1, parseFinite(ioutStr, 500));
    const fswKhz = Math.max(10, parseFinite(fswStr, 500));
    const lUh = Math.max(0.1, parseFinite(inductorStr, 4.7));
    const coutUf = Math.max(0.1, parseFinite(coutStr, 22));
    const esrMohm = Math.max(0, parseFinite(esrStr, 10));
    const effPctInput = Math.max(30, Math.min(99, parseFinite(effStr, 90)));
    const ratedMa = Math.max(10, parseFinite(ratedStr, 1000));

    const ioutA = ioutMa / 1000;
    const fHz = fswKhz * 1000;
    const lH = lUh * 1e-6;
    const coutF = coutUf * 1e-6;
    const esrOhm = esrMohm * 1e-3;

    const vRatio = vout / vin;
    const isTransitionRegion = topology === 'buck-boost' && vRatio >= 0.85 && vRatio <= 1.15;
    // Account for extra 4-switch conduction/switching loss (~3%) in buck-boost transition band
    const effPctEffective = isTransitionRegion ? Math.max(30, effPctInput - 3) : effPctInput;
    const eta = effPctEffective / 100;

    let topologyError: string | null = null;
    let duty = 0.5;
    let ilAvgA = ioutA;
    let deltaIlCcmA = 0;
    let minLUh = lUh;
    let activeModeLabel = topology.toUpperCase();
    // Inductor voltage during ON (vUp) and OFF (vDown) phases, for waveform/DCM model.
    let vUp = Math.max(0.05, vin - vout);
    let vDown = Math.max(0.05, vout);
    let isBuckLikeOutput = false;

    if (topology === 'buck') {
      isBuckLikeOutput = true;
      if (vout >= vin) {
        topologyError = 'Buck converter requires Vin > Vout. Increase Vin or switch topology to Boost / Buck-Boost.';
      } else {
        duty = Math.min(0.99, Math.max(0.01, vout / (vin * eta)));
        ilAvgA = ioutA;
        deltaIlCcmA = (vout * (vin - vout)) / (vin * fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vout * (vin - vout)) / (vin * fHz * targetRippleA)) * 1e6;
      }
    } else if (topology === 'boost') {
      if (vout <= vin) {
        topologyError = 'Boost converter requires Vout > Vin. Raise Vout, lower Vin, or use a Buck / Buck-Boost topology.';
      } else {
        duty = Math.min(0.95, Math.max(0.01, 1 - (vin * eta) / vout));
        ilAvgA = (ioutA * vout) / (vin * eta);
        deltaIlCcmA = (vin * duty) / (fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vin * duty) / (fHz * targetRippleA)) * 1e6;
        vUp = Math.max(0.05, vin);
        vDown = Math.max(0.05, vout - vin);
      }
    } else {
      // 4-Switch Non-Inverting Buck-Boost
      if (isTransitionRegion) {
        // Transition region (0.85 <= Vout/Vin <= 1.15): model true buck-boost switching ripple & losses
        activeModeLabel = 'BUCK-BOOST (Transition Mode)';
        duty = Math.min(0.92, Math.max(0.08, vout / (vin + vout)));
        ilAvgA = Math.max(ioutA, (ioutA * vout) / (vin * eta));
        deltaIlCcmA = (vin * duty) / (fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vin * duty) / (fHz * targetRippleA)) * 1e6;
        vUp = Math.max(0.05, vin);
        vDown = Math.max(0.05, vout);
      } else if (vRatio < 0.85) {
        isBuckLikeOutput = true;
        activeModeLabel = 'BUCK-BOOST (Buck Mode)';
        duty = Math.min(0.98, Math.max(0.02, vout / (vin * eta)));
        ilAvgA = ioutA;
        deltaIlCcmA = (vout * (vin - vout)) / (vin * fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vout * (vin - vout)) / (vin * fHz * targetRippleA)) * 1e6;
        vUp = Math.max(0.05, vin - vout);
        vDown = Math.max(0.05, vout);
      } else {
        activeModeLabel = 'BUCK-BOOST (Boost Mode)';
        duty = Math.min(0.94, Math.max(0.02, 1 - (vin * eta) / vout));
        ilAvgA = (ioutA * vout) / (vin * eta);
        deltaIlCcmA = (vin * duty) / (fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vin * duty) / (fHz * targetRippleA)) * 1e6;
        vUp = Math.max(0.05, vin);
        vDown = Math.max(0.05, vout - vin);
      }
    }

    const dcmBoundaryIlMa = (deltaIlCcmA / 2) * 1000;
    const dcmBoundaryIoutMa = isBuckLikeOutput
      ? dcmBoundaryIlMa
      : dcmBoundaryIlMa * ((vin * eta) / vout);
    const isDcm = !topologyError && ilAvgA < deltaIlCcmA / 2;

    let deltaIlA = deltaIlCcmA;
    let iPeakA: number;
    let iValleyA: number;
    let tOnS: number;
    let tOffS: number;
    if (isDcm) {
      // Ideal DCM triangle: Iavg = Ipk²·L·f·(1/Vup + 1/Vdown)/2 with a 0 A idle interval.
      iPeakA = Math.sqrt((2 * ilAvgA) / (lH * fHz * (1 / vUp + 1 / vDown)));
      iValleyA = 0;
      tOnS = (lH * iPeakA) / vUp;
      tOffS = (lH * iPeakA) / vDown;
      const period = 1 / fHz;
      if (tOnS + tOffS > period) {
        const k = period / (tOnS + tOffS);
        tOnS *= k;
        tOffS *= k;
      }
      duty = tOnS * fHz;
      deltaIlA = iPeakA;
    } else {
      iPeakA = ilAvgA + deltaIlA / 2;
      iValleyA = Math.max(0, ilAvgA - deltaIlA / 2);
      tOnS = duty / fHz;
      tOffS = (1 - duty) / fHz;
    }

    const iPeakMa = iPeakA * 1000;
    const iValleyMa = iValleyA * 1000;
    const deltaIlMa = deltaIlA * 1000;
    const ilAvgMa = ilAvgA * 1000;
    const rippleRatioPct = ilAvgA > 0 ? (deltaIlA / ilAvgA) * 100 : 0;

    // Output voltage ripple ΔVout (capacitive + ESR components)
    const dvCapV = isBuckLikeOutput
      ? deltaIlA / (8 * fHz * coutF)
      : (ioutA * duty) / (fHz * coutF);
    const dvEsrV = isBuckLikeOutput ? deltaIlA * esrOhm : iPeakA * esrOhm;
    const dvCapMv = dvCapV * 1000;
    const dvEsrMv = dvEsrV * 1000;
    const deltaVoutMv = dvCapMv + dvEsrMv;
    const deltaVoutPct = (deltaVoutMv / (vout * 1000)) * 100;

    const poutMw = vout * ioutMa;
    const pinMw = poutMw / eta;
    const pLossMw = pinMw - poutMw;

    // Separated checks: Iout vs rated output current, Ipeak vs switch current limit.
    const compareCurrentMa = isSwitchLimit ? iPeakMa : ioutMa;
    const compareLabel = isSwitchLimit ? 'Ipeak vs Isw limit' : 'Iout vs rated Iout';
    const currentUtilizationPct = (compareCurrentMa / ratedMa) * 100;
    const overIoutRated = !isSwitchLimit && ioutMa > ratedMa;
    const overSwitchLimit = isSwitchLimit && iPeakMa > ratedMa;
    const peakAboveOutputRating = !isSwitchLimit && ioutMa <= ratedMa && iPeakMa > ratedMa;
    const inductanceLow = !topologyError && lUh < minLUh * 0.8;
    const overVinMax = !isCustom && vin > activePreset.vinMax;
    const underVinMin = !isCustom && vin < activePreset.vinMin;
    const highVoutRipple = !topologyError && deltaVoutPct > 3.0;

    // Collect ALL simultaneous violations (no else-if masking)
    const violations: DcdcViolation[] = [];

    if (topologyError) {
      violations.push({
        severity: 'DANGER',
        code: 'TOPO_RATIO',
        title: 'Invalid Input/Output Voltage Ratio',
        detail: topologyError,
      });
    }
    if (overVinMax) {
      violations.push({
        severity: 'DANGER',
        code: 'VIN_OVER_MAX',
        title: 'Input Voltage Exceeds Rated Vin,max',
        detail: `Vin (${vin.toFixed(2)} V) exceeds the rated operating maximum (${activePreset.vinMax} V) for ${selectedOpn}.`,
      });
    }
    if (!topologyError && overSwitchLimit) {
      violations.push({
        severity: 'DANGER',
        code: 'ISW_OVER_LIMIT',
        title: 'Peak Switch Current Ipeak Exceeds Rated Isw Limit',
        detail: `Estimated Ipeak (${iPeakMa.toFixed(0)} mA) exceeds switch limit Isw (${ratedMa.toFixed(0)} mA) at Iout = ${ioutMa.toFixed(0)} mA. Cycle-by-cycle current limiting may occur; reduce load, raise L to trim ripple, adjust Vin, or review a higher-current IC.`,
      });
    }
    if (!topologyError && overIoutRated) {
      violations.push({
        severity: 'DANGER',
        code: 'IOUT_OVER_RATED',
        title: 'Load Current Iout Exceeds Rated Output Current',
        detail: `Load Iout (${ioutMa.toFixed(0)} mA) exceeds rated continuous output current (${ratedMa.toFixed(0)} mA). Inductor Ipeak = ${iPeakMa.toFixed(0)} mA; reduce load or evaluate a higher-current IC.`,
      });
    }
    if (underVinMin) {
      violations.push({
        severity: 'CAUTION',
        code: 'VIN_UNDER_MIN',
        title: 'Input Voltage Below Rated Vin,min',
        detail: `Vin (${vin.toFixed(2)} V) is below the datasheet minimum operating input (${activePreset.vinMin} V) for ${selectedOpn}.`,
      });
    }
    if (!topologyError && peakAboveOutputRating) {
      violations.push({
        severity: 'CAUTION',
        code: 'IPEAK_ABOVE_IOUT_RATING',
        title: 'Inductor Peak Current Ipeak Exceeds Rated Output Current',
        detail: `Load Iout (${ioutMa.toFixed(0)} mA) is within the rated continuous output (${ratedMa.toFixed(0)} mA), but inductor Ipeak (${iPeakMa.toFixed(0)} mA) exceeds that figure. Verify the datasheet internal switch current limit Isw separately and size inductor Isat ≥ ${(iPeakMa * 1.25).toFixed(0)} mA.`,
      });
    }
    if (!topologyError && currentUtilizationPct > 85 && currentUtilizationPct <= 100) {
      violations.push({
        severity: 'CAUTION',
        code: 'HIGH_UTIL',
        title: 'Tight Current Margin (> 85% Utilization)',
        detail: `${compareLabel} utilization is ${currentUtilizationPct.toFixed(0)}% of ${ratedMa.toFixed(0)} mA.`,
      });
    }
    if (inductanceLow) {
      violations.push({
        severity: 'CAUTION',
        code: 'LOW_L',
        title: 'Inductance Below 30% Ripple Target',
        detail: `Selected L (${lUh} µH) is below the ~30% ripple target (${minLUh.toFixed(1)} µH), increasing peak/RMS currents and core losses.`,
      });
    }
    if (isDcm) {
      violations.push({
        severity: 'CAUTION',
        code: 'DCM_MODE',
        title: 'Discontinuous Conduction Mode (DCM)',
        detail: `Inductor current reaches 0 A every cycle (IL,avg ${ilAvgMa.toFixed(0)} mA < ΔIL,CCM/2 = ${dcmBoundaryIlMa.toFixed(0)} mA; boundary Iout ≈ ${dcmBoundaryIoutMa.toFixed(0)} mA). Expect pulse-skipping / higher light-load ripple unless forced-PWM.`,
      });
    }
    if (highVoutRipple) {
      violations.push({
        severity: 'CAUTION',
        code: 'HIGH_VOUT_RIPPLE',
        title: 'Elevated Output Voltage Ripple (> 3% of Vout)',
        detail: `Estimated ΔVout (${deltaVoutMv.toFixed(1)} mVpp, ${deltaVoutPct.toFixed(1)}% of Vout) exceeds 3%. Increase Cout or choose lower-ESR ceramic capacitors.`,
      });
    }
    if (!topologyError && isTransitionRegion) {
      violations.push({
        severity: 'CAUTION',
        code: 'BB_TRANSITION',
        title: '4-Switch Buck-Boost Transition Region (0.85 ≤ Vout/Vin ≤ 1.15)',
        detail: `Vin (${vin.toFixed(2)} V) is close to Vout (${vout.toFixed(2)} V). Modeled with buck-boost ripple ΔIL = Vin·D/(fsw·L) at D = Vout/(Vin+Vout) = ${(duty * 100).toFixed(1)}% and ~3% extra 4-switch loss penalty (η_eff ≈ ${effPctEffective.toFixed(0)}%).`,
      });
    }

    const dangerCount = violations.filter((v) => v.severity === 'DANGER').length;
    const cautionCount = violations.filter((v) => v.severity === 'CAUTION').length;

    let status: 'SAFE' | 'CAUTION' | 'DANGER' = 'SAFE';
    let statusTitle = 'Candidate Operating Point — Within Current & Ripple Targets';
    let statusDetail = isSwitchLimit
      ? `Peak switch current Ipeak (${iPeakMa.toFixed(0)} mA) stays below switch limit Isw (${ratedMa.toFixed(0)} mA, ${currentUtilizationPct.toFixed(0)}% utilization). Load Iout = ${ioutMa.toFixed(0)} mA, ripple ratio ${rippleRatioPct.toFixed(0)}%, est. ΔVout = ${deltaVoutMv.toFixed(1)} mVpp.`
      : `Both load Iout (${ioutMa.toFixed(0)} mA) and peak inductor current Ipeak (${iPeakMa.toFixed(0)} mA) stay within the ${ratedMa.toFixed(0)} mA rating (${currentUtilizationPct.toFixed(0)}% load utilization). Size inductor Isat ≥ ${(iPeakMa * 1.25).toFixed(0)} mA; est. ΔVout = ${deltaVoutMv.toFixed(1)} mVpp.`;

    if (dangerCount > 0) {
      status = 'DANGER';
      statusTitle =
        violations.length === 1
          ? violations[0].title
          : `Critical Operating Violations (${dangerCount} Critical${cautionCount > 0 ? `, ${cautionCount} Caution` : ''})`;
      statusDetail = violations[0].detail;
    } else if (cautionCount > 0) {
      status = 'CAUTION';
      statusTitle =
        violations.length === 1
          ? violations[0].title
          : `Caution — ${cautionCount} Design Checks Flagged`;
      statusDetail = violations[0].detail;
    }

    let limitMa: number | null = null;
    let limitLabel = '';
    let overLimit = false;
    if (isSwitchLimit) {
      limitMa = ratedMa;
      limitLabel = 'Isw limit';
      overLimit = overSwitchLimit;
    } else if (isBuckLikeOutput) {
      limitMa = ratedMa;
      limitLabel = 'Rated Iout';
      overLimit = overIoutRated;
    }

    return {
      topologyError,
      activeModeLabel,
      isTransitionRegion,
      dutyPct: duty * 100,
      ilAvgMa,
      deltaIlMa,
      iPeakMa,
      iValleyMa,
      ioutMa,
      isDcm,
      dcmBoundaryIlMa,
      dcmBoundaryIoutMa,
      tOnUs: tOnS * 1e6,
      tOffUs: tOffS * 1e6,
      fswKhz,
      rippleRatioPct,
      minLUh,
      deltaVoutMv,
      dvCapMv,
      dvEsrMv,
      deltaVoutPct,
      poutMw,
      pLossMw,
      effPctEffective,
      ratedMa,
      compareLabel,
      currentUtilizationPct,
      limitMa,
      limitLabel,
      overLimit,
      isBuckLikeOutput,
      violations,
      status,
      statusTitle,
      statusDetail,
    };
  }, [
    topology,
    vinStr,
    voutStr,
    ioutStr,
    fswStr,
    inductorStr,
    coutStr,
    esrStr,
    effStr,
    ratedStr,
    isSwitchLimit,
    isCustom,
    activePreset,
    selectedOpn,
  ]);

  const copySimulationLink = async () => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams();
    if (!isCustom) qs.set('opn', selectedOpn);
    qs.set('topo', topology);
    qs.set('vin', vinStr);
    qs.set('vout', voutStr);
    qs.set('iout', ioutStr);
    qs.set('fsw', fswStr);
    qs.set('l', inductorStr);
    qs.set('cout', coutStr);
    qs.set('esr', esrStr);
    qs.set('eff', effStr);
    qs.set('rated', ratedStr);
    qs.set('isw', isSwitchLimit ? '1' : '0');
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
      topology,
      status: results.status,
      copied: ok,
    });
  };

  const statusClasses =
    results.status === 'DANGER'
      ? 'border-rose-400 bg-rose-50 text-rose-950'
      : results.status === 'CAUTION'
        ? 'border-amber-400 bg-amber-50 text-amber-950'
        : 'border-emerald-400 bg-emerald-50 text-emerald-950';

  const utilBar =
    results.currentUtilizationPct > 100
      ? 'bg-rose-600'
      : results.currentUtilizationPct > 85
        ? 'bg-amber-500'
        : 'bg-emerald-600';

  const inputCls =
    'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600';

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    step: string,
    min?: string,
    hint?: string,
    extra = '',
  ) => (
    <label className={`block ${extra}`}>
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

  const kpi = (label: string, value: string, unit: string, cls = 'text-slate-950', sub?: string) => (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${cls}`}>
        {value} <span className="text-xs font-normal text-slate-600">{unit}</span>
      </div>
      {sub && <div className="mt-0.5 text-xs font-mono text-slate-600">{sub}</div>}
    </div>
  );

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <h3 className="text-sm font-bold tracking-tight">
            Interactive DC-DC Inductor Ripple, Peak Current &amp; Output Ripple Calculator
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-amber-200">
            {selectedOpn} · {results.activeModeLabel}
          </span>
          {!isCompact && (
            <button
              type="button"
              onClick={copySimulationLink}
              className="inline-flex items-center gap-1 rounded border border-amber-700 bg-amber-900/50 px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-800 cursor-pointer print:hidden"
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
            `${p.topology} · ${p.isSwitchLimit ? 'Isw' : 'Iout'} ${p.ratedCurrentMa} mA · ${p.fswKhz} kHz`
          }
          onSelect={(p) => applyPreset(p, 'preset', false)}
        />
      )}

      <div className="p-4 sm:p-5 space-y-5">
        {/* Topology selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-1">Topology:</span>
          {(['buck', 'boost', 'buck-boost'] as const).map((topo) => (
            <button
              key={topo}
              type="button"
              onClick={() => {
                setTopology(topo);
                trackEvent('calculator_interact', {
                  calculator: CALC_ID,
                  opn: selectedOpn,
                  topology: topo,
                });
              }}
              className={`rounded-md border px-3 py-1 text-xs font-mono font-bold uppercase cursor-pointer transition-colors print:hidden ${
                topology === topo
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {topo}
            </button>
          ))}
          <span className="hidden print:inline font-mono text-xs font-bold uppercase">{topology}</span>
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isSwitchLimit}
              onChange={(e) => {
                setIsSwitchLimit(e.target.checked);
                trackEvent('calculator_interact', {
                  calculator: CALC_ID,
                  opn: selectedOpn,
                  is_switch_limit: e.target.checked,
                });
              }}
              className="rounded border-slate-300"
            />
            Rated current is Peak Switch Limit (Isw)
          </label>
        </div>

        {/* Inputs */}
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-3"
          onBlur={(e) => {
            if (e.target instanceof HTMLInputElement) {
              trackEvent('calculator_interact', {
                calculator: CALC_ID,
                opn: selectedOpn,
                topology,
                status: results.status,
              });
            }
          }}
        >
          {field(
            'Vin (V)',
            vinStr,
            setVinStr,
            '0.1',
            '0.1',
            isCustom ? undefined : `rated ${activePreset.vinMin}–${activePreset.vinMax} V`,
          )}
          {field('Vout (V)', voutStr, setVoutStr, '0.1', '0.1')}
          {field('Load Iout (mA)', ioutStr, setIoutStr, '50', '1')}
          {field('fsw (kHz)', fswStr, setFswStr, '50', '10')}
          {field('Inductor L (µH)', inductorStr, setInductorStr, '0.5', '0.1')}
          {field(
            'Output Cap Cout (µF)',
            coutStr,
            setCoutStr,
            '1',
            '0.1',
            !isCustom && activePreset.minCoutUf ? `min ${activePreset.minCoutUf} µF` : undefined,
          )}
          {field('Cap ESR (mΩ)', esrStr, setEsrStr, '1', '0', 'MLCC typ 5–20 mΩ')}
          {field('Est. Efficiency η (%)', effStr, setEffStr, '1', '30')}
          {field(
            `Rated ${isSwitchLimit ? 'Switch Limit Isw' : 'Output Iout'} (mA)`,
            ratedStr,
            setRatedStr,
            '50',
            '10',
            isSwitchLimit ? 'compared to Ipeak' : 'compared to load Iout',
            'col-span-2',
          )}
        </div>

        {/* Status Banner (shows ALL simultaneous violations) */}
        <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
          {results.status === 'DANGER' ? (
            <Flame className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
          ) : results.status === 'CAUTION' ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-bold">{results.statusTitle}</p>
            {results.violations.length === 0 ? (
              <p className="text-xs leading-relaxed">{results.statusDetail}</p>
            ) : (
              <ul className="space-y-1.5 text-xs leading-relaxed">
                {results.violations.map((v) => (
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

        {/* Current rating comparison + DCM boundary indicator */}
        {!results.topologyError && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-700">
              <span>
                Rating check: <strong className="text-slate-900">{results.compareLabel}</strong>
              </span>
              <span>
                Iout {results.ioutMa.toFixed(0)} mA · IL,avg {results.ilAvgMa.toFixed(0)} mA · Ipeak{' '}
                {results.iPeakMa.toFixed(0)} mA · Rated {results.ratedMa.toFixed(0)} mA (
                {results.currentUtilizationPct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${utilBar}`}
                style={{ width: `${Math.max(0, Math.min(100, results.currentUtilizationPct))}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Conduction Mode:</span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                    results.isDcm
                      ? 'bg-violet-700 text-white'
                      : 'bg-emerald-700 text-white'
                  }`}
                >
                  {results.isDcm ? 'DCM (Discontinuous)' : 'CCM (Continuous)'}
                </span>
              </div>
              <span className="font-mono text-slate-700">
                DCM boundary: {results.isBuckLikeOutput ? 'Iout' : 'IL,avg'} &lt; ΔIL/2 (
                {results.dcmBoundaryIlMa.toFixed(0)} mA
                {!results.isBuckLikeOutput ? ` · load Iout,crit ≈ ${results.dcmBoundaryIoutMa.toFixed(0)} mA` : ''})
              </span>
            </div>
          </div>
        )}

        {/* Outputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpi(`Duty Cycle D${results.isDcm ? ' (DCM)' : ''}`, results.dutyPct.toFixed(1), '%')}
          {kpi('Ripple ΔIL (p-p)', results.deltaIlMa.toFixed(0), 'mA', 'text-slate-950', `${results.rippleRatioPct.toFixed(0)}% of IL,avg`)}
          {kpi('Avg Inductor IL,avg', results.ilAvgMa.toFixed(0), 'mA')}
          {kpi(
            'Peak Ipeak',
            results.iPeakMa.toFixed(0),
            'mA',
            (isSwitchLimit && results.iPeakMa > results.ratedMa) || (!isSwitchLimit && results.iPeakMa > results.ratedMa)
              ? 'text-rose-700'
              : 'text-slate-950',
          )}
          {kpi('Valley Ivalley', results.iValleyMa.toFixed(0), 'mA')}
          {kpi(
            'Output Ripple ΔVout',
            results.deltaVoutMv.toFixed(1),
            'mVpp',
            results.deltaVoutPct > 3 ? 'text-amber-700' : 'text-slate-950',
            `cap ${results.dvCapMv.toFixed(1)} + ESR ${results.dvEsrMv.toFixed(1)}`,
          )}
          {kpi('Min L (30% ΔIL)', results.minLUh.toFixed(1), 'µH')}
          {kpi('Est. Power Loss', results.pLossMw.toFixed(0), 'mW', 'text-slate-950', `at η ≈ ${results.effPctEffective.toFixed(0)}%`)}
          {kpi('Min Inductor Isat', (results.iPeakMa * 1.25).toFixed(0), 'mA', 'text-sky-800', '1.25× Ipeak')}
          {kpi('Output Power Pout', results.poutMw.toFixed(0), 'mW')}
        </div>

        {/* Inductor current waveform */}
        {results.topologyError ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-600">
            Inductor current waveform unavailable — fix the Vin/Vout ratio for the selected topology.
          </div>
        ) : (
          <InductorCurrentWaveform
            fswKhz={results.fswKhz}
            tOnUs={results.tOnUs}
            tOffUs={results.tOffUs}
            iAvgMa={results.ilAvgMa}
            iPeakMa={results.iPeakMa}
            iValleyMa={results.iValleyMa}
            isDcm={results.isDcm}
            limitMa={results.limitMa}
            limitLabel={results.limitLabel}
            overLimit={results.overLimit}
          />
        )}
        {!results.topologyError && !isSwitchLimit && !results.isBuckLikeOutput && (
          <p className="text-xs text-slate-600">
            Note: in boost / buck-boost transition operation, rated continuous output current applies to the load (Iout),
            not the inductor — check the datasheet internal switch current limit (Isw) separately against Ipeak.
          </p>
        )}

        {/* Cross-link to Feedback Divider Solver */}
        <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-800">
            Setting adjustable <strong className="font-mono">Vout = {voutStr} V</strong> via an external FB resistor
            network?
          </span>
          <Link
            href="/en/tools/feedback-divider/"
            className="inline-flex items-center gap-1 font-semibold text-sky-800 hover:text-sky-950 hover:underline"
          >
            Open Feedback Divider Solver (E96/E24)
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <p className="text-xs font-mono text-slate-600">
          Equations: Buck ΔVout ≈ ΔIL/(8·fsw·Cout) + ΔIL·ESR · Boost/BB ΔVout ≈ (Iout·D)/(fsw·Cout) + Ipeak·ESR · Isat ≥ 1.25×Ipeak
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          Engineering estimate only — results are review candidates, not a guarantee. Verify against the manufacturer&apos;s
          official datasheet and bench measurements; safety-critical (medical, automotive, aerospace) designs require
          independent qualification.
        </p>
      </div>
    </div>
  );
}
