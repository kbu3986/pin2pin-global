import { getSiteConfig } from '@/lib/data-loader';

export default function EnLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = getSiteConfig();
  const adsenseEnabled =
    siteConfig.monetization.adsense_enabled &&
    Boolean(siteConfig.monetization.adsense_publisher_id);

  return (
    <>
      {adsenseEnabled && (
        <script
          async
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(siteConfig.monetization.adsense_publisher_id)}`}
        />
      )}
      {children}
    </>
  );
}
