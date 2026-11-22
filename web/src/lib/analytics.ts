'use client';

export type AnalyticsEventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetOrName: string | Date,
      params?: Record<string, unknown>,
    ) => void;
    dataLayer?: unknown[];
    adsbygoogle?: unknown[];
  }
}

/**
 * Safe client-side GA4 event dispatcher.
 * Silently no-ops on SSR or when GA4 / window.gtag is not configured or blocked.
 */
export function trackEvent(eventName: string, params: AnalyticsEventParams = {}): void {
  if (typeof window === 'undefined') return;
  const gtag = window.gtag;
  if (typeof gtag !== 'function') return;

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  try {
    gtag('event', eventName, cleaned);
  } catch {
    // Non-blocking: analytics failures must never affect engineering tools
  }
}
