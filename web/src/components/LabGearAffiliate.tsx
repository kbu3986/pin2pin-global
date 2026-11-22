import { ExternalLink, Wrench } from 'lucide-react';
import type { PartCategory, SiteConfig } from '@/types/schema';
import { categoryLabel } from '@/lib/format';
import { TrackedOutboundLink } from '@/components/TrackedOutboundLink';

export function LabGearAffiliate({
  siteConfig,
  category,
}: {
  siteConfig: SiteConfig;
  category: PartCategory;
}) {
  const items = siteConfig.lab_gear_affiliates[category] ?? [];
  if (items.length === 0) return null;

  const hasCoupangLinks = items.some((item) => Boolean(item.coupang_search_url));

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
          Affiliate Disclosure:{' '}
          {hasCoupangLinks
            ? 'Amazon Associate & Coupang Partners links'
            : 'Amazon Associate links'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {items.map((item) => (
          <article
            key={item.title}
            className="flex flex-col justify-between rounded-md border border-slate-200 bg-slate-50/70 p-3.5 hover:border-slate-400 hover:bg-white transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <TrackedOutboundLink
                  href={item.amazon_search_url}
                  eventName="affiliate_click"
                  eventParams={{
                    partner: 'amazon_us',
                    category,
                    item_title: item.title,
                  }}
                  rel="nofollow sponsored noopener noreferrer"
                  className="text-xs font-bold text-slate-900 hover:text-sky-700 leading-snug"
                >
                  {item.title}
                </TrackedOutboundLink>
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.reason}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono font-semibold text-slate-700">{item.price_band}</span>
              <div className="flex items-center gap-2.5">
                <TrackedOutboundLink
                  href={item.amazon_search_url}
                  eventName="affiliate_click"
                  eventParams={{
                    partner: 'amazon_us',
                    category,
                    item_title: item.title,
                  }}
                  rel="nofollow sponsored noopener noreferrer"
                  className="font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                >
                  Amazon US →
                </TrackedOutboundLink>
                {item.coupang_search_url && (
                  <TrackedOutboundLink
                    href={item.coupang_search_url}
                    eventName="affiliate_click"
                    eventParams={{
                      partner: 'coupang_kr',
                      category,
                      item_title: item.title,
                    }}
                    rel="nofollow sponsored noopener noreferrer"
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700 hover:border-rose-400 hover:text-rose-700 transition-colors"
                  >
                    Coupang KR →
                  </TrackedOutboundLink>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {hasCoupangLinks && (
        <p className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
          이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </p>
      )}
    </section>
  );
}
