'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Cpu, Menu, Search, X } from 'lucide-react';
import type { SiteConfig } from '@/types/schema';
import { GUIDES_HUB_HREF, SITE_TOOLS, TOOLS_HUB_HREF } from '@/lib/format';
import { openCommandPalette } from '@/components/CommandPalette';

export function SiteHeader({ siteConfig }: { siteConfig: SiteConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToolsOpen(false);
        setMobileOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  return (
    <header className="site-header print:hidden sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2 sm:gap-4">
          {/* Brand */}
          <Link href="/en/" className="flex items-center gap-2 group min-w-0 shrink-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
              <Cpu className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors truncate">
                  {siteConfig.site_name}
                </span>
                <span className="hidden xs:inline-block sm:inline-block rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 shrink-0">
                  v2.0
                </span>
              </div>
              <span className="hidden lg:block text-[11px] text-slate-300">
                OPN-Exact Pinout &amp; Cross-Reference Workbench
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-1 text-xs lg:text-sm font-medium"
          >
            <Link
              href="/en/catalog/"
              className="rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Catalog
            </Link>

            {/* Tools Dropdown */}
            <div ref={toolsMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                Tools
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              </button>
              {toolsOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-1.5 w-80 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl"
                >
                  <Link
                    href={TOOLS_HUB_HREF}
                    role="menuitem"
                    onClick={() => setToolsOpen(false)}
                    className="block rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-slate-800 hover:text-white mb-1.5"
                  >
                    All {SITE_TOOLS.length} Engineering Tools Hub →
                  </Link>
                  <div className="space-y-0.5">
                    {SITE_TOOLS.map((tool) => (
                      <Link
                        key={tool.slug}
                        href={tool.href}
                        role="menuitem"
                        onClick={() => setToolsOpen(false)}
                        className="block rounded-md px-3 py-2 hover:bg-slate-800 transition-colors"
                      >
                        <div className="text-xs font-semibold text-white">{tool.label}</div>
                        <div className="text-[11px] text-slate-300 line-clamp-1">
                          {tool.description}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/en/tools/bom-checker/"
              className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-emerald-200 font-semibold hover:bg-emerald-500/25 hover:text-white transition-colors"
            >
              BOM Checker
            </Link>
            <Link
              href="/en/compare/"
              className="rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/en/packages/"
              className="rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Packages
            </Link>
            <Link
              href={GUIDES_HUB_HREF}
              className="rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Guides
            </Link>
            <Link
              href="/en/methodology/"
              className="hidden xl:inline-flex rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Methodology
            </Link>
          </nav>

          {/* Right Controls: Search (Ctrl+K) + Mobile Hamburger */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Open global search (Ctrl+K)"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline rounded bg-slate-900 border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 p-1.5 text-slate-100 hover:bg-slate-700 cursor-pointer"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav-drawer"
          className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <Link
              href="/en/catalog/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 hover:border-emerald-400"
            >
              Parametric Catalog
            </Link>
            <Link
              href="/en/compare/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 hover:border-emerald-400"
            >
              2-OPN Comparator
            </Link>
            <Link
              href="/en/packages/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 hover:border-emerald-400"
            >
              Package Trap Matrix
            </Link>
            <Link
              href="/en/vs/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 hover:border-emerald-400"
            >
              1:1 Diff Directory
            </Link>
            <Link
              href={GUIDES_HUB_HREF}
              onClick={() => setMobileOpen(false)}
              className="col-span-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 hover:border-emerald-400"
            >
              Engineering Guides
            </Link>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Engineering Tools ({SITE_TOOLS.length})
              </span>
              <Link
                href={TOOLS_HUB_HREF}
                onClick={() => setMobileOpen(false)}
                className="text-xs font-semibold text-emerald-300 hover:underline"
              >
                Tools Hub →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {SITE_TOOLS.map((tool) => (
                <Link
                  key={tool.slug}
                  href={tool.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:border-slate-600"
                >
                  {tool.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href="/en/methodology/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:text-white"
            >
              Methodology
            </Link>
            <Link
              href="/en/about/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:text-white"
            >
              About
            </Link>
            <Link
              href="/en/contact/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-200"
            >
              Report Error
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
