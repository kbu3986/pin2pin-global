import Link from 'next/link';
import type { SiteConfig } from '@/types/schema';

interface HomeFooterProps {
  siteConfig: SiteConfig;
  partCount: number;
  vsCount: number;
}

export function HomeFooter({ siteConfig, partCount, vsCount }: HomeFooterProps) {
  return (
    <footer className="footer closing" id="contact" aria-labelledby="close-h">
      <div className="wrap">
        <div className="closing__cta close--word">
          <div className="section-head section-head--split">
            <div>
              <h2 id="close-h">Check your BOM pinouts before layout</h2>
              <p className="t-lead muted">
                {partCount} OPNs and {vsCount} pin-diffs audited locally in your browser.
              </p>
            </div>
            <Link className="btn btn--primary" href="/en/tools/bom-checker/" prefetch={false}>
              Check BOM
            </Link>
          </div>
          <p className="close__word" aria-hidden="true">
            Pin2Pin Global
          </p>
        </div>

        <div className="closing__links">
          <div className="grid">
            <div className="span-4 stack-4">
              <a className="nav__logo" href="#top">
                <span className="mark mark--initial" aria-hidden="true">
                  P
                </span>
                Pin2Pin Global
              </a>
              <p className="footer__lede">OPN-exact pinouts from official PDFs.</p>
            </div>

            <div className="span-2 footer__col">
              <h3>Database</h3>
              <ul>
                <li>
                  <Link href="/en/catalog/" prefetch={false}>Parametric Catalog</Link>
                </li>
                <li>
                  <Link href="/en/packages/" prefetch={false}>Package Directory</Link>
                </li>
                <li>
                  <Link href="/en/vs/" prefetch={false}>1:1 Pin-Diffs</Link>
                </li>
                <li>
                  <Link href="/en/compare/" prefetch={false}>Compare Hub</Link>
                </li>
              </ul>
            </div>

            <div className="span-2 footer__col">
              <h3>Tools</h3>
              <ul>
                <li>
                  <Link href="/en/tools/bom-checker/" prefetch={false}>BOM Checker</Link>
                </li>
                <li>
                  <Link href="/en/tools/compare/" prefetch={false}>Live Compare</Link>
                </li>
                <li>
                  <Link href="/en/tools/pinout-finder/" prefetch={false}>Pinout Finder</Link>
                </li>
                <li>
                  <Link href="/en/tools/" prefetch={false}>All 7 Tools</Link>
                </li>
              </ul>
            </div>

            <div className="span-2 footer__col">
              <h3>Guides</h3>
              <ul>
                <li>
                  <Link href="/en/guides/" prefetch={false}>Field Guides</Link>
                </li>
                <li>
                  <Link href="/en/guides/sot23-5-pinout-chaos-guide/" prefetch={false}>SOT-23-5 Pinout Guide</Link>
                </li>
                <li>
                  <Link href="/en/guides/ceramic-capacitor-esr-ldo-oscillation/" prefetch={false}>MLCC ESR Stability</Link>
                </li>
                <li>
                  <Link href="/en/methodology/" prefetch={false}>Audit Methodology</Link>
                </li>
              </ul>
            </div>

            <div className="span-2 footer__col">
              <h3>Verification</h3>
              <ul>
                <li>
                  <Link href="/en/about/" prefetch={false}>About Pin2Pin</Link>
                </li>
                <li>
                  <Link href="/en/disclaimer/" prefetch={false}>Disclaimer</Link>
                </li>
                <li>
                  <Link href="/en/privacy/" prefetch={false}>Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/en/contact/" prefetch={false}>Report Errata</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer__legal">
            <span>&copy; 2026 Pin2Pin Global</span>
            <span className="footer__legal-links">
              <Link href="/en/privacy/" prefetch={false}>Privacy</Link>
              <Link href="/en/disclaimer/" prefetch={false}>Disclaimer</Link>
              <Link href="/en/about/" prefetch={false}>About</Link>
              <Link href="/en/contact/" prefetch={false}>Contact</Link>
            </span>
            <p className="footer__disclaimer">
              {siteConfig.legal.engineering_disclaimer_short} {siteConfig.legal.trademark_notice}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
