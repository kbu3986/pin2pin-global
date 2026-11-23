'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export interface CopyOpnButtonProps {
  opn: string;
  size?: 'sm' | 'md';
  label?: string;
}

export function CopyOpnButton({ opn, size = 'md', label }: CopyOpnButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(opn);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = opn;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      trackEvent('copy_opn', { opn });
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const sizeClass =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[11px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? `Copy OPN ${opn} to clipboard`}
      className={`print:hidden inline-flex items-center rounded-md border font-mono font-semibold transition-colors cursor-pointer ${sizeClass} ${
        copied
          ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-950'
      }`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-slate-600 shrink-0" aria-hidden="true" />
          <span>{label ?? 'Copy OPN'}</span>
        </>
      )}
    </button>
  );
}
