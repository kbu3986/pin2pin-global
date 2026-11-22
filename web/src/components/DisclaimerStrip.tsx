import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { SiteConfig } from '@/types/schema';

export function DisclaimerStrip({ siteConfig }: { siteConfig: SiteConfig }) {
  return (
    <div
      role="note"
      aria-label="Engineering Reference Disclaimer"
      className="rounded-md border border-amber-300 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2.5"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
      <p className="leading-relaxed">
        <strong className="font-semibold">Engineering Reference Only (AS-IS):</strong>{' '}
        {siteConfig.legal.engineering_disclaimer_short.replace(
          /^Engineering Reference Only \(AS-IS\):\s*/i,
          '',
        )}{' '}
        <Link href="/en/disclaimer" className="underline font-medium hover:text-amber-800">
          Full Legal &amp; Safety Notice
        </Link>
        .
      </p>
    </div>
  );
}
