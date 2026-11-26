import Link from 'next/link';
import type { EngineeringGuide } from '@/types/schema';
import { categoryLabel } from '@/lib/format';

interface HomeVerifyAndFaqProps {
  guides: EngineeringGuide[];
  latestVerifiedDate: string;
}

export function HomeVerifyAndFaq({ guides, latestVerifiedDate }: HomeVerifyAndFaqProps) {
  const featuredGuides = guides.slice(0, 6);

  return (
    <>
      {/* Screen 6: Dealt Moment iris-opens on ground-inverse */}
      <section
        className="section ground-inverse"
        id="verify"
        data-moment="iris-opens"
        data-moment-opts='{"from":"base"}'
        aria-labelledby="verify-h"
      >
        <div className="wrap">
          <div className="grid">
            <div className="span-5 split-col">
              <div className="section-head">
                <h2 id="verify-h">
                  Dual-path pinout verification.{' '}
                  <span className="muted">Zero distributor scraping.</span>
                </h2>
                <p>
                  Pinout drawings, absolute maximum ratings, and thermal resistance tables are
                  checked against 300 DPI page renders from official manufacturer PDFs before
                  schema validation.
                </p>
              </div>

              <ul className="rows rows--spec">
                <li>
                  <span className="rows__name">Primary source</span>
                  <span className="rows__value">Official manufacturer PDFs</span>
                </li>
                <li>
                  <span className="rows__name">Package isolation</span>
                  <span className="rows__value">Family 1:N OPN (1:1 map)</span>
                </li>
                <li>
                  <span className="rows__name">Latest PDF audit</span>
                  <span className="rows__value">{latestVerifiedDate}</span>
                </li>
              </ul>

              <div className="split-col__end">
                <Link className="link" href="/en/methodology/" prefetch={false}>
                  Read audit methodology
                </Link>
              </div>
            </div>

            <div className="frame frame--split span-6 start-7 verify-frame">
              <div className="ui ui-panel verify-guides">
                <div className="verify-guides__head">
                  <span>Hardware Field Guides</span>
                  <span>{guides.length} playbooks</span>
                </div>
                <ul className="verify-guides__list">
                  {featuredGuides.map((guide) => (
                    <li key={guide.slug} className="verify-guides__li">
                      <Link
                        href={`/en/guides/${guide.slug}/`}
                        prefetch={false}
                        className="verify-guides__item"
                      >
                        <span className="verify-guides__title">{guide.title}</span>
                        <span className="verify-guides__cat">{categoryLabel(guide.category)}</span>
                        <span className="verify-guides__time">{guide.reading_time_min} min</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="verify-guides__foot">
                  <Link className="link" href="/en/guides/" prefetch={false}>
                    Browse all {guides.length} field guides
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screen 7: Open FAQ (aligned on span-5 / span-6 start-7 split line, zero FAQPage JSON-LD) */}
      <section className="section" id="faq" aria-labelledby="faq-h">
        <div className="wrap">
          <div className="grid">
            <div className="span-5 stack-4">
              <h2 id="faq-h">Pin2Pin database engineering questions</h2>
              <p className="muted">
                BOM security, compatibility levels, and datasheet verification scope.
              </p>
              <Link className="link" href="/en/contact/" prefetch={false}>
                Report datasheet errata
              </Link>

              <div className="ui ui-panel faq-matrix">
                <svg
                  viewBox="0 0 420 228"
                  role="img"
                  aria-label="Compatibility grading matrix: Level 1 drop-in matches package, pins, and thermal tab; Level 2 requires passive or thermal tuning; Level 3 indicates a pin conflict requiring PCB changes; thermal and ESR bounds verify safe margin."
                >
                  <text x="12" y="20" fill="#a3a3a3" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    PIN2PIN COMPATIBILITY GRADING MATRIX
                  </text>
                  <line x1="12" y1="30" x2="408" y2="30" stroke="#2e2e2e" strokeWidth="1" />

                  {/* Level 1 */}
                  <rect x="12" y="42" width="396" height="36" rx="3" fill="#1e2418" stroke="#41522b" strokeWidth="1" />
                  <circle cx="28" cy="60" r="5" fill="#dafa9c" />
                  <text x="42" y="57" fill="#dafa9c" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    LEVEL 1: CANDIDATE DROP-IN
                  </text>
                  <text x="42" y="71" fill="#d4d4d4" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    JEDEC pkg match · All pin roles align · Tab net safe
                  </text>

                  {/* Level 2 */}
                  <rect x="12" y="88" width="396" height="36" rx="3" fill="#262014" stroke="#5c471b" strokeWidth="1" />
                  <circle cx="28" cy="106" r="5" fill="#fbbf24" />
                  <text x="42" y="103" fill="#fcd34d" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    LEVEL 2: TUNING REQUIRED
                  </text>
                  <text x="42" y="117" fill="#d4d4d4" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    Pins align · Check MLCC ESR, Vref divider, or θJA
                  </text>

                  {/* Level 3 */}
                  <rect x="12" y="134" width="396" height="36" rx="3" fill="#291616" stroke="#6b2525" strokeWidth="1" />
                  <circle cx="28" cy="152" r="5" fill="#f87171" />
                  <text x="42" y="149" fill="#fca5a5" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    LEVEL 3: LAYOUT CHANGE
                  </text>
                  <text x="42" y="163" fill="#d4d4d4" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    Same footprint · Swapped VIN/GND/VOUT or thermal tab
                  </text>

                  {/* Thermal & ESR Gate */}
                  <rect x="12" y="180" width="396" height="36" rx="3" fill="#1d1d1d" stroke="#3b3b3b" strokeWidth="1" />
                  <rect x="23" y="193" width="10" height="10" rx="1.5" fill="none" stroke="#dafa9c" strokeWidth="1.4" />
                  <text x="42" y="195" fill="#ffffff" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    PHYSICS GATE: THERMAL &amp; ESR BOUNDS
                  </text>
                  <text x="42" y="209" fill="#b8b8b8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    Vabs &gt;= Vrec · θJA derating · MLCC ESR window cited
                  </text>
                </svg>
              </div>
            </div>

            <div className="span-6 start-7">
              <div className="faq">
                <div className="faq__item">
                  <h3>Does the Pin2Pin BOM checker upload files?</h3>
                  <p>
                    No. CSV parsing, OPN lookup, and alternate matching execute in browser memory
                    with zero server uploads.
                  </p>
                </div>
                <div className="faq__item">
                  <h3>What do Level 1, Level 2, and Level 3 pinout grades mean?</h3>
                  <p>
                    Level 1 matches package and pin roles as a candidate drop-in. Level 2 needs
                    passive or thermal tuning. Level 3 flags pin conflicts requiring PCB changes.
                  </p>
                </div>
                <div className="faq__item">
                  <h3>Which semiconductor families are in the database?</h3>
                  <p>
                    Verified LDO regulators, buck and boost DC-DC converters, op-amps, and
                    comparators from official PDFs. Large 1,000-page MCUs stay out of scope.
                  </p>
                </div>
                <div className="faq__item">
                  <h3>How do I report a pinout or datasheet error?</h3>
                  <p>
                    Submit the official PDF URL, revision, and page number via{' '}
                    <Link href="/en/contact/" prefetch={false}>
                      error reporting
                    </Link>
                    , and review our{' '}
                    <Link href="/en/disclaimer/" prefetch={false}>
                      engineering disclaimer
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
