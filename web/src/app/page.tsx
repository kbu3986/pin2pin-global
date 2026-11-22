import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteConfig } from '@/lib/data-loader';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: `${siteConfig.site_name} — Redirecting to English Workbench`,
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: `${siteConfig.site_url}/en`,
  },
};

export default function RootRedirectPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <meta httpEquiv="refresh" content="0;url=/en" />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace('/en');`,
        }}
      />
      <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest text-emerald-400">
          {siteConfig.site_name}
        </p>
        <h1 className="text-lg font-bold text-white">Redirecting to /en Workbench…</h1>
        <p className="text-xs text-slate-400">
          If your browser does not redirect automatically, continue to the English datasheet cross-reference hub.
        </p>
        <Link
          href="/en"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Open Pin2Pin Global (/en)
        </Link>
      </div>
    </main>
  );
}
