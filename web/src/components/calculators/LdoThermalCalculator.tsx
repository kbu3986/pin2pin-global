'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, RotateCcw, Thermometer } from 'lucide-react';

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
}

export interface LdoThermalCalculatorProps {
  initialPreset: LdoPreset | null;
  presets: LdoPreset[];
}

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function defaultVinFor(preset: LdoPreset): number {
  const candidate = Math.max(preset.vout + preset.dropoutMv / 1000 + 1.0, preset.vinMin);
  return Number(Math.min(candidate, preset.vinMax).toFixed(2));
}

function defaultIoutFor(preset: LdoPreset): number {
  return Math.max(10, Math.round(preset.ioutMaxMa * 0.5));
}

export function LdoThermalCalculator({
  initialPreset,
  presets,
}: LdoThermalCalculatorProps) {
  const base: LdoPreset = initialPreset ?? {
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

  const [selectedOpn, setSelectedOpn] = useState<string>(base.opn);
  const [vinStr, setVinStr] = useState<string>(String(defaultVinFor(base)));
  const [voutStr, setVoutStr] = useState<string>(String(base.vout));
  const [ioutStr, setIoutStr] = useState<string>(String(defaultIoutFor(base)));
  const [taStr, setTaStr] = useState<string>('25');
  const [thetaJaStr, setThetaJaStr] = useState<string>(String(base.thetaJa));
  const [tjMaxStr, setTjMaxStr] = useState<string>(String(base.tjMax));
  const [dropoutStr, setDropoutStr] = useState<string>(String(base.dropoutMv));
  const [iqStr, setIqStr] = useState<string>(String(base.iqUa));
  const [vinMinLimit, setVinMinLimit] = useState<number>(base.vinMin);
  const [vinMaxLimit, setVinMaxLimit] = useState<number>(base.vinMax);
  const [ioutRatedLimit, setIoutRatedLimit] = useState<number>(base.ioutMaxMa);

  const applyPreset = (p: LdoPreset) => {
    setSelectedOpn(p.opn);
    setVinStr(String(defaultVinFor(p)));
    setVoutStr(String(p.vout));
    setIoutStr(String(defaultIoutFor(p)));
    setTaStr('25');
    setThetaJaStr(String(p.thetaJa));
    setTjMaxStr(String(p.tjMax));
    setDropoutStr(String(p.dropoutMv));
    setIqStr(String(p.iqUa));
    setVinMinLimit(p.vinMin);
    setVinMaxLimit(p.vinMax);
    setIoutRatedLimit(p.ioutMaxMa);
  };

  const results = useMemo(() => {
    const vin = Math.max(0, parseFinite(vinStr, 5.0));
    const vout = Math.max(0, parseFinite(voutStr, 3.3));
    const ioutMa = Math.max(0, parseFinite(ioutStr, 150));
    const ta = parseFinite(taStr, 25);
    const thetaJa = Math.max(1, parseFinite(thetaJaStr, 200));
    const tjMax = Math.max(50, parseFinite(tjMaxStr, 125));
    const dropoutMv = Math.max(0, parseFinite(dropoutStr, 250));
    const iqUa = Math.max(0, parseFinite(iqStr, 50));

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
    const maxIoutThermalMa =
      vDiff > 0.001
        ? Math.max(0, ((pdMaxAllowedW - pdIqW) / vDiff) * 1000)
        : ioutRatedLimit;

    const overVinMax = initialPreset !== null && vin > vinMaxLimit;
    const underVinMin = initialPreset !== null && vin < vinMinLimit;
    const overIoutRated = initialPreset !== null && ioutMa > ioutRatedLimit;

    let status: 'SAFE' | 'CAUTION' | 'DANGER' = 'SAFE';
    let statusTitle = 'Safe Operating Region';
    let statusDetail = `Junction temperature (${tj.toFixed(1)}°C) remains safely below Tj,max (${tjMax}°C) with ${thermalMargin.toFixed(1)}°C thermal headroom and valid dropout margin.`;

    if (tj >= tjMax) {
      status = 'DANGER';
      statusTitle = 'Thermal Shutdown Danger (Tj >= Tj,max)';
      statusDetail = `Estimated Tj (${tj.toFixed(1)}°C) exceeds Tj,max (${tjMax}°C). Reduce Vin, lower Iout below ${maxIoutThermalMa.toFixed(0)} mA, add copper area, or switch to a buck converter.`;
    } else if (overVinMax) {
      status = 'DANGER';
      statusTitle = 'Input Voltage Exceeds Recommended Vin,max';
      statusDetail = `Vin (${vin.toFixed(2)} V) exceeds rated operating maximum (${vinMaxLimit} V) for ${selectedOpn}.`;
    } else if (!dropoutOk) {
      status = 'DANGER';
      statusTitle = 'Insufficient Dropout Headroom (Regulation Lost)';
      statusDetail = `Vin - Vout (${(vDiff * 1000).toFixed(0)} mV) is below required dropout voltage (${dropoutMv.toFixed(0)} mV). Output voltage will sag out of regulation.`;
    } else if (tj > 100 || thermalMargin < 15 || overIoutRated || underVinMin) {
      status = 'CAUTION';
      statusTitle = 'Caution — Tight Thermal or Rating Margin';
      const reasons: string[] = [];
      if (tj > 100) reasons.push(`Tj (${tj.toFixed(1)}°C) exceeds 100°C derating threshold`);
      if (thermalMargin < 15) reasons.push(`Thermal margin (${thermalMargin.toFixed(1)}°C) is under 15°C`);
      if (overIoutRated) reasons.push(`Iout (${ioutMa} mA) exceeds datasheet rating (${ioutRatedLimit} mA)`);
      if (underVinMin) reasons.push(`Vin (${vin} V) is below Vin,min (${vinMinLimit} V)`);
      statusDetail = reasons.join('; ') + '.';
    }

    const barPct = Math.max(0, Math.min(100, (tj / tjMax) * 100));

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
      maxIoutThermalMa,
      status,
      statusTitle,
      statusDetail,
      barPct,
    };
  }, [
    vinStr,
    voutStr,
    ioutStr,
    taStr,
    thetaJaStr,
    tjMaxStr,
    dropoutStr,
    iqStr,
    vinMinLimit,
    vinMaxLimit,
    ioutRatedLimit,
    initialPreset,
    selectedOpn,
  ]);

  const statusClasses =
    results.status === 'DANGER'
      ? 'border-rose-400 bg-rose-50 text-rose-950'
      : results.status === 'CAUTION'
        ? 'border-amber-400 bg-amber-50 text-amber-950'
        : 'border-emerald-400 bg-emerald-50 text-emerald-950';

  const barColor =
    results.status === 'DANGER'
      ? 'bg-rose-600'
      : results.status === 'CAUTION'
        ? 'bg-amber-500'
        : 'bg-emerald-600';

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
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-200">
            {selectedOpn}
          </span>
          <button
            type="button"
            onClick={() => applyPreset(base)}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      {/* Optional Quick Preset Bar on Standalone Tool */}
      {presets.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Load Datasheet Preset:
          </span>
          {presets.slice(0, 8).map((p) => (
            <button
              key={p.opn}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedOpn === p.opn
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
              }`}
            >
              {p.opn}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 sm:p-5 space-y-5">
        {/* Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Input Voltage Vin (V)
            </span>
            <input
              type="number"
              step="0.1"
              value={vinStr}
              onChange={(e) => setVinStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Output Voltage Vout (V)
            </span>
            <input
              type="number"
              step="0.1"
              value={voutStr}
              onChange={(e) => setVoutStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Load Current Iout (mA)
            </span>
            <input
              type="number"
              step="10"
              min="0"
              value={ioutStr}
              onChange={(e) => setIoutStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Ambient Temp Ta (°C)
            </span>
            <input
              type="number"
              step="5"
              value={taStr}
              onChange={(e) => setTaStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Thermal Res. θJA (°C/W)
            </span>
            <input
              type="number"
              step="5"
              min="1"
              value={thetaJaStr}
              onChange={(e) => setThetaJaStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Max Junction Tj,max (°C)
            </span>
            <input
              type="number"
              step="5"
              value={tjMaxStr}
              onChange={(e) => setTjMaxStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Dropout Vdo (mV)
            </span>
            <input
              type="number"
              step="10"
              min="0"
              value={dropoutStr}
              onChange={(e) => setDropoutStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Quiescent Iq (µA)
            </span>
            <input
              type="number"
              step="1"
              min="0"
              value={iqStr}
              onChange={(e) => setIqStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>
        </div>

        {/* Status Alert */}
        <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
          {results.status === 'DANGER' ? (
            <Flame className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
          ) : results.status === 'CAUTION' ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{results.statusTitle}</p>
            <p className="text-xs mt-0.5 leading-relaxed">{results.statusDetail}</p>
          </div>
        </div>

        {/* Output KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Power Dissipation Pd</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.pdTotalMw.toFixed(1)} <span className="text-xs font-normal text-slate-600">mW</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Est. Junction Temp Tj</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.tj.toFixed(1)} <span className="text-xs font-normal text-slate-600">°C</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Thermal Margin</div>
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
            <div className="text-[11px] font-semibold text-slate-500">Dropout Headroom</div>
            <div
              className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                results.dropoutOk ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {results.dropoutHeadroomMv >= 0 ? '+' : ''}
              {results.dropoutHeadroomMv.toFixed(0)}{' '}
              <span className="text-xs font-normal">mV</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-slate-500">Max Iout @ Ta</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.maxIoutThermalMa.toFixed(0)}{' '}
              <span className="text-xs font-normal text-slate-600">mA</span>
            </div>
          </div>
        </div>

        {/* Thermal Utilization Gauge */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1">
            <span>Ta: {results.ta.toFixed(0)}°C</span>
            <span>ΔT: +{results.deltaT.toFixed(1)}°C → Tj: {results.tj.toFixed(1)}°C</span>
            <span>Tj,max: {results.tjMax.toFixed(0)}°C</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${barColor}`}
              style={{ width: `${results.barPct}%` }}
            />
          </div>
        </div>

        {/* Formula note */}
        <p className="text-[11px] font-mono text-slate-500">
          Equations: Pd = (Vin − Vout)·Iout + Vin·Iq · Tj = Ta + Pd·θJA · Dropout Check: (Vin − Vout) ≥ Vdo
        </p>
      </div>
    </div>
  );
}
