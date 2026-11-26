import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';
import { buildMetaDescription, buildPageMetadata } from '@/lib/format';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('privacy');
  return buildPageMetadata({
    siteUrl: siteConfig.site_url,
    siteName: siteConfig.site_name,
    path: '/en/privacy',
    title: 'Privacy Policy & Zero-Upload Disclosures',
    description: buildMetaDescription(doc.description),
  });
}

export default function PrivacyPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('privacy');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
