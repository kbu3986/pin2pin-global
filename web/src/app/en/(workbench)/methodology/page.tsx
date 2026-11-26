import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';
import { buildMetaDescription, buildPageMetadata } from '@/lib/format';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('methodology');
  return buildPageMetadata({
    siteUrl: siteConfig.site_url,
    siteName: siteConfig.site_name,
    path: '/en/methodology',
    title: 'Dual-Path PDF & Vision Verification Methodology',
    description: buildMetaDescription(doc.description),
  });
}

export default function MethodologyPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('methodology');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
