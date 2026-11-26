import Link from 'next/link';

export function HomeHeader() {
  return (
    <header className="nav">
      <div className="wrap nav__bar">
        <a className="skip-link" href="#top">
          Skip to content
        </a>
        <a className="nav__logo" href="#top">
          <span className="mark mark--initial" aria-hidden="true">
            P
          </span>
          Pin2Pin Global
        </a>
        <nav className="nav__links" aria-label="Main">
          <div className="nav__item">
            <Link className="nav__link" href="/en/tools/" prefetch={false}>
              Tools
              <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M3 4.5l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <div className="nav__menu">
              <div className="wrap grid">
                <Link className="menu-card span-4" href="/en/tools/bom-checker/" prefetch={false}>
                  <div className="panel">
                    <div className="stage stage--fade-br">
                      <div className="at-corner" style={{ ['--ax' as string]: '20px', ['--ay' as string]: '20px' }}>
                        <div className="nav-mini" aria-hidden="true">
                          <div className="nav-mini__head">
                            <span>bom-audit · local</span>
                            <b>0 B uploaded</b>
                          </div>
                          <div className="nav-mini__row">
                            <span>CAT6219-330TD-GT3</span>
                            <span className="nav-mini__tag nav-mini__tag--err">EOL</span>
                          </div>
                          <div className="nav-mini__row">
                            <span>AMS1117-3.3</span>
                            <span className="nav-mini__tag nav-mini__tag--warn">ESR trap</span>
                          </div>
                          <div className="nav-mini__row">
                            <span>AP2112K-3.3TRG1</span>
                            <span className="nav-mini__tag nav-mini__tag--ok">Active</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="menu-card__copy">
                    <span className="t-card">BOM Checker</span>
                    <span className="menu-card__desc">Audit KiCad and Altium CSVs in local memory</span>
                  </div>
                </Link>

                <Link className="menu-card span-4" href="/en/tools/compare/" prefetch={false}>
                  <div className="panel">
                    <div className="stage stage--fade-br">
                      <div className="at-corner" style={{ ['--ax' as string]: '20px', ['--ay' as string]: '20px' }}>
                        <div className="nav-mini" aria-hidden="true">
                          <div className="nav-mini__head">
                            <span>SOT-223-3 pin-diff</span>
                            <b>Level 3</b>
                          </div>
                          <div className="nav-mini__row">
                            <span>Pin 1 · GND vs IN</span>
                            <span className="nav-mini__tag nav-mini__tag--err">Conflict</span>
                          </div>
                          <div className="nav-mini__row">
                            <span>Pin 2 · VOUT vs GND</span>
                            <span className="nav-mini__tag nav-mini__tag--err">Conflict</span>
                          </div>
                          <div className="nav-mini__row">
                            <span>Tab · VOUT vs GND</span>
                            <span className="nav-mini__tag nav-mini__tag--err">Short</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="menu-card__copy">
                    <span className="t-card">Live Compare</span>
                    <span className="menu-card__desc">Diff any two OPNs pin by pin with thermal margins</span>
                  </div>
                </Link>

                <Link className="menu-card span-4" href="/en/tools/pinout-finder/" prefetch={false}>
                  <div className="panel">
                    <div className="stage stage--fade-br">
                      <div className="at-corner" style={{ ['--ax' as string]: '20px', ['--ay' as string]: '20px' }}>
                        <div className="nav-mini" aria-hidden="true">
                          <div className="nav-mini__head">
                            <span>SOT-23-5 · 5 pins</span>
                            <b>8 matches</b>
                          </div>
                          <div className="nav-mini__row">
                            <span>AP2112K-3.3TRG1</span>
                            <span className="nav-mini__tag nav-mini__tag--ok">600 mA</span>
                          </div>
                          <div className="nav-mini__row">
                            <span>TLV73333PDBVR</span>
                            <span className="nav-mini__tag nav-mini__tag--ok">300 mA</span>
                          </div>
                          <div className="nav-mini__row">
                            <span>TPS61040DBVR</span>
                            <span className="nav-mini__tag nav-mini__tag--warn">Boost</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="menu-card__copy">
                    <span className="t-card">Pinout Finder</span>
                    <span className="menu-card__desc">Match a PCB footprint and pin roles to verified ICs</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <div className="nav__item">
            <Link className="nav__link" href="/en/catalog/" prefetch={false}>
              Catalog
            </Link>
          </div>
          <div className="nav__item">
            <Link className="nav__link" href="/en/tools/compare/" prefetch={false}>
              Compare
            </Link>
          </div>
          <div className="nav__item">
            <Link className="nav__link" href="/en/packages/" prefetch={false}>
              Packages
            </Link>
          </div>
          <div className="nav__item">
            <Link className="nav__link" href="/en/guides/" prefetch={false}>
              Guides
            </Link>
          </div>
        </nav>
        <div className="nav__actions">
          <Link className="btn btn--primary" href="/en/tools/bom-checker/" prefetch={false}>
            Check BOM
          </Link>
        </div>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
