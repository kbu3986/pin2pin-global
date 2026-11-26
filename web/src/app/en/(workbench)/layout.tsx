import '../../globals.css';
import { getAllGuides, getCommandSearchItems, getSiteConfig } from '@/lib/data-loader';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CommandPalette } from '@/components/CommandPalette';

export default function WorkbenchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = getSiteConfig();
  const guides = getAllGuides();
  const searchItems = getCommandSearchItems();

  return (
    <div className="workbench-shell min-h-screen flex flex-col bg-[#f7f7f5] text-[#0f0f0f]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[4px] focus:bg-[#0f0f0f] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#dafa9c] focus:shadow-lg"
      >
        Skip to main content
      </a>

      <SiteHeader siteConfig={siteConfig} />
      <CommandPalette items={searchItems} />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8 focus-visible:outline-2 focus-visible:outline-[#0f0f0f]"
      >
        {children}
      </main>

      <SiteFooter siteConfig={siteConfig} guides={guides} />
    </div>
  );
}
