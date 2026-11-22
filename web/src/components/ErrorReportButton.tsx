import { Flag } from 'lucide-react';
import type { SiteConfig } from '@/types/schema';
import { buildErrorReportUrl } from '@/lib/format';

export function ErrorReportButton({
  siteConfig,
  subject,
  pagePath,
  datasheetRef,
}: {
  siteConfig: SiteConfig;
  subject: string;
  pagePath: string;
  datasheetRef?: string;
}) {
  const href = buildErrorReportUrl(siteConfig, subject, pagePath, datasheetRef);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100 transition-colors"
    >
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Report Pinout/Spec Error
    </a>
  );
}
