import { getAllGuides, getSiteConfig } from '@/lib/data-loader';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export default function EnLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = getSiteConfig();
  const guides = getAllGuides();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader siteConfig={siteConfig} />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <SiteFooter siteConfig={siteConfig} guides={guides} />
    </div>
  );
}
