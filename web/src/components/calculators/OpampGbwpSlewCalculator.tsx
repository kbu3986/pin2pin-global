'use client';

import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Flame, Info, RotateCcw } from 'lucide-react';

export interface OpampPreset {
  opn: string;
  deviceKind: 'opamp' | 'comparator';
  gbwpMhz: number | null;
  slewRateVus: number | null;
  propDelayNs: number | null;
  vsMax: number;
}

export interface OpampGbwpSlewCalculatorProps {
  initialPreset: OpampPreset | null;
  presets: OpampPreset[];
}

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function OpampGbwpSlewCalculator({
  initialPreset,
  presets,
}: OpampGbwpSlewCalculatorProps) {
  const base: OpampPreset = initialPreset ?? {
    opn: 'Custom Op-Amp',
    deviceKind: 'opamp',
    gbwpMhz: 1.0,
    slewRateVus: 0.5,
    propDelayNs: null,
    vsMax: 5.5,
  };

  const [selectedOpn, setSelectedOpn] = useState<string>(base.opn);
  const [deviceKind, setDeviceKind] = useState<'opamp' | 'comparator'>(base.deviceKind);
  const [propDelayNs, setPropDelayNs] = useState<number | null>(base.propDelayNs);
  const [aclStr, setAclStr] = useState<string>('10');
  const [fSigStr, setFSigStr] = useState<string>('20');
  const [vPeakStr, setVPeakStr] = useState<string>(
    String(Math.min(1.5, Number((base.vsMax * 0.25).toFixed(1)) || 1.0)),
  );
  const [gbwpStr, setGbwpStr] = useState<string>(String(base.gbwpMhz ?? 1.0));
  const [srStr, setSrStr] = useState<string>(String(base.slewRateVus ?? 0.5));

  const applyPreset = (p: OpampPreset) => {
    setSelectedOpn(p.opn);
    setDeviceKind(p.deviceKind);
    setPropDelayNs(p.propDelayNs);
    setAclStr('10');
    setFSigStr('20');
    setVPeakStr(String(Math.min(1.5, Number((p.vsMax * 0.25).toFixed(1)) || 1.0)));
    setGbwpStr(String(p.gbwpMhz ?? 1.0));
    setSrStr(String(p.slewRateVus ?? 0.5));
  };

  const results = useMemo(() => {
    const acl = Math.max(1, parseFinite(aclStr, 10));
    const fSigKhz = Math.max(0.01, parseFinite(fSigStr, 20));
    const vPeak = Math.max(0.01, parseFinite(vPeakStr, 1.0));
    const gbwpMhz = Math.max(0.01, parseFinite(gbwpStr, 1.0));
    const srVus = Math.max(0.005, parseFinite(srStr, 0.5));

    // Closed-loop -3dB bandwidth in kHz
    const f3dbKhz = (gbwpMhz * 1000) / acl;
    // Required slew rate in V/us = 2 * pi * f(Hz) * Vpeak / 1e6 = 2 * pi * f(kHz) * Vpeak / 1000
    const requiredSrVus = (2 * Math.PI * fSigKhz * vPeak) / 1000;
    // Full-power bandwidth in kHz = (SR * 1e6) / (2 * pi * Vpeak) / 1000 = (SR * 1000) / (2 * pi * Vpeak)
    const fpbwKhz = (srVus * 1000) / (2 * Math.PI * vPeak);

    const bwRatio = f3dbKhz / fSigKhz;
    const srRatio = srVus / requiredSrVus;

    let status: 'PASS' | 'CAUTION' | 'DISTORTION' = 'PASS';
    let statusTitle = 'Pass — Linear Bandwidth & Slew Rate Headroom Verified';
    let statusDetail = `Closed-loop −3 dB bandwidth (${f3dbKhz.toFixed(1)} kHz) and Full-Power Bandwidth (${fpbwKhz.toFixed(1)} kHz) cleanly exceed your ${fSigKhz.toFixed(1)} kHz signal.`;

    if (srVus < requiredSrVus) {
      status = 'DISTORTION';
      statusTitle = 'Slew-Rate Limiting Warning (Triangle-Wave Distortion)';
      statusDetail = `Required slew rate (${requiredSrVus.toFixed(3)} V/µs) exceeds amplifier SR (${srVus.toFixed(3)} V/µs). Output sine wave will distort above FPBW = ${fpbwKhz.toFixed(1)} kHz.`;
    } else if (fSigKhz > f3dbKhz) {
      status = 'DISTORTION';
      statusTitle = 'Signal Exceeds Closed-Loop −3 dB Bandwidth';
      statusDetail = `At gain Acl = ${acl} V/V, −3 dB cutoff is ${f3dbKhz.toFixed(1)} kHz (below ${fSigKhz.toFixed(1)} kHz). Lower closed-loop gain or select a higher-GBWP amplifier.`;
    } else if (bwRatio < 5 || srRatio < 1.5) {
      status = 'CAUTION';
      statusTitle = 'Caution — Narrow Gain Accuracy or Slew Margin';
      const notes: string[] = [];
      if (bwRatio < 5) {
        notes.push(`f_sig is within 5× of f_-3dB (${bwRatio.toFixed(1)}× headroom), causing noticeable gain roll-off & phase lag`);
      }
      if (srRatio < 1.5) {
        notes.push(`Slew rate margin is only ${srRatio.toFixed(2)}× above required minimum`);
      }
      statusDetail = notes.join('; ') + '.';
    }

    return {
      acl,
      fSigKhz,
      vPeak,
      gbwpMhz,
      srVus,
      f3dbKhz,
      requiredSrVus,
      fpbwKhz,
      bwRatio,
      srRatio,
      status,
      statusTitle,
      statusDetail,
    };
  }, [aclStr, fSigStr, vPeakStr, gbwpStr, srStr]);

  const statusClasses =
    results.status === 'DISTORTION'
      ? 'border-rose-400 bg-rose-50 text-rose-950'
      : results.status === 'CAUTION'
        ? 'border-amber-400 bg-amber-50 text-amber-950'
        : 'border-emerald-400 bg-emerald-50 text-emerald-950';

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <h3 className="text-sm font-bold tracking-tight">
            Interactive Op-Amp GBWP &amp; Slew Rate Distortion Checker
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-sky-200">
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
        {deviceKind === 'comparator' && (
          <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-950 flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-sky-700 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="font-semibold">Comparator Notice ({selectedOpn}):</strong>{' '}
              Comparators are uncompensated open-loop switching devices and are NOT specified by linear GBWP or slew rate.
              {propDelayNs !== null && (
                <span>
                  {' '}
                  Datasheet propagation delay is{' '}
                  <strong className="font-mono">{propDelayNs} ns</strong> (approx. max toggle ceiling{' '}
                  <strong className="font-mono">
                    {(1000 / (4 * Math.max(1, propDelayNs))).toFixed(2)} MHz
                  </strong>
                  ). You can still test replacement op-amp GBWP/SR targets below.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Closed-Loop Gain Acl (V/V)
            </span>
            <input
              type="number"
              step="1"
              min="1"
              value={aclStr}
              onChange={(e) => setAclStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Signal Freq f_sig (kHz)
            </span>
            <input
              type="number"
              step="1"
              min="0.01"
              value={fSigStr}
              onChange={(e) => setFSigStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Output Vpeak (V)
            </span>
            <input
              type="number"
              step="0.1"
              min="0.01"
              value={vPeakStr}
              onChange={(e) => setVPeakStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Op-Amp GBWP (MHz)
            </span>
            <input
              type="number"
              step="0.1"
              min="0.01"
              value={gbwpStr}
              onChange={(e) => setGbwpStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <label className="block col-span-2 sm:col-span-1">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Slew Rate SR (V/µs)
            </span>
            <input
              type="number"
              step="0.1"
              min="0.005"
              value={srStr}
              onChange={(e) => setSrStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>
        </div>

        {/* Status */}
        <div className={`rounded-md border p-3.5 flex items-start gap-3 ${statusClasses}`}>
          {results.status === 'DISTORTION' ? (
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Closed-Loop −3 dB BW</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.f3dbKhz >= 1000
                ? `${(results.f3dbKhz / 1000).toFixed(2)} MHz`
                : `${results.f3dbKhz.toFixed(1)} kHz`}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Required Slew Rate</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.requiredSrVus.toFixed(3)}{' '}
              <span className="text-xs font-normal text-slate-600">V/µs</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Full-Power BW (FPBW)</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">
              {results.fpbwKhz >= 1000
                ? `${(results.fpbwKhz / 1000).toFixed(2)} MHz`
                : `${results.fpbwKhz.toFixed(1)} kHz`}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Slew Rate Margin</div>
            <div
              className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                results.srRatio < 1
                  ? 'text-rose-700'
                  : results.srRatio < 1.5
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              {results.srRatio.toFixed(2)}×
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-slate-500">
          Equations: f_-3dB = GBWP / Acl · SR_req = 2π · f_sig · Vpeak · FPBW = SR / (2π · Vpeak)
        </p>
      </div>
    </div>
  );
}
