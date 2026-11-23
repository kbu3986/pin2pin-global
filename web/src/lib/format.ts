import type { Metadata } from 'next';
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

export function subTopologyLabel(subTopology: string | null | undefined): string {
  switch (subTopology) {
    case 'fixed-ldo':
      return 'Fixed LDO';
    case 'adj-ldo':
      return 'Adjustable LDO';
    case 'buck':
      return 'Step-Down (Buck)';
    case 'boost':
      return 'Step-Up (Boost)';
    case 'buck-boost':
      return 'Buck-Boost';
    case 'opamp-single':
      return 'Single Op-Amp';
    case 'opamp-dual':
      return 'Dual Op-Amp';
    case 'comparator-single':
      return 'Single Comparator';
    case 'comparator-dual':
      return 'Dual Comparator';
    default:
      if (!subTopology) return 'Analog / Power IC';
      return subTopology
        .split('-')
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
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

export function joinCanonical(siteUrl: string, routePath: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  return clean ? `${base}/${clean}/` : `${base}/`;
}

/** Absolute URL of the 1200x630 Open Graph card in web/public. */
export function ogImageUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/og-image.png`;
}

/** Absolute URL of the square site logo (apple-touch-icon, 180x180). */
export function logoUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/apple-touch-icon.png`;
}

/**
 * Compose a meta description that lands in the 125-158 char target window.
 * Pads with supplemental sentences when too short and trims on a word boundary when too long.
 */
export function buildMetaDescription(
  primary: string,
  supplements: string[] = [],
  min = 125,
  max = 158,
): string {
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  let text = clean(primary);
  for (const extra of supplements) {
    if (text.length >= min) break;
    const next = `${text.replace(/[.\s]+$/, '')}. ${clean(extra)}`;
    text = next.length <= max ? next : text;
    if (next.length > max && text.length < min) {
      text = next;
    }
  }
  if (text.length > max) {
    const slice = text.slice(0, max - 1);
    const cut = slice.lastIndexOf(' ');
    const trimmed = (cut > min - 20 ? slice.slice(0, cut) : slice).replace(/[\s,;:.\-–—]+$/, '');
    text = `${trimmed}…`;
  }
  return text;
}

/**
 * Choose the richest title candidate that fits the 65-char budget once the
 * site template (` | Pin2Pin Global`) is appended. Falls back to the shortest candidate.
 */
export function buildMetaTitle(candidates: string[], brand = 'Pin2Pin Global', budget = 65): string {
  const suffixLen = brand ? brand.length + 3 : 0;
  const fit = candidates.find((c) => c.length + suffixLen <= budget);
  if (fit) return fit;
  return [...candidates].sort((a, b) => a.length - b.length)[0];
}

export interface PageMetaOptions {
  siteUrl: string;
  siteName: string;
  path: string;
  title: string;
  description: string;
  /** When true the title is rendered verbatim (no `| Brand` template suffix). */
  absoluteTitle?: boolean;
  ogType?: 'website' | 'article';
  noindex?: boolean;
}

/** Shared Metadata builder: canonical, OpenGraph (url + 1200x630 image) and Twitter large-image card. */
export function buildPageMetadata(opts: PageMetaOptions): Metadata {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  const image = ogImageUrl(opts.siteUrl);
  const ogTitle = opts.absoluteTitle ? opts.title : `${opts.title} | ${opts.siteName}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: opts.ogType ?? 'website',
      url: canonical,
      siteName: opts.siteName,
      locale: 'en_US',
      title: ogTitle,
      description: opts.description,
      images: [{ url: image, width: 1200, height: 630, alt: `${opts.siteName} — datasheet-verified pinout and cross-reference database` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: opts.description,
      images: [image],
    },
  };
}

function organizationNode(siteUrl: string, siteName: string): Record<string, unknown> {
  return {
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: logoUrl(siteUrl),
      width: 180,
      height: 180,
    },
  };
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

/** WebSite + SearchAction + Organization (with logo) for the /en home page. */
export function buildWebsiteJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  description: string;
  searchPath?: string;
}): Record<string, unknown> {
  const home = joinCanonical(opts.siteUrl, '/en');
  const searchBase = joinCanonical(opts.siteUrl, opts.searchPath ?? '/en/catalog');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${home}#website`,
        url: home,
        name: opts.siteName,
        description: opts.description,
        inLanguage: 'en',
        publisher: { '@id': `${home}#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${searchBase}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        ...organizationNode(opts.siteUrl, opts.siteName),
        '@id': `${home}#organization`,
      },
    ],
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
  wordCount?: number;
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: opts.headline.length > 110 ? `${opts.headline.slice(0, 107)}…` : opts.headline,
    description: opts.description,
    url: canonical,
    image: [ogImageUrl(opts.siteUrl)],
    inLanguage: 'en',
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
    publisher: organizationNode(opts.siteUrl, opts.siteName),
    ...(opts.about ? { about: opts.about } : {}),
    ...(opts.wordCount ? { wordCount: opts.wordCount } : {}),
  };
}

/** AboutPage / ContactPage / WebPage JSON-LD for trust pages. */
export function buildWebPageJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  name: string;
  description: string;
  dateModified: string;
  type?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': opts.type ?? 'WebPage',
    '@id': canonical,
    url: canonical,
    name: opts.name,
    description: opts.description,
    inLanguage: 'en',
    dateModified: opts.dateModified,
    isPartOf: {
      '@type': 'WebSite',
      name: opts.siteName,
      url: joinCanonical(opts.siteUrl, '/en'),
    },
    publisher: organizationNode(opts.siteUrl, opts.siteName),
  };
}

/** CollectionPage + ItemList for hub index pages (e.g. field guides). */
export function buildCollectionPageJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  name: string;
  description: string;
  dateModified: string;
  items: Array<{ name: string; path: string }>;
}): Record<string, unknown> {
  return {
    ...buildWebPageJsonLd({ ...opts, type: 'CollectionPage' }),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        url: joinCanonical(opts.siteUrl, item.path),
      })),
    },
  };
}

/** Latest ISO date (YYYY-MM-DD) in a list, falling back to the provided default. */
export function maxIsoDate(values: Array<string | null | undefined>, fallback = ''): string {
  const valid = values
    .filter((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))
    .map((v) => v.slice(0, 10))
    .sort();
  return valid.length ? valid[valid.length - 1] : fallback;
}

export function buildDatasetJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  name: string;
  description: string;
  keywords: string[];
  dateModified: string;
  identifier?: string;
  variableMeasured?: string[];
  license?: string;
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: opts.name,
    description: opts.description,
    url: canonical,
    identifier: opts.identifier ?? canonical,
    // Data originates from official manufacturer PDFs (trademarks remain with owners);
    // point at the site's legal notice rather than asserting an open license.
    license: opts.license ?? joinCanonical(opts.siteUrl, '/en/disclaimer'),
    inLanguage: 'en',
    keywords: opts.keywords,
    dateModified: opts.dateModified,
    isAccessibleForFree: true,
    variableMeasured: (
      opts.variableMeasured ?? [
        'Pin number and signal role',
        'Absolute maximum ratings',
        'Thermal resistance θJA (°C/W)',
        'Package code and exposed pad net',
        'Datasheet page citation',
      ]
    ).map((name) => ({ '@type': 'PropertyValue', name })),
    creator: organizationNode(opts.siteUrl, opts.siteName),
  };
}

export function buildSoftwareAppJsonLd(opts: {
  siteUrl: string;
  siteName: string;
  path: string;
  name: string;
  description: string;
  featureList?: string[];
  screenshot?: string;
}): Record<string, unknown> {
  const canonical = joinCanonical(opts.siteUrl, opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    description: opts.description,
    url: canonical,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Electronic engineering calculator',
    operatingSystem: 'Any (Web Browser)',
    softwareVersion: '2.0',
    inLanguage: 'en',
    isAccessibleForFree: true,
    screenshot: opts.screenshot ?? ogImageUrl(opts.siteUrl),
    ...(opts.featureList && opts.featureList.length > 0 ? { featureList: opts.featureList } : {}),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: organizationNode(opts.siteUrl, opts.siteName),
  };
}

/**
 * Absolute page URL that always honours `trailingSlash: true` (next.config.ts).
 * File-like paths (with an extension, e.g. `/og-card.svg`) are returned without a trailing slash.
 */
export function buildPageUrl(routePath: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const clean = routePath.replace(/^\/+|\/+$/g, '').split(/[?#]/)[0];
  if (!clean) return `${base}/`;
  if (/\.[a-z0-9]{2,5}$/i.test(clean)) return `${base}/${clean}`;
  const suffix = routePath.includes('?') || routePath.includes('#') ? routePath.slice(routePath.search(/[?#]/)) : '';
  return `${base}/${clean}/${suffix}`;
}

/** Internal route path with guaranteed trailing slash (for Next <Link href>). Keeps ?query / #hash. */
export function routePath(path: string): string {
  const idx = path.search(/[?#]/);
  const pathname = idx === -1 ? path : path.slice(0, idx);
  const rest = idx === -1 ? '' : path.slice(idx);
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${withSlash}${rest}`;
}

/** Live A-vs-B comparator deep link (`/en/tools/compare/?a=..&b=..`). */
export function buildCompareHref(a?: string | null, b?: string | null): string {
  const params = new URLSearchParams();
  if (a) params.set('a', a);
  if (b) params.set('b', b);
  const qs = params.toString();
  return `/en/tools/compare/${qs ? `?${qs}` : ''}`;
}

/** Deep link straight to a datasheet PDF page (`#page=N`, honoured by Chrome/Firefox/Acrobat PDF viewers). */
export function buildPdfPageUrl(pdfUrl: string, page: number | null | undefined): string {
  if (!page || !Number.isFinite(page) || page < 1) return pdfUrl;
  return `${pdfUrl.split('#')[0]}#page=${Math.floor(page)}`;
}

/** Normalize a search string: lowercase and strip spaces, hyphens, slashes, dots and underscores. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[\s\-_/.,()]+/g, '');
}

export interface SiteToolLink {
  slug: string;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
}

/** Single source of truth for the zero-upload engineering tool routes (header, palette, footer, hub). */
export const SITE_TOOLS: SiteToolLink[] = [
  {
    slug: 'compare',
    href: '/en/tools/compare/',
    label: 'Live A-vs-B Comparator',
    shortLabel: 'Live Compare',
    description: 'Compare any two verified OPNs pin-by-pin with parameter deltas.',
  },
  {
    slug: 'pinout-finder',
    href: '/en/tools/pinout-finder/',
    label: 'Reverse Pinout & Footprint Finder',
    shortLabel: 'Pinout Finder',
    description: 'Find every verified part that fits an existing footprint / pin map.',
  },
  {
    slug: 'feedback-divider',
    href: '/en/tools/feedback-divider/',
    label: 'Feedback Divider Solver (E96/E24)',
    shortLabel: 'Feedback Divider',
    description: 'Solve R1/R2 for adjustable LDO and DC-DC Vref with E-series values.',
  },
  {
    slug: 'bom-checker',
    href: '/en/tools/bom-checker/',
    label: 'Zero-Upload BOM Checker',
    shortLabel: 'BOM Checker',
    description: 'Paste a BOM to flag EOL/NRND parts, gotchas and verified alternates locally.',
  },
  {
    slug: 'ldo-thermal-calculator',
    href: '/en/tools/ldo-thermal-calculator/',
    label: 'LDO Thermal & Tj Calculator',
    shortLabel: 'LDO Thermal',
    description: 'Power dissipation, junction temperature and derating margin.',
  },
  {
    slug: 'dcdc-efficiency-ripple-calculator',
    href: '/en/tools/dcdc-efficiency-ripple-calculator/',
    label: 'DC-DC Efficiency & Ripple Calculator',
    shortLabel: 'DC-DC Ripple',
    description: 'Duty cycle, inductor ripple current and output ripple estimates.',
  },
  {
    slug: 'opamp-gbwp-slewrate-checker',
    href: '/en/tools/opamp-gbwp-slewrate-checker/',
    label: 'Op-Amp GBWP & Slew-Rate Checker',
    shortLabel: 'Op-Amp GBWP',
    description: 'Closed-loop bandwidth and full-power bandwidth sanity check.',
  },
];

export const TOOLS_HUB_HREF = '/en/tools/';
export const GUIDES_HUB_HREF = '/en/guides/';

export type CommandSearchItemType = 'part' | 'tool' | 'guide' | 'vs' | 'alt' | 'page';

/** Compact, serializable search record fed to the client CommandPalette from the server layout. */
export interface CommandSearchItem {
  /** Stable unique key. */
  id: string;
  type: CommandSearchItemType;
  /** Primary label (OPN, tool name, guide title, "A vs B"). */
  label: string;
  /** Secondary line (manufacturer · package · category, etc.). */
  sublabel: string;
  /** Internal route path with trailing slash (no basePath; use Next <Link>/router). */
  href: string;
  /** Pre-normalized (normalizeSearchText) haystack: OPN, family, package, mfg package code, keywords. */
  keywords: string;
  /** Optional lifecycle badge for parts. */
  lifecycle?: 'Active' | 'NRND' | 'EOL' | 'Unknown';
}

export function lifecycleBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'EOL':
      return 'bg-rose-600 text-white border-rose-700';
    case 'NRND':
      return 'bg-amber-100 text-amber-950 border-amber-400';
    case 'Active':
      return 'bg-emerald-50 text-emerald-900 border-emerald-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}
