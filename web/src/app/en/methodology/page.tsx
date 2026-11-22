import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('methodology');
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `${siteConfig.site_url}/en/methodology/`,
    },
  };
}

export default function MethodologyPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('methodology');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
