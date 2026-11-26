import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getSiteConfig } from '@/lib/data-loader';

const siteConfig = getSiteConfig();
const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
const basePath =
  rawBasePath && rawBasePath !== '/'
    ? rawBasePath.startsWith('/')
      ? rawBasePath
      : `/${rawBasePath}`
    : '';
const redirectTarget = `${basePath}/en/`;

export const metadata: Metadata = {
  title: {
    absolute: `${siteConfig.site_name} — Redirecting to English Workbench`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function RootRedirectPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white font-sans p-6">
      <noscript>
        <p className="text-xs text-white/80">
          JavaScript is disabled.{' '}
          <a href={redirectTarget} className="underline text-[#dafa9c]">
            Continue to {siteConfig.site_name} (/en/)
          </a>
        </p>
      </noscript>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(redirectTarget)});`,
        }}
      />
      <div className="max-w-md rounded-[8px] border border-white/12 bg-[#1a1a1a] p-7 text-center space-y-4">
        <div className="inline-flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] bg-white text-[#0f0f0f] font-semibold text-xs leading-none"
            aria-hidden="true"
          >
            P
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-[#dafa9c]">
            {siteConfig.site_name}
          </span>
        </div>
        <h1 className="text-xl font-medium tracking-[-0.02em] text-white">
          Redirecting to /en/ Workbench…
        </h1>
        <p className="text-xs text-[#8f8f8f] leading-relaxed">
          If your browser does not redirect automatically, continue to the English datasheet
          cross-reference hub.
        </p>
        <Link
          href="/en/"
          className="inline-flex items-center justify-center rounded-full bg-[#dafa9c] px-5 py-2.5 text-xs font-medium text-[#0f0f0f] hover:bg-[#e7fdbc] transition-colors"
        >
          Open {siteConfig.site_name} (/en/)
        </Link>
      </div>
    </main>
  );
}
