'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, RotateCcw, Zap } from 'lucide-react';

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
}

export interface DcdcEfficiencyRippleCalculatorProps {
  initialPreset: DcdcPreset | null;
  presets: DcdcPreset[];
}

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
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
  // buck-boost (e.g. single Li-Ion 3.7V)
  return Number(Math.min(Math.max(3.6, preset.vinMin), preset.vinMax).toFixed(2));
}

function defaultIoutFor(preset: DcdcPreset): number {
  const scale = preset.isSwitchLimit ? 0.35 : 0.6;
  return Math.max(50, Math.round(preset.ratedCurrentMa * scale));
}

export function DcdcEfficiencyRippleCalculator({
  initialPreset,
  presets,
}: DcdcEfficiencyRippleCalculatorProps) {
  const base: DcdcPreset = initialPreset ?? {
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
  };

  const [selectedOpn, setSelectedOpn] = useState<string>(base.opn);
  const [topology, setTopology] = useState<'buck' | 'boost' | 'buck-boost'>(base.topology);
  const [vinStr, setVinStr] = useState<string>(String(defaultVinFor(base)));
  const [voutStr, setVoutStr] = useState<string>(String(base.voutNom));
  const [ioutStr, setIoutStr] = useState<string>(String(defaultIoutFor(base)));
  const [fswStr, setFswStr] = useState<string>(String(base.fswKhz));
  const [inductorStr, setInductorStr] = useState<string>(String(base.inductorUh));
  const [effStr, setEffStr] = useState<string>(String(base.efficiencyPct));
  const [ratedStr, setRatedStr] = useState<string>(String(base.ratedCurrentMa));
  const [isSwitchLimit, setIsSwitchLimit] = useState<boolean>(base.isSwitchLimit);

  const applyPreset = (p: DcdcPreset) => {
    setSelectedOpn(p.opn);
    setTopology(p.topology);
    setVinStr(String(defaultVinFor(p)));
    setVoutStr(String(p.voutNom));
    setIoutStr(String(defaultIoutFor(p)));
    setFswStr(String(p.fswKhz));
    setInductorStr(String(p.inductorUh));
    setEffStr(String(p.efficiencyPct));
    setRatedStr(String(p.ratedCurrentMa));
    setIsSwitchLimit(p.isSwitchLimit);
  };

  const results = useMemo(() => {
    const vin = Math.max(0.1, parseFinite(vinStr, 5.0));
    const vout = Math.max(0.1, parseFinite(voutStr, 3.3));
    const ioutMa = Math.max(1, parseFinite(ioutStr, 500));
    const fswKhz = Math.max(10, parseFinite(fswStr, 500));
    const lUh = Math.max(0.1, parseFinite(inductorStr, 4.7));
    const effPct = Math.max(30, Math.min(99, parseFinite(effStr, 90)));
    const ratedMa = Math.max(10, parseFinite(ratedStr, 1000));

    const eta = effPct / 100;
    const ioutA = ioutMa / 1000;
    const fHz = fswKhz * 1000;
    const lH = lUh * 1e-6;

    let topologyError: string | null = null;
    let duty = 0.5;
    let ilAvgA = ioutA;
    let deltaIlA = 0;
    let minLUh = lUh;
    let activeModeLabel = topology.toUpperCase();

    if (topology === 'buck') {
      if (vout >= vin) {
        topologyError = 'Buck converter requires Vin > Vout. Increase Vin or switch topology to Boost / Buck-Boost.';
      } else {
        duty = Math.min(0.99, Math.max(0.01, vout / (vin * eta)));
        ilAvgA = ioutA;
        deltaIlA = (vout * (vin - vout)) / (vin * fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vout * (vin - vout)) / (vin * fHz * targetRippleA)) * 1e6;
      }
    } else if (topology === 'boost') {
      if (vout <= vin) {
        topologyError = 'Boost converter requires Vout > Vin. Raise Vout, lower Vin, or use a Buck / Buck-Boost topology.';
      } else {
        duty = Math.min(0.95, Math.max(0.01, 1 - (vin * eta) / vout));
        ilAvgA = (ioutA * vout) / (vin * eta);
        deltaIlA = (vin * duty) / (fHz * lH);
        const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
        minLUh = ((vin * duty) / (fHz * targetRippleA)) * 1e6;
      }
    } else {
      // 4-Switch Non-Inverting Buck-Boost (automatic Buck or Boost operating mode)
      if (vin > vout) {
        activeModeLabel = 'BUCK-BOOST (Buck Mode)';
        duty = Math.min(0.98, Math.max(0.02, vout / (vin * eta)));
        ilAvgA = ioutA;
        deltaIlA = (vout * (vin - vout)) / (vin * fHz * lH);
      } else {
        activeModeLabel = 'BUCK-BOOST (Boost Mode)';
        duty = Math.min(0.94, Math.max(0.02, 1 - (vin * eta) / Math.max(vout, vin + 0.05)));
        ilAvgA = (ioutA * vout) / (vin * eta);
        deltaIlA = (vin * duty) / (fHz * lH);
      }
      const targetRippleA = Math.max(0.05, 0.3 * ilAvgA);
      minLUh =
        vin > vout
          ? ((vout * (vin - vout)) / (vin * fHz * targetRippleA)) * 1e6
          : ((vin * duty) / (fHz * targetRippleA)) * 1e6;
    }

    const iPeakA = ilAvgA + deltaIlA / 2;
    const iPeakMa = iPeakA * 1000;
    const deltaIlMa = deltaIlA * 1000;
    const ilAvgMa = ilAvgA * 1000;
    const rippleRatioPct = ilAvgA > 0 ? (deltaIlA / ilAvgA) * 100 : 0;
    const isDcm = deltaIlA / 2 > ilAvgA;

    const poutMw = vout * ioutMa;
    const pinMw = poutMw / eta;
    const pLossMw = pinMw - poutMw;

    const compareCurrentMa = isSwitchLimit ? iPeakMa : ioutMa;
    const currentUtilizationPct = (compareCurrentMa / ratedMa) * 100;
    const overCurrent = compareCurrentMa > ratedMa;
    const inductanceLow = lUh < minLUh * 0.8;

    let status: 'SAFE' | 'CAUTION' | 'DANGER' = 'SAFE';
    let statusTitle = 'Operating Within Switch & Ripple Targets';
    let statusDetail = `Peak inductor/switch current (${iPeakMa.toFixed(0)} mA) stays within rated ${isSwitchLimit ? 'switch limit' : 'output rating'} (${ratedMa.toFixed(0)} mA) with ${rippleRatioPct.toFixed(0)}% ripple ratio.`;

    if (topologyError) {
      status = 'DANGER';
      statusTitle = 'Invalid Input/Output Voltage Ratio';
      statusDetail = topologyError;
    } else if (overCurrent) {
      status = 'DANGER';
      statusTitle = isSwitchLimit
        ? 'Peak Switch Current Exceeds Rated Isw Limit'
        : 'Load Current Exceeds Rated Output Limit';
      statusDetail = `Estimated ${isSwitchLimit ? 'Ipeak' : 'Iout'} (${compareCurrentMa.toFixed(0)} mA) exceeds ${ratedMa.toFixed(0)} mA. Increase Vin, reduce load, increase L to trim ripple, or choose a higher-current IC.`;
    } else if (currentUtilizationPct > 85 || inductanceLow || isDcm) {
      status = 'CAUTION';
      statusTitle = 'Caution — High Ripple, DCM, or Narrow Current Margin';
      const notes: string[] = [];
      if (currentUtilizationPct > 85) {
        notes.push(`Current utilization is ${currentUtilizationPct.toFixed(0)}% of rated ${ratedMa.toFixed(0)} mA`);
      }
      if (inductanceLow) {
        notes.push(`Chosen L (${lUh} µH) is below ~30% ripple target (${minLUh.toFixed(1)} µH)`);
      }
      if (isDcm) {
        notes.push('Converter operates in Discontinuous Conduction Mode (DCM) at this load');
      }
      statusDetail = notes.join('; ') + '.';
    }

    return {
      activeModeLabel,
      dutyPct: duty * 100,
      ilAvgMa,
      deltaIlMa,
      iPeakMa,
      rippleRatioPct,
      minLUh,
      poutMw,
      pLossMw,
      effPct,
      ratedMa,
      currentUtilizationPct,
      status,
      statusTitle,
      statusDetail,
    };
  }, [topology, vinStr, voutStr, ioutStr, fswStr, inductorStr, effStr, ratedStr, isSwitchLimit]);

  const statusClasses =
    results.status === 'DANGER'
      ? 'border-rose-400 bg-rose-50 text-rose-950'
      : results.status === 'CAUTION'
        ? 'border-amber-400 bg-amber-50 text-amber-950'
        : 'border-emerald-400 bg-emerald-50 text-emerald-950';

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <h3 className="text-sm font-bold tracking-tight">
            Interactive DC-DC Inductor Ripple, Peak Current &amp; Loss Calculator
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-amber-200">
            {selectedOpn} · {results.activeModeLabel}
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
        {/* Topology selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-1">Topology:</span>
          {(['buck', 'boost', 'buck-boost'] as const).map((topo) => (
            <button
              key={topo}
              type="button"
              onClick={() => setTopology(topo)}
              className={`rounded-md border px-3 py-1 text-xs font-mono font-bold uppercase cursor-pointer transition-colors ${
                topology === topo
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {topo}
            </button>
          ))}
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isSwitchLimit}
              onChange={(e) => setIsSwitchLimit(e.target.checked)}
              className="rounded border-slate-300"
            />
            Rated current is Peak Switch Limit (Isw)
          </label>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Vin (V)</span>
            <input
              type="number"
              step="0.1"
              value={vinStr}
              onChange={(e) => setVinStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Vout (V)</span>
            <input
              type="number"
              step="0.1"
              value={voutStr}
              onChange={(e) => setVoutStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Load Iout (mA)</span>
            <input
              type="number"
              step="50"
              min="1"
              value={ioutStr}
              onChange={(e) => setIoutStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">fsw (kHz)</span>
            <input
              type="number"
              step="50"
              min="10"
              value={fswStr}
              onChange={(e) => setFswStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Inductor L (µH)</span>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={inductorStr}
              onChange={(e) => setInductorStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Est. Efficiency η (%)</span>
            <input
              type="number"
              step="1"
              min="30"
              max="99"
              value={effStr}
              onChange={(e) => setEffStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block col-span-2">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Rated {isSwitchLimit ? 'Switch Current Limit Isw' : 'Output Current Iout'} (mA)
            </span>
            <input
              type="number"
              step="50"
              min="10"
              value={ratedStr}
              onChange={(e) => setRatedStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>
        </div>

        {/* Status Banner */}
        <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
          {results.status === 'DANGER' ? (
            <Flame className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
          ) : results.status === 'CAUTION' ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-bold">{results.statusTitle}</p>
            <p className="text-xs mt-0.5 leading-relaxed">{results.statusDetail}</p>
          </div>
        </div>

        {/* Outputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Duty Cycle D</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.dutyPct.toFixed(1)}<span className="text-xs font-normal text-slate-600">%</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Ripple ΔIL</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.deltaIlMa.toFixed(0)} <span className="text-xs font-normal text-slate-600">mA</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Peak Ipeak</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.iPeakMa.toFixed(0)} <span className="text-xs font-normal text-slate-600">mA</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Min L (30% ΔIL)</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.minLUh.toFixed(1)} <span className="text-xs font-normal text-slate-600">µH</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Est. Power Loss</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.pLossMw.toFixed(0)} <span className="text-xs font-normal text-slate-600">mW</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Min Inductor Isat</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-sky-800">
              {(results.iPeakMa * 1.25).toFixed(0)}{' '}
              <span className="text-xs font-normal text-slate-600">mA</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-slate-500">
          Size inductor saturation current Isat ≥ 1.25 × Ipeak. Avg inductor current IL,avg = {results.ilAvgMa.toFixed(0)} mA · Output power Pout = {results.poutMw.toFixed(0)} mW.
        </p>
      </div>
    </div>
  );
}
