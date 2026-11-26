import { getAllParts, getAllVsComparisons, getSiteConfig } from '@/lib/data-loader';
import { HOME_PAGE_CSS } from '@/components/home/home-styles';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeFooter } from '@/components/home/HomeFooter';
import { HomeKitLoader } from '@/components/home/HomeKitLoader';

function resolveBasePath(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
  if (!raw || raw === '/') return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export default function EnHomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const basePath = resolveBasePath();
  const siteConfig = getSiteConfig();
  const parts = getAllParts();
  const vsList = getAllVsComparisons();

  const stylesheets = [
    `${basePath}/assets/system.css`,
    `${basePath}/assets/ui/cards.css`,
    `${basePath}/assets/motion/motion.css`,
    `${basePath}/assets/backgrounds/backgrounds.css`,
    `${basePath}/assets/layout/layout.css`,
    `${basePath}/assets/icons/icon.css`,
    `${basePath}/assets/ui/base.css`,
    `${basePath}/assets/ui/window/fragment.css`,
    `${basePath}/assets/ui/diff-review/fragment.css`,
    `${basePath}/assets/ui/terminal-run/fragment.css`,
    `${basePath}/assets/ui/search/fragment.css`,
    `${basePath}/assets/ui/toggles/fragment.css`,
    `${basePath}/assets/diagrams/diagram.css`,
    `${basePath}/assets/moments/iris-opens/moment.css`,
  ];

  const modulePreloads = [
    `${basePath}/assets/moments/moments.js`,
    `${basePath}/assets/moments/lib.js`,
    `${basePath}/assets/moments/iris-opens/moment.js`,
    `${basePath}/assets/system.js`,
    `${basePath}/assets/motion/motion.js`,
    `${basePath}/assets/layout/layout.js`,
    `${basePath}/assets/diagrams/mount.js`,
  ];

  return (
    <>
      {stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="tasteskill-kit" />
      ))}
      <style href="pin2pin-home-styles" precedence="tasteskill-page">
        {HOME_PAGE_CSS}
      </style>
      {modulePreloads.map((href) => (
        <link key={href} rel="modulepreload" href={href} />
      ))}

      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)",
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)",
        }}
      />
      <script src={`${basePath}/assets/backgrounds/backgrounds.js`} />

      <HomeHeader />
      <main id="top">{children}</main>
      <HomeFooter
        siteConfig={siteConfig}
        partCount={parts.length}
        vsCount={vsList.length}
      />
      <HomeKitLoader basePath={basePath} />
    </>
  );
}
