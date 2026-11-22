import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { SiteConfig } from '@/types/schema';
import { buildDistributorUrl } from '@/lib/format';
import { TrackedOutboundLink } from '@/components/TrackedOutboundLink';

export function DistributorLinks({
  siteConfig,
  opn,
  label,
}: {
  siteConfig: SiteConfig;
  opn: string;
  label?: string;
}) {
  const { digikey, mouser, lcsc } = siteConfig.distributor_search_deeplinks;
  const links = [
    {
      id: 'digikey',
      name: 'DigiKey Search',
      url: buildDistributorUrl(digikey, opn),
      accent: 'hover:border-red-400 hover:bg-red-50/40',
    },
    {
      id: 'mouser',
      name: 'Mouser Search',
      url: buildDistributorUrl(mouser, opn),
      accent: 'hover:border-sky-400 hover:bg-sky-50/40',
    },
    {
      id: 'lcsc',
      name: 'LCSC Search',
      url: buildDistributorUrl(lcsc, opn),
      accent: 'hover:border-indigo-400 hover:bg-indigo-50/40',
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {label ?? `Check Live Stock & Pricing: `}
            <span className="font-mono text-slate-950">{opn}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            Direct outbound search deeplinks only — zero distributor scraping or stale cached pricing.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {links.map((item) => (
          <TrackedOutboundLink
            key={item.id}
            href={item.url}
            eventName="distributor_click"
            eventParams={{
              distributor: item.id,
              opn,
            }}
            rel="nofollow noopener noreferrer"
            className={`flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors ${item.accent}`}
          >
            <span>{item.name}</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </TrackedOutboundLink>
        ))}
      </div>
    </div>
  );
}
