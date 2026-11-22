import type { Metadata } from 'next';
import { getSiteConfig, getTrustDocBySlug } from '@/lib/data-loader';
import { TrustPageView } from '@/components/TrustPageView';

export function generateMetadata(): Metadata {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('about');
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `${siteConfig.site_url}/en/about/`,
    },
  };
}

export default function AboutPage() {
  const siteConfig = getSiteConfig();
  const doc = getTrustDocBySlug('about');
  return <TrustPageView doc={doc} siteConfig={siteConfig} />;
}
