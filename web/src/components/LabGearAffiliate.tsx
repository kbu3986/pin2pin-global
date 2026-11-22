import { ExternalLink, Wrench } from 'lucide-react';
import type { PartCategory, SiteConfig } from '@/types/schema';
import { categoryLabel } from '@/lib/format';

export function LabGearAffiliate({
  siteConfig,
  category,
}: {
  siteConfig: SiteConfig;
  category: PartCategory;
}) {
  const items = siteConfig.lab_gear_affiliates[category] ?? [];
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Recommended Bench Validation Lab Gear"
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-slate-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">
            Recommended {categoryLabel(category)} Bench Validation Gear
          </h3>
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          Affiliate Disclosure: Amazon Associate links
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {items.map((item) => (
          <a
            key={item.title}
            href={item.amazon_search_url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="group flex flex-col justify-between rounded-md border border-slate-200 bg-slate-50/70 p-3.5 hover:border-slate-400 hover:bg-white transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-700 leading-snug">
                  {item.title}
                </h4>
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-sky-600 mt-0.5"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.reason}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
              <span className="font-mono font-semibold text-slate-700">{item.price_band}</span>
              <span className="font-semibold text-sky-700 group-hover:underline">
                View on Amazon →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
