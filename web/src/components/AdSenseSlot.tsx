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
 * Maintains min-h-[100px] reserved height and my-8 (32px >= 24px AUD-06 separation)
 * and is only placed below fold / at page bottom away from calculators and pinout SVGs.
 */
export function AdSenseSlot({
  publisherId,
  enabled,
  slotId,
  label = 'Sponsored Engineering Advertisement',
}: AdSenseSlotProps) {
  const pushedRef = useRef(false);
  const resolvedSlot = slotId || process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID || '';

  useEffect(() => {
    if (!enabled || !publisherId || pushedRef.current) return;
    pushedRef.current = true;
    try {
      const adsbygoogle = (window.adsbygoogle = window.adsbygoogle || []);
      adsbygoogle.push({});
    } catch {
      // AdBlock or duplicate push in StrictMode — safely ignore
    }
  }, [enabled, publisherId]);

  if (!enabled || !publisherId) return null;

  return (
    <aside
      aria-label={label}
      className="my-8 min-h-[100px] rounded-lg border border-slate-200/90 bg-slate-100/70 px-4 py-3 flex flex-col items-center justify-center overflow-hidden"
    >
      <span className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Advertisement
      </span>
      <ins
        className="adsbygoogle block w-full min-h-[90px]"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        {...(resolvedSlot ? { 'data-ad-slot': resolvedSlot } : {})}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
