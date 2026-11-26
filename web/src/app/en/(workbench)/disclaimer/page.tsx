import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';
import { buildMetaDescription, buildPageMetadata } from '@/lib/format';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('disclaimer');
  return buildPageMetadata({
    siteUrl: siteConfig.site_url,
    siteName: siteConfig.site_name,
    path: '/en/disclaimer',
    title: 'Engineering Disclaimer & Safety Legal Terms',
    description: buildMetaDescription(doc.description),
  });
}

export default function DisclaimerPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('disclaimer');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
