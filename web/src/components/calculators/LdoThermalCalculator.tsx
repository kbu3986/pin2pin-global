'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Flame,
  Link2,
  RotateCcw,
  Search,
  Thermometer,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export interface LdoPreset {
  opn: string;
  vout: number;
  vinMin: number;
  vinMax: number;
  ioutMaxMa: number;
  iqUa: number;
  dropoutMv: number;
  thetaJa: number;
  tjMax: number;
  packageCode?: string;
}

export interface LdoThermalCalculatorProps {
  initialPreset: LdoPreset | null;
  presets: LdoPreset[];
  /**
   * Optional second LDO preset for side-by-side Dual-Part Thermal Delta mode (used on /en/vs/ pages).
   */
  comparePreset?: LdoPreset | null;
  /**
   * Compact (embedded) mode: hides URL-state reading and the share-link action.
   * Defaults to `true` when `presets` is empty (part-page embed), else `false`.
   */
  compact?: boolean;
}

const CALC_ID = 'ldo_thermal';

const CUSTOM_LDO: LdoPreset = {
  opn: 'Custom LDO',
  vout: 3.3,
  vinMin: 3.6,
  vinMax: 6.0,
  ioutMaxMa: 300,
  iqUa: 50,
  dropoutMv: 250,
  thetaJa: 220,
  tjMax: 125,
};

interface LdoViolation {
  severity: 'DANGER' | 'CAUTION';
  code: string;
  title: string;
  detail: string;
}

interface LdoMetrics {
  vin: number;
  vout: number;
  ioutMa: number;
  ta: number;
  thetaJa: number;
  tjMax: number;
  dropoutMv: number;
  iqUa: number;
  pdTotalMw: number;
  deltaT: number;
  tj: number;
  thermalMargin: number;
  dropoutHeadroomMv: number;
  dropoutOk: boolean;
  thermalMaxIoutMa: number;
  effectiveMaxIoutMa: number;
  governingLimit: 'datasheet' | 'thermal';
  ioutRatedLimit: number;
  vinMinLimit: number;
  vinMaxLimit: number;
  violations: LdoViolation[];
  status: 'SAFE' | 'CAUTION' | 'DANGER';
  statusTitle: string;
  statusDetail: string;
  taPct: number;
  deltaTPct: number;
  cautionMarkerPct: number;
}

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) ? n : fallback;
}

function defaultVinFor(preset: LdoPreset): number {
  const candidate = Math.max(preset.vout + preset.dropoutMv / 1000 + 1.0, preset.vinMin);
  return Number(Math.min(candidate, preset.vinMax).toFixed(2));
}

function defaultIoutFor(preset: LdoPreset): number {
  return Math.max(10, Math.round(preset.ioutMaxMa * 0.5));
}

function niceCeil(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function computeLdoMetrics(
  preset: LdoPreset,
  params: {
    vin: number;
    vout: number;
    ioutMa: number;
    ta: number;
    thetaJa: number;
    tjMax: number;
    dropoutMv: number;
    iqUa: number;
  },
  checkBounds: boolean,
): LdoMetrics {
  const { vin, vout, ioutMa, ta, thetaJa, tjMax, dropoutMv, iqUa } = params;
  const vinMinLimit = preset.vinMin;
  const vinMaxLimit = preset.vinMax;
  const ioutRatedLimit = preset.ioutMaxMa;

  const vDiff = vin - vout;
  const pdLoadMw = Math.max(0, vDiff) * ioutMa;
  const pdIqMw = vin * (iqUa / 1000);
  const pdTotalMw = pdLoadMw + pdIqMw;
  const deltaT = (pdTotalMw / 1000) * thetaJa;
  const tj = ta + deltaT;
  const thermalMargin = tjMax - tj;

  const dropoutHeadroomMv = vDiff * 1000 - dropoutMv;
  const dropoutOk = vDiff * 1000 >= dropoutMv && vin >= vout;

  const pdMaxAllowedW = Math.max(0, (tjMax - ta) / thetaJa);
  const pdIqW = pdIqMw / 1000;
  const thermalMaxIoutMa =
    vDiff > 0.001 ? Math.max(0, ((pdMaxAllowedW - pdIqW) / vDiff) * 1000) : ioutRatedLimit;

  const effectiveMaxIoutMa = checkBounds
    ? Math.min(thermalMaxIoutMa, ioutRatedLimit)
    : thermalMaxIoutMa;
  const governingLimit: 'datasheet' | 'thermal' =
    checkBounds && ioutRatedLimit <= thermalMaxIoutMa ? 'datasheet' : 'thermal';

  const overVinMax = checkBounds && vin > vinMaxLimit;
  const underVinMin = checkBounds && vin < vinMinLimit;
  const overIoutRated = checkBounds && ioutMa > ioutRatedLimit;

  // Collect ALL simultaneous violations (no else-if masking)
  const violations: LdoViolation[] = [];

  if (tj >= tjMax) {
    violations.push({
      severity: 'DANGER',
      code: 'THERMAL_LIMIT',
      title: 'Thermal Shutdown Risk (Tj ≥ Tj,max)',
      detail: `Estimated Tj (${tj.toFixed(1)}°C) meets or exceeds Tj,max (${tjMax}°C). Reduce Vin, lower Iout below ~${effectiveMaxIoutMa.toFixed(0)} mA, increase copper area, or evaluate a buck converter.`,
    });
  }
  if (overVinMax) {
    violations.push({
      severity: 'DANGER',
      code: 'VIN_OVER_MAX',
      title: 'Input Voltage Exceeds Rated Vin,max',
      detail: `Vin (${vin.toFixed(2)} V) exceeds the rated operating maximum (${vinMaxLimit} V) for ${preset.opn}.`,
    });
  }
  if (!dropoutOk) {
    violations.push({
      severity: 'DANGER',
      code: 'DROPOUT_LOST',
      title: 'Insufficient Dropout Headroom (Regulation Lost)',
      detail: `Vin − Vout (${(vDiff * 1000).toFixed(0)} mV) is below the required dropout voltage (${dropoutMv.toFixed(0)} mV). Output voltage may sag out of regulation.`,
    });
  }
  if (overIoutRated) {
    violations.push({
      severity: 'DANGER',
      code: 'IOUT_OVER_MAX',
      title: 'Load Current Exceeds Datasheet Iout,max',
      detail: `Load Iout (${ioutMa.toFixed(0)} mA) exceeds the datasheet maximum current rating (${ioutRatedLimit} mA) for ${preset.opn}.`,
    });
  }
  if (tj < tjMax && tj > 100) {
    violations.push({
      severity: 'CAUTION',
      code: 'HIGH_TJ',
      title: 'Elevated Junction Temperature (> 100°C)',
      detail: `Estimated Tj (${tj.toFixed(1)}°C) exceeds the 100°C conservative derating guideline.`,
    });
  }
  if (tj < tjMax && thermalMargin < 15) {
    violations.push({
      severity: 'CAUTION',
      code: 'LOW_THERMAL_MARGIN',
      title: 'Tight Thermal Margin (< 15°C)',
      detail: `Thermal headroom (${thermalMargin.toFixed(1)}°C) is below the recommended 15°C engineering margin.`,
    });
  }
  if (underVinMin) {
    violations.push({
      severity: 'CAUTION',
      code: 'VIN_UNDER_MIN',
      title: 'Input Voltage Below Rated Vin,min',
      detail: `Vin (${vin.toFixed(2)} V) is below the datasheet minimum operating input (${vinMinLimit} V) for ${preset.opn}.`,
    });
  }

  const dangerCount = violations.filter((v) => v.severity === 'DANGER').length;
  const cautionCount = violations.filter((v) => v.severity === 'CAUTION').length;

  let status: 'SAFE' | 'CAUTION' | 'DANGER' = 'SAFE';
  let statusTitle = 'Candidate Operating Point — Within Estimated Thermal & Rating Limits';
  let statusDetail = `Estimated Tj (${tj.toFixed(1)}°C) stays below Tj,max (${tjMax}°C) with ${thermalMargin.toFixed(1)}°C headroom and valid dropout margin. Review against the official datasheet θJA test board and your actual PCB copper before sign-off.`;

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
        : `Caution — ${cautionCount} Margin Warnings Detected`;
    statusDetail = violations[0].detail;
  }

  const safeTjMax = Math.max(1, tjMax);
  const taPositive = Math.max(0, ta);
  const taPct = Math.max(0, Math.min(100, (taPositive / safeTjMax) * 100));
  const deltaTPct = Math.max(0, Math.min(100 - taPct, (Math.max(0, deltaT) / safeTjMax) * 100));
  const cautionMarkerPct = Math.max(0, Math.min(100, ((safeTjMax - 15) / safeTjMax) * 100));

  return {
    vin,
    vout,
    ioutMa,
    ta,
    thetaJa,
    tjMax,
    dropoutMv,
    iqUa,
    pdTotalMw,
    deltaT,
    tj,
    thermalMargin,
    dropoutHeadroomMv,
    dropoutOk,
    thermalMaxIoutMa,
    effectiveMaxIoutMa,
    governingLimit,
    ioutRatedLimit,
    vinMinLimit,
    vinMaxLimit,
    violations,
    status,
    statusTitle,
    statusDetail,
    taPct,
    deltaTPct,
    cautionMarkerPct,
  };
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
  accent: string;
}

function PresetSearchBar<T extends { opn: string }>({
  presets,
  selectedOpn,
  describe,
  onSelect,
  accent,
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
                  ? `${accent} text-white`
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
/* Stacked Thermal Gauge (Ta ambient base + ΔT self-heating vs Tj,max) */
/* ------------------------------------------------------------------ */

function StackedThermalGauge({ metrics, label }: { metrics: LdoMetrics; label?: string }) {
  const deltaColor =
    metrics.status === 'DANGER'
      ? 'bg-rose-600'
      : metrics.status === 'CAUTION'
        ? 'bg-amber-500'
        : 'bg-emerald-600';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-700">
        <span>
          {label ? <strong className="text-slate-900 mr-1.5">{label}</strong> : null}
          Ta: {metrics.ta.toFixed(0)}°C
        </span>
        <span>
          ΔT: +{metrics.deltaT.toFixed(1)}°C → <strong>Tj: {metrics.tj.toFixed(1)}°C</strong>
        </span>
        <span>Tj,max: {metrics.tjMax.toFixed(0)}°C</span>
      </div>
      <div
        className="relative h-3 w-full rounded-full bg-slate-200 overflow-hidden flex"
        role="img"
        aria-label={`Thermal utilization: ambient ${metrics.ta.toFixed(0)}°C plus ${metrics.deltaT.toFixed(1)}°C self-heating equals ${metrics.tj.toFixed(1)}°C junction temperature out of ${metrics.tjMax.toFixed(0)}°C maximum.`}
      >
        <div
          className="h-full bg-sky-500 transition-all duration-200"
          style={{ width: `${metrics.taPct}%` }}
          title={`Ambient base Ta: ${metrics.ta.toFixed(1)}°C`}
        />
        <div
          className={`h-full transition-all duration-200 ${deltaColor}`}
          style={{ width: `${metrics.deltaTPct}%` }}
          title={`Self-heating ΔT: +${metrics.deltaT.toFixed(1)}°C`}
        />
        {metrics.cautionMarkerPct > 0 && metrics.cautionMarkerPct < 100 && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-slate-800/70"
            style={{ left: `${metrics.cautionMarkerPct}%` }}
            title={`15°C caution threshold (${(metrics.tjMax - 15).toFixed(0)}°C)`}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" aria-hidden="true" />
          Ta ambient ({metrics.ta.toFixed(0)}°C)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${deltaColor}`} aria-hidden="true" />
          ΔT self-heating (+{metrics.deltaT.toFixed(1)}°C)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200 border border-slate-300" aria-hidden="true" />
          Headroom ({metrics.thermalMargin >= 0 ? `${metrics.thermalMargin.toFixed(1)}°C` : `Exceeded by ${Math.abs(metrics.thermalMargin).toFixed(1)}°C`})
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Violations Banner (shows ALL simultaneous violations)               */
/* ------------------------------------------------------------------ */

function StatusViolationsBanner({ metrics }: { metrics: LdoMetrics }) {
  const statusClasses =
    metrics.status === 'DANGER'
      ? 'border-rose-400 bg-rose-50 text-rose-950'
      : metrics.status === 'CAUTION'
        ? 'border-amber-400 bg-amber-50 text-amber-950'
        : 'border-emerald-400 bg-emerald-50 text-emerald-950';

  return (
    <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
      {metrics.status === 'DANGER' ? (
        <Flame className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
      ) : metrics.status === 'CAUTION' ? (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-bold">{metrics.statusTitle}</p>
        {metrics.violations.length === 0 ? (
          <p className="text-xs leading-relaxed">{metrics.statusDetail}</p>
        ) : (
          <ul className="space-y-1.5 text-xs leading-relaxed">
            {metrics.violations.map((v) => (
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
  );
}

/* ------------------------------------------------------------------ */
/* Thermal derating curve (Tj vs Iout)                                 */
/* ------------------------------------------------------------------ */

interface ThermalCurveProps {
  vin: number;
  vout: number;
  iqUa: number;
  ta: number;
  thetaJa: number;
  tjMax: number;
  ioutMa: number;
  tj: number;
  ratedMa: number;
  thermalLimitMa: number;
  status: 'SAFE' | 'CAUTION' | 'DANGER';
  opnLabel?: string;
  compareSeries?: {
    opn: string;
    iqUa: number;
    thetaJa: number;
    tjMax: number;
    tj: number;
    ratedMa: number;
    status: 'SAFE' | 'CAUTION' | 'DANGER';
  } | null;
}

function ThermalDeratingCurve({
  vin,
  vout,
  iqUa,
  ta,
  thetaJa,
  tjMax,
  ioutMa,
  tj,
  ratedMa,
  thermalLimitMa,
  status,
  opnLabel,
  compareSeries,
}: ThermalCurveProps) {
  const W = 640;
  const H = 264;
  const PL = 48;
  const PR = 18;
  const PT = 16;
  const PB = 38;
  const pw = W - PL - PR;
  const ph = H - PT - PB;

  const vDiff = Math.max(0, vin - vout);
  const pdIqMw = vin * (iqUa / 1000);
  const tjAt = (iMa: number) => ta + ((vDiff * iMa + pdIqMw) / 1000) * thetaJa;

  const tjAtB = compareSeries
    ? (iMa: number) =>
        ta + ((vDiff * iMa + vin * (compareSeries.iqUa / 1000)) / 1000) * compareSeries.thetaJa
    : null;

  const xMax = niceCeil(
    Math.max(ratedMa, compareSeries?.ratedMa ?? 0, ioutMa, 10) * 1.15,
  );
  const maxTjCeil = Math.max(tjMax, compareSeries?.tjMax ?? tjMax);
  const yMin = Math.floor(Math.min(ta - 5, 0) / 10) * 10;
  const curveEndMax = Math.max(tjAt(xMax), tjAtB ? tjAtB(xMax) : 0, tj + 10, (compareSeries?.tj ?? 0) + 10);
  const yTop = Math.max(maxTjCeil + 15, Math.min(curveEndMax, maxTjCeil + 60));
  const yMax = Math.ceil(yTop / 10) * 10;

  const sx = (iMa: number) => PL + (Math.min(Math.max(iMa, 0), xMax) / xMax) * pw;
  const syRaw = (t: number) => PT + (1 - (t - yMin) / (yMax - yMin)) * ph;
  const sy = (t: number) => Math.min(PT + ph, Math.max(PT, syRaw(t)));

  const yStepRaw = (yMax - yMin) / 5;
  const yStep = yStepRaw <= 10 ? 10 : yStepRaw <= 20 ? 20 : yStepRaw <= 25 ? 25 : 50;
  const yTicks: number[] = [];
  for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(t);
  const xTicks = [0, 1, 2, 3, 4, 5].map((k) => (xMax * k) / 5);

  const tj0 = tjAt(0);
  const crossMa = vDiff > 0.0005 ? Math.max(0, thermalLimitMa) : Infinity;
  const headroomEnd = Math.min(crossMa, xMax);
  const showHeadroom = !compareSeries && tj0 < tjMax;
  const opColor = status === 'DANGER' ? '#e11d48' : status === 'CAUTION' ? '#d97706' : '#059669';
  const opX = sx(ioutMa);
  const opY = sy(tj);
  const opClipped = syRaw(tj) < PT;
  const labelAnchor = opX > PL + pw * 0.6 ? 'end' : 'start';
  const labelDx = labelAnchor === 'end' ? -8 : 8;

  return (
    <figure className="rounded-md border border-slate-200 bg-white p-2.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Thermal derating curve: junction temperature versus load current. Operating point ${ioutMa.toFixed(0)} mA at ${tj.toFixed(1)} °C, Tj,max ${tjMax} °C.`}
      >
        <defs>
          <clipPath id="ldo-plot-clip">
            <rect x={PL} y={PT} width={pw} height={ph} />
          </clipPath>
        </defs>

        {/* Grid */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PL} x2={PL + pw} y1={syRaw(t)} y2={syRaw(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PL - 6} y={syRaw(t) + 3} textAnchor="end" fontSize={10} fill="#475569" fontFamily="monospace">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((x) => (
          <g key={`x${x}`}>
            <line x1={sx(x)} x2={sx(x)} y1={PT} y2={PT + ph} stroke="#f1f5f9" strokeWidth={1} />
            <text x={sx(x)} y={PT + ph + 14} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="monospace">
              {Number(x.toFixed(0))}
            </text>
          </g>
        ))}

        <g clipPath="url(#ldo-plot-clip)">
          {/* Over-temperature zone */}
          <rect x={PL} y={PT} width={pw} height={Math.max(0, syRaw(tjMax) - PT)} fill="#e11d48" opacity={0.07} />

          {/* Safe headroom zone between Tj line and Tj,max */}
          {showHeadroom && headroomEnd > 0 && (
            <polygon
              points={[
                `${sx(0)},${syRaw(tj0)}`,
                `${sx(headroomEnd)},${syRaw(tjAt(headroomEnd))}`,
                `${sx(headroomEnd)},${syRaw(tjMax)}`,
                `${sx(0)},${syRaw(tjMax)}`,
              ].join(' ')}
              fill="#10b981"
              opacity={0.13}
            />
          )}

          {/* Ta baseline */}
          <line x1={PL} x2={PL + pw} y1={syRaw(ta)} y2={syRaw(ta)} stroke="#475569" strokeWidth={1} strokeDasharray="4 3" />

          {/* Caution band (15 °C margin) */}
          <line
            x1={PL}
            x2={PL + pw}
            y1={syRaw(tjMax - 15)}
            y2={syRaw(tjMax - 15)}
            stroke="#d97706"
            strokeWidth={1}
            strokeDasharray="2 3"
          />

          {/* Tj,max ceiling */}
          <line x1={PL} x2={PL + pw} y1={syRaw(tjMax)} y2={syRaw(tjMax)} stroke="#dc2626" strokeWidth={2} />

          {/* Part A linear thermal rise slope */}
          <line
            x1={sx(0)}
            y1={syRaw(tj0)}
            x2={sx(xMax)}
            y2={syRaw(tjAt(xMax))}
            stroke="#0f172a"
            strokeWidth={2.25}
          />

          {/* Part B linear thermal rise slope (when comparing) */}
          {compareSeries && tjAtB && (
            <line
              x1={sx(0)}
              y1={syRaw(tjAtB(0))}
              x2={sx(xMax)}
              y2={syRaw(tjAtB(xMax))}
              stroke="#0284c7"
              strokeWidth={2.25}
              strokeDasharray="6 3"
            />
          )}
        </g>

        {/* Rated Iout marker (single mode) */}
        {!compareSeries && ratedMa > 0 && ratedMa <= xMax && (
          <g>
            <line x1={sx(ratedMa)} x2={sx(ratedMa)} y1={PT} y2={PT + ph} stroke="#475569" strokeWidth={1} strokeDasharray="5 3" />
            <text x={sx(ratedMa) - 4} y={PT + ph - 6} textAnchor="end" fontSize={10} fill="#334155" fontFamily="monospace">
              Iout,max {ratedMa.toFixed(0)} mA
            </text>
          </g>
        )}

        {/* Thermal limit marker (single mode) */}
        {!compareSeries && Number.isFinite(crossMa) && crossMa > 0 && crossMa < xMax && (
          <g>
            <line x1={sx(crossMa)} x2={sx(crossMa)} y1={syRaw(tjMax)} y2={PT + ph} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 3" />
            <text x={sx(crossMa) + 4} y={Math.min(PT + ph - 18, syRaw(tjMax) + 24)} fontSize={10} fill="#be123c" fontFamily="monospace">
              thermal ≈ {crossMa.toFixed(0)} mA
            </text>
          </g>
        )}

        {/* Labels for reference lines */}
        <text x={PL + pw - 4} y={syRaw(tjMax) - 4} textAnchor="end" fontSize={10} fontWeight={700} fill="#dc2626" fontFamily="monospace">
          Tj,max {tjMax.toFixed(0)}°C
        </text>
        <text x={PL + 4} y={syRaw(ta) - 4} fontSize={10} fill="#334155" fontFamily="monospace">
          Ta {ta.toFixed(0)}°C
        </text>
        {showHeadroom && (
          <text x={PL + 6} y={(syRaw(tjMax) + syRaw(tj0)) / 2 - 6} fontSize={10} fill="#047857" fontFamily="monospace">
            thermal headroom (candidate region)
          </text>
        )}

        {/* Live operating point A */}
        <g>
          <line x1={opX} x2={opX} y1={opY} y2={PT + ph} stroke={compareSeries ? '#0f172a' : opColor} strokeWidth={1} strokeDasharray="2 2" />
          <circle cx={opX} cy={opY} r={5.5} fill={compareSeries ? '#0f172a' : opColor} stroke="#ffffff" strokeWidth={2} />
          <text
            x={opX + labelDx}
            y={Math.max(PT + 12, opY - 8)}
            textAnchor={labelAnchor}
            fontSize={10.5}
            fontWeight={700}
            fill={compareSeries ? '#0f172a' : opColor}
            fontFamily="monospace"
          >
            {compareSeries ? `${opnLabel ?? 'A'}: ${tj.toFixed(1)}°C` : `${ioutMa.toFixed(0)} mA → Tj ${tj.toFixed(1)}°C`}
            {opClipped ? ' ↑' : ''}
          </text>
        </g>

        {/* Live operating point B */}
        {compareSeries && (
          <g>
            <circle cx={opX} cy={sy(compareSeries.tj)} r={5.5} fill="#0284c7" stroke="#ffffff" strokeWidth={2} />
            <text
              x={opX + labelDx}
              y={Math.min(PT + ph - 6, Math.max(PT + 24, sy(compareSeries.tj) + 14))}
              textAnchor={labelAnchor}
              fontSize={10.5}
              fontWeight={700}
              fill="#0369a1"
              fontFamily="monospace"
            >
              {compareSeries.opn}: {compareSeries.tj.toFixed(1)}°C{syRaw(compareSeries.tj) < PT ? ' ↑' : ''}
            </text>
          </g>
        )}

        {/* Axes */}
        <line x1={PL} x2={PL} y1={PT} y2={PT + ph} stroke="#334155" strokeWidth={1} />
        <line x1={PL} x2={PL + pw} y1={PT + ph} y2={PT + ph} stroke="#334155" strokeWidth={1} />
        <text x={PL + pw / 2} y={H - 4} textAnchor="middle" fontSize={10.5} fill="#334155" fontWeight={600}>
          Load current Iout (mA)
        </text>
        <text
          x={12}
          y={PT + ph / 2}
          textAnchor="middle"
          fontSize={10.5}
          fill="#334155"
          fontWeight={600}
          transform={`rotate(-90 12 ${PT + ph / 2})`}
        >
          Junction temp Tj (°C)
        </text>
      </svg>
      <figcaption className="px-1 pt-1.5 text-xs text-slate-600">
        Steady-state estimate Tj(Iout) = Ta + [(Vin − Vout)·Iout + Vin·Iq]·θJA at Vin = {vin.toFixed(2)} V. Linear model —
        real θJA depends on copper area, airflow and board stack-up; treat results as a review candidate, not a guarantee.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Main calculator                                                     */
/* ------------------------------------------------------------------ */

export function LdoThermalCalculator({
  initialPreset,
  presets,
  comparePreset = null,
  compact,
}: LdoThermalCalculatorProps) {
  const isCompareMode = Boolean(comparePreset);
  const isCompact = compact ?? (presets.length === 0 || isCompareMode);
  const base: LdoPreset = initialPreset ?? CUSTOM_LDO;

  const initialSharedVin = comparePreset
    ? Number(
        Math.min(
          Math.max(defaultVinFor(base), defaultVinFor(comparePreset)),
          Math.min(base.vinMax, comparePreset.vinMax),
        ).toFixed(2),
      )
    : defaultVinFor(base);
  const initialSharedIout = comparePreset
    ? Math.min(defaultIoutFor(base), defaultIoutFor(comparePreset))
    : defaultIoutFor(base);

  const [activePreset, setActivePreset] = useState<LdoPreset>(base);
  const [isCustom, setIsCustom] = useState<boolean>(initialPreset === null);
  const [vinStr, setVinStr] = useState<string>(String(initialSharedVin));
  const [voutStr, setVoutStr] = useState<string>(String(base.vout));
  const [ioutStr, setIoutStr] = useState<string>(String(initialSharedIout));
  const [taStr, setTaStr] = useState<string>('25');
  const [thetaJaStr, setThetaJaStr] = useState<string>(String(base.thetaJa));
  const [thetaJaBStr, setThetaJaBStr] = useState<string>(
    String(comparePreset?.thetaJa ?? base.thetaJa),
  );
  const [tjMaxStr, setTjMaxStr] = useState<string>(String(base.tjMax));
  const [dropoutStr, setDropoutStr] = useState<string>(String(base.dropoutMv));
  const [iqStr, setIqStr] = useState<string>(String(base.iqUa));
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep internal state synced if initialPreset / comparePreset props change across navigations
  useEffect(() => {
    const nextBase = initialPreset ?? CUSTOM_LDO;
    setActivePreset(nextBase);
    setIsCustom(initialPreset === null);
    const nextVin = comparePreset
      ? Number(
          Math.min(
            Math.max(defaultVinFor(nextBase), defaultVinFor(comparePreset)),
            Math.min(nextBase.vinMax, comparePreset.vinMax),
          ).toFixed(2),
        )
      : defaultVinFor(nextBase);
    const nextIout = comparePreset
      ? Math.min(defaultIoutFor(nextBase), defaultIoutFor(comparePreset))
      : defaultIoutFor(nextBase);
    setVinStr(String(nextVin));
    setVoutStr(String(nextBase.vout));
    setIoutStr(String(nextIout));
    setTaStr('25');
    setThetaJaStr(String(nextBase.thetaJa));
    if (comparePreset) setThetaJaBStr(String(comparePreset.thetaJa));
    setTjMaxStr(String(nextBase.tjMax));
    setDropoutStr(String(nextBase.dropoutMv));
    setIqStr(String(nextBase.iqUa));
  }, [initialPreset?.opn, comparePreset?.opn]);

  const selectedOpn = activePreset.opn;

  const applyPreset = (
    p: LdoPreset,
    source: 'preset' | 'reset' | 'url' = 'preset',
    custom = false,
  ) => {
    setActivePreset(p);
    setIsCustom(custom);
    if (comparePreset) {
      const nextVin = Number(
        Math.min(
          Math.max(defaultVinFor(p), defaultVinFor(comparePreset)),
          Math.min(p.vinMax, comparePreset.vinMax),
        ).toFixed(2),
      );
      setVinStr(String(nextVin));
      setIoutStr(String(Math.min(defaultIoutFor(p), defaultIoutFor(comparePreset))));
      setThetaJaBStr(String(comparePreset.thetaJa));
    } else {
      setVinStr(String(defaultVinFor(p)));
      setIoutStr(String(defaultIoutFor(p)));
    }
    setVoutStr(String(p.vout));
    setTaStr('25');
    setThetaJaStr(String(p.thetaJa));
    setTjMaxStr(String(p.tjMax));
    setDropoutStr(String(p.dropoutMv));
    setIqStr(String(p.iqUa));
    if (source !== 'url') {
      trackEvent(source === 'reset' ? 'calculator_reset' : 'calculator_preset_select', {
        calculator: CALC_ID,
        opn: p.opn,
      });
    }
  };

  // Shareable URL state (standalone tool only). Reads window.location directly
  // so static export does not require a Suspense boundary for useSearchParams.
  useEffect(() => {
    if (isCompact || typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.toString() === '') return;
    const opnParam = qs.get('opn');
    if (opnParam) {
      const match = presets.find((p) => p.opn.toLowerCase() === opnParam.toLowerCase());
      if (match) applyPreset(match, 'url', false);
    }
    const num = (key: string, set: (v: string) => void) => {
      const raw = qs.get(key);
      if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) set(raw);
    };
    num('vin', setVinStr);
    num('vout', setVoutStr);
    num('iout', setIoutStr);
    num('ta', setTaStr);
    num('tja', setThetaJaStr);
    num('tjmax', setTjMaxStr);
    num('vdo', setDropoutStr);
    num('iq', setIqStr);
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
    const vin = Math.max(0, parseFinite(vinStr, 5.0));
    const vout = Math.max(0, parseFinite(voutStr, 3.3));
    const ioutMa = Math.max(0, parseFinite(ioutStr, 150));
    const ta = parseFinite(taStr, 25);
    const thetaJa = Math.max(1, parseFinite(thetaJaStr, activePreset.thetaJa));
    const tjMax = Math.max(50, parseFinite(tjMaxStr, activePreset.tjMax));
    const dropoutMv = Math.max(0, parseFinite(dropoutStr, activePreset.dropoutMv));
    const iqUa = Math.max(0, parseFinite(iqStr, activePreset.iqUa));

    return computeLdoMetrics(
      activePreset,
      { vin, vout, ioutMa, ta, thetaJa, tjMax, dropoutMv, iqUa },
      !isCustom,
    );
  }, [vinStr, voutStr, ioutStr, taStr, thetaJaStr, tjMaxStr, dropoutStr, iqStr, activePreset, isCustom]);

  const compareResults = useMemo(() => {
    if (!comparePreset) return null;
    const vin = Math.max(0, parseFinite(vinStr, 5.0));
    const vout = Math.max(0, parseFinite(voutStr, comparePreset.vout));
    const ioutMa = Math.max(0, parseFinite(ioutStr, 150));
    const ta = parseFinite(taStr, 25);
    const thetaJaB = Math.max(1, parseFinite(thetaJaBStr, comparePreset.thetaJa));

    return computeLdoMetrics(
      comparePreset,
      {
        vin,
        vout,
        ioutMa,
        ta,
        thetaJa: thetaJaB,
        tjMax: comparePreset.tjMax,
        dropoutMv: comparePreset.dropoutMv,
        iqUa: comparePreset.iqUa,
      },
      true,
    );
  }, [comparePreset, vinStr, voutStr, ioutStr, taStr, thetaJaBStr]);

  const copySimulationLink = async () => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams();
    if (!isCustom) qs.set('opn', selectedOpn);
    qs.set('vin', vinStr);
    qs.set('vout', voutStr);
    qs.set('iout', ioutStr);
    qs.set('ta', taStr);
    qs.set('tja', thetaJaStr);
    qs.set('tjmax', tjMaxStr);
    qs.set('vdo', dropoutStr);
    qs.set('iq', iqStr);
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
      status: results.status,
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

  const statusBadge = (status: 'SAFE' | 'CAUTION' | 'DANGER') => {
    if (status === 'DANGER') {
      return (
        <span className="rounded bg-rose-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
          CRITICAL
        </span>
      );
    }
    if (status === 'CAUTION') {
      return (
        <span className="rounded bg-amber-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
          CAUTION
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
        CANDIDATE OK
      </span>
    );
  };

  /* ---------------------------------------------------------------- */
  /* Dual-Part Thermal Delta Mode (when comparePreset is provided)     */
  /* ---------------------------------------------------------------- */
  if (comparePreset && compareResults) {
    const tjDiff = compareResults.tj - results.tj; // negative => B runs cooler
    const absDiff = Math.abs(tjDiff);
    const coolerOpn = absDiff < 0.1 ? null : tjDiff < 0 ? comparePreset.opn : activePreset.opn;
    const warmerOpn = absDiff < 0.1 ? null : tjDiff < 0 ? activePreset.opn : comparePreset.opn;
    const pdDiffMw = Math.abs(compareResults.pdTotalMw - results.pdTotalMw);

    const renderCompareCard = (
      side: 'Part A' | 'Part B',
      preset: LdoPreset,
      m: LdoMetrics,
      isCooler: boolean,
      accentBorder: string,
    ) => (
      <div className={`rounded-lg border-2 ${accentBorder} bg-white p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {side}
              {preset.packageCode ? ` · ${preset.packageCode}` : ''}
            </div>
            <div className="font-mono text-sm font-bold text-slate-950">{preset.opn}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {isCooler && (
              <span className="rounded bg-sky-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                COOLER
              </span>
            )}
            {statusBadge(m.status)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="font-semibold text-slate-600">Power Diss. Pd</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-950">
              {m.pdTotalMw.toFixed(1)} mW
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="font-semibold text-slate-600">Self-Heating ΔT</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-950">
              +{m.deltaT.toFixed(1)} °C
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="font-semibold text-slate-600">Est. Junction Tj</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-950">
              {m.tj.toFixed(1)} °C
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="font-semibold text-slate-600">Thermal Margin</div>
            <div
              className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                m.thermalMargin < 0
                  ? 'text-rose-700'
                  : m.thermalMargin < 15
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              {m.thermalMargin.toFixed(1)} °C
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="font-semibold text-slate-600">Dropout Headroom</div>
            <div
              className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                m.dropoutOk ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {m.dropoutHeadroomMv >= 0 ? '+' : ''}
              {m.dropoutHeadroomMv.toFixed(0)} mV
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="font-semibold text-slate-600">Max Iout @ Ta</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-950">
              {m.effectiveMaxIoutMa.toFixed(0)} mA
            </div>
            <div className="text-xs font-mono text-slate-600">
              {m.governingLimit === 'datasheet' ? 'Rated Iout cap' : 'Thermal Tj cap'}
            </div>
          </div>
        </div>

        <StackedThermalGauge metrics={m} />

        <div className="text-xs font-mono text-slate-600">
          θJA {m.thetaJa}°C/W · Tj,max {m.tjMax}°C · Vdo {m.dropoutMv} mV · Iq {m.iqUa} µA · Iout,max{' '}
          {preset.ioutMaxMa} mA · Vin {preset.vinMin}–{preset.vinMax} V
        </div>

        {m.violations.length > 0 && (
          <ul className="space-y-1 rounded border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-950">
            {m.violations.map((v) => (
              <li key={v.code}>
                <strong className="font-semibold">
                  [{v.severity === 'DANGER' ? 'Critical' : 'Caution'}] {v.title}:
                </strong>{' '}
                {v.detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    );

    return (
      <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h3 className="text-sm font-bold tracking-tight">
              Dual-Part LDO Thermal Delta Simulator ({activePreset.opn} vs {comparePreset.opn})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => applyPreset(activePreset, 'reset', false)}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer print:hidden"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {/* Shared Operating Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {field('Shared Vin (V)', vinStr, setVinStr, '0.1', '0')}
            {field('Shared Vout (V)', voutStr, setVoutStr, '0.1', '0')}
            {field('Shared Iout (mA)', ioutStr, setIoutStr, '10', '0')}
            {field('Ambient Ta (°C)', taStr, setTaStr, '5')}
            {field(`${activePreset.opn} θJA`, thetaJaStr, setThetaJaStr, '5', '1', '°C/W')}
            {field(`${comparePreset.opn} θJA`, thetaJaBStr, setThetaJaBStr, '5', '1', '°C/W')}
          </div>

          {/* Thermal Delta Banner */}
          <div className="rounded-md border border-sky-300 bg-sky-50 p-3.5 flex items-start gap-3 text-sky-950">
            <Thermometer className="h-5 w-5 shrink-0 text-sky-700 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              {coolerOpn && warmerOpn ? (
                <>
                  <p className="text-sm font-bold">
                    {coolerOpn} runs {absDiff.toFixed(1)} °C cooler than {warmerOpn}
                  </p>
                  <p className="mt-0.5">
                    At Vin = {results.vin.toFixed(2)} V, Vout = {results.vout.toFixed(2)} V, Iout ={' '}
                    {results.ioutMa.toFixed(0)} mA, Ta = {results.ta.toFixed(0)}°C: {activePreset.opn} est. Tj ={' '}
                    <strong className="font-mono">{results.tj.toFixed(1)}°C</strong> vs {comparePreset.opn} est. Tj ={' '}
                    <strong className="font-mono">{compareResults.tj.toFixed(1)}°C</strong> (ΔPd ={' '}
                    {pdDiffMw.toFixed(1)} mW, thermal margin delta ={' '}
                    {(compareResults.thermalMargin - results.thermalMargin >= 0 ? '+' : '') +
                      (compareResults.thermalMargin - results.thermalMargin).toFixed(1)}
                    °C for {comparePreset.opn}).
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold">Equal Estimated Junction Temperature (ΔTj &lt; 0.1 °C)</p>
                  <p className="mt-0.5">
                    Both {activePreset.opn} and {comparePreset.opn} settle near{' '}
                    <strong className="font-mono">{results.tj.toFixed(1)}°C</strong> at {results.ioutMa.toFixed(0)} mA.
                    Compare dropout headroom and datasheet rated current limits below.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderCompareCard(
              'Part A',
              activePreset,
              results,
              coolerOpn === activePreset.opn,
              'border-slate-300',
            )}
            {renderCompareCard(
              'Part B',
              comparePreset,
              compareResults,
              coolerOpn === comparePreset.opn,
              'border-sky-300',
            )}
          </div>

          {/* Dual Thermal Derating Curve */}
          <ThermalDeratingCurve
            vin={results.vin}
            vout={results.vout}
            iqUa={results.iqUa}
            ta={results.ta}
            thetaJa={results.thetaJa}
            tjMax={results.tjMax}
            ioutMa={results.ioutMa}
            tj={results.tj}
            ratedMa={results.ioutRatedLimit}
            thermalLimitMa={results.thermalMaxIoutMa}
            status={results.status}
            opnLabel={activePreset.opn}
            compareSeries={{
              opn: comparePreset.opn,
              iqUa: compareResults.iqUa,
              thetaJa: compareResults.thetaJa,
              tjMax: compareResults.tjMax,
              tj: compareResults.tj,
              ratedMa: compareResults.ioutRatedLimit,
              status: compareResults.status,
            }}
          />

          <p className="text-xs text-slate-600 leading-relaxed">
            Engineering estimate only — side-by-side thermal comparisons are review candidates, not a guarantee of
            equivalence. Datasheet θJA values may reflect different JEDEC test boards; verify on your actual PCB copper
            and qualify independently for safety-critical designs.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Standard Single-Part Mode                                         */
  /* ---------------------------------------------------------------- */
  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h3 className="text-sm font-bold tracking-tight">
            Interactive LDO Thermal &amp; Junction Temperature (Tj) Calculator
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-100">{selectedOpn}</span>
          {!isCompact && (
            <button
              type="button"
              onClick={copySimulationLink}
              className="inline-flex items-center gap-1 rounded border border-emerald-700 bg-emerald-900/60 px-2 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-800 cursor-pointer print:hidden"
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
          describe={(p) => `${p.vout} V · ${p.ioutMaxMa} mA · θJA ${p.thetaJa}`}
          onSelect={(p) => applyPreset(p, 'preset', false)}
          accent="border-slate-900 bg-slate-900"
        />
      )}

      <div className="p-4 sm:p-5 space-y-5">
        {/* Inputs Grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          onBlur={(e) => {
            if (e.target instanceof HTMLInputElement) {
              trackEvent('calculator_interact', {
                calculator: CALC_ID,
                opn: selectedOpn,
                status: results.status,
              });
            }
          }}
        >
          {field(
            'Input Voltage Vin (V)',
            vinStr,
            setVinStr,
            '0.1',
            undefined,
            isCustom ? undefined : `rated ${activePreset.vinMin}–${activePreset.vinMax} V`,
          )}
          {field('Output Voltage Vout (V)', voutStr, setVoutStr, '0.1')}
          {field(
            'Load Current Iout (mA)',
            ioutStr,
            setIoutStr,
            '10',
            '0',
            isCustom ? undefined : `rated ≤ ${activePreset.ioutMaxMa} mA`,
          )}
          {field('Ambient Temp Ta (°C)', taStr, setTaStr, '5')}
          {field('Thermal Res. θJA (°C/W)', thetaJaStr, setThetaJaStr, '5', '1')}
          {field('Max Junction Tj,max (°C)', tjMaxStr, setTjMaxStr, '5')}
          {field('Dropout Vdo (mV)', dropoutStr, setDropoutStr, '10', '0')}
          {field('Quiescent Iq (µA)', iqStr, setIqStr, '1', '0')}
        </div>

        {/* Status Alert (shows ALL simultaneous violations) */}
        <StatusViolationsBanner metrics={results} />

        {/* Output KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-600">Power Dissipation Pd</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.pdTotalMw.toFixed(1)} <span className="text-xs font-normal text-slate-600">mW</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-600">Est. Junction Temp Tj</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.tj.toFixed(1)} <span className="text-xs font-normal text-slate-600">°C</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-600">Thermal Margin</div>
            <div
              className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                results.thermalMargin < 0
                  ? 'text-rose-700'
                  : results.thermalMargin < 15
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              {results.thermalMargin.toFixed(1)} <span className="text-xs font-normal">°C</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-600">Dropout Headroom</div>
            <div
              className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                results.dropoutOk ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {results.dropoutHeadroomMv >= 0 ? '+' : ''}
              {results.dropoutHeadroomMv.toFixed(0)} <span className="text-xs font-normal">mV</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 col-span-2 sm:col-span-1">
            <div className="text-xs font-semibold text-slate-600">Max Iout @ Ta</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.effectiveMaxIoutMa.toFixed(0)} <span className="text-xs font-normal text-slate-600">mA</span>
            </div>
            <div className="mt-0.5 text-xs font-mono text-slate-600">
              {results.governingLimit === 'datasheet'
                ? `Rated cap (thermal ${results.thermalMaxIoutMa.toFixed(0)} mA)`
                : isCustom
                  ? 'Thermal Tj,max cap'
                  : `Thermal cap (rated ${results.ioutRatedLimit} mA)`}
            </div>
          </div>
        </div>

        {/* Stacked Thermal Utilization Gauge (Ta ambient + ΔT self-heating) */}
        <StackedThermalGauge metrics={results} />

        {/* Thermal Derating Curve */}
        <ThermalDeratingCurve
          vin={results.vin}
          vout={results.vout}
          iqUa={results.iqUa}
          ta={results.ta}
          thetaJa={results.thetaJa}
          tjMax={results.tjMax}
          ioutMa={results.ioutMa}
          tj={results.tj}
          ratedMa={results.ioutRatedLimit}
          thermalLimitMa={results.thermalMaxIoutMa}
          status={results.status}
        />

        {/* Formula note */}
        <p className="text-xs font-mono text-slate-600">
          Equations: Pd = (Vin − Vout)·Iout + Vin·Iq · Tj = Ta + Pd·θJA · Max Iout = min(Iout,thermal, Iout,rated)
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          Engineering estimate only — results are review candidates, not a guarantee of thermal performance. Verify
          against the manufacturer&apos;s official datasheet and bench measurements; safety-critical (medical, automotive,
          aerospace) designs require independent qualification.
        </p>
      </div>
    </div>
  );
}
