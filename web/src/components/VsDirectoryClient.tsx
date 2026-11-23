'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CompatibilityLevel, PartCategory, VsDirectoryItem } from '@/types/schema';
import { trackEvent } from '@/lib/analytics';
import { categoryShortLabel, getCompatibilityStyle } from '@/lib/format';

export type { VsDirectoryItem };

export interface VsDirectoryProps {
  items: VsDirectoryItem[];
}

type LevelFilter = 'ALL' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
type SortMode = 'traps_first' | 'l1_first' | 'alpha';

function normalizeLevel(level: string): CompatibilityLevel {
  if (level.startsWith('LEVEL_1')) return 'LEVEL_1_CANDIDATE_DROP_IN';
  if (level.startsWith('LEVEL_2')) return 'LEVEL_2_TUNING_REQUIRED';
  return 'LEVEL_3_LAYOUT_CHANGE';
}

function levelRank(level: string): number {
  if (level.startsWith('LEVEL_1')) return 1;
  if (level.startsWith('LEVEL_2')) return 2;
  return 3;
}

export function VsDirectoryClient({ items }: VsDirectoryProps) {
  const [category, setCategory] = useState<'all' | PartCategory>('all');
  const [level, setLevel] = useState<LevelFilter>('ALL');
  const [pinoutMismatchOnly, setPinoutMismatchOnly] = useState(false);
  const [epConflictOnly, setEpConflictOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('traps_first');

  const stats = useMemo(() => {
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    let pinTraps = 0;
    let epTraps = 0;
    for (const it of items) {
      const n = normalizeLevel(it.compatibilityLevel);
      if (n === 'LEVEL_1_CANDIDATE_DROP_IN') l1++;
      else if (n === 'LEVEL_2_TUNING_REQUIRED') l2++;
      else l3++;
      if (!it.pinoutMatch) pinTraps++;
      if (!it.exposedPadMatch) epTraps++;
    }
    return { total: items.length, l1, l2, l3, pinTraps, epTraps };
  }, [items]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false;
      if (level !== 'ALL' && !it.compatibilityLevel.startsWith(level)) return false;
      if (pinoutMismatchOnly && it.pinoutMatch) return false;
      if (epConflictOnly && it.exposedPadMatch) return false;
      if (tokens.length > 0) {
        const hay = `${it.partAOpn} ${it.partBOpn} ${it.partAPkg} ${it.partBPkg} ${it.category} ${it.summary} ${it.slug}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'traps_first') {
        const trapA = (!a.pinoutMatch ? 2 : 0) + (!a.exposedPadMatch ? 1 : 0);
        const trapB = (!b.pinoutMatch ? 2 : 0) + (!b.exposedPadMatch ? 1 : 0);
        if (trapB !== trapA) return trapB - trapA;
        return a.partAOpn.localeCompare(b.partAOpn) || a.partBOpn.localeCompare(b.partBOpn);
      }
      if (sortMode === 'l1_first') {
        const r = levelRank(a.compatibilityLevel) - levelRank(b.compatibilityLevel);
        if (r !== 0) return r;
        return a.partAOpn.localeCompare(b.partAOpn) || a.partBOpn.localeCompare(b.partBOpn);
      }
      return a.partAOpn.localeCompare(b.partAOpn) || a.partBOpn.localeCompare(b.partBOpn);
    });
  }, [items, category, level, pinoutMismatchOnly, epConflictOnly, query, sortMode]);

  const hasFilters =
    category !== 'all' || level !== 'ALL' || pinoutMismatchOnly || epConflictOnly || query.trim() !== '';

  const resetFilters = () => {
    setCategory('all');
    setLevel('ALL');
    setPinoutMismatchOnly(false);
    setEpConflictOnly(false);
    setQuery('');
  };

  return (
    <div className="space-y-5">
      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-300 bg-white p-3">
          <div className="font-mono text-[10px] font-bold uppercase text-slate-500">All 1:1 Diffs</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-950">{stats.total}</div>
        </div>
        <button
          type="button"
          onClick={() => setLevel(level === 'LEVEL_1' ? 'ALL' : 'LEVEL_1')}
          className={`rounded-lg border p-3 text-left transition-colors ${
            level === 'LEVEL_1'
              ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200'
              : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400'
          }`}
        >
          <div className="font-mono text-[10px] font-bold uppercase text-emerald-800">L1 Candidate Drop-In</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-950">{stats.l1}</div>
        </button>
        <button
          type="button"
          onClick={() => setLevel(level === 'LEVEL_2' ? 'ALL' : 'LEVEL_2')}
          className={`rounded-lg border p-3 text-left transition-colors ${
            level === 'LEVEL_2'
              ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-200'
              : 'border-amber-200 bg-amber-50/50 hover:border-amber-400'
          }`}
        >
          <div className="font-mono text-[10px] font-bold uppercase text-amber-900">L2 Tuning Required</div>
          <div className="mt-1 font-mono text-xl font-bold text-amber-950">{stats.l2}</div>
        </button>
        <button
          type="button"
          onClick={() => setLevel(level === 'LEVEL_3' ? 'ALL' : 'LEVEL_3')}
          className={`rounded-lg border p-3 text-left transition-colors ${
            level === 'LEVEL_3'
              ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-200'
              : 'border-rose-200 bg-rose-50/50 hover:border-rose-400'
          }`}
        >
          <div className="font-mono text-[10px] font-bold uppercase text-rose-800">L3 Layout Change</div>
          <div className="mt-1 font-mono text-xl font-bold text-rose-950">{stats.l3}</div>
        </button>
        <button
          type="button"
          onClick={() => setPinoutMismatchOnly((v) => !v)}
          className={`col-span-2 rounded-lg border p-3 text-left transition-colors sm:col-span-1 ${
            pinoutMismatchOnly
              ? 'border-red-600 bg-red-50 ring-2 ring-red-200'
              : 'border-slate-300 bg-white hover:border-rose-400'
          }`}
        >
          <div className="font-mono text-[10px] font-bold uppercase text-rose-800">Pinout Mismatches</div>
          <div className="mt-1 font-mono text-xl font-bold text-rose-900">{stats.pinTraps}</div>
        </button>
      </div>

      {/* Controls */}
      <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search OPN, package, or keyword (e.g. AMS1117, SOT-23-5, tab)…"
            className="min-w-[220px] flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />

          {/* Category segmented control */}
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs font-semibold">
            {(['all', 'ldo', 'dcdc', 'opamp'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1.5 ${
                  category === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                } ${cat !== 'all' ? 'border-l border-slate-300' : ''}`}
              >
                {cat === 'all' ? 'All' : categoryShortLabel(cat)}
              </button>
            ))}
          </div>

          {/* Compatibility level select */}
          <select
            aria-label="Filter by compatibility level"
            value={level}
            onChange={(e) => setLevel(e.target.value as LevelFilter)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="ALL">All Levels</option>
            <option value="LEVEL_1">Level 1 · Candidate Drop-In</option>
            <option value="LEVEL_2">Level 2 · Tuning Required</option>
            <option value="LEVEL_3">Level 3 · Layout Change</option>
          </select>

          <select
            aria-label="Sort comparisons"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="traps_first">Sort: Pinout Traps First</option>
            <option value="l1_first">Sort: Level 1 → Level 3</option>
            <option value="alpha">Sort: OPN A → Z</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-900">
              <input
                type="checkbox"
                checked={pinoutMismatchOnly}
                onChange={(e) => setPinoutMismatchOnly(e.target.checked)}
                className="accent-rose-600"
              />
              Pinout Mismatch Only
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
              <input
                type="checkbox"
                checked={epConflictOnly}
                onChange={(e) => setEpConflictOnly(e.target.checked)}
                className="accent-amber-600"
              />
              EP / Tab Conflict Only ({stats.epTraps})
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset filters
              </button>
            )}
          </div>
          <span className="font-mono text-slate-500">
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {items.length} comparisons
          </span>
        </div>
      </div>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">No pre-audited VS comparisons match these filters.</p>
          <p className="text-xs text-slate-500">
            Need to compare any arbitrary pair in the database?{' '}
            <Link href="/en/compare/" className="font-semibold text-sky-700 hover:underline">
              Open the Freeform Compare Workbench →
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((item) => {
            const normLevel = normalizeLevel(item.compatibilityLevel);
            const style = getCompatibilityStyle(normLevel);
            const samePkg = item.partAPkg === item.partBPkg;
            const catLabel =
              item.category === 'ldo' || item.category === 'dcdc' || item.category === 'opamp'
                ? categoryShortLabel(item.category)
                : item.category.toUpperCase();

            return (
              <Link
                key={item.slug}
                href={`/en/vs/${item.slug}/`}
                onClick={() =>
                  trackEvent('vs_directory_click', {
                    slug: item.slug,
                    category: item.category,
                    level: normLevel,
                  })
                }
                className="group flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 transition-colors hover:border-sky-500 hover:bg-sky-50/20"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor}`} />
                      {style.tierCode} · {style.shortLabel}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-600">
                      {catLabel}
                    </span>
                  </div>

                  <div className="font-mono text-sm font-bold text-slate-950 group-hover:text-sky-800">
                    {item.partAOpn}{' '}
                    <span className="font-sans text-xs font-normal text-slate-400">vs</span>{' '}
                    {item.partBOpn}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                      {samePkg ? item.partAPkg : `${item.partAPkg} → ${item.partBPkg}`}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        item.pinoutMatch
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {item.pinoutMatch ? 'Pinout Match' : 'PINOUT MISMATCH'}
                    </span>
                    {!item.exposedPadMatch && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 font-bold text-white">
                        EP / TAB CONFLICT
                      </span>
                    )}
                  </div>

                  {item.summary && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{item.summary}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-semibold text-sky-700">
                  <span>Inspect side-by-side SVG diff &amp; parameters</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VsDirectoryClient;
