'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
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
    <header className="site-header print:hidden sticky top-0 z-40 border-b border-white/12 bg-[#0f0f0f] text-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[56px] sm:h-[72px] items-center justify-between gap-4">
          {/* Brand */}
          <Link
            href="/en/"
            className="inline-flex items-center gap-2.5 group min-w-0 shrink-0"
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[#dafa9c] text-[#0f0f0f] font-semibold text-sm leading-none"
              aria-hidden="true"
            >
              P
            </span>
            <span className="text-[18px] font-medium tracking-[-0.02em] text-white group-hover:text-[#dafa9c] transition-colors whitespace-nowrap">
              {siteConfig.site_name}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-1 text-[14px] font-medium"
          >
            <Link
              href="/en/catalog/"
              className="rounded-[4px] px-3 py-1.5 text-white/85 hover:bg-white/6 hover:text-white transition-colors"
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
                className="inline-flex items-center gap-1 rounded-[4px] px-3 py-1.5 text-white/85 hover:bg-white/6 hover:text-white transition-colors cursor-pointer"
              >
                Tools
                <ChevronDown
                  className={`h-3.5 w-3.5 text-[#8f8f8f] transition-transform ${
                    toolsOpen ? 'rotate-180 text-white' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              {toolsOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-84 rounded-[6px] border border-white/12 bg-[#141414] p-2 shadow-2xl"
                >
                  <Link
                    href={TOOLS_HUB_HREF}
                    role="menuitem"
                    onClick={() => setToolsOpen(false)}
                    className="block rounded-[4px] border border-white/12 bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-[#dafa9c] hover:border-[#dafa9c]/40 hover:text-white mb-1.5 transition-colors"
                  >
                    All {SITE_TOOLS.length} Engineering Tools →
                  </Link>
                  <div className="space-y-0.5">
                    {SITE_TOOLS.map((tool) => (
                      <Link
                        key={tool.slug}
                        href={tool.href}
                        role="menuitem"
                        onClick={() => setToolsOpen(false)}
                        className="block rounded-[4px] px-3 py-2 hover:bg-[#1f1f1f] transition-colors"
                      >
                        <div className="text-xs font-medium text-white">{tool.label}</div>
                        <div className="text-[11px] text-[#8f8f8f] line-clamp-1">
                          {tool.description}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/en/compare/"
              className="rounded-[4px] px-3 py-1.5 text-white/85 hover:bg-white/6 hover:text-white transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/en/packages/"
              className="rounded-[4px] px-3 py-1.5 text-white/85 hover:bg-white/6 hover:text-white transition-colors"
            >
              Packages
            </Link>
            <Link
              href={GUIDES_HUB_HREF}
              className="rounded-[4px] px-3 py-1.5 text-white/85 hover:bg-white/6 hover:text-white transition-colors"
            >
              Guides
            </Link>
            <Link
              href="/en/methodology/"
              className="rounded-[4px] px-3 py-1.5 text-white/85 hover:bg-white/6 hover:text-white transition-colors"
            >
              Methodology
            </Link>
          </nav>

          {/* Right Controls: Search (Ctrl K) + Primary Pill CTA + Mobile Hamburger */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Open global search (Ctrl+K)"
              className="inline-flex items-center gap-2 rounded-[4px] border border-white/15 bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-white/85 hover:border-white/30 hover:text-white transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-[#dafa9c]" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline rounded-[3px] border border-white/15 bg-[#0f0f0f] px-1.5 py-0.5 font-mono text-[11px] text-[#8f8f8f]">
                Ctrl K
              </kbd>
            </button>

            <Link
              href="/en/tools/bom-checker/"
              className="hidden sm:inline-flex items-center justify-center rounded-full bg-[#dafa9c] px-4 py-2 text-[13px] font-medium text-[#0f0f0f] hover:bg-[#e7fdbc] transition-colors whitespace-nowrap"
            >
              Check BOM
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-[4px] border border-white/15 bg-[#1a1a1a] text-white hover:border-white/30 cursor-pointer"
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
          className="lg:hidden border-t border-white/12 bg-[#0f0f0f] px-4 py-4 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <Link
            href="/en/tools/bom-checker/"
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center justify-center rounded-full bg-[#dafa9c] px-4 py-2.5 text-sm font-medium text-[#0f0f0f] hover:bg-[#e7fdbc] transition-colors"
          >
            Check BOM
          </Link>

          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <Link
              href="/en/catalog/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-white/12 bg-[#1a1a1a] px-3 py-2.5 text-white hover:border-[#dafa9c]/50"
            >
              Catalog
            </Link>
            <Link
              href="/en/compare/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-white/12 bg-[#1a1a1a] px-3 py-2.5 text-white hover:border-[#dafa9c]/50"
            >
              Compare
            </Link>
            <Link
              href="/en/packages/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-white/12 bg-[#1a1a1a] px-3 py-2.5 text-white hover:border-[#dafa9c]/50"
            >
              Packages
            </Link>
            <Link
              href="/en/vs/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-white/12 bg-[#1a1a1a] px-3 py-2.5 text-white hover:border-[#dafa9c]/50"
            >
              1:1 Diffs
            </Link>
            <Link
              href={GUIDES_HUB_HREF}
              onClick={() => setMobileOpen(false)}
              className="col-span-2 rounded-[4px] border border-white/12 bg-[#1a1a1a] px-3 py-2.5 text-white hover:border-[#dafa9c]/50"
            >
              Guides
            </Link>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#8f8f8f]">
                Engineering Tools ({SITE_TOOLS.length})
              </span>
              <Link
                href={TOOLS_HUB_HREF}
                onClick={() => setMobileOpen(false)}
                className="text-xs font-medium text-[#dafa9c] hover:underline"
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
                  className="rounded-[4px] bg-[#1a1a1a] border border-white/10 px-3 py-2 text-xs font-medium text-white/90 hover:border-white/25"
                >
                  {tool.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-white/12 pt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href="/en/methodology/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-white/15 px-3 py-1.5 text-white/85 hover:text-white"
            >
              Methodology
            </Link>
            <Link
              href="/en/about/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-white/15 px-3 py-1.5 text-white/85 hover:text-white"
            >
              About
            </Link>
            <Link
              href="/en/contact/"
              onClick={() => setMobileOpen(false)}
              className="rounded-[4px] border border-[#dafa9c]/40 bg-[#dafa9c]/10 px-3 py-1.5 font-medium text-[#dafa9c]"
            >
              Report Error
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
