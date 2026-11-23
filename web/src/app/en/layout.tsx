import { getAllGuides, getCommandSearchItems, getSiteConfig } from '@/lib/data-loader';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CommandPalette } from '@/components/CommandPalette';

export default function EnLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = getSiteConfig();
  const guides = getAllGuides();
  const searchItems = getCommandSearchItems();
  const adsenseEnabled =
    siteConfig.monetization.adsense_enabled &&
    Boolean(siteConfig.monetization.adsense_publisher_id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {adsenseEnabled && (
        <script
          async
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(siteConfig.monetization.adsense_publisher_id)}`}
        />
      )}

      <SiteHeader siteConfig={siteConfig} />
      <CommandPalette items={searchItems} />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 focus:outline-none"
      >
        {children}
      </main>
      <SiteFooter siteConfig={siteConfig} guides={guides} />
    </div>
  );
}
