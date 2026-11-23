'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  BookOpen,
  Compass,
  Cpu,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import {
  lifecycleBadgeClass,
  normalizeSearchText,
  type CommandSearchItem,
  type CommandSearchItemType,
} from '@/lib/format';
import { trackGlobalSearchSelect } from '@/lib/analytics';

export const OPEN_COMMAND_PALETTE_EVENT = 'pin2pin:open-command-palette';

export function openCommandPalette(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  }
}

function TypeBadge({ type }: { type: CommandSearchItemType }) {
  switch (type) {
    case 'part':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
          <Cpu className="h-3 w-3" aria-hidden="true" />
          OPN
        </span>
      );
    case 'tool':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-700 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
          <Wrench className="h-3 w-3" aria-hidden="true" />
          Tool
        </span>
      );
    case 'guide':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-sky-700 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          Guide
        </span>
      );
    case 'vs':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-violet-700 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
          Diff
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-slate-800">
          <Compass className="h-3 w-3" aria-hidden="true" />
          Page
        </span>
      );
  }
}

export function CommandPalette({ items }: { items: CommandSearchItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const openModal = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery('');
            setActiveIndex(0);
          }
          return !prev;
        });
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onCustomOpen = () => openModal();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    };
  }, [open, openModal]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const norm = normalizeSearchText(query);
    if (!norm) {
      // Curated defaults: top tools + top parts + guides
      const tools = items.filter((i) => i.type === 'tool').slice(0, 5);
      const parts = items.filter((i) => i.type === 'part').slice(0, 5);
      const guides = items.filter((i) => i.type === 'guide').slice(0, 2);
      return [...tools, ...parts, ...guides];
    }

    const tokens = query
      .trim()
      .split(/\s+/)
      .map((t) => normalizeSearchText(t))
      .filter(Boolean);

    const scored: Array<{ item: CommandSearchItem; score: number }> = [];
    for (const item of items) {
      const labelNorm = normalizeSearchText(item.label);
      const hay = `${labelNorm} ${item.keywords}`;
      if (!tokens.every((tok) => hay.includes(tok))) continue;

      let score = 0;
      if (labelNorm === norm) score += 1000;
      else if (labelNorm.startsWith(norm)) score += 500;
      else if (labelNorm.includes(norm)) score += 250;
      if (item.type === 'part') score += 40;
      else if (item.type === 'tool') score += 30;
      else if (item.type === 'vs') score += 20;
      else if (item.type === 'guide') score += 15;
      scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
    return scored.slice(0, 14).map((s) => s.item);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectItem = useCallback(
    (item: CommandSearchItem, rank: number) => {
      trackGlobalSearchSelect({
        result_type: item.type,
        result_label: item.label,
        query_length: query.trim().length,
        rank,
      });
      setOpen(false);
      router.push(item.href);
    },
    [query, router],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex] ?? results[0];
      if (target) selectItem(target, activeIndex + 1);
    }
  };

  useEffect(() => {
    const activeEl = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      data-no-print="true"
      className="print:hidden fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 p-4 pt-[10vh] backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Global OPN, Tool and Guide Command Palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <Search className="h-4 w-4 text-slate-600 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search OPN, package (DBVR, DCY, SOT235), tool, guide, or VS pair..."
            aria-label="Search OPNs, package codes, engineering tools, and guides"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            className="w-full bg-transparent font-mono text-sm text-slate-950 placeholder:font-sans placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close command palette"
            className="rounded-md border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ul
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100"
        >
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-xs text-slate-600">
              No matches for <span className="font-mono font-bold text-slate-900">&ldquo;{query}&rdquo;</span>.
              Try an OPN prefix (e.g. <span className="font-mono">AP2112K</span>,{' '}
              <span className="font-mono">DBVR</span>, <span className="font-mono">LM358</span>) or tool name.
            </li>
          ) : (
            results.map((item, idx) => {
              const active = idx === activeIndex;
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectItem(item, idx + 1)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    active ? 'bg-sky-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <TypeBadge type={item.type} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate text-sm font-bold ${
                            item.type === 'part' || item.type === 'vs' ? 'font-mono' : ''
                          } ${active ? 'text-sky-900' : 'text-slate-950'}`}
                        >
                          {item.label}
                        </span>
                        {item.lifecycle && item.lifecycle !== 'Active' && (
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${lifecycleBadgeClass(item.lifecycle)}`}
                          >
                            {item.lifecycle}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-600">{item.sublabel}</p>
                    </div>
                  </div>
                  <span className="hidden sm:inline shrink-0 font-mono text-[11px] text-slate-500">
                    ↵ Open
                  </span>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 font-mono">
          <span>↑↓ Navigate · ↵ Open · Esc Close</span>
          <span>Hyphen-insensitive OPN &amp; mfg package code search</span>
        </div>
      </div>
    </div>
  );
}
