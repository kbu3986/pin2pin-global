'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import type { PartCategory } from '@/types/schema';
import type { QuickCompareOption } from '@/lib/data-loader';
import { buildCompareHref } from '@/lib/format';
import { trackCompareLaunch } from '@/lib/analytics';

export interface QuickComparePickerProps {
  currentSlug: string;
  currentOpn: string;
  currentCategory: PartCategory;
  options: QuickCompareOption[];
}

export function QuickComparePicker({
  currentSlug,
  currentOpn,
  currentCategory,
  options,
}: QuickComparePickerProps) {
  const router = useRouter();

  const { sameCategory, otherCategory } = useMemo(() => {
    const others = options.filter((o) => o.slug !== currentSlug);
    return {
      sameCategory: others.filter((o) => o.category === currentCategory),
      otherCategory: others.filter((o) => o.category !== currentCategory),
    };
  }, [options, currentSlug, currentCategory]);

  const defaultTarget = sameCategory[0]?.slug ?? otherCategory[0]?.slug ?? '';
  const [targetSlug, setTargetSlug] = useState<string>(defaultTarget);

  const handleCompare = () => {
    if (!targetSlug) return;
    const chosen = options.find((o) => o.slug === targetSlug);
    trackCompareLaunch('part_quick_compare', currentOpn, chosen?.opn ?? targetSlug);
    router.push(buildCompareHref(currentSlug, targetSlug));
  };

  if (options.length <= 1) return null;

  return (
    <div
      data-no-print="true"
      className="print:hidden rounded-lg border border-sky-200 bg-sky-50/70 p-3.5 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <ArrowLeftRight className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
          Live A-vs-B Pinout Compare
        </span>
        <span className="font-mono text-[11px] text-slate-600">Any verified OPN</span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <label htmlFor={`quick-compare-${currentSlug}`} className="sr-only">
          Choose second OPN to compare with {currentOpn}
        </label>
        <select
          id={`quick-compare-${currentSlug}`}
          value={targetSlug}
          onChange={(e) => setTargetSlug(e.target.value)}
          className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        >
          {sameCategory.length > 0 && (
            <optgroup label={`Same Category (${currentCategory.toUpperCase()})`}>
              {sameCategory.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.opn} · {o.package_code} · {o.manufacturer}
                  {o.lifecycle_status === 'EOL' || o.lifecycle_status === 'NRND'
                    ? ` [${o.lifecycle_status}]`
                    : ''}
                </option>
              ))}
            </optgroup>
          )}
          {otherCategory.length > 0 && (
            <optgroup label="Other Categories">
              {otherCategory.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.opn} · {o.package_code} ({o.category.toUpperCase()})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={handleCompare}
          disabled={!targetSlug}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          Compare Now →
        </button>
      </div>
    </div>
  );
}
