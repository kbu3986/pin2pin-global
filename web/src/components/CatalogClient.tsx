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
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-70" aria-hidden="true" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-emerald-300" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-300" aria-hidden="true" />
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
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                category === key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset Filters
        </button>
      </div>

      {/* Filter Panel */}
      <div className="rounded-lg border border-slate-300 bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Parametric Workbench Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <label className="block lg:col-span-2">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Search OPN / Family / Mfg Code
            </span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="OPN, DBVR, SOT235, TI..."
                className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 font-mono text-xs text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Package</span>
            <select
              value={pkgFilter}
              onChange={(e) => {
                setPkgFilter(e.target.value);
                trackCatalogFilter('package', e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
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
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Manufacturer</span>
            <select
              value={mfgFilter}
              onChange={(e) => {
                setMfgFilter(e.target.value);
                trackCatalogFilter('manufacturer', e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
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
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Max Iq (µA)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={maxIqStr}
              onChange={(e) => setMaxIqStr(e.target.value)}
              placeholder="e.g. 50"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">
              Min Current (mA)
            </span>
            <input
              type="number"
              min="0"
              step="50"
              value={minCurrentStr}
              onChange={(e) => setMinCurrentStr(e.target.value)}
              placeholder="e.g. 300"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <label
            className={`inline-flex items-center gap-2 font-medium ${
              ceramicDisabled ? 'text-slate-500 cursor-not-allowed' : 'text-slate-700 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={ceramicOnly}
              disabled={ceramicDisabled}
              onChange={(e) => setCeramicOnly(e.target.checked)}
              className="rounded border-slate-300 disabled:opacity-50"
            />
            Ceramic-Cap (MLCC) Stable LDOs Only
            {ceramicDisabled && (
              <span className="text-[11px] font-mono text-slate-500">(LDOs only)</span>
            )}
          </label>
          <span className="font-mono text-slate-600">
            Matched: <strong className="text-slate-950">{filtered.length}</strong> / {rows.length} OPNs
            {' · '}Check any 2 rows to live-compare
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-900 px-3 py-2.5 text-left border-r border-slate-800" aria-sort={ariaSort('opn')}>
                <div className="flex items-center gap-2">
                  <span className="sr-only">Compare</span>
                  <button
                    type="button"
                    onClick={() => toggleSort('opn')}
                    className="inline-flex items-center gap-1 hover:text-emerald-300 cursor-pointer"
                  >
                    OPN / Family
                    {sortIcon('opn')}
                  </button>
                </div>
              </th>
              <th className="px-3 py-2.5 text-left">Manufacturer</th>
              <th className="px-3 py-2.5 text-left" aria-sort={ariaSort('package_code')}>
                <button
                  type="button"
                  onClick={() => toggleSort('package_code')}
                  className="inline-flex items-center gap-1 hover:text-emerald-300 cursor-pointer"
                >
                  Package
                  {sortIcon('package_code')}
                </button>
              </th>
              <th className="px-3 py-2.5 text-right" aria-sort={ariaSort('vin_or_vs_max_v')}>
                <button
                  type="button"
                  onClick={() => toggleSort('vin_or_vs_max_v')}
                  className="inline-flex items-center gap-1 hover:text-emerald-300 cursor-pointer"
                >
                  Supply Range
                  {sortIcon('vin_or_vs_max_v')}
                </button>
              </th>
              <th className="px-3 py-2.5 text-right" aria-sort={ariaSort('current_ma')}>
                <button
                  type="button"
                  onClick={() => toggleSort('current_ma')}
                  className="inline-flex items-center gap-1 hover:text-emerald-300 cursor-pointer"
                >
                  Current
                  {sortIcon('current_ma')}
                </button>
              </th>
              <th className="px-3 py-2.5 text-right" aria-sort={ariaSort('iq_ua')}>
                <button
                  type="button"
                  onClick={() => toggleSort('iq_ua')}
                  className="inline-flex items-center gap-1 hover:text-emerald-300 cursor-pointer"
                >
                  Iq (Typ)
                  {sortIcon('iq_ua')}
                </button>
              </th>
              <th className="px-3 py-2.5 text-right" aria-sort={ariaSort('theta_ja')}>
                <button
                  type="button"
                  onClick={() => toggleSort('theta_ja')}
                  className="inline-flex items-center gap-1 hover:text-emerald-300 cursor-pointer"
                >
                  θJA
                  {sortIcon('theta_ja')}
                </button>
              </th>
              <th className="px-3 py-2.5 text-left">Key Spec / MLCC</th>
              <th className="px-3.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-600">
                  No OPNs match the current parametric filter criteria. Try relaxing Max Iq or Package constraints.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isSelected = compareSlugs.includes(r.slug);
                const life = (r as CatalogPartRow & { lifecycle?: string }).lifecycle;
                return (
                  <tr
                    key={r.slug}
                    className={`transition-colors ${isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50/90'}`}
                  >
                    <td
                      className={`sticky left-0 z-10 px-3 py-2.5 whitespace-nowrap border-r border-slate-100 ${
                        isSelected ? 'bg-sky-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompare(r.slug)}
                          aria-label={`Select ${r.opn} for comparison`}
                          className="mt-1 h-3.5 w-3.5 rounded border-slate-400 text-sky-700 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/en/part/${r.slug}/`}
                              className="font-mono font-bold text-slate-950 hover:text-sky-700 hover:underline"
                            >
                              {r.opn}
                            </Link>
                            {life && life !== 'Active' && (
                              <span
                                className={`rounded border px-1 py-0.5 font-mono text-[11px] font-bold uppercase leading-none ${lifecycleBadgeClass(life)}`}
                              >
                                {life}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-600">
                            {r.family} · <span className="uppercase font-mono">{r.category}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.manufacturer}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                        {r.package_code}
                      </span>
                      {r.exposed_pad_net !== 'NONE' && (
                        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px] font-bold text-amber-900">
                          EP:{r.exposed_pad_net === 'THERMAL_GND_RECOMMENDED' ? 'GND' : r.exposed_pad_net}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {fmtNum(r.vin_or_vs_min_v, 1)}–{fmtNum(r.vin_or_vs_max_v, 1)} V
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {r.current_label}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {fmtIqUa(r.iq_ua)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {fmtNum(r.theta_ja, 0)} °C/W
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      <span className="font-mono text-[11px]">{r.highlight_metric}</span>
                      {r.ceramic_cap_stable !== null && (
                        <span
                          className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            r.ceramic_cap_stable
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {r.ceramic_cap_stable ? 'MLCC OK' : 'ESR Req'}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/en/part/${r.slug}/`}
                          className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100"
                        >
                          Pinout
                        </Link>
                        {r.has_alt_page && (
                          <Link
                            href={`/en/alt/${r.slug}-alternatives/`}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
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
          className="print:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-3xl rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-300">
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Compare ({selectedParts.length}/2):
              </span>
              {selectedParts.map((part) => (
                <span
                  key={part.slug}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs font-semibold text-white"
                >
                  {part.opn}
                  <button
                    type="button"
                    onClick={() => toggleCompare(part.slug)}
                    aria-label={`Remove ${part.opn} from comparison`}
                    className="text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {selectedParts.length === 1 && (
                <span className="text-slate-300">Select 1 more OPN to run pin-by-pin diff</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareSlugs([])}
                className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
                >
                  Compare Pinouts Side-by-Side →
                </Link>
              ) : (
                <Link
                  href={buildCompareHref(selectedParts[0].slug)}
                  onClick={() => trackCompareLaunch('catalog_sticky_bar', selectedParts[0].opn)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors"
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
