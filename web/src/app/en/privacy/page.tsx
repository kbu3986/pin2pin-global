import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('privacy');
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `${siteConfig.site_url}/en/privacy/`,
    },
  };
}

export default function PrivacyPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('privacy');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
