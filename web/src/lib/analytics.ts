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

/** Canonical GA4 event names used across the site (keep in sync with GA4 custom definitions). */
export const ANALYTICS_EVENTS = {
  errorReportClick: 'error_report_click',
  datasheetPdfClick: 'datasheet_pdf_click',
  globalSearchSelect: 'global_search_select',
  catalogFilter: 'catalog_filter',
  compareLaunch: 'compare_launch',
} as const;

export function trackErrorReportClick(subject: string, pagePath: string): void {
  trackEvent(ANALYTICS_EVENTS.errorReportClick, { subject, page_path: pagePath });
}

export function trackGlobalSearchSelect(params: {
  result_type: string;
  result_label: string;
  query_length: number;
  rank: number;
}): void {
  trackEvent(ANALYTICS_EVENTS.globalSearchSelect, params);
}

export function trackCatalogFilter(filter: string, value: string | number | boolean): void {
  trackEvent(ANALYTICS_EVENTS.catalogFilter, { filter, value });
}

export function trackCompareLaunch(source: string, partA: string, partB?: string): void {
  trackEvent(ANALYTICS_EVENTS.compareLaunch, { source, part_a: partA, part_b: partB });
}
