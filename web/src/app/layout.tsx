import type { Metadata } from 'next';
import './globals.css';
import { getSiteConfig } from '@/lib/data-loader';
import { ogImageUrl } from '@/lib/format';

const siteConfig = getSiteConfig();
const defaultTitle = `${siteConfig.site_name} — ${siteConfig.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.site_url),
  title: {
    default: defaultTitle,
    template: `%s | ${siteConfig.site_name}`,
  },
  description: siteConfig.tagline,
  openGraph: {
    type: 'website',
    siteName: siteConfig.site_name,
    locale: 'en_US',
    url: `${siteConfig.site_url}/en/`,
    title: defaultTitle,
    description: siteConfig.tagline,
    images: [
      {
        url: ogImageUrl(siteConfig.site_url),
        width: 1200,
        height: 630,
        alt: siteConfig.site_name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: siteConfig.tagline,
    images: [ogImageUrl(siteConfig.site_url)],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <link rel="icon" href={`${basePath}/favicon.ico`} sizes="32x32 48x48" />
        <link rel="icon" href={`${basePath}/favicon.svg`} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={`${basePath}/apple-touch-icon.png`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* AdSense Auto Ads is intentionally NOT loaded here: it lives in app/en/layout.tsx so that
            404.html and the root redirect index.html (thin / no-content pages) never serve ads. */}
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
