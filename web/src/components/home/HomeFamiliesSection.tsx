import Link from 'next/link';

export interface FamilyScreenRow {
  label: string;
  badge: string;
  isTrap?: boolean;
  spec: string;
  href: string;
}

export interface FamilyTabSpec {
  id: string;
  label: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  sheetTitle: string;
  sheetMeta: string;
  rows: FamilyScreenRow[];
}

export function HomeFamiliesSection({ tabs }: { tabs: FamilyTabSpec[] }) {
  return (
    <section className="section bg-dots" id="families" aria-labelledby="families-h">
      <div className="wrap">
        <div className="grid">
          <div className="span-5 stack-6">
            <div className="section-head">
              <h2 id="families-h">Verified semiconductor families and pinout traps</h2>
              <p className="muted">
                Every orderable part number maps to one JEDEC package and pinout view.
              </p>
            </div>

            <div className="tabs" role="tablist" aria-label="Verified component families">
              {tabs.map((tab, idx) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`btn-${tab.id}`}
                  className="tab"
                  aria-selected={idx === 0 ? 'true' : 'false'}
                  aria-controls={`tab-${tab.id} screen-${tab.id}`}
                  tabIndex={idx === 0 ? 0 : -1}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {tabs.map((tab, idx) => (
              <div
                key={tab.id}
                role="tabpanel"
                id={`tab-${tab.id}`}
                aria-labelledby={`btn-${tab.id}`}
                className="stack-4"
                hidden={idx !== 0}
              >
                <p className="t-body">{tab.description}</p>
                <Link className="link" href={tab.ctaHref} prefetch={false}>
                  {tab.ctaLabel}
                </Link>
              </div>
            ))}
          </div>

          <div className="frame frame--split frame--lit span-6 start-7 families-frame">
            {tabs.map((tab, idx) => (
              <div
                key={tab.id}
                id={`screen-${tab.id}`}
                className="families-screen"
                hidden={idx !== 0}
              >
                <div className="ui ui-panel families-sheet">
                  <div className="families-sheet__head">
                    <span>{tab.sheetTitle}</span>
                    <span>{tab.sheetMeta}</span>
                  </div>
                  <ul className="families-sheet__list">
                    {tab.rows.map((row) => (
                      <li key={row.href} className="families-sheet__item">
                        <Link href={row.href} prefetch={false} className="families-sheet__row">
                          <svg
                            className="families-sheet__ic"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                          >
                            <rect x="5" y="5" width="10" height="10" rx="1.5" />
                            <path d="M2 8h3M2 12h3M15 8h3M15 12h3M8 2v3M12 2v3M8 15v3M12 15v3" strokeLinecap="round" />
                          </svg>
                          <span className="families-sheet__opn">{row.label}</span>
                          <span
                            className={`families-sheet__pkg${row.isTrap ? ' families-sheet__pkg--trap' : ''}`}
                          >
                            {row.badge}
                          </span>
                          <span className="families-sheet__spec">{row.spec}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
