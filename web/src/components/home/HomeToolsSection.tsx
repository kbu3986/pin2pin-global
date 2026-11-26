import Link from 'next/link';

interface HomeToolsSectionProps {
  basePath: string;
  partCount: number;
}

const ARROW_SVG = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function HomeToolsSection({ basePath, partCount }: HomeToolsSectionProps) {
  const pipelineDiagram = {
    layout: 'lanes',
    curve: 'curve',
    ground: 'none',
    alt: 'Official manufacturer PDFs pass through dual-path extraction into 300 DPI pinout vision, Zod physics bounds checks, and 1:1 OPN package locking before publishing to the verified database.',
    input: { label: 'Official PDFs', meta: '1st-party' },
    core: { label: 'Dual-Path' },
    lanes: [
      { label: 'Pinout Vision', meta: '300 DPI', done: true },
      { label: 'Zod Physics', meta: 'Vabs >= Vrec', done: true },
      { label: 'Package Lock', meta: '1:1 OPN', done: true },
    ],
    output: { label: 'Verified DB', meta: `${partCount} OPNs`, done: true },
  };

  return (
    <section className="section g2" id="tools" aria-labelledby="tools-h">
      <div className="wrap">
        {/* Row 1 (Screen 3) */}
        <div className="group">
          <div className="section-head">
            <h2 id="tools-h">
              7 browser pinout tools.{' '}
              <span className="muted">Zero server uploads.</span>
            </h2>
          </div>

          <div className="grid">
            {/* Card 1: BOM Checker (terminal-run with data-ui-loop) */}
            <article className="card card--row span-6">
              <h3>Audit BOM pinouts locally</h3>
              <p>Audit KiCad, Altium, and JLCPCB CSVs for EOL and ESR risks locally.</p>
              <Link className="card__link" href="/en/tools/bom-checker/" prefetch={false}>
                Open BOM Checker
                {ARROW_SVG}
              </Link>
              <div
                className="panel panel--flush"
                data-fx="gradient-mesh"
                data-fx-seed="11"
                data-fx-params='{"drift":0}'
              >
                <div className="stage stage--fade-b">
                  <div
                    className="at-rise fit"
                    style={{
                      ['--fit-max' as string]: '440px',
                      ['--ax' as string]: 'max(20px, 50% - 220px)',
                      ['--ay' as string]: '20px',
                      ['--ay-sm' as string]: '12px',
                    }}
                  >
                    <div className="ui ui-panel ui-term" data-ui="terminal-run" data-ui-loop="">
                      <div className="ui-term__head">
                        <span className="ui-dots" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="ui-term__title">pin2pin/bom-audit</span>
                        <span className="ui-meta">local</span>
                        <span className="ui-spacer" />
                        <span className="ui-chip ui-chip--plain ui-term__branch">0B upload</span>
                      </div>
                      <div className="ui-term__screen" data-term-screen="">
                        <div className="ui-term__track" data-term-track="">
                          <div className="ui-term__ln ui-term__cmd">
                            <span className="ui-term__cwd">
                              ~/<span className="ui-term__up">pcb/</span>bom
                            </span>
                            <span className="ui-term__sig">$</span>
                            <span className="ui-term__typed" data-term-cmd="">
                              bom-audit power_rev3.csv
                            </span>
                          </div>
                          <div className="ui-term__ln ui-term__meter" data-term-out="" data-term-meter="">
                            <span className="ui-term__bar" style={{ ['--p' as string]: 1 }}>
                              <i />
                            </span>
                            <span className="ui-term__count" data-term-count="">
                              4 of 4 OPNs
                            </span>
                          </div>
                          <div className="ui-term__ln ui-term__log" data-term-out="" data-term-step="">
                            <svg className="ui-term__tick" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="m3.5 8.4 2.8 2.8 6.2-6.4" />
                            </svg>
                            <span className="ui-term__path">AMS1117-3.3 (SOT-223-3)</span>
                            <span className="ui-term__n">ESR trap</span>
                            <span className="ui-term__t">p.4</span>
                          </div>
                          <div className="ui-term__ln ui-term__log" data-term-out="" data-term-step="">
                            <svg className="ui-term__tick" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="m3.5 8.4 2.8 2.8 6.2-6.4" />
                            </svg>
                            <span className="ui-term__path">AP2112K-3.3TRG1 (SOT-23-5)</span>
                            <span className="ui-term__n">Active</span>
                            <span className="ui-term__t">p.1</span>
                          </div>
                          <div className="ui-term__ln ui-term__log" data-term-out="" data-term-step="">
                            <svg className="ui-term__tick" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="m3.5 8.4 2.8 2.8 6.2-6.4" />
                            </svg>
                            <span className="ui-term__path">LM358DR (SOIC-8)</span>
                            <span className="ui-term__n">Active</span>
                            <span className="ui-term__t">p.5</span>
                          </div>
                          <div className="ui-term__ln ui-term__log" data-term-out="" data-term-step="">
                            <svg className="ui-term__tick" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="m3.5 8.4 2.8 2.8 6.2-6.4" />
                            </svg>
                            <span className="ui-term__path">TPS54302DDCR (SOT-23-6)</span>
                            <span className="ui-term__n">Active</span>
                            <span className="ui-term__t">p.4</span>
                          </div>
                          <div className="ui-term__ln ui-term__gap" data-term-out="" aria-hidden="true" />
                          <div className="ui-term__ln ui-term__sum" data-term-out="">
                            <span className="ui-term__key">OPNs</span>
                            <span className="ui-term__val">4 matched</span>
                            <span className="ui-term__dim">(1 ESR alert)</span>
                          </div>
                          <div className="ui-term__ln ui-term__done" data-term-out="" data-term-done="">
                            <span className="ui-term__ok">
                              <svg viewBox="0 0 16 16" aria-hidden="true">
                                <path d="m4.5 8.3 2.4 2.4 4.6-5" />
                              </svg>
                            </span>
                            <b>Done</b>
                            <span className="ui-term__dim">in 14ms · browser memory</span>
                          </div>
                          <div className="ui-term__ln ui-term__cmd" data-term-next="">
                            <span className="ui-term__cwd">
                              ~/<span className="ui-term__up">pcb/</span>bom
                            </span>
                            <span className="ui-term__sig">$</span>
                            <span className="ui-term__typed" />
                            <i className="ui-term__caret" aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Card 2: Live Compare (search fragment, still, 3 rows, no footer fade-cut) */}
            <article className="card card--row span-6">
              <h3>Compare 2 OPNs pin by pin</h3>
              <p>Diff pin roles, thermal tabs, and datasheet ratings side by side.</p>
              <Link className="card__link" href="/en/tools/compare/" prefetch={false}>
                Launch Live Compare
                {ARROW_SVG}
              </Link>
              <div
                className="panel panel--flush"
                data-fx="gradient-mesh"
                data-fx-seed="23"
                data-fx-params='{"drift":0}'
              >
                <div className="stage">
                  <div
                    className="at-rise fit to-edge"
                    style={{
                      ['--fit-max' as string]: '400px',
                      ['--ax' as string]: 'max(20px, 50% - 200px)',
                      ['--ay' as string]: '22px',
                      ['--ay-sm' as string]: '10px',
                    }}
                  >
                    <div className="ui ui-panel ui-search" data-ui="search" data-ui-still="">
                      <div className="ui-search__field">
                        <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
                          <circle cx="7" cy="7" r="4.5" />
                          <path d="m10.5 10.5 3 3" />
                        </svg>
                        <span className="ui-search__q">
                          <span data-search-q="">SOT-23-5 AP2112K</span>
                          <i className="ui-search__caret" />
                        </span>
                        <kbd className="ui-search__kbd">Ctrl K</kbd>
                      </div>
                      <div className="ui-search__group">Verified SOT-23-5 matches</div>
                      <ul className="ui-search__list" data-search-list="">
                        <li className="ui-search__row is-sel">
                          <span className="ui-search__ico">
                            <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
                              <rect x="4" y="4" width="8" height="8" rx="1" />
                              <path d="M2 6h2M2 10h2M12 6h2M12 10h2" />
                            </svg>
                          </span>
                          <span className="ui-search__t">
                            <b>AP2112K-3.3TRG1</b> · 600 mA LDO
                          </span>
                          <span className="ui-search__m">Active</span>
                        </li>
                        <li className="ui-search__row">
                          <span className="ui-search__ico">
                            <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
                              <rect x="4" y="4" width="8" height="8" rx="1" />
                              <path d="M2 6h2M2 10h2M12 6h2M12 10h2" />
                            </svg>
                          </span>
                          <span className="ui-search__t">
                            <b>TLV73333PDBVR</b> · 300 mA cap-free
                          </span>
                          <span className="ui-search__m">L1 Alt</span>
                        </li>
                        <li className="ui-search__row">
                          <span className="ui-search__ico">
                            <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
                              <rect x="4" y="4" width="8" height="8" rx="1" />
                              <path d="M2 6h2M2 10h2M12 6h2M12 10h2" />
                            </svg>
                          </span>
                          <span className="ui-search__t">
                            <b>AP2210K-3.3TRG1</b> · 300 mA low-noise
                          </span>
                          <span className="ui-search__m">L2 Alt</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>

        {/* Row 2 (Screen 4) */}
        <div className="grid">
          {/* Card 3: Engineering Calculators (toggles fragment, still, 4 compact rows) */}
          <article className="card card--row span-6">
            <h3>Check 7 thermal and ripple calculators</h3>
            <p>Compute LDO Tj rise, buck ripple, E96 dividers, and op-amp GBWP.</p>
            <Link className="card__link" href="/en/tools/" prefetch={false}>
              Explore all 7 tools
              {ARROW_SVG}
            </Link>
            <div
              className="panel panel--flush"
              data-fx="gradient-mesh"
              data-fx-seed="37"
              data-fx-params='{"drift":0}'
            >
              <div className="stage">
                <div
                  className="at-right to-edge"
                  style={{
                    ['--ax' as string]: '24px',
                    ['--ay' as string]: '18px',
                    ['--ay-sm' as string]: '10px',
                  }}
                >
                  <div className="ui ui-panel ui-toggles" data-ui="toggles" data-ui-still="">
                    <div className="ui-head">
                      <svg className="ui-icon ui-toggles__ico" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 1.8 13 4v3.6c0 3-2.1 5.4-5 6.6-2.9-1.2-5-3.6-5-6.6V4z" />
                        <path d="m5.8 8 1.6 1.6 3-3.2" />
                      </svg>
                      <div className="ui-title">Local browser calculators</div>
                      <span className="ui-spacer" />
                      <div className="ui-meta" data-tg-count="">
                        4 of 4 active
                      </div>
                    </div>
                    <ul className="ui-toggles__list">
                      <li className="ui-tg">
                        <span className="ui-tg__text">
                          <span className="ui-tg__label">LDO Tj thermal margin</span>
                          <span className="ui-tg__sub">Pd = (Vin - Vout) * Iout · θJA p.2</span>
                        </span>
                        <button
                          className="ui-switch is-on"
                          type="button"
                          role="switch"
                          aria-checked="true"
                          aria-label="LDO Tj thermal margin"
                          tabIndex={-1}
                        >
                          <i />
                        </button>
                      </li>
                      <li className="ui-tg">
                        <span className="ui-tg__text">
                          <span className="ui-tg__label">DC-DC inductor ripple</span>
                          <span className="ui-tg__sub">Duty cycle, ΔIL, and Isw peak limit</span>
                        </span>
                        <button
                          className="ui-switch is-on"
                          type="button"
                          role="switch"
                          aria-checked="true"
                          aria-label="DC-DC inductor ripple"
                          tabIndex={-1}
                        >
                          <i />
                        </button>
                      </li>
                      <li className="ui-tg">
                        <span className="ui-tg__text">
                          <span className="ui-tg__label">E96 feedback divider</span>
                          <span className="ui-tg__sub">1% R1/R2 pairs with Vref tolerance</span>
                        </span>
                        <button
                          className="ui-switch is-on"
                          type="button"
                          role="switch"
                          aria-checked="true"
                          aria-label="E96 feedback divider"
                          tabIndex={-1}
                        >
                          <i />
                        </button>
                      </li>
                      <li className="ui-tg">
                        <span className="ui-tg__text">
                          <span className="ui-tg__label">Op-Amp GBWP &amp; slew check</span>
                          <span className="ui-tg__sub">Closed-loop bandwidth and pull-up rise</span>
                        </span>
                        <button
                          className="ui-switch is-on"
                          type="button"
                          role="switch"
                          aria-checked="true"
                          aria-label="Op-Amp GBWP and slew check"
                          tabIndex={-1}
                        >
                          <i />
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Card 4: Dual-Path Pipeline Diagram */}
          <article className="card card--row span-6">
            <h3>Trace every pinout spec to PDF pages</h3>
            <p>Verify pinouts with 300 DPI PDF renders and Zod physics checks.</p>
            <Link className="card__link" href="/en/methodology/" prefetch={false}>
              Read audit pipeline
              {ARROW_SVG}
            </Link>
            <div
              className="panel panel--flush tools-dg-panel"
              data-fx="gradient-mesh"
              data-fx-seed="49"
              data-fx-params='{"drift":0}'
            >
              <div
                className="dg"
                data-icon-base={`${basePath}/assets/icons/`}
                data-diagram={JSON.stringify(pipelineDiagram)}
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
