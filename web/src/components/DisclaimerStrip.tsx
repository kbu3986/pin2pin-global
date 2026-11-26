import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { SiteConfig } from '@/types/schema';

export function DisclaimerStrip({ siteConfig }: { siteConfig: SiteConfig }) {
  return (
    <div
      role="note"
      aria-label="Engineering Reference Disclaimer"
      className="rounded-[4px] border border-[#e2e2dc] border-l-[3px] border-l-amber-700 bg-white px-4 py-3 text-[13px] text-[#2a2a28] flex items-start gap-2.5"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
      <p className="leading-relaxed">
        <strong className="font-semibold text-[#0f0f0f]">
          Engineering Reference Only (AS-IS):
        </strong>{' '}
        {siteConfig.legal.engineering_disclaimer_short.replace(
          /^Engineering Reference Only \(AS-IS\):\s*/i,
          '',
        )}{' '}
        <Link
          href="/en/disclaimer/"
          className="font-medium text-[#0f0f0f] underline decoration-[#8f8f8f] underline-offset-3 hover:decoration-[#0f0f0f]"
        >
          Full Legal &amp; Safety Notice
        </Link>
        .
      </p>
    </div>
  );
}
