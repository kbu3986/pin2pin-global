'use client';

import React, { useEffect, useRef } from 'react';

export interface AdSenseSlotProps {
  publisherId: string;
  enabled: boolean;
  slotId?: string;
  label?: string;
}

/**
 * CLS-safe responsive Google AdSense display unit.
 *
 * Policy guard: a unit without a `data-ad-slot` id can never fill, so it would render as an
 * empty grey "Advertisement" box. When no slot id is configured (prop or NEXT_PUBLIC_ADSENSE_SLOT_ID)
 * this component renders nothing at all — AdSense Auto Ads (loaded in app/en/layout.tsx) handles placement.
 *
 * When active it keeps min-h-[100px] reserved height and my-8 (32px >= 24px AUD-06 separation) and is only
 * placed below fold / at page bottom away from calculators and pinout SVGs.
 */
export function AdSenseSlot({
  publisherId,
  enabled,
  slotId,
  label = 'Sponsored Engineering Advertisement',
}: AdSenseSlotProps) {
  const pushedRef = useRef(false);
  const resolvedSlotId = (slotId || process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID || '').trim();
  const active = Boolean(enabled && publisherId && resolvedSlotId);

  useEffect(() => {
    if (!active || pushedRef.current) return;
    pushedRef.current = true;
    try {
      const adsbygoogle = (window.adsbygoogle = window.adsbygoogle || []);
      adsbygoogle.push({});
    } catch {
      // AdBlock or duplicate push in StrictMode — safely ignore
    }
  }, [active]);

  if (!active) return null;

  return (
    <aside
      aria-label={label}
      className="print:hidden my-8 min-h-[100px] rounded-lg border border-slate-200/90 bg-slate-100/70 px-4 py-3 flex flex-col items-center justify-center overflow-hidden"
    >
      <span className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Advertisement
      </span>
      <ins
        className="adsbygoogle block w-full min-h-[90px]"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        data-ad-slot={resolvedSlotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
