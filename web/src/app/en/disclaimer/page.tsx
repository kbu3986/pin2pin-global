import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('disclaimer');
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `${siteConfig.site_url}/en/disclaimer/`,
    },
  };
}

export default function DisclaimerPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('disclaimer');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
