'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface WorkbenchDiffLine {
  oldNum: string;
  newNum: string;
  kind: 'ctx' | 'del' | 'add' | 'target';
  text: string;
}

export interface WorkbenchItem {
  slug: string;
  opn: string;
  manufacturer: string;
  category: 'ldo' | 'dcdc' | 'opamp';
  packageCode: string;
  pinCount: number;
  ratingLabel: string;
  statusLabel: string;
  statusTone: 'l1' | 'l2' | 'l3';
  avatarTone: '1' | '2' | '3' | '4' | '5';
  initials: string;
  diffDir: string;
  diffFile: string;
  addCount: string;
  delCount: string;
  hunkSig: string;
  threadTitle: string;
  threadMeta: string;
  threadMessage: string;
  primaryHref: string;
  primaryLinkLabel: string;
  partHref: string;
  lines: WorkbenchDiffLine[];
}

interface HomeWorkbenchProps {
  items: WorkbenchItem[];
  totalParts: number;
  categoryCounts: {
    all: number;
    ldo: number;
    dcdc: number;
    opamp: number;
    traps: number;
  };
}

type FilterMode = 'all' | 'ldo' | 'dcdc' | 'opamp' | 'traps';

export function HomeWorkbench({ items, totalParts, categoryCounts }: HomeWorkbenchProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(items[0]?.slug ?? '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'traps' && item.statusTone !== 'l3') return false;
      if ((filter === 'ldo' || filter === 'dcdc' || filter === 'opamp') && item.category !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        item.opn.toLowerCase().includes(q) ||
        item.packageCode.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.ratingLabel.toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const active =
    filtered.find((item) => item.slug === selectedSlug) ?? filtered[0] ?? items[0];

  if (!active) return null;

  const targetIndex = active.lines.findIndex((ln) => ln.kind === 'target');
  const beforeLines = targetIndex >= 0 ? active.lines.slice(0, targetIndex + 1) : active.lines.slice(0, 6);
  const afterLines = (targetIndex >= 0 ? active.lines.slice(targetIndex + 1) : active.lines.slice(6)).slice(0, 6);
  const visibleRows = filtered.slice(0, 9);

  return (
    <div
      className="ui app fill"
      aria-label="Interactive Pin2Pin Global OPN inspector and pin-by-pin comparison diff"
    >
      {/* Left Pane: Verified OPN Window */}
      <div className="app__pane app__pane--list">
        <div className="ui ui-panel ui-win">
          <div className="ui-win__bar">
            <span className="ui-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="ui-win__crumb">
              <svg className="ui-brand" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M1 6h2M1 10h2M13 6h2M13 10h2M6 1v2M10 1v2M6 13v2M10 13v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Catalog <i>/</i> <b>{totalParts} OPNs</b>
            </span>
            <span className="ui-spacer" />
            <label className="ui-win__search">
              <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" />
              </svg>
              <input
                type="search"
                className="ui-win__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter OPN"
                aria-label="Filter verified OPNs"
              />
            </label>
          </div>

          <div className="ui-win__body">
            <div className="ui-win__side" role="group" aria-label="Filter by family">
              <button
                type="button"
                className={`ui-win__nav-btn${filter === 'all' ? ' is-on' : ''}`}
                onClick={() => setFilter('all')}
              >
                All<em>{categoryCounts.all}</em>
              </button>
              <button
                type="button"
                className={`ui-win__nav-btn${filter === 'ldo' ? ' is-on' : ''}`}
                onClick={() => setFilter('ldo')}
              >
                LDO<em>{categoryCounts.ldo}</em>
              </button>
              <button
                type="button"
                className={`ui-win__nav-btn${filter === 'dcdc' ? ' is-on' : ''}`}
                onClick={() => setFilter('dcdc')}
              >
                DC-DC<em>{categoryCounts.dcdc}</em>
              </button>
              <button
                type="button"
                className={`ui-win__nav-btn${filter === 'opamp' ? ' is-on' : ''}`}
                onClick={() => setFilter('opamp')}
              >
                Op-Amp<em>{categoryCounts.opamp}</em>
              </button>
              <span className="ui-win__label">Risk</span>
              <button
                type="button"
                className={`ui-win__nav-btn${filter === 'traps' ? ' is-on' : ''}`}
                onClick={() => setFilter('traps')}
              >
                <span className="ui-win__hash">#</span>Pin traps<em>{categoryCounts.traps}</em>
              </button>
            </div>

            <div className="ui-win__main">
              <div className="ui-win__cols" aria-hidden="true">
                <span>OPN</span>
                <span>Package · Rating</span>
                <span>Grade</span>
                <span>Pins</span>
              </div>
              <ul className="ui-win__rows">
                {visibleRows.map((item) => {
                  const isSel = item.slug === active.slug;
                  return (
                    <li key={item.slug} className="ui-win__item">
                      <button
                        type="button"
                        className={`ui-win__row ui-win__row-btn${isSel ? ' is-sel' : ''}`}
                        onClick={() => setSelectedSlug(item.slug)}
                        aria-pressed={isSel}
                      >
                        <span className="ui-avatar" data-tone={item.avatarTone}>
                          {item.initials}
                        </span>
                        <span className="ui-win__who">{item.opn}</span>
                        <span className="ui-win__sub">
                          {item.packageCode} · {item.ratingLabel}
                        </span>
                        <span className={`ui-win__st ui-win__st--${item.statusTone}`}>
                          {item.statusLabel}
                        </span>
                        <span className="ui-win__age">{item.pinCount}p</span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="ui-win__item">
                    <div className="ui-win__row">
                      <span className="ui-win__sub" style={{ gridColumn: '1 / -1' }}>
                        No matching OPN in preview. Open full catalog for all {totalParts} parts.
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Pin-by-Pin Diff & Datasheet Spec Review */}
      <div className="app__pane app__pane--open">
        <div className="ui ui-panel ui-diff">
          <div className="ui-diff__head">
            <svg className="ui-icon ui-diff__fold" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </svg>
            <span className="ui-diff__tool" aria-hidden="true">
              <svg className="ui-brand" viewBox="0 0 16 16">
                <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="#0f0f0f" strokeWidth="1.5" />
                <circle cx="6.2" cy="6.2" r="1.2" fill="#0f0f0f" />
              </svg>
            </span>
            <span className="ui-diff__repo">pin2pin/xref</span>
            <i className="ui-diff__slash" aria-hidden="true">
              /
            </i>
            <span className="ui-diff__path">
              <span className="ui-diff__dir">{active.diffDir}</span>
              <b>{active.diffFile}</b>
            </span>
            <span className="ui-spacer" />
            <span className="ui-diff__stat">
              <b className="is-add">
                <span className="ui-diff__was">{active.addCount}</span>
              </b>
              <b className="is-del">
                <span className="ui-diff__was">{active.delCount}</span>
              </b>
              <span className="ui-diff__bar" aria-hidden="true">
                <i className="is-add" />
                <i className="is-add" />
                <i className="is-del" />
                <i className="is-del" />
                <i className="is-del" />
              </span>
            </span>
          </div>

          <div className="ui-diff__hunk">
            <span>@@ -1,4 +1,4 @@</span> <em className="ui-diff__sig">{active.hunkSig}</em>
          </div>

          <div className="ui-diff__lines">
            {beforeLines.map((ln, idx) => (
              <div
                key={`b-${idx}`}
                className={`ui-diff__ln${
                  ln.kind === 'del'
                    ? ' is-del'
                    : ln.kind === 'add'
                      ? ' is-add'
                      : ln.kind === 'target'
                        ? ' is-target'
                        : ''
                }`}
              >
                <i>{ln.oldNum}</i>
                <i>{ln.newNum}</i>
                <span className="ui-diff__code" data-i="1">
                  {ln.text}
                </span>
              </div>
            ))}

            <div className="ui-diff__thread">
              <div className="ui-diff__by">
                <span className="ui-avatar" data-tone="3">
                  AG
                </span>
                <span className="ui-diff__name">{active.threadTitle}</span>
                <span className="ui-diff__time">{active.threadMeta}</span>
                <span className="ui-spacer" />
                <span className="ui-diff__actions">
                  <Link className="ui-diff__open-link" href={active.primaryHref} prefetch={false}>
                    {active.primaryLinkLabel}
                  </Link>
                  <Link className="ui-btn ui-btn--sm ui-btn--ghost" href={active.partHref} prefetch={false}>
                    Part spec
                  </Link>
                </span>
              </div>
              <div className="ui-diff__msg">{active.threadMessage}</div>
            </div>

            {afterLines.map((ln, idx) => (
              <div
                key={`a-${idx}`}
                className={`ui-diff__ln${
                  ln.kind === 'del' ? ' is-del' : ln.kind === 'add' ? ' is-add' : ''
                }`}
              >
                <i>{ln.oldNum}</i>
                <i>{ln.newNum}</i>
                <span className="ui-diff__code" data-i="1">
                  {ln.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
