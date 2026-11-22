import type {
  CitedNumber,
  CompatibilityLevel,
  PartCategory,
  SiteConfig,
} from '@/types/schema';

export function fmtNum(value: number | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: maxDecimals,
    });
  }
  return Number(value.toFixed(maxDecimals)).toString();
}

export function fmtCited(
  cited: CitedNumber | null | undefined,
  unit = '',
  maxDecimals = 2,
): string {
  if (!cited || !Number.isFinite(cited.value)) return '—';
  const num = fmtNum(cited.value, maxDecimals);
  return unit ? `${num} ${unit}` : num;
}

export function fmtPage(cited: CitedNumber | null | undefined): string {
  if (!cited || !Number.isFinite(cited.page)) return '—';
  return `p.${cited.page}`;
}

export function fmtBool(
  val: boolean | null | undefined,
  trueLabel = 'Yes',
  falseLabel = 'No',
): string {
  if (val === true) return trueLabel;
  if (val === false) return falseLabel;
  return 'Not Specified';
}

export function fmtFrequencyKhz(khz: number | null | undefined): string {
  if (khz === null || khz === undefined || !Number.isFinite(khz)) return '—';
  if (khz >= 1000) {
    return `${fmtNum(khz / 1000, 2)} MHz`;
  }
  return `${fmtNum(khz, 0)} kHz`;
}

export function fmtCurrentMa(ma: number | null | undefined): string {
  if (ma === null || ma === undefined || !Number.isFinite(ma)) return '—';
  if (ma >= 1000) {
    return `${fmtNum(ma / 1000, 2)} A`;
  }
  return `${fmtNum(ma, 0)} mA`;
}

export function fmtIqUa(ua: number | null | undefined): string {
  if (ua === null || ua === undefined || !Number.isFinite(ua)) return '—';
  if (ua < 1) {
    return `${fmtNum(ua * 1000, 0)} nA`;
  }
  if (ua >= 1000) {
    return `${fmtNum(ua / 1000, 2)} mA`;
  }
  return `${fmtNum(ua, 2)} µA`;
}

export function categoryLabel(category: PartCategory | 'general'): string {
  switch (category) {
    case 'ldo':
      return 'LDO Regulator';
    case 'dcdc':
      return 'DC-DC Converter';
    case 'opamp':
      return 'Op-Amp / Comparator';
    case 'general':
      return 'Hardware Design';
  }
}

export function categoryShortLabel(category: PartCategory): string {
  switch (category) {
    case 'ldo':
      return 'LDO';
    case 'dcdc':
      return 'DC-DC';
    case 'opamp':
      return 'Op-Amp';
  }
}

export function getCompatibilityStyle(level: CompatibilityLevel): {
  shortLabel: string;
  tierCode: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  bannerBg: string;
  bannerBorder: string;
} {
  switch (level) {
    case 'LEVEL_1_CANDIDATE_DROP_IN':
      return {
        shortLabel: 'Candidate Drop-In',
        tierCode: 'LEVEL 1',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-900',
        badgeBorder: 'border-emerald-300',
        dotColor: 'bg-emerald-600',
        bannerBg: 'bg-emerald-50/80',
        bannerBorder: 'border-emerald-400',
      };
    case 'LEVEL_2_TUNING_REQUIRED':
      return {
        shortLabel: 'Tuning Required',
        tierCode: 'LEVEL 2',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-950',
        badgeBorder: 'border-amber-300',
        dotColor: 'bg-amber-500',
        bannerBg: 'bg-amber-50/80',
        bannerBorder: 'border-amber-400',
      };
    case 'LEVEL_3_LAYOUT_CHANGE':
      return {
        shortLabel: 'Layout Change Required',
        tierCode: 'LEVEL 3',
        badgeBg: 'bg-rose-50',
        badgeText: 'text-rose-950',
        badgeBorder: 'border-rose-300',
        dotColor: 'bg-rose-600',
        bannerBg: 'bg-rose-50/80',
        bannerBorder: 'border-rose-400',
      };
  }
}

export function buildErrorReportUrl(
  siteConfig: SiteConfig,
  subject: string,
  pagePath: string,
  datasheetRef?: string,
): string {
  const title = encodeURIComponent(`[Pinout/Spec Audit] ${subject}`);
  const bodyLines = [
    `Page URL: ${siteConfig.site_url}${pagePath}`,
    `Part / Comparison: ${subject}`,
    datasheetRef ? `Datasheet Reference: ${datasheetRef}` : '',
    '',
    '### Reported Discrepancy',
    '- Field / Pin Number:',
    '- Value Shown on Pin2Pin:',
    '- Correct Value from Official Manufacturer Datasheet (include Revision & Page #):',
    '- Official Manufacturer PDF URL:',
  ].filter(Boolean);
  const body = encodeURIComponent(bodyLines.join('\n'));
  return `${siteConfig.error_report_issue_url}?title=${title}&body=${body}`;
}

export function buildDistributorUrl(template: string, opn: string): string {
  return template.replace('{OPN}', encodeURIComponent(opn));
}

function joinCanonical(siteUrl: string, routePath: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  return clean ? `${base}/${clean}/` : `${base}/`;
}

export function buildBreadcrumbJsonLd(
  siteUrl: string,
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: joinCanonical(siteUrl, item.path),
    })),
  };
}

export function buildTechArticleJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  headline: string;
  description: string;
  dateModified: string;
  datePublished?: string;
  about?: string;
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: opts.headline,
    description: opts.description,
    url: canonical,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    datePublished: opts.datePublished ?? opts.dateModified,
    dateModified: opts.dateModified,
    author: {
      '@type': 'Organization',
      name: opts.siteName,
      url: opts.siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: opts.siteName,
      url: opts.siteUrl,
    },
    ...(opts.about ? { about: opts.about } : {}),
  };
}

export function buildDatasetJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  name: string;
  description: string;
  keywords: string[];
  dateModified: string;
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: opts.name,
    description: opts.description,
    url: canonical,
    keywords: opts.keywords,
    dateModified: opts.dateModified,
    isAccessibleForFree: true,
    creator: {
      '@type': 'Organization',
      name: opts.siteName,
      url: opts.siteUrl,
    },
  };
}

export function buildSoftwareAppJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    description: opts.description,
    url: canonical,
    applicationCategory: 'EngineeringApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: opts.siteName,
      url: opts.siteUrl,
    },
  };
}
