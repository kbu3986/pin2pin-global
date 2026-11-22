import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { getBomIndexParts, getSiteConfig } from '@/lib/data-loader';
import { BomCheckerClient } from '@/components/tools/BomCheckerClient';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbJsonLd, buildSoftwareAppJsonLd } from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: 'Zero-Upload Client-Side BOM CSV Alternative & EOL Risk Checker',
  description:
    'Audit KiCad, Altium, PADS, and EasyEDA BOM CSV files 100% locally in your browser with zero server upload. Detect EOL/NRND parts, ESR and pinout traps, and candidate drop-in replacements.',
  alternates: {
    canonical: `${siteConfig.site_url}/en/tools/bom-checker/`,
  },
};

export default function BomCheckerPage() {
  const bomParts = getBomIndexParts();
  const proWaitlistUrl =
    siteConfig.monetization.bom_pro_waitlist_url || siteConfig.error_report_issue_url;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Zero-Upload BOM Checker', path: '/en/tools/bom-checker' },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/bom-checker',
      name: 'Pin2Pin Zero-Upload Client-Side BOM CSV Alternative & EOL Risk Checker',
      description:
        'Browser-local semiconductor BOM CSV auditing tool that detects EOL/NRND lifecycle alerts, pinout reversals, ceramic-cap ESR traps, and datasheet-verified candidate alternatives without uploading files to any server.',
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">Zero-Upload BOM Checker</span>
      </nav>

      <header className="space-y-2 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase">
          <span className="text-emerald-700">Engineering Tool 04 · BOM Risk Audit</span>
          <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-900 normal-case">
            <Lock className="h-3 w-3" aria-hidden="true" />
            100% Client-Side • Zero-Upload Privacy
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Zero-Upload Client-Side BOM CSV Alternative &amp; EOL Risk Checker
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Drop your KiCad, Altium, PADS, or EasyEDA BOM CSV directly into browser memory to flag
          EOL/NRND lifecycle hazards, reversed-pinout SOT-23 traps, non-MLCC ESR stability risks,
          and ranked candidate drop-in replacements — with zero server upload.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <BomCheckerClient
        parts={bomParts}
        siteUrl={siteConfig.site_url}
        disclaimerShort={siteConfig.legal.engineering_disclaimer_short}
        proWaitlistUrl={proWaitlistUrl}
      />

      {/* Engineering Privacy Guarantee & Cross-Links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            How Zero-Upload BOM Auditing Protects Your IP
          </h2>
          <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed list-disc pl-4">
            <li>
              <strong>100% Browser Memory Execution:</strong> Your CSV is read locally via the
              browser <code className="font-mono text-slate-900">FileReader</code> API against a
              pre-built static OPN index. No BOM text ever leaves your workstation.
            </li>
            <li>
              <strong>Strict OPN-Level Isolation (AUD-02):</strong> Exact and normalized OPN
              matches link directly to verified package pinouts; family prefix hits are explicitly
              flagged for package suffix confirmation before substitution.
            </li>
            <li>
              <strong>Compliance-Ready Export (AUD-04):</strong> Downloaded audited CSV reports
              embed the mandatory engineering verification disclaimer in Row 1 for design reviews.
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Related Tools &amp; Field Guides</h2>
          <ul className="space-y-2 text-xs">
            <li>
              <Link
                href="/en/catalog"
                className="font-semibold text-sky-700 hover:underline"
              >
                Browse Full Parametric OPN Catalog →
              </Link>
            </li>
            <li>
              <Link
                href="/en/tools/ldo-thermal-calculator"
                className="font-semibold text-sky-700 hover:underline"
              >
                LDO Thermal &amp; Tj Margin Calculator →
              </Link>
            </li>
            <li>
              <Link
                href="/en/tools/dcdc-efficiency-ripple-calculator"
                className="font-semibold text-sky-700 hover:underline"
              >
                DC-DC Efficiency, Ripple &amp; Ipeak Calculator →
              </Link>
            </li>
            <li>
              <Link
                href="/en/tools/opamp-gbwp-slewrate-checker"
                className="font-semibold text-sky-700 hover:underline"
              >
                Op-Amp GBWP &amp; Slew Rate Distortion Checker →
              </Link>
            </li>
            <li>
              <Link
                href="/en/guides/sot23-3-ldo-pinout-traps"
                className="font-semibold text-sky-700 hover:underline"
              >
                Read Guide: SOT-23-3 LDO Pinout Traps →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <LabGearAffiliate siteConfig={siteConfig} category="ldo" />
    </div>
  );
}
