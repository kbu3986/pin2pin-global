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
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
