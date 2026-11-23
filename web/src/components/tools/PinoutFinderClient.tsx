'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Filter,
  RotateCcw,
  Scale,
  SlidersHorizontal,
} from 'lucide-react';
import type { GoldenPartV2, PackageCode, PartCategory, PinRole } from '@/types/schema';
import { matchPinoutQuery, type PinoutMatchItem, type PinoutQuery } from '@/lib/xref-client';
import { categoryShortLabel, fmtCurrentMa, fmtIqUa, fmtNum } from '@/lib/format';
import { trackEvent } from '@/lib/analytics';

export interface PinoutFinderClientProps {
  parts: GoldenPartV2[];
}

interface FootprintPreset {
  id: string;
  label: string;
  subtitle: string;
  packageCode: PackageCode;
  pinCount: number;
  pinRoles: Record<number, PinRole | 'ANY'>;
  exposedPadNet: NonNullable<PinoutQuery['exposedPadNet']>;
}

const FOOTPRINT_PRESETS: FootprintPreset[] = [
  {
    id: 'sot23-3-classic',
    label: 'SOT-23-3 Classic LDO',
    subtitle: '1:GND · 2:VOUT · 3:VIN',
    packageCode: 'SOT-23-3',
    pinCount: 3,
    pinRoles: { 1: 'GND', 2: 'VOUT', 3: 'VIN' },
    exposedPadNet: 'ANY',
  },
  {
    id: 'sot223-3-1117',
    label: 'SOT-223-3 1117 LDO',
    subtitle: '1:GND · 2:VOUT · 3:VIN · Tab:VOUT',
    packageCode: 'SOT-223-3',
    pinCount: 3,
    pinRoles: { 1: 'GND', 2: 'VOUT', 3: 'VIN' },
    exposedPadNet: 'VOUT',
  },
  {
    id: 'sot23-5-ldo',
    label: 'SOT-23-5 Standard LDO',
    subtitle: '1:VIN · 2:GND · 3:EN · 4:NC/BYP · 5:VOUT',
    packageCode: 'SOT-23-5',
    pinCount: 5,
    pinRoles: { 1: 'VIN', 2: 'GND', 3: 'EN', 4: 'ANY', 5: 'VOUT' },
    exposedPadNet: 'ANY',
  },
  {
    id: 'sot23-6-buck',
    label: 'SOT-23-6 Sync Buck',
    subtitle: '1:GND · 2:SW · 3:VIN · 4:FB · 5:EN · 6:BOOT',
    packageCode: 'SOT-23-6',
    pinCount: 6,
    pinRoles: { 1: 'GND', 2: 'SW', 3: 'VIN', 4: 'FB', 5: 'EN', 6: 'BOOT' },
    exposedPadNet: 'ANY',
  },
  {
    id: 'soic-8-dual-opamp',
    label: 'SOIC-8 Dual Op-Amp',
    subtitle: '1:OUTA 2:IN-A 3:IN+A 4:VEE 5:IN+B 6:IN-B 7:OUTB 8:VCC',
    packageCode: 'SOIC-8',
    pinCount: 8,
    pinRoles: {
      1: 'OUT_A',
      2: 'IN_NEG_A',
      3: 'IN_POS_A',
      4: 'VEE',
      5: 'IN_POS_B',
      6: 'IN_NEG_B',
      7: 'OUT_B',
      8: 'VCC',
    },
    exposedPadNet: 'ANY',
  },
  {
    id: 'sot23-5-opamp-std',
    label: 'SOT-23-5 Single Op-Amp (Std)',
    subtitle: '1:OUT · 2:VEE · 3:IN+ · 4:IN- · 5:VCC',
    packageCode: 'SOT-23-5',
    pinCount: 5,
    pinRoles: { 1: 'OUT', 2: 'VEE', 3: 'IN_POS', 4: 'IN_NEG', 5: 'VCC' },
    exposedPadNet: 'ANY',
  },
  {
    id: 'sot23-5-opamp-u',
    label: 'SOT-23-5 Single Op-Amp (U-Pinout)',
    subtitle: '1:IN+ · 2:VEE · 3:IN- · 4:OUT · 5:VCC',
    packageCode: 'SOT-23-5',
    pinCount: 5,
    pinRoles: { 1: 'IN_POS', 2: 'VEE', 3: 'IN_NEG', 4: 'OUT', 5: 'VCC' },
    exposedPadNet: 'ANY',
  },
];

const ALL_PIN_ROLES: PinRole[] = [
  'GND',
  'VIN',
  'VOUT',
  'EN',
  'FB',
  'SW',
  'BOOT',
  'NC',
  'BYPASS',
  'ADJ',
  'COMP',
  'SS',
  'PG',
  'OUT',
  'IN_POS',
  'IN_NEG',
  'OUT_A',
  'IN_POS_A',
  'IN_NEG_A',
  'OUT_B',
  'IN_POS_B',
  'IN_NEG_B',
  'VCC',
  'VEE',
  'VREF',
  'SYNC',
  'MODE',
  'PS',
  'OTHER',
];

function inferPinCount(pkg: PackageCode | 'ALL', pkgPinMap: Map<PackageCode, number>): number {
  if (pkg === 'ALL') return 6;
  return pkgPinMap.get(pkg) ?? 5;
}

function lifecyclePill(status: GoldenPartV2['lifecycle_status']): string {
  switch (status) {
    case 'Active':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'NRND':
      return 'border-amber-300 bg-amber-50 text-amber-950';
    case 'EOL':
      return 'border-rose-300 bg-rose-50 text-rose-950';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-700';
  }
}

function summarizeKeySpecs(p: GoldenPartV2): string {
  if (p.category === 'ldo') {
    return `${fmtNum(p.specs.vout_v.value, 2)}V ${p.specs.vout_fixed ? 'Fix' : 'Adj'} · Vin≤${fmtNum(p.specs.vin_max_v.value, 1)}V · ${fmtCurrentMa(p.specs.iout_max_ma.value)} · Iq ${fmtIqUa(p.specs.iq_typ_ua.value)} · ${p.specs.ceramic_cap_stable ? 'MLCC OK' : 'ESR-Bound'}`;
  }
  if (p.category === 'dcdc') {
    return `${p.specs.topology.toUpperCase()} (${p.specs.synchronous ? 'Sync' : 'Async'}) · Vin ${fmtNum(p.specs.vin_min_v.value, 1)}–${fmtNum(p.specs.vin_max_v.value, 1)}V · ${fmtCurrentMa(p.specs.iout_or_isw_max_ma.value)} · ${fmtNum(p.specs.fsw_typ_khz.value, 0)} kHz`;
  }
  return `${p.specs.channels}ch ${p.specs.device_kind} (${p.specs.output_type}) · Vs≤${fmtNum(p.specs.vs_max_v.value, 1)}V · ${
    p.specs.device_kind === 'comparator'
      ? `tpd ${p.specs.prop_delay_ns ? fmtNum(p.specs.prop_delay_ns.value, 0) + 'ns' : '—'}`
      : `GBWP ${p.specs.gbwp_mhz ? fmtNum(p.specs.gbwp_mhz.value, 2) + ' MHz' : '—'}`
  }`;
}

export function PinoutFinderClient({ parts }: PinoutFinderClientProps) {
  const { packageCounts, pkgPinMap } = useMemo(() => {
    const counts = new Map<PackageCode, number>();
    const pins = new Map<PackageCode, number>();
    for (const p of parts) {
      counts.set(p.package.code, (counts.get(p.package.code) ?? 0) + 1);
      pins.set(p.package.code, p.package.pin_count);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { packageCounts: sorted, pkgPinMap: pins };
  }, [parts]);

  const [packageCode, setPackageCode] = useState<PackageCode | 'ALL'>('SOT-23-5');
  const [allowFootprintCompat, setAllowFootprintCompat] = useState<boolean>(true);
  const [pinRoles, setPinRoles] = useState<Record<number, PinRole | 'ANY'>>({
    1: 'VIN',
    2: 'GND',
    3: 'EN',
    4: 'ANY',
    5: 'VOUT',
  });
  const [exposedPadNet, setExposedPadNet] = useState<NonNullable<PinoutQuery['exposedPadNet']>>('ANY');
  const [category, setCategory] = useState<PartCategory | 'ALL'>('ALL');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [ceramicOnly, setCeramicOnly] = useState<boolean>(false);
  const [minIoutStr, setMinIoutStr] = useState<string>('');
  const [maxIqStr, setMaxIqStr] = useState<string>('');
  const [minVinMaxStr, setMinVinMaxStr] = useState<string>('');
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  const pinCount = inferPinCount(packageCode, pkgPinMap);

  const handleSelectPackage = (nextPkg: PackageCode | 'ALL') => {
    setPackageCode(nextPkg);
    const nextCount = inferPinCount(nextPkg, pkgPinMap);
    const trimmed: Record<number, PinRole | 'ANY'> = {};
    for (let i = 1; i <= nextCount; i++) {
      trimmed[i] = 'ANY';
    }
    setPinRoles(trimmed);
    setExposedPadNet('ANY');
    trackEvent('pinout_finder_package', { package: nextPkg });
  };

  const applyFootprintPreset = (preset: FootprintPreset) => {
    setPackageCode(preset.packageCode);
    setPinRoles({ ...preset.pinRoles });
    setExposedPadNet(preset.exposedPadNet);
    setCategory('ALL');
    trackEvent('pinout_finder_preset', { preset: preset.id });
  };

  const resetAll = () => {
    setPackageCode('ALL');
    setPinRoles({});
    setExposedPadNet('ANY');
    setCategory('ALL');
    setActiveOnly(false);
    setCeramicOnly(false);
    setMinIoutStr('');
    setMaxIqStr('');
    setMinVinMaxStr('');
  };

  const toggleCompareSelection = (slug: string) => {
    setSelectedSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 2) return [prev[1], slug];
      return [...prev, slug];
    });
  };

  const { exact, partial } = useMemo(() => {
    const query: PinoutQuery = {
      packageCode,
      allowFootprintCompat,
      pinRoles,
      exposedPadNet,
      category,
      activeOnly,
      ceramicOnly,
      minIoutMa: minIoutStr.trim() !== '' && Number.isFinite(Number(minIoutStr)) ? Number(minIoutStr) : null,
      maxIqUa: maxIqStr.trim() !== '' && Number.isFinite(Number(maxIqStr)) ? Number(maxIqStr) : null,
      minVinMaxV: minVinMaxStr.trim() !== '' && Number.isFinite(Number(minVinMaxStr)) ? Number(minVinMaxStr) : null,
    };
    return matchPinoutQuery(parts, query);
  }, [
    parts,
    packageCode,
    allowFootprintCompat,
    pinRoles,
    exposedPadNet,
    category,
    activeOnly,
    ceramicOnly,
    minIoutStr,
    maxIqStr,
    minVinMaxStr,
  ]);

  const renderMatchCard = (item: PinoutMatchItem) => {
    const p = item.part;
    const checked = selectedSlugs.includes(p.slug);
    return (
      <div
        key={p.slug}
        className={`rounded-lg border p-4 transition-colors space-y-2.5 ${
          checked
            ? 'border-sky-600 bg-sky-50/40'
            : item.matchKind === 'EXACT'
              ? 'border-emerald-300 bg-white'
              : 'border-amber-300 bg-amber-50/20'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <label className="mt-0.5 flex items-center cursor-pointer" title="Select up to 2 parts to compare">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCompareSelection(p.slug)}
                className="h-4 w-4 rounded border-slate-400 text-sky-700 focus:ring-sky-600 cursor-pointer"
                aria-label={`Select ${p.opn} for live comparison`}
              />
            </label>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/en/part/${p.slug}`}
                  className="font-mono text-sm font-bold text-slate-950 hover:text-sky-700 hover:underline"
                >
                  {p.opn}
                </Link>
                <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                  {p.package.code}
                </span>
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${lifecyclePill(p.lifecycle_status)}`}>
                  {p.lifecycle_status}
                </span>
                <span className="text-[11px] font-medium text-slate-600">
                  {p.manufacturer} · {categoryShortLabel(p.category)}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5 font-mono">{summarizeKeySpecs(p)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.constrainedPins > 0 && (
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${
                  item.matchKind === 'EXACT'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
                }`}
              >
                {item.matchedPins}/{item.constrainedPins} pins
              </span>
            )}
            <Link
              href={`/en/part/${p.slug}`}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Inspect →
            </Link>
          </div>
        </div>

        {/* Pinout Pills */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {p.package.pinout.map((pin) => {
            const isCaution = item.cautionPins.includes(pin.pin);
            const isMismatch = item.mismatchPins.includes(pin.pin);
            const isConstrained = pinRoles[pin.pin] && pinRoles[pin.pin] !== 'ANY';
            const pillCls = isMismatch
              ? 'border-rose-300 bg-rose-50 text-rose-950'
              : isCaution
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : isConstrained
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-700';
            return (
              <span
                key={pin.pin}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] ${pillCls}`}
              >
                <span className="text-slate-500">P{pin.pin}:</span>
                <span>{pin.name}</span>
                {pin.name.toUpperCase() !== pin.role && (
                  <span className="text-[11px] text-slate-600">({pin.role})</span>
                )}
              </span>
            );
          })}
          {p.package.exposed_pad.present && (
            <span
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                item.epMatched
                  ? 'border-teal-300 bg-teal-50 text-teal-950'
                  : 'border-rose-300 bg-rose-50 text-rose-950'
              }`}
            >
              EP/TAB: {p.package.exposed_pad.net}
            </span>
          )}
        </div>

        {/* Caution Notes */}
        {(item.footprintVariantNote || !item.epMatched || item.cautionPins.length > 0 || item.mismatchPins.length > 0) && (
          <div className="text-[11px] text-amber-950 bg-amber-50/70 border border-amber-200 rounded px-2.5 py-1.5 space-y-0.5">
            {item.footprintVariantNote && <div>• {item.footprintVariantNote}</div>}
            {!item.epMatched && (
              <div>
                • Exposed pad / thermal tab net differs ({p.package.exposed_pad.present ? p.package.exposed_pad.net : 'NONE'} vs requested {exposedPadNet}).
              </div>
            )}
            {item.cautionPins.length > 0 && (
              <div>• Caution pin alias on Pin {item.cautionPins.join(', ')} (e.g. NC↔BYPASS or fixed ADJ↔GND). Verify PCB net.</div>
            )}
            {item.mismatchPins.length > 0 && (
              <div>• Pin conflict on Pin {item.mismatchPins.join(', ')} — requires trace cut / layout rework.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Package Selection */}
      <section aria-label="Step 1 Select PCB Package" className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-950">
              Step 1 · Select PCB Package ({packageCounts.length} Verified Packages)
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset Filters
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectPackage('ALL')}
            className={`rounded-md border px-2.5 py-1.5 font-mono text-xs font-semibold cursor-pointer ${
              packageCode === 'ALL'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'
            }`}
          >
            ALL ({parts.length})
          </button>
          {packageCounts.map(([code, count]) => (
            <button
              key={code}
              type="button"
              onClick={() => handleSelectPackage(code)}
              className={`rounded-md border px-2.5 py-1.5 font-mono text-xs font-semibold cursor-pointer ${
                packageCode === code
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-500 hover:bg-white'
              }`}
            >
              {code} <span className="opacity-80">({count})</span>
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={allowFootprintCompat}
            onChange={(e) => setAllowFootprintCompat(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-400 text-sky-700"
          />
          Include shared-land-pattern variants (e.g., SOT-23-5 ↔ TSOT-23-5, SOT-23-6 ↔ TSOT-23-6) as Partial/Caution matches
        </label>
      </section>

      {/* Step 2: Popular PCB Footprint Presets */}
      <section aria-label="Step 2 Popular PCB Footprint Presets" className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-950">
          Step 2 · One-Click Popular PCB Footprint Presets
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {FOOTPRINT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyFootprintPreset(preset)}
              className="rounded-md border border-slate-300 bg-slate-50 p-3 text-left hover:border-sky-600 hover:bg-sky-50/40 transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-slate-950">{preset.label}</div>
              <div className="font-mono text-[11px] text-slate-600 mt-0.5 leading-snug">
                {preset.subtitle}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Step 3: Per-Pin Role Selector + Engineering Filters */}
      <section aria-label="Step 3 Pin Role Assignment and Engineering Filters" className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-950">
              Step 3 · Assign Required Pin Roles &amp; Engineering Constraints
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setPinRoles({})}
            className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
          >
            Clear All Pin Roles (Set ANY)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {Array.from({ length: pinCount }, (_, i) => i + 1).map((pinNum) => {
            const current = pinRoles[pinNum] ?? 'ANY';
            return (
              <label key={pinNum} className="block rounded-md border border-slate-200 bg-slate-50 p-2">
                <span className="block font-mono text-[11px] font-bold text-slate-700 mb-1">
                  Pin {pinNum}
                </span>
                <select
                  value={current}
                  onChange={(e) =>
                    setPinRoles((prev) => ({
                      ...prev,
                      [pinNum]: e.target.value as PinRole | 'ANY',
                    }))
                  }
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
                >
                  <option value="ANY">ANY</option>
                  {ALL_PIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}

          {/* Thermal Tab / EP Net */}
          <label className="block rounded-md border border-teal-200 bg-teal-50/60 p-2">
            <span className="block font-mono text-[11px] font-bold text-teal-900 mb-1">
              EP / Thermal Tab
            </span>
            <select
              value={exposedPadNet}
              onChange={(e) => setExposedPadNet(e.target.value as NonNullable<PinoutQuery['exposedPadNet']>)}
              className="w-full rounded border border-teal-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
            >
              <option value="ANY">ANY</option>
              <option value="NONE">None (No EP)</option>
              <option value="GND_ANY">GND / Thermal GND</option>
              <option value="VOUT">VOUT (Live Tab)</option>
              <option value="VIN">VIN (Live Tab)</option>
              <option value="SW">SW (Live Tab)</option>
              <option value="FLOATING">Floating</option>
            </select>
          </label>
        </div>

        {/* Engineering Filters */}
        <div className="border-t border-slate-200 pt-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PartCategory | 'ALL')}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
            >
              <option value="ALL">All Categories</option>
              <option value="ldo">LDO</option>
              <option value="dcdc">DC-DC</option>
              <option value="opamp">Op-Amp / Comp</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Min Iout / Isw (mA)</span>
            <input
              type="number"
              min="0"
              placeholder="e.g. 300"
              value={minIoutStr}
              onChange={(e) => setMinIoutStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Max Iq (µA)</span>
            <input
              type="number"
              min="0"
              placeholder="e.g. 100"
              value={maxIqStr}
              onChange={(e) => setMaxIqStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Min Vin,max / Vs,max (V)</span>
            <input
              type="number"
              min="0"
              placeholder="e.g. 5.5"
              value={minVinMaxStr}
              onChange={(e) => setMinVinMaxStr(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-400 text-emerald-700"
            />
            Active Only
          </label>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={ceramicOnly}
              onChange={(e) => setCeramicOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-400 text-emerald-700"
            />
            MLCC Stable (LDO)
          </label>
        </div>
      </section>

      {/* Sticky Compare Bar when 1-2 matches selected */}
      {selectedSlugs.length > 0 && (
        <div className="sticky bottom-3 z-20 rounded-lg border-2 border-sky-700 bg-slate-900 px-4 py-3 text-white shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Scale className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <span className="font-bold">Compare Queue ({selectedSlugs.length}/2):</span>
            {selectedSlugs.map((slug) => {
              const part = parts.find((x) => x.slug === slug);
              return (
                <span key={slug} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-sky-200">
                  {part?.opn ?? slug}
                </span>
              );
            })}
            {selectedSlugs.length === 1 && (
              <span className="text-slate-300">Select 1 more part to launch Live Comparator</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedSlugs([])}
              className="rounded border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              Clear
            </button>
            {selectedSlugs.length === 2 && (
              <Link
                href={`/en/tools/compare?a=${encodeURIComponent(selectedSlugs[0])}&b=${encodeURIComponent(selectedSlugs[1])}`}
                className="rounded bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
              >
                Compare Selected Pair →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Results: Exact Footprint Matches */}
      <section aria-label="Exact footprint matches" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-950">
              Exact Footprint &amp; Pinout Matches ({exact.length})
            </h2>
          </div>
          <span className="text-xs text-slate-600">
            Check any 2 parts to send directly to Live A-vs-B Comparator
          </span>
        </div>

        {exact.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-xs text-slate-700 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
            No exact matches for the current pin &amp; constraint combination. Check Partial/Caution matches below or relax a pin role to ANY.
          </div>
        ) : (
          <div className="space-y-2.5">{exact.map(renderMatchCard)}</div>
        )}
      </section>

      {/* Results: Partial / Caution Matches */}
      {partial.length > 0 && (
        <section aria-label="Partial and caution matches" className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-950">
              Partial / Caution Matches ({partial.length})
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            These devices share your package or most pin roles, but carry a Pin 4 NC↔BYPASS difference, shared-land-pattern body height delta, thermal tab conflict, or partial pin mismatch. Verify before PCB rework.
          </p>
          <div className="space-y-2.5">{partial.map(renderMatchCard)}</div>
        </section>
      )}
    </div>
  );
}
