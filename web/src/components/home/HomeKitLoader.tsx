'use client';

import { useEffect } from 'react';

interface TasteBackgroundsApi {
  detect?: () => void;
}

declare global {
  interface Window {
    tasteBackgrounds?: TasteBackgroundsApi;
    __pin2pinKitLoaded?: boolean;
  }
}

export function HomeKitLoader({ basePath }: { basePath: string }) {
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        window.tasteBackgrounds?.detect?.();

        const p = basePath || '';
        const importKit = (url: string) =>
          import(/* webpackIgnore: true */ url) as Promise<{
            default?: { init?: () => void; auto?: (root: Document) => void };
            init?: () => void;
          }>;

        const alreadyLoaded = Boolean(window.__pin2pinKitLoaded);
        window.__pin2pinKitLoaded = true;

        const sysMod = await importKit(`${p}/assets/system.js`);
        if (cancelled) return;
        if (alreadyLoaded) sysMod.default?.init?.();

        const motMod = await importKit(`${p}/assets/motion/motion.js`);
        if (cancelled) return;
        if (alreadyLoaded) (motMod.init ?? motMod.default?.init)?.();

        const layMod = await importKit(`${p}/assets/layout/layout.js`);
        if (cancelled) return;
        if (alreadyLoaded) layMod.default?.init?.();

        await importKit(`${p}/assets/diagrams/mount.js`);
        if (cancelled) return;
        if (alreadyLoaded) {
          const dgMod = await importKit(`${p}/assets/diagrams/diagram.js`);
          if (!cancelled) dgMod.default?.auto?.(document);
        }
      } catch (err) {
        console.warn('HomeKitLoader:', err);
        document.documentElement.dataset.ready = '1';
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [basePath]);

  return null;
}
