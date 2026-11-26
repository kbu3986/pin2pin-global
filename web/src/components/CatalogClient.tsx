'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { CatalogPartRow, PartCategory } from '@/types/schema';
import {
  buildCompareHref,
  fmtIqUa,
  fmtNum,
  lifecycleBadgeClass,
  normalizeSearchText,
} from '@/lib/format';
import { trackCatalogFilter, trackCompareLaunch } from '@/lib/analytics';

type SortKey = 'opn' | 'package_code' | 'vin_or_vs_max_v' | 'current_ma' | 'iq_ua' | 'theta_ja';

export function CatalogClient({ rows }: { rows: CatalogPartRow[] }) {
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<'all' | PartCategory>('all');
  const [pkgFilter, setPkgFilter] = useState<string>('all');
  const [mfgFilter, setMfgFilter] = useState<string>('all');
  const [ceramicOnly, setCeramicOnly] = useState<boolean>(false);
  const [maxIqStr, setMaxIqStr] = useState<string>('');
  const [minCurrentStr, setMinCurrentStr] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('opn');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [hydratedUrl, setHydratedUrl] = useState<boolean>(false);

  // Hydrate filters from URL query (?category=, ?package=, ?q=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat === 'ldo' || cat === 'dcdc' || cat === 'opamp') {
      setCategory(cat);
    }
    const pkg = params.get('package');
    if (pkg) {
      setPkgFilter(pkg);
    }
    const q = params.get('q');
    if (q) {
      setSearch(q);
    }
    setHydratedUrl(true);
  }, []);

  // Keep URL cleanly synchronized with ?category=, ?package=, ?q=
  useEffect(() => {
    if (!hydratedUrl) return;
    const url = new URL(window.location.href);
    if (category !== 'all') url.searchParams.set('category', category);
    else url.searchParams.delete('category');
    if (pkgFilter !== 'all') url.searchParams.set('package', pkgFilter);
    else url.searchParams.delete('package');
    if (search.trim()) url.searchParams.set('q', search.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [category, pkgFilter, search, hydratedUrl]);

  const handleCategoryChange = (next: 'all' | PartCategory) => {
    setCategory(next);
    if (next === 'dcdc' || next === 'opamp') {
      setCeramicOnly(false);
    }
    trackCatalogFilter('category', next);
  };

  const packageOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.package_code))).sort(),
    [rows],
  );

  const manufacturerOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.manufacturer))).sort(),
    [rows],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleCompare = (slug: string) => {
    setCompareSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 2) return [prev[1], slug];
      return [...prev, slug];
    });
  };

  const resetFilters = () => {
    setSearch('');
    setCategory('all');
    setPkgFilter('all');
    setMfgFilter('all');
    setCeramicOnly(false);
    setMaxIqStr('');
    setMinCurrentStr('');
    setSortKey('opn');
    setSortDir('asc');
  };

  const filtered = useMemo(() => {
    const tokens = search
      .trim()
      .split(/\s+/)
      .map((t) => normalizeSearchText(t))
      .filter(Boolean);
    const maxIq = maxIqStr.trim() !== '' && Number.isFinite(Number(maxIqStr)) ? Number(maxIqStr) : null;
    const minCurrent =
      minCurrentStr.trim() !== '' && Number.isFinite(Number(minCurrentStr))
        ? Number(minCurrentStr)
        : null;

    const list = rows.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (pkgFilter !== 'all' && r.package_code !== pkgFilter) return false;
      if (mfgFilter !== 'all' && r.manufacturer !== mfgFilter) return false;
      if (ceramicOnly && r.ceramic_cap_stable !== true) return false;
      if (maxIq !== null && r.iq_ua > maxIq) return false;
      if (minCurrent !== null && (r.current_ma === null || r.current_ma < minCurrent)) return false;
      if (tokens.length > 0) {
        const hay = normalizeSearchText(
          `${r.opn} ${r.family} ${r.manufacturer} ${r.package_code} ${r.mfg_package_code} ${r.highlight_metric} ${r.sub_topology}`,
        );
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortKey === 'opn' || sortKey === 'package_code') {
        const cmp = a[sortKey].localeCompare(b[sortKey]);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      // Always push null / undefined values to the bottom regardless of asc/desc.
      if (av === null && bv === null) return a.opn.localeCompare(b.opn);
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [
    rows,
    search,
    category,
    pkgFilter,
    mfgFilter,
    ceramicOnly,
    maxIqStr,
    minCurrentStr,
    sortKey,
    sortDir,
  ]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      ldo: rows.filter((r) => r.category === 'ldo').length,
      dcdc: rows.filter((r) => r.category === 'dcdc').length,
      opamp: rows.filter((r) => r.category === 'opamp').length,
    }),
    [rows],
  );

  const selectedParts = useMemo(
    () =>
      compareSlugs
        .map((s) => rows.find((r) => r.slug === s))
        .filter((r): r is CatalogPartRow => Boolean(r)),
    [compareSlugs, rows],
  );

  const ceramicDisabled = category === 'dcdc' || category === 'opamp';

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden="true" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-[#dafa9c]" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#dafa9c]" aria-hidden="true" />
    );
  };

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className={`space-y-4 ${selectedParts.length > 0 ? 'pb-20' : ''}`}>
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Component category">
          {(
            [
              ['all', `All Parts (${counts.all})`],
              ['ldo', `LDO Regulators (${counts.ldo})`],
              ['dcdc', `DC-DC Converters (${counts.dcdc})`],
              ['opamp', `Op-Amps & Comparators (${counts.opamp})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              onClick={() => handleCategoryChange(key)}
              className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                category === key
                  ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                  : 'border-[#dfdfd9] bg-white text-[#40403c] hover:border-[#0f0f0f] hover:text-[#0f0f0f]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#dfdfd9] bg-white px-3 py-1.5 text-xs font-medium text-[#40403c] hover:border-[#0f0f0f] hover:text-[#0f0f0f] transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset Filters
        </button>
      </div>

      {/* Filter Panel */}
      <div className="rounded-[6px] border border-[#dfdfd9] bg-white p-4">
        <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[#5f5f5f] mb-3">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#0f0f0f]" aria-hidden="true" />
          Parametric Workbench Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <label className="block lg:col-span-2">
            <span className="block text-[11px] font-medium text-[#5f5f5f] mb-1">
              Search OPN / Family / Mfg Code
            </span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5f5f5f]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="OPN, DBVR, SOT235, TI..."
                className="w-full rounded-[4px] border border-[#d6d6ce] bg-white pl-8 pr-3 py-1.5 font-mono text-xs text-[#0f0f0f] placeholder:text-[#8f8f8f] focus:border-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#0f0f0f]"
              />
            </div>
          </label>

          <label className="block">
            <span className="block text-[11px] font-medium text-[#5f5f5f] mb-1">Package</span>
            <select
              value={pkgFilter}
              onChange={(e) => {
                setPkgFilter(e.target.value);
                trackCatalogFilter('package', e.target.value);
              }}
              className="w-full rounded-[4px] border border-[#d6d6ce] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0f0f0f] focus:border-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#0f0f0f]"
            >
              <option value="all">All Packages</option>
              {packageOptions.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] font-medium text-[#5f5f5f] mb-1">Manufacturer</span>
            <select
              value={mfgFilter}
              onChange={(e) => {
                setMfgFilter(e.target.value);
                trackCatalogFilter('manufacturer', e.target.value);
              }}
              className="w-full rounded-[4px] border border-[#d6d6ce] bg-white px-2.5 py-1.5 text-xs text-[#0f0f0f] focus:border-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#0f0f0f]"
            >
              <option value="all">All Manufacturers</option>
              {manufacturerOptions.map((mfg) => (
                <option key={mfg} value={mfg}>
                  {mfg}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] font-medium text-[#5f5f5f] mb-1">Max Iq (µA)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={maxIqStr}
              onChange={(e) => setMaxIqStr(e.target.value)}
              placeholder="e.g. 50"
              className="w-full rounded-[4px] border border-[#d6d6ce] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#0f0f0f] placeholder:text-[#8f8f8f] focus:border-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#0f0f0f]"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-medium text-[#5f5f5f] mb-1">
              Min Current (mA)
            </span>
            <input
              type="number"
              min="0"
              step="50"
              value={minCurrentStr}
              onChange={(e) => setMinCurrentStr(e.target.value)}
              placeholder="e.g. 300"
              className="w-full rounded-[4px] border border-[#d6d6ce] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#0f0f0f] placeholder:text-[#8f8f8f] focus:border-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#0f0f0f]"
            />
          </label>
        </div>

        <div className="mt-3 pt-3 border-t border-[#ecece6] flex flex-wrap items-center justify-between gap-2 text-xs">
          <label
            className={`inline-flex items-center gap-2 font-medium ${
              ceramicDisabled ? 'text-[#8f8f8f] cursor-not-allowed' : 'text-[#2a2a28] cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={ceramicOnly}
              disabled={ceramicDisabled}
              onChange={(e) => setCeramicOnly(e.target.checked)}
              className="rounded-[3px] border-[#c8c8bf] accent-[#0f0f0f] disabled:opacity-50"
            />
            Ceramic-Cap (MLCC) Stable LDOs Only
            {ceramicDisabled && (
              <span className="text-[11px] font-mono text-[#8f8f8f]">(LDOs only)</span>
            )}
          </label>
          <span className="font-mono text-[#5f5f5f]">
            Matched: <strong className="text-[#0f0f0f]">{filtered.length}</strong> / {rows.length}{' '}
            OPNs · Check any 2 rows to live-compare
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-[6px] border border-[#dfdfd9] bg-white overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e2e2dc] text-xs">
          <thead className="bg-[#0f0f0f] text-white font-mono text-[11px] uppercase tracking-wide">
            <tr>
              <th
                className="sticky left-0 z-20 bg-[#0f0f0f] px-2.5 py-2.5 text-left border-r border-white/12"
                aria-sort={ariaSort('opn')}
              >
                <div className="flex items-center gap-2">
                  <span className="sr-only">Compare</span>
                  <button
                    type="button"
                    onClick={() => toggleSort('opn')}
                    className="inline-flex items-center gap-1 hover:text-[#dafa9c] cursor-pointer transition-colors"
                  >
                    OPN / Family
                    {sortIcon('opn')}
                  </button>
                </div>
              </th>
              <th className="px-2 py-2.5 text-left">Mfg</th>
              <th className="px-2 py-2.5 text-left" aria-sort={ariaSort('package_code')}>
                <button
                  type="button"
                  onClick={() => toggleSort('package_code')}
                  className="inline-flex items-center gap-1 hover:text-[#dafa9c] cursor-pointer transition-colors"
                >
                  Package
                  {sortIcon('package_code')}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right" aria-sort={ariaSort('vin_or_vs_max_v')}>
                <button
                  type="button"
                  onClick={() => toggleSort('vin_or_vs_max_v')}
                  className="inline-flex items-center gap-1 hover:text-[#dafa9c] cursor-pointer transition-colors"
                >
                  Supply
                  {sortIcon('vin_or_vs_max_v')}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right" aria-sort={ariaSort('current_ma')}>
                <button
                  type="button"
                  onClick={() => toggleSort('current_ma')}
                  className="inline-flex items-center gap-1 hover:text-[#dafa9c] cursor-pointer transition-colors"
                >
                  Current
                  {sortIcon('current_ma')}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right" aria-sort={ariaSort('iq_ua')}>
                <button
                  type="button"
                  onClick={() => toggleSort('iq_ua')}
                  className="inline-flex items-center gap-1 hover:text-[#dafa9c] cursor-pointer transition-colors"
                >
                  Iq
                  {sortIcon('iq_ua')}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right" aria-sort={ariaSort('theta_ja')}>
                <button
                  type="button"
                  onClick={() => toggleSort('theta_ja')}
                  className="inline-flex items-center gap-1 hover:text-[#dafa9c] cursor-pointer transition-colors"
                >
                  θJA
                  {sortIcon('theta_ja')}
                </button>
              </th>
              <th className="px-2 py-2.5 text-left">Key Spec / MLCC</th>
              <th className="px-2.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ecece6] bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#5f5f5f]">
                  No OPNs match the current parametric filter criteria. Try relaxing Max Iq or
                  Package constraints.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isSelected = compareSlugs.includes(r.slug);
                const life = (r as CatalogPartRow & { lifecycle?: string }).lifecycle;
                return (
                  <tr
                    key={r.slug}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#f4f8e8]' : 'hover:bg-[#f7f7f5]'
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-10 px-2.5 py-2 whitespace-nowrap border-r border-[#ecece6] ${
                        isSelected ? 'bg-[#f4f8e8]' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompare(r.slug)}
                          aria-label={`Select ${r.opn} for comparison`}
                          className="mt-1 h-3.5 w-3.5 rounded-[3px] border-[#b8b8ae] accent-[#0f0f0f] cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/en/part/${r.slug}/`}
                              className="font-mono font-semibold text-[#0f0f0f] hover:underline underline-offset-2"
                            >
                              {r.opn}
                            </Link>
                            {life && life !== 'Active' && (
                              <span
                                className={`rounded-[4px] border px-1 py-0.5 font-mono text-[11px] font-medium uppercase leading-none ${lifecycleBadgeClass(life)}`}
                              >
                                {life}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#5f5f5f]">
                            {r.family} · <span className="uppercase font-mono">{r.category}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-2 py-2 text-[#40403c] max-w-[136px] truncate"
                      title={r.manufacturer}
                    >
                      {r.manufacturer}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-[4px] border border-[#e2e2dc] bg-[#f7f7f5] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#0f0f0f]">
                        {r.package_code}
                      </span>
                      {r.exposed_pad_net !== 'NONE' && (
                        <span className="ml-1 rounded-[4px] bg-amber-100 px-1 py-0.5 font-mono text-[11px] font-medium text-amber-950">
                          EP:
                          {r.exposed_pad_net === 'THERMAL_GND_RECOMMENDED'
                            ? 'GND'
                            : r.exposed_pad_net}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-[#0f0f0f] whitespace-nowrap">
                      {fmtNum(r.vin_or_vs_min_v, 1)}–{fmtNum(r.vin_or_vs_max_v, 1)} V
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-[#0f0f0f] whitespace-nowrap">
                      {r.current_label}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-[#0f0f0f] whitespace-nowrap">
                      {fmtIqUa(r.iq_ua)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-[#40403c] whitespace-nowrap">
                      {fmtNum(r.theta_ja, 0)} °C/W
                    </td>
                    <td className="px-2 py-2 text-[#40403c] whitespace-nowrap">
                      <span className="font-mono text-[11px]">{r.highlight_metric}</span>
                      {r.ceramic_cap_stable !== null && (
                        <span
                          className={`ml-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${
                            r.ceramic_cap_stable
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {r.ceramic_cap_stable ? 'MLCC OK' : 'ESR Req'}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/en/part/${r.slug}/`}
                          className="rounded-[4px] border border-[#0f0f0f] bg-[#0f0f0f] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#2a2a2a] transition-colors"
                        >
                          Pinout
                        </Link>
                        {r.has_alt_page && (
                          <Link
                            href={`/en/alt/${r.slug}-alternatives/`}
                            className="rounded-[4px] border border-[#d6d6ce] bg-white px-2 py-1 text-[11px] font-medium text-[#0f0f0f] hover:border-[#0f0f0f] transition-colors"
                          >
                            Alts
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sticky Bottom Compare Bar */}
      {selectedParts.length > 0 && (
        <div
          data-no-print="true"
          role="region"
          aria-label="Compare selected parts"
          className="print:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-3xl rounded-[8px] border border-white/15 bg-[#0f0f0f] px-4 py-3 text-white shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono font-medium text-[#dafa9c]">
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Compare ({selectedParts.length}/2):
              </span>
              {selectedParts.map((part) => (
                <span
                  key={part.slug}
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-white/15 bg-[#1a1a1a] px-2 py-1 font-mono text-xs font-medium text-white"
                >
                  {part.opn}
                  <button
                    type="button"
                    onClick={() => toggleCompare(part.slug)}
                    aria-label={`Remove ${part.opn} from comparison`}
                    className="text-[#8f8f8f] hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {selectedParts.length === 1 && (
                <span className="text-[#8f8f8f]">Select 1 more OPN to run pin-by-pin diff</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareSlugs([])}
                className="rounded-[4px] border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white/85 hover:bg-[#1a1a1a] cursor-pointer"
              >
                Clear
              </button>
              {selectedParts.length === 2 ? (
                <Link
                  href={buildCompareHref(selectedParts[0].slug, selectedParts[1].slug)}
                  onClick={() =>
                    trackCompareLaunch(
                      'catalog_sticky_bar',
                      selectedParts[0].opn,
                      selectedParts[1].opn,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#dafa9c] px-4 py-1.5 text-xs font-semibold text-[#0f0f0f] hover:bg-[#e7fdbc] transition-colors"
                >
                  Compare Pinouts Side-by-Side →
                </Link>
              ) : (
                <Link
                  href={buildCompareHref(selectedParts[0].slug)}
                  onClick={() => trackCompareLaunch('catalog_sticky_bar', selectedParts[0].opn)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#dafa9c] px-4 py-1.5 text-xs font-semibold text-[#0f0f0f] hover:bg-[#e7fdbc] transition-colors"
                >
                  Open in Live Compare →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
