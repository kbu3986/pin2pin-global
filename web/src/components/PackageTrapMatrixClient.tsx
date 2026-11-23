'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PackageCode, PartCategory, PartRecord } from '@/types/schema';
import { trackEvent } from '@/lib/analytics';
import { categoryShortLabel } from '@/lib/format';
import { PackagePinoutSvg, type DiffStatus, type EpDiffStatus } from '@/components/PackagePinoutSvg';
import { computeEpStatus, computePinDiff, normalizeEpNet, pinoutSignature } from '@/components/CompareWorkbenchClient';

export interface PackageTrapMatrixProps {
  parts: PartRecord[];
}

interface PinoutCluster {
  id: string;
  signature: string;
  epNet: string;
  representative: PartRecord;
  parts: PartRecord[];
  categories: PartCategory[];
  compactPinSummary: string;
}

interface PackageGroup {
  code: PackageCode;
  pinCount: number;
  parts: PartRecord[];
  clusters: PinoutCluster[];
  hasPinoutConflict: boolean;
  hasEpConflict: boolean;
  distinctEpNets: string[];
  categories: PartCategory[];
}

function buildCompactPinSummary(part: PartRecord): string {
  return [...part.package.pinout]
    .sort((a, b) => a.pin - b.pin)
    .map((p) => `${p.pin}:${p.role}`)
    .join(' · ');
}

function groupPackages(parts: PartRecord[]): PackageGroup[] {
  const byPkg = new Map<PackageCode, PartRecord[]>();
  for (const part of parts) {
    const arr = byPkg.get(part.package.code) ?? [];
    arr.push(part);
    byPkg.set(part.package.code, arr);
  }

  const groups: PackageGroup[] = [];
  for (const [code, pkgParts] of byPkg.entries()) {
    const bySig = new Map<string, PartRecord[]>();
    for (const p of pkgParts) {
      const sig = pinoutSignature(p.package);
      const list = bySig.get(sig) ?? [];
      list.push(p);
      bySig.set(sig, list);
    }

    const clusters: PinoutCluster[] = [...bySig.entries()]
      .map(([sig, clusterParts], idx) => {
        const sorted = [...clusterParts].sort((a, b) => a.opn.localeCompare(b.opn));
        const rep = sorted[0];
        const cats = Array.from(new Set(sorted.map((p) => p.category)));
        return {
          id: `${code}-c${idx + 1}`,
          signature: sig,
          epNet: normalizeEpNet(rep.package),
          representative: rep,
          parts: sorted,
          categories: cats,
          compactPinSummary: buildCompactPinSummary(rep),
        };
      })
      .sort((a, b) => b.parts.length - a.parts.length || a.representative.opn.localeCompare(b.representative.opn));

    const distinctEpNets = Array.from(new Set(clusters.map((c) => c.epNet)));
    const hasEpConflict =
      distinctEpNets.length > 1 &&
      distinctEpNets.some((n) => n === 'VOUT' || n === 'VIN' || n === 'SW');

    groups.push({
      code,
      pinCount: pkgParts[0]?.package.pin_count ?? 0,
      parts: pkgParts,
      clusters,
      hasPinoutConflict: clusters.length > 1,
      hasEpConflict,
      distinctEpNets,
      categories: Array.from(new Set(pkgParts.map((p) => p.category))),
    });
  }

  return groups.sort(
    (a, b) =>
      b.clusters.length - a.clusters.length ||
      Number(b.hasEpConflict) - Number(a.hasEpConflict) ||
      b.parts.length - a.parts.length ||
      a.code.localeCompare(b.code),
  );
}

export function PackageTrapMatrixClient({ parts }: PackageTrapMatrixProps) {
  const allGroups = useMemo(() => groupPackages(parts), [parts]);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<PackageCode | null>(() => {
    const firstConflict = allGroups.find((g) => g.hasPinoutConflict);
    return firstConflict?.code ?? allGroups[0]?.code ?? null;
  });
  const [baselineClusterIdx, setBaselineClusterIdx] = useState(0);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allGroups.filter((g) => {
      if (conflictsOnly && !g.hasPinoutConflict) return false;
      if (categoryFilter !== 'all' && !g.categories.includes(categoryFilter)) return false;
      if (q) {
        const inCode = g.code.toLowerCase().includes(q);
        const inPart = g.parts.some(
          (p) =>
            p.opn.toLowerCase().includes(q) ||
            p.family.toLowerCase().includes(q) ||
            p.manufacturer.toLowerCase().includes(q),
        );
        if (!inCode && !inPart) return false;
      }
      return true;
    });
  }, [allGroups, conflictsOnly, categoryFilter, search]);

  const activeGroup = useMemo(() => {
    if (selectedCode) {
      const match = filteredGroups.find((g) => g.code === selectedCode);
      if (match) return match;
    }
    return filteredGroups[0] ?? null;
  }, [filteredGroups, selectedCode]);

  const conflictPkgCount = useMemo(
    () => allGroups.filter((g) => g.hasPinoutConflict).length,
    [allGroups],
  );
  const epTrapPkgCount = useMemo(
    () => allGroups.filter((g) => g.hasEpConflict).length,
    [allGroups],
  );
  const totalDistinctPinouts = useMemo(
    () => allGroups.reduce((acc, g) => acc + g.clusters.length, 0),
    [allGroups],
  );

  const safeBaselineIdx = activeGroup
    ? Math.min(baselineClusterIdx, Math.max(0, activeGroup.clusters.length - 1))
    : 0;
  const baselineCluster = activeGroup?.clusters[safeBaselineIdx] ?? null;

  const selectPackage = (code: PackageCode) => {
    setSelectedCode(code);
    setBaselineClusterIdx(0);
    trackEvent('package_trap_select', { package_code: code });
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-300 bg-white p-3.5">
          <div className="font-mono text-[11px] font-bold uppercase text-slate-500">Tracked Packages</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-950">{allGroups.length}</div>
          <div className="text-[11px] text-slate-500">{parts.length} verified OPNs</div>
        </div>
        <div className="rounded-lg border border-rose-300 bg-rose-50/70 p-3.5">
          <div className="font-mono text-[11px] font-bold uppercase text-rose-800">Multi-Pinout Trap Packages</div>
          <div className="mt-1 font-mono text-2xl font-bold text-rose-900">{conflictPkgCount}</div>
          <div className="text-[11px] text-rose-800">Same outline, ≥2 conflicting pinouts</div>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3.5">
          <div className="font-mono text-[11px] font-bold uppercase text-amber-900">Live-Power Tab / EP Traps</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-950">{epTrapPkgCount}</div>
          <div className="text-[11px] text-amber-900">e.g. VOUT tab vs GND tab</div>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-3.5">
          <div className="font-mono text-[11px] font-bold uppercase text-slate-500">Distinct Pinout Signatures</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-950">{totalDistinctPinouts}</div>
          <div className="text-[11px] text-slate-500">Across {allGroups.length} JEDEC footprints</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter package or OPN (e.g. SOT-23-5, AMS1117)…"
            className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs font-semibold">
            {(['all', 'ldo', 'dcdc', 'opamp'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1.5 ${
                  categoryFilter === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                } ${cat !== 'all' ? 'border-l border-slate-300' : ''}`}
              >
                {cat === 'all' ? 'All' : categoryShortLabel(cat)}
              </button>
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-900">
            <input
              type="checkbox"
              checked={conflictsOnly}
              onChange={(e) => setConflictsOnly(e.target.checked)}
              className="accent-rose-600"
            />
            Conflicting Packages Only ({conflictPkgCount})
          </label>
        </div>
        <span className="font-mono text-xs text-slate-500">
          Showing {filteredGroups.length} of {allGroups.length} packages
        </span>
      </div>

      {/* Package Matrix Grid */}
      <section aria-label="Package pinout conflict matrix" className="space-y-2.5">
        <h2 className="text-base font-bold text-slate-950">Select a Package Footprint to Inspect Pinout Clusters</h2>
        {filteredGroups.length === 0 ? (
          <div className="rounded-lg border border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            No packages match your current filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((g) => {
              const isSelected = activeGroup?.code === g.code;
              return (
                <button
                  key={g.code}
                  type="button"
                  onClick={() => selectPackage(g.code)}
                  className={`flex flex-col justify-between rounded-lg border-2 p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50/70 shadow-sm'
                      : g.hasPinoutConflict
                        ? 'border-rose-200 bg-white hover:border-rose-400'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-slate-950">{g.code}</div>
                      <div className="text-[11px] text-slate-500">
                        {g.pinCount}-pin · {g.parts.length} OPN{g.parts.length === 1 ? '' : 's'} ·{' '}
                        {g.categories.map(categoryShortLabel).join(' / ')}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        g.clusters.length >= 3
                          ? 'bg-rose-600 text-white'
                          : g.clusters.length === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {g.clusters.length} {g.clusters.length === 1 ? 'pinout' : 'pinouts'}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {g.hasEpConflict && (
                      <span className="rounded border border-rose-300 bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-900">
                        TAB/EP TRAP: {g.distinctEpNets.join(' vs ')}
                      </span>
                    )}
                    {!g.hasEpConflict && g.distinctEpNets.some((n) => n !== 'NONE') && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        EP/Tab: {g.distinctEpNets.join(', ')}
                      </span>
                    )}
                    {g.hasPinoutConflict && !g.hasEpConflict && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-900">
                        Non-interchangeable clusters
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Package Cluster Inspector */}
      {activeGroup && baselineCluster && (
        <section aria-label={`${activeGroup.code} pinout clusters`} className="space-y-4 rounded-xl border-2 border-slate-300 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-xl font-bold text-slate-950">{activeGroup.code}</h3>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                    activeGroup.hasPinoutConflict ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {activeGroup.clusters.length} Distinct Pinout{activeGroup.clusters.length === 1 ? '' : 's'}
                </span>
                {activeGroup.hasEpConflict && (
                  <span className="rounded bg-amber-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                    EP/TAB NET CONFLICT ({activeGroup.distinctEpNets.join(' vs ')})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {activeGroup.hasPinoutConflict
                  ? `Parts in different clusters below share the physical ${activeGroup.code} footprint but assign incompatible pin or thermal-tab nets. Red diff badges compare each cluster against Baseline Cluster #${safeBaselineIdx + 1} (${baselineCluster.representative.opn}).`
                  : `All ${activeGroup.parts.length} tracked OPNs in ${activeGroup.code} currently share one normalized pinout signature. Still verify electrical ratings, ESR stability, and datasheet revisions before substitution.`}
              </p>
            </div>
            {activeGroup.clusters.length > 1 && (
              <label className="print:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                Diff baseline:
                <select
                  value={safeBaselineIdx}
                  onChange={(e) => setBaselineClusterIdx(Number(e.target.value))}
                  className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                >
                  {activeGroup.clusters.map((c, idx) => (
                    <option key={c.id} value={idx}>
                      Cluster #{idx + 1} ({c.representative.opn})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeGroup.clusters.map((cluster, idx) => {
              const isBaseline = idx === safeBaselineIdx;
              let diffHighlights: Record<number, DiffStatus> | null = null;
              let epDiffStatus: EpDiffStatus | undefined = undefined;
              let mismatchCount = 0;

              if (activeGroup.clusters.length > 1 && !isBaseline) {
                const pinRows = computePinDiff(baselineCluster.representative.package, cluster.representative.package);
                diffHighlights = {};
                for (const row of pinRows) {
                  diffHighlights[row.pin] = row.status;
                  if (row.status === 'MISMATCH') mismatchCount++;
                }
                const ep = computeEpStatus(baselineCluster.representative.package, cluster.representative.package);
                epDiffStatus = ep.status;
              }

              const comparePeer = isBaseline
                ? activeGroup.clusters[idx === 0 ? 1 : 0]?.representative ?? cluster.parts[1] ?? null
                : baselineCluster.representative;

              return (
                <div
                  key={cluster.id}
                  className={`flex flex-col justify-between space-y-3 rounded-lg border-2 bg-white p-4 ${
                    isBaseline && activeGroup.clusters.length > 1
                      ? 'border-sky-500'
                      : mismatchCount > 0 || epDiffStatus === 'MISMATCH'
                        ? 'border-rose-300'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                          Cluster #{idx + 1}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-600">
                          {cluster.parts.length} part{cluster.parts.length === 1 ? '' : 's'}
                        </span>
                        {isBaseline && activeGroup.clusters.length > 1 && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-900">
                            DIFF BASELINE
                          </span>
                        )}
                        {!isBaseline && mismatchCount > 0 && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-900">
                            {mismatchCount} PIN CONFLICT{mismatchCount > 1 ? 'S' : ''} vs #{safeBaselineIdx + 1}
                          </span>
                        )}
                        {!isBaseline && epDiffStatus === 'MISMATCH' && (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                            TAB/EP CONFLICT
                          </span>
                        )}
                      </div>
                      {comparePeer && (
                        <Link
                          href={`/en/compare/?a=${encodeURIComponent(baselineCluster.representative.slug)}&b=${encodeURIComponent(
                            isBaseline ? comparePeer.slug : cluster.representative.slug,
                          )}`}
                          onClick={() =>
                            trackEvent('package_trap_compare_click', {
                              package_code: activeGroup.code,
                              a: baselineCluster.representative.slug,
                              b: isBaseline ? comparePeer.slug : cluster.representative.slug,
                            })
                          }
                          className="print:hidden rounded-md bg-sky-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-800"
                        >
                          Compare Pinouts →
                        </Link>
                      )}
                    </div>

                    <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                      {cluster.compactPinSummary}
                      {cluster.epNet !== 'NONE' && (
                        <span className="ml-2 font-bold text-amber-800">· EP/TAB: {cluster.epNet}</span>
                      )}
                    </div>

                    <PackagePinoutSvg
                      opn={cluster.representative.opn}
                      pkg={cluster.representative.package}
                      diffHighlights={diffHighlights}
                      epDiffStatus={epDiffStatus}
                      compact
                    />
                  </div>

                  {/* Parts in this cluster */}
                  <div className="space-y-1.5 border-t border-slate-200 pt-3">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      OPNs with this exact pinout ({cluster.parts.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.parts.map((p) => (
                        <div
                          key={p.slug}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                        >
                          <Link
                            href={`/en/part/${p.slug}/`}
                            className="font-mono font-semibold text-sky-800 hover:underline"
                          >
                            {p.opn}
                          </Link>
                          <span className="text-[10px] text-slate-500">
                            ({categoryShortLabel(p.category)} · {p.manufacturer.split(' ')[0]})
                          </span>
                          {!isBaseline && (
                            <Link
                              href={`/en/compare/?a=${encodeURIComponent(baselineCluster.representative.slug)}&b=${encodeURIComponent(p.slug)}`}
                              title={`Compare ${baselineCluster.representative.opn} vs ${p.opn}`}
                              className="print:hidden ml-0.5 rounded bg-white px-1 py-0.5 font-mono text-[10px] font-bold text-slate-600 ring-1 ring-slate-300 hover:bg-sky-50 hover:text-sky-800"
                            >
                              vs #{safeBaselineIdx + 1}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default PackageTrapMatrixClient;
