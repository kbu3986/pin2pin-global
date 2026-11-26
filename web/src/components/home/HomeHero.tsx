import Link from 'next/link';

interface HomeHeroProps {
  partCount: number;
  vsCount: number;
  toolCount: number;
}

export function HomeHero({ partCount, vsCount, toolCount }: HomeHeroProps) {
  return (
    <section className="hero hero--triptych" data-enter aria-labelledby="hero-h">
      <div className="wrap">
        <div className="hero-text grid hero__grid">
          <div className="span-3">
            <h1 id="hero-h">Pinout database for PCB teams</h1>
            <p className="hero__lead">
              {partCount} verified OPNs, {vsCount} pin-diffs, and {toolCount} browser tools from
              official PDFs.
            </p>
          </div>

          <div
            className="ly-collage span-6 start-4"
            role="img"
            aria-label="Three Pin2Pin Global views: an SOT-223-3 pinout conflict check, a local BOM CSV audit, and verified thermal bounds."
          >
            {/* Set 1: SOT-223-3 Pinout Trap (AMS1117-3.3 vs AP7361C-33E-13) */}
            <div className="ly-collage__set is-on">
              <div className="ly-piece pc-card" style={{ left: '4%', top: '4%', width: '53%' }}>
                <span className="pc-kicker">SOT-223-3 AUDIT</span>
                <strong className="pc-title">AMS1117-3.3 vs AP7361C</strong>
                <div className="pc-row">
                  <span className="pc-mono">Pin 1 · GND/IN</span>
                  <span className="pc-badge pc-badge--bad">Conflict</span>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span className="pc-mono">Pin 2 · VOUT/GND</span>
                  <span className="pc-badge pc-badge--bad">Conflict</span>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span className="pc-mono">Pin 3 · VIN/OUT</span>
                  <span className="pc-badge pc-badge--bad">Conflict</span>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span className="pc-mono">Tab · VOUT/GND</span>
                  <span className="pc-badge pc-badge--bad">Short</span>
                </div>
              </div>

              <div
                className="ly-piece pc-card pc-card--lime"
                style={{ left: '60%', top: '6%', width: '36%' }}
              >
                <span className="pc-kicker">LEVEL 3</span>
                <strong className="pc-title">Layout swap</strong>
                <div className="pc-row">
                  <span>Match</span>
                  <b className="pc-mono">0 / 3</b>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span>PDF</span>
                  <b className="pc-mono">p.1 · p.15</b>
                </div>
              </div>

              <div
                className="ly-piece pc-schem"
                style={{ left: '4%', top: '52%', width: '92%', height: '44%' }}
              >
                <span className="pc-kicker">TOP VIEW · 300 DPI VISION VERIFIED</span>
                <svg viewBox="0 0 460 132" aria-hidden="true">
                  {/* Left IC: AMS1117-3.3 */}
                  <text x="16" y="16" fill="#dafa9c" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    AMS1117-3.3 (p.1)
                  </text>
                  <rect x="48" y="24" width="64" height="14" rx="2" fill="#dc2626" opacity="0.88" />
                  <text x="80" y="34" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                    TAB: VOUT
                  </text>
                  <rect x="26" y="38" width="108" height="46" rx="3" fill="#262626" stroke="#737373" strokeWidth="1.2" />
                  <circle cx="38" cy="72" r="3" fill="#dafa9c" />
                  <rect x="40" y="84" width="14" height="18" fill="#a3a3a3" />
                  <rect x="73" y="84" width="14" height="18" fill="#a3a3a3" />
                  <rect x="106" y="84" width="14" height="18" fill="#a3a3a3" />
                  <text x="47" y="116" textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="JetBrains Mono, monospace">1:GND</text>
                  <text x="80" y="116" textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="JetBrains Mono, monospace">2:OUT</text>
                  <text x="113" y="116" textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="JetBrains Mono, monospace">3:VIN</text>

                  {/* Conflict cross indicators */}
                  <line x1="150" y1="54" x2="250" y2="54" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
                  <line x1="150" y1="74" x2="250" y2="74" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
                  <rect x="172" y="47" width="56" height="32" rx="3" fill="#2b1212" stroke="#ef4444" strokeWidth="1" />
                  <text x="200" y="61" textAnchor="middle" fill="#fecaca" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    3 PINS
                  </text>
                  <text x="200" y="73" textAnchor="middle" fill="#fca5a5" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    SWAPPED
                  </text>

                  {/* Right IC: AP7361C-33E-13 */}
                  <text x="266" y="16" fill="#ffffff" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    AP7361C-33E-13 (p.1)
                  </text>
                  <rect x="298" y="24" width="64" height="14" rx="2" fill="#dc2626" opacity="0.88" />
                  <text x="330" y="34" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                    TAB: GND
                  </text>
                  <rect x="276" y="38" width="108" height="46" rx="3" fill="#262626" stroke="#737373" strokeWidth="1.2" />
                  <circle cx="288" cy="72" r="3" fill="#ffffff" />
                  <rect x="290" y="84" width="14" height="18" fill="#a3a3a3" />
                  <rect x="323" y="84" width="14" height="18" fill="#a3a3a3" />
                  <rect x="356" y="84" width="14" height="18" fill="#a3a3a3" />
                  <text x="297" y="116" textAnchor="middle" fill="#fecaca" fontSize="10" fontFamily="JetBrains Mono, monospace">1:IN</text>
                  <text x="330" y="116" textAnchor="middle" fill="#fecaca" fontSize="10" fontFamily="JetBrains Mono, monospace">2:GND</text>
                  <text x="363" y="116" textAnchor="middle" fill="#fecaca" fontSize="10" fontFamily="JetBrains Mono, monospace">3:OUT</text>
                </svg>
              </div>
            </div>

            {/* Set 2: Zero-Upload BOM Audit */}
            <div className="ly-collage__set" aria-hidden="true">
              <div
                className="ly-piece pc-card pc-card--dark"
                style={{ left: '4%', top: '4%', width: '54%' }}
              >
                <span className="pc-kicker">LOCAL BOM PARSER</span>
                <strong className="pc-title">power_rev3.csv</strong>
                <div className="pc-row">
                  <span>Upload</span>
                  <span className="pc-badge pc-badge--ok">0 bytes</span>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span>CAD</span>
                  <b className="pc-mono">KiCad · Altium</b>
                </div>
              </div>

              <div
                className="ly-piece pc-card pc-card--sage"
                style={{ left: '61%', top: '6%', width: '35%' }}
              >
                <span className="pc-kicker">AUDIT</span>
                <strong className="pc-title">4 OPNs</strong>
                <div className="pc-row">
                  <span>Alerts</span>
                  <b className="pc-mono">1 EOL</b>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span>Drop-ins</span>
                  <b className="pc-mono">2 verified</b>
                </div>
              </div>

              <div
                className="ly-piece pc-card pc-anchor"
                style={{ left: '4%', top: '48%', width: '92%', height: '48%' }}
              >
                <span className="pc-kicker">LOCAL BOM RISK REGISTER</span>
                <div className="pc-row">
                  <span className="pc-mono">CAT6219-330TD-GT3 · TSOT-23-5</span>
                  <span className="pc-badge pc-badge--bad">EOL</span>
                </div>
                <div className="pc-row">
                  <span className="pc-mono">AP2204K-3.3TRG1 · SOT-23-5</span>
                  <span className="pc-badge pc-badge--warn">NRND</span>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span className="pc-mono">AMS1117-3.3 · SOT-223-3</span>
                  <span className="pc-badge pc-badge--warn">22 uF Ta</span>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span className="pc-mono">TPS54302DDCR · SOT-23-6</span>
                  <span className="pc-badge pc-badge--ok">Active</span>
                </div>
              </div>
            </div>

            {/* Set 3: Thermal & Electrical Limits */}
            <div className="ly-collage__set" aria-hidden="true">
              <div className="ly-piece pc-card" style={{ left: '4%', top: '4%', width: '50%' }}>
                <span className="pc-kicker">LDO THERMAL</span>
                <strong className="pc-title">5.0 V to 3.3 V</strong>
                <div className="pc-row">
                  <span>Loss</span>
                  <b className="pc-mono">255 mW</b>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span>Temp rise</span>
                  <b className="pc-mono">+22.9 C</b>
                </div>
              </div>

              <div
                className="ly-piece pc-card pc-card--lime"
                style={{ left: '57%', top: '8%', width: '39%' }}
              >
                <span className="pc-kicker">MLCC ESR</span>
                <strong className="pc-title">Stability</strong>
                <div className="pc-row">
                  <span>AP7361C</span>
                  <b className="pc-mono">0-10 Ohm</b>
                </div>
                <div className="pc-row pc-hide-sm">
                  <span>AMS1117</span>
                  <b className="pc-mono">Tantalum</b>
                </div>
              </div>

              <div
                className="ly-piece pc-card pc-card--dark pc-anchor"
                style={{ left: '4%', top: '48%', width: '92%', height: '48%' }}
              >
                <span className="pc-kicker">DATASHEET BOUNDS · PAGE-CITED</span>
                <div className="pc-row">
                  <span className="pc-mono">AMS1117-3.3 · 90 C/W · Tj 125 C</span>
                  <span className="pc-mono">p.2</span>
                </div>
                <div className="pc-bar pc-bar--warn">
                  <i style={{ width: '74%' }} />
                </div>
                <div className="pc-row">
                  <span className="pc-mono">AP7361C-33E-13 · 110 C/W · 340 mV</span>
                  <span className="pc-mono">p.5</span>
                </div>
                <div className="pc-bar pc-hide-sm">
                  <i style={{ width: '58%' }} />
                </div>
                <div className="pc-row pc-hide-sm">
                  <span className="pc-mono">TPS54302DDCR · 400 kHz · 28 V · 3 A</span>
                  <span className="pc-mono">p.4</span>
                </div>
              </div>
            </div>
          </div>

          <div className="span-3 start-10 hero__cta">
            <Link className="btn btn--primary" href="/en/tools/bom-checker/" prefetch={false}>
              Check BOM
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
