import type { Metadata } from 'next';
import './globals.css';
import { getSiteConfig } from '@/lib/data-loader';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.site_url),
  title: {
    default: `${siteConfig.site_name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.site_name}`,
  },
  description: siteConfig.tagline,
  openGraph: {
    type: 'website',
    siteName: siteConfig.site_name,
    locale: 'en_US',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = siteConfig.monetization.adsense_publisher_id?.trim() ?? '';
  const adsenseEnabled = Boolean(siteConfig.monetization.adsense_enabled && adsenseClient);
  const ga4Id = (
    process.env.NEXT_PUBLIC_GA4_ID ||
    siteConfig.monetization.ga4_measurement_id ||
    ''
  ).trim();

  const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
  const basePath =
    rawBasePath && rawBasePath !== '/'
      ? rawBasePath.startsWith('/')
        ? rawBasePath
        : `/${rawBasePath}`
      : '';

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={`${basePath}/favicon.svg`} type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {adsenseEnabled && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`}
            crossOrigin="anonymous"
          />
        )}
        {ga4Id && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga4Id)},{anonymize_ip:true});`,
              }}
            />
          </>
        )}
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
