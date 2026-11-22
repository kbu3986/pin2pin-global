import type { Metadata } from 'next';
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { getSiteConfig } from '@/lib/data-loader';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

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
    <html lang="en" className={`${ibmPlexSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
