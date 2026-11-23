'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  FlipHorizontal2,
  Link2,
  Scale,
  Search,
  ShieldAlert,
  Thermometer,
} from 'lucide-react';
import type { GoldenPartV2, PartCategory } from '@/types/schema';
import { comparePartsClient } from '@/lib/xref-client';
import {
  categoryShortLabel,
  fmtNum,
  getCompatibilityStyle,
} from '@/lib/format';
import { PackagePinoutSvg } from '@/components/PackagePinoutSvg';
import { trackEvent } from '@/lib/analytics';

export interface CompareToolClientProps {
  parts: GoldenPartV2[];
  vsSlugs: string[];
}

interface CuratedPreset {
  label: string;
  tag: string;
  slugA: string;
  slugB: string;
}

const CURATED_CANDIDATES: CuratedPreset[] = [
  {
    label: 'AMS1117-3.3 vs LM1117IMPX-3.3',
    tag: 'SOT-223 Tab=VOUT',
    slugA: 'ams1117-3-3',
    slugB: 'lm1117impx-3-3-nopb',
  },
  {
    label: 'AMS1117-3.3 vs LM2937IMP-3.3',
    tag: 'Tab Short Trap!',
    slugA: 'ams1117-3-3',
    slugB: 'lm2937imp-3-3-nopb',
  },
  {
    label: 'AP2112K-3.3 vs TLV75533PDBVR',
    tag: 'SOT-23-5 3.3V',
    slugA: 'ap2112k-3-3trg1',
    slugB: 'tlv75533pdbvr',
  },
  {
    label: 'LM358DR vs LM393DR',
    tag: 'Op-Amp vs Comp Trap',
    slugA: 'lm358dr',
    slugB: 'lm393dr',
  },
  {
    label: 'TPS54302DDCR vs MP1584EN',
    tag: 'Sync Buck Compare',
    slugA: 'tps54302ddcr',
    slugB: 'mp1584en-lf-z',
  },
  {
    label: 'MCP1700T-3302E/TT vs XC6206P332MR',
    tag: 'SOT-23-3 Pinout Trap',
    slugA: 'mcp1700t-3302e-tt',
    slugB: 'xc6206p332mr',
  },
];

function lifecycleBadgeClass(status: GoldenPartV2['lifecycle_status']): string {
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

async function copyToClipboard(text: string): Promise<boolean> {
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

function PartSelectorCard({
  side,
  parts,
  selectedSlug,
  onSelect,
  otherSlug,
}: {
  side: 'A' | 'B';
  parts: GoldenPartV2[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  otherSlug: string;
}) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<PartCategory | 'ALL'>('ALL');
  const [pkgFilter, setPkgFilter] = useState<string>('ALL');

  const packages = useMemo(() => {
    const set = new Set<string>();
    for (const p of parts) {
      if (catFilter === 'ALL' || p.category === catFilter) {
        set.add(p.package.code);
      }
    }
    return Array.from(set).sort();
  }, [parts, catFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts.filter((p) => {
      if (catFilter !== 'ALL' && p.category !== catFilter) return false;
      if (pkgFilter !== 'ALL' && p.package.code !== pkgFilter) return false;
      if (!q) return true;
      return (
        p.opn.toLowerCase().includes(q) ||
        p.family.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q) ||
        p.package.code.toLowerCase().includes(q)
      );
    });
  }, [parts, catFilter, pkgFilter, search]);

  const selectedPart = useMemo(
    () => parts.find((p) => p.slug === selectedSlug) ?? parts[0],
    [parts, selectedSlug],
  );

  const badgeTone =
    side === 'A'
      ? 'bg-sky-700 text-white'
      : 'bg-indigo-700 text-white';

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${badgeTone}`}>
            {side}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
            Part {side} ({filtered.length} shown)
          </span>
        </div>
        {selectedPart && (
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${lifecycleBadgeClass(selectedPart.lifecycle_status)}`}
          >
            {selectedPart.lifecycle_status}
          </span>
        )}
      </div>

      {/* Category & Package Filters */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="sr-only">Filter Part {side} by category</span>
          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value as PartCategory | 'ALL');
              setPkgFilter('ALL');
            }}
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-800 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          >
            <option value="ALL">All Categories ({parts.length})</option>
            <option value="ldo">LDO Regulators</option>
            <option value="dcdc">DC-DC Converters</option>
            <option value="opamp">Op-Amps / Comparators</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter Part {side} by package</span>
          <select
            value={pkgFilter}
            onChange={(e) => setPkgFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-800 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          >
            <option value="ALL">All Packages</option>
            {packages.map((pkg) => (
              <option key={pkg} value={pkg}>
                {pkg}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Search + Select */}
      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">Search Part {side} OPN or manufacturer</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter OPN, family, manufacturer…"
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </label>

        <label className="block">
          <span className="sr-only">Select Part {side}</span>
          <select
            value={filtered.some((p) => p.slug === selectedSlug) ? selectedSlug : ''}
            onChange={(e) => {
              if (e.target.value) onSelect(e.target.value);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer"
          >
            {!filtered.some((p) => p.slug === selectedSlug) && selectedPart && (
              <option value="">
                Current: {selectedPart.opn} ({selectedPart.package.code})
              </option>
            )}
            {filtered.map((p) => (
              <option key={p.slug} value={p.slug} disabled={p.slug === otherSlug}>
                {p.opn} · {p.package.code} · {categoryShortLabel(p.category)} ({p.manufacturer})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Selected Summary Strip */}
      {selectedPart && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <div className="min-w-0">
            <div className="font-mono font-bold text-slate-950 truncate">{selectedPart.opn}</div>
            <div className="text-[11px] text-slate-600">
              {selectedPart.manufacturer} · {selectedPart.package.code} ({selectedPart.package.pin_count}p)
              {selectedPart.package.exposed_pad.present
                ? ` · EP:${selectedPart.package.exposed_pad.net}`
                : ''}
            </div>
          </div>
          <Link
            href={`/en/part/${selectedPart.slug}`}
            className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline shrink-0"
          >
            Datasheet <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function CompareToolClient({ parts, vsSlugs }: CompareToolClientProps) {
  const searchParams = useSearchParams();
  const vsSlugSet = useMemo(() => new Set(vsSlugs), [vsSlugs]);
  const slugMap = useMemo(() => new Map(parts.map((p) => [p.slug, p])), [parts]);

  const curatedPresets = useMemo(
    () => CURATED_CANDIDATES.filter((c) => slugMap.has(c.slugA) && slugMap.has(c.slugB)),
    [slugMap],
  );

  const defaultA = curatedPresets[0]?.slugA ?? parts[0]?.slug ?? '';
  const defaultB = curatedPresets[0]?.slugB ?? parts[1]?.slug ?? parts[0]?.slug ?? '';

  const [slugA, setSlugA] = useState<string>(defaultA);
  const [slugB, setSlugB] = useState<string>(defaultB);
  const [highlightedPin, setHighlightedPin] = useState<number | null>(null);
  const [mirrored, setMirrored] = useState<boolean>(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thermal Delta mini-comparator state
  const [taStr, setTaStr] = useState<string>('40');
  const [vinStr, setVinStr] = useState<string>('5.0');
  const [ioutStr, setIoutStr] = useState<string>('250');
  const [pdManualStr, setPdManualStr] = useState<string>('400');

  // Hydrate from ?a=&b= search params
  useEffect(() => {
    const paramA = searchParams.get('a')?.trim().toLowerCase();
    const paramB = searchParams.get('b')?.trim().toLowerCase();
    if (paramA && slugMap.has(paramA)) {
      setSlugA(paramA);
    }
    if (paramB && slugMap.has(paramB) && paramB !== paramA) {
      setSlugB(paramB);
    }
  }, [searchParams, slugMap]);

  // Keep URL synced cleanly via replaceState
  const syncUrl = (nextA: string, nextB: string) => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    qs.set('a', nextA);
    qs.set('b', nextB);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}?${qs.toString()}`);
    } catch {
      // non-fatal
    }
  };

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const partA = slugMap.get(slugA) ?? parts[0];
  const partB = slugMap.get(slugB) ?? parts[1] ?? parts[0];

  const comparison = useMemo(() => {
    if (!partA || !partB) return null;
    return comparePartsClient(partA, partB);
  }, [partA, partB]);

  const handleSelectA = (next: string) => {
    setSlugA(next);
    syncUrl(next, slugB);
    trackEvent('compare_pair_change', { side: 'A', part_a: next, part_b: slugB });
  };

  const handleSelectB = (next: string) => {
    setSlugB(next);
    syncUrl(slugA, next);
    trackEvent('compare_pair_change', { side: 'B', part_a: slugA, part_b: next });
  };

  const handleSwap = () => {
    setSlugA(slugB);
    setSlugB(slugA);
    syncUrl(slugB, slugA);
    trackEvent('compare_pair_swap', { part_a: slugB, part_b: slugA });
  };

  const handleApplyPreset = (preset: CuratedPreset) => {
    setSlugA(preset.slugA);
    setSlugB(preset.slugB);
    syncUrl(preset.slugA, preset.slugB);
    trackEvent('compare_preset_click', { label: preset.label });
  };

  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?a=${encodeURIComponent(slugA)}&b=${encodeURIComponent(slugB)}`;
    const ok = await copyToClipboard(url);
    setCopyState(ok ? 'copied' : 'error');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyState('idle'), 2200);
    trackEvent('compare_share_link', { part_a: slugA, part_b: slugB, copied: ok });
  };

  // Thermal delta calculation
  const thermalDelta = useMemo(() => {
    if (!partA || !partB) return null;
    const ta = Number.isFinite(Number(taStr)) ? Number(taStr) : 40;
    const bothLdo = partA.category === 'ldo' && partB.category === 'ldo';

    let pdAMw = Math.max(0, Number.isFinite(Number(pdManualStr)) ? Number(pdManualStr) : 400);
    let pdBMw = pdAMw;
    if (bothLdo) {
      const vin = Math.max(0, Number.isFinite(Number(vinStr)) ? Number(vinStr) : 5.0);
      const iout = Math.max(0, Number.isFinite(Number(ioutStr)) ? Number(ioutStr) : 250);
      pdAMw =
        Math.max(0, vin - partA.specs.vout_v.value) * iout +
        vin * (partA.specs.iq_typ_ua.value / 1000);
      pdBMw =
        Math.max(0, vin - partB.specs.vout_v.value) * iout +
        vin * (partB.specs.iq_typ_ua.value / 1000);
    }

    const thetaA = partA.package.theta_ja_c_per_w.value;
    const thetaB = partB.package.theta_ja_c_per_w.value;
    const tjMaxA = partA.package.tj_max_c.value;
    const tjMaxB = partB.package.tj_max_c.value;

    const deltaTA = (pdAMw / 1000) * thetaA;
    const deltaTB = (pdBMw / 1000) * thetaB;
    const tjA = ta + deltaTA;
    const tjB = ta + deltaTB;
    const marginA = tjMaxA - tjA;
    const marginB = tjMaxB - tjB;
    const tjDiff = tjB - tjA;

    return {
      bothLdo,
      ta,
      pdAMw,
      pdBMw,
      thetaA,
      thetaB,
      tjMaxA,
      tjMaxB,
      deltaTA,
      deltaTB,
      tjA,
      tjB,
      marginA,
      marginB,
      tjDiff,
    };
  }, [partA, partB, taStr, vinStr, ioutStr, pdManualStr]);

  if (!partA || !partB || !comparison) {
    return (
      <div className="rounded-lg border border-slate-300 bg-white p-6 text-sm text-slate-700">
        No verified parts loaded for comparison.
      </div>
    );
  }

  const totalPairs = Math.floor((parts.length * (parts.length - 1)) / 2);
  const compatStyle = getCompatibilityStyle(comparison.compatibilityLevel);
  const hasStaticVs = vsSlugSet.has(comparison.canonicalVsSlug);

  return (
    <div className="space-y-6">
      {/* Curated Quick-Pick Presets */}
      <section aria-label="Curated engineering comparisons" className="rounded-lg border border-slate-300 bg-white p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
            High-Value Trap &amp; Substitution Presets ({totalPairs.toLocaleString('en-US')} possible pairs)
          </h2>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            {copyState === 'copied' ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            ) : (
              <Link2 className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
            )}
            {copyState === 'copied'
              ? 'Shareable Link Copied'
              : copyState === 'error'
                ? 'Copy Failed'
                : 'Copy Shareable Link'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {curatedPresets.map((preset) => {
            const active =
              (slugA === preset.slugA && slugB === preset.slugB) ||
              (slugA === preset.slugB && slugB === preset.slugA);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-500 hover:bg-white'
                }`}
              >
                <span className="font-mono font-semibold">{preset.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    active ? 'bg-slate-700 text-slate-100' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {preset.tag}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dual Part Selectors + Swap Button */}
      <section aria-label="Select two parts to compare" className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-center">
        <div className="lg:col-span-5">
          <PartSelectorCard
            side="A"
            parts={parts}
            selectedSlug={partA.slug}
            onSelect={handleSelectA}
            otherSlug={partB.slug}
          />
        </div>
        <div className="lg:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs hover:border-slate-500 hover:bg-slate-50 cursor-pointer"
            title="Swap Part A and Part B"
          >
            <ArrowLeftRight className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <span className="lg:hidden">Swap A ↔ B</span>
          </button>
        </div>
        <div className="lg:col-span-5">
          <PartSelectorCard
            side="B"
            parts={parts}
            selectedSlug={partB.slug}
            onSelect={handleSelectB}
            otherSlug={partA.slug}
          />
        </div>
      </section>

      {/* Compatibility Verdict Banner */}
      <section
        aria-label="Compatibility verdict"
        className={`rounded-lg border-2 p-4 sm:p-5 space-y-3 ${compatStyle.bannerBg} ${compatStyle.bannerBorder}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-0.5 font-mono text-xs font-bold ${compatStyle.badgeBg} ${compatStyle.badgeText} ${compatStyle.badgeBorder}`}
              >
                <span className={`h-2 w-2 rounded-full ${compatStyle.dotColor}`} aria-hidden="true" />
                {compatStyle.tierCode} · {compatStyle.shortLabel}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-700">
                Package: {comparison.packageMatch ? 'Exact Match' : comparison.footprintCompatible ? 'Shared Land Pattern (Height Differs)' : 'Mismatch'}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-700">
                Pinout: {comparison.pinoutExactMatch ? 'Role-Equivalent' : 'Differs / Caution'}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-700">
                EP/Tab: {comparison.epDiffStatus}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-950">
              {comparison.compatibilityBadge}
            </h2>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed max-w-4xl">
              {comparison.engineeringVerdict}
            </p>
          </div>

          {hasStaticVs && (
            <Link
              href={`/en/vs/${comparison.canonicalVsSlug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 shrink-0"
            >
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              Open Full Static Deep Audit →
            </Link>
          )}
        </div>
      </section>

      {/* Side-by-Side Interactive Pinout SVGs */}
      <section aria-label="Side-by-side pinout diagrams" className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              Side-by-Side Package Pinout &amp; Exposed Pad Diff
            </h2>
            <p className="text-xs text-slate-600">
              Hover or tap any pin to cross-highlight the corresponding physical pin on both packages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMirrored((m) => !m)}
            aria-pressed={mirrored}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
              mirrored
                ? 'border-sky-600 bg-sky-50 text-sky-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" aria-hidden="true" />
            {mirrored ? 'Bottom / PCB Mirror ON' : 'Mirror Both (Bottom View)'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-sky-900">Part A: {partA.opn}</span>
              <span className="text-slate-600">
                {partA.package.code} · {partA.package.mfg_package_code} · p.{partA.package.pinout_source_page}
              </span>
            </div>
            <PackagePinoutSvg
              opn={partA.opn}
              pkg={partA.package}
              diffHighlights={comparison.diffHighlightsA}
              epDiffStatus={comparison.epDiffStatus}
              highlightedPin={highlightedPin}
              onPinHover={setHighlightedPin}
              mirrored={mirrored}
              onMirroredChange={setMirrored}
              hideMirrorToggle
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-indigo-900">Part B: {partB.opn}</span>
              <span className="text-slate-600">
                {partB.package.code} · {partB.package.mfg_package_code} · p.{partB.package.pinout_source_page}
              </span>
            </div>
            <PackagePinoutSvg
              opn={partB.opn}
              pkg={partB.package}
              diffHighlights={comparison.diffHighlightsB}
              epDiffStatus={comparison.epDiffStatus}
              highlightedPin={highlightedPin}
              onPinHover={setHighlightedPin}
              mirrored={mirrored}
              onMirroredChange={setMirrored}
              hideMirrorToggle
            />
          </div>
        </div>
      </section>

      {/* Actionable Swap Risks & Gotchas */}
      <section aria-label="Actionable swap risks and gotchas" className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-700" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-950">
            Actionable Swap Risks &amp; Engineering Traps ({comparison.swapRisks.length})
          </h2>
        </div>
        <ul className="space-y-2">
          {comparison.swapRisks.map((risk, idx) => {
            const isCritical = risk.startsWith('CRITICAL');
            const isHigh = risk.startsWith('HIGH');
            const cls = isCritical
              ? 'border-rose-300 bg-rose-50 text-rose-950'
              : isHigh
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-slate-200 bg-slate-50 text-slate-800';
            return (
              <li key={idx} className={`rounded-md border px-3.5 py-2.5 text-xs leading-relaxed flex items-start gap-2.5 ${cls}`}>
                {isCritical ? (
                  <Flame className="h-4 w-4 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
                ) : isHigh ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" aria-hidden="true" />
                )}
                <span>{risk}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Pin-by-Pin + EP/TAB Diff Table */}
      <section aria-label="Pin-by-pin and exposed pad diff table" className="rounded-lg border border-slate-300 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-bold text-slate-950">
            Pin-by-Pin &amp; Exposed Pad / Thermal Tab Diff Table
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                <th scope="col" className="px-3 py-2.5 font-mono font-bold">Pin</th>
                <th scope="col" className="px-3 py-2.5 font-mono font-bold">Part A ({partA.opn})</th>
                <th scope="col" className="px-3 py-2.5 font-mono font-bold">Part B ({partB.opn})</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Status</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Engineering Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {comparison.pinDiff.map((row) => {
                const isHover = highlightedPin === row.pin;
                const pill =
                  row.status === 'MATCH'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : row.status === 'CAUTION'
                      ? 'border-amber-300 bg-amber-50 text-amber-950'
                      : 'border-rose-300 bg-rose-50 text-rose-950';
                return (
                  <tr
                    key={row.pin}
                    onMouseEnter={() => setHighlightedPin(row.pin)}
                    onMouseLeave={() => setHighlightedPin(null)}
                    className={isHover ? 'bg-sky-50/70' : 'hover:bg-slate-50'}
                  >
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-950">#{row.pin}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-900">
                      <span className="font-semibold">{row.part_a_name}</span>{' '}
                      <span className="text-slate-600">({row.part_a_role})</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-900">
                      <span className="font-semibold">{row.part_b_name}</span>{' '}
                      <span className="text-slate-600">({row.part_b_role})</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${pill}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 leading-relaxed">{row.note}</td>
                  </tr>
                );
              })}
              {/* Explicit EP/TAB row */}
              <tr className="bg-slate-50/90 font-medium">
                <td className="px-3 py-2.5 font-mono font-bold text-slate-950">EP / TAB</td>
                <td className="px-3 py-2.5 font-mono text-slate-900">
                  {partA.package.exposed_pad.present ? partA.package.exposed_pad.net : 'NONE'}
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-900">
                  {partB.package.exposed_pad.present ? partB.package.exposed_pad.net : 'NONE'}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${
                      comparison.epDiffStatus === 'MATCH'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : comparison.epDiffStatus === 'CAUTION'
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : 'border-rose-300 bg-rose-50 text-rose-950'
                    }`}
                  >
                    {comparison.epDiffStatus}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-700 leading-relaxed">{comparison.epNote}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Electrical Parameter Comparison Matrix */}
      <section aria-label="Electrical parameter comparison matrix" className="rounded-lg border border-slate-300 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-bold text-slate-950">
            Side-by-Side Electrical &amp; Thermal Parameter Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                <th scope="col" className="px-3 py-2.5 font-bold">Parameter</th>
                <th scope="col" className="px-3 py-2.5 font-mono font-bold">Part A ({partA.opn})</th>
                <th scope="col" className="px-3 py-2.5 font-mono font-bold">Part B ({partB.opn})</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Edge</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Design Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {comparison.parameterRows.map((row) => (
                <tr key={row.metric} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {row.metric}{' '}
                    <span className="font-mono text-[11px] font-normal text-slate-600">[{row.unit}]</span>
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono tabular-nums ${
                      row.winner === 'A' ? 'font-bold text-emerald-900 bg-emerald-50/50' : 'text-slate-900'
                    }`}
                  >
                    {row.part_a_value}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono tabular-nums ${
                      row.winner === 'B' ? 'font-bold text-emerald-900 bg-emerald-50/50' : 'text-slate-900'
                    }`}
                  >
                    {row.part_b_value}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-700">
                    {row.winner === 'A'
                      ? 'Part A'
                      : row.winner === 'B'
                        ? 'Part B'
                        : row.winner === 'TIE'
                          ? 'Tie'
                          : 'Context'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Thermal Delta Mini-Comparator */}
      {thermalDelta && (
        <section aria-label="Live thermal delta comparison" className="rounded-lg border border-slate-300 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-bold">
                Live Dual-Part Thermal Delta Simulator (Tj = Ta + Pd × θJA)
              </h2>
            </div>
            <Link
              href="/en/tools/ldo-thermal-calculator"
              className="text-xs font-semibold text-emerald-300 hover:underline"
            >
              Open Full Thermal Derating Calculator →
            </Link>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {thermalDelta.bothLdo ? (
                <>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-slate-700 mb-1">Input Voltage Vin (V)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={vinStr}
                      onChange={(e) => setVinStr(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-slate-700 mb-1">Load Current Iout (mA)</span>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      value={ioutStr}
                      onChange={(e) => setIoutStr(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
                    />
                  </label>
                </>
              ) : (
                <label className="block col-span-2">
                  <span className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Estimated Package Dissipation Pd (mW)
                  </span>
                  <input
                    type="number"
                    step="25"
                    min="0"
                    value={pdManualStr}
                    onChange={(e) => setPdManualStr(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
                  />
                </label>
              )}
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">Ambient Temp Ta (°C)</span>
                <input
                  type="number"
                  step="5"
                  value={taStr}
                  onChange={(e) => setTaStr(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900"
                />
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col justify-center">
                <span className="text-[11px] font-semibold text-slate-600">ΔTj (Part B − Part A)</span>
                <span
                  className={`font-mono text-base font-bold tabular-nums ${
                    Math.abs(thermalDelta.tjDiff) < 1
                      ? 'text-slate-900'
                      : thermalDelta.tjDiff < 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {thermalDelta.tjDiff >= 0 ? '+' : ''}
                  {thermalDelta.tjDiff.toFixed(1)} °C
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  label: `Part A · ${partA.opn}`,
                  pkg: partA.package.code,
                  pd: thermalDelta.pdAMw,
                  theta: thermalDelta.thetaA,
                  dt: thermalDelta.deltaTA,
                  tj: thermalDelta.tjA,
                  tjMax: thermalDelta.tjMaxA,
                  margin: thermalDelta.marginA,
                },
                {
                  label: `Part B · ${partB.opn}`,
                  pkg: partB.package.code,
                  pd: thermalDelta.pdBMw,
                  theta: thermalDelta.thetaB,
                  dt: thermalDelta.deltaTB,
                  tj: thermalDelta.tjB,
                  tjMax: thermalDelta.tjMaxB,
                  margin: thermalDelta.marginB,
                },
              ].map((card) => {
                const danger = card.margin < 0;
                const caution = !danger && card.margin < 15;
                return (
                  <div
                    key={card.label}
                    className={`rounded-md border p-3.5 space-y-1.5 ${
                      danger
                        ? 'border-rose-300 bg-rose-50/70'
                        : caution
                          ? 'border-amber-300 bg-amber-50/70'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-950">{card.label}</span>
                      <span className="text-slate-600">{card.pkg} · θJA {fmtNum(card.theta, 1)} °C/W</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-xs tabular-nums">
                      <div>
                        <div className="text-[11px] text-slate-600">Pd</div>
                        <div className="font-bold text-slate-950">{card.pd.toFixed(0)} mW</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-600">ΔT</div>
                        <div className="font-bold text-slate-950">+{card.dt.toFixed(1)} °C</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-600">Est. Tj</div>
                        <div className="font-bold text-slate-950">{card.tj.toFixed(1)} °C</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-600">Margin</div>
                        <div
                          className={`font-bold ${
                            danger ? 'text-rose-700' : caution ? 'text-amber-800' : 'text-emerald-700'
                          }`}
                        >
                          {card.margin.toFixed(1)} °C
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
