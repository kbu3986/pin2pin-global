import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';
import { buildMetaDescription, buildPageMetadata } from '@/lib/format';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('about');
  return buildPageMetadata({
    siteUrl: siteConfig.site_url,
    siteName: siteConfig.site_name,
    path: '/en/about',
    // Absolute title prevents double-brand "About Pin2Pin Global | Pin2Pin Global"
    title: 'About Pin2Pin Global — Verified IC Pinout & Cross-Ref DB',
    absoluteTitle: true,
    description: buildMetaDescription(doc.description),
  });
}

export default function AboutPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('about');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
