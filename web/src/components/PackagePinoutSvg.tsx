'use client';

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { PackageCode, PackageInfo, PinEntry, PinRole } from '@/types/schema';
import { trackEvent } from '@/lib/analytics';

export type DiffStatus = 'MATCH' | 'MISMATCH' | 'CAUTION';
export type EpDiffStatus = 'MATCH' | 'CAUTION' | 'MISMATCH';

export interface PackagePinoutSvgProps {
  opn: string;
  pkg: PackageInfo;
  diffHighlights?: Record<number, DiffStatus> | null;
  compact?: boolean;
  /** Exposed pad / thermal tab comparison status (VS / compare contexts). */
  epDiffStatus?: EpDiffStatus | null;
  /** Show SVG download + Markdown / KiCad CSV copy buttons. Defaults to `!compact`. */
  showExportControls?: boolean;
  /** Enables the engineering toolbar, pin inspector and hover/tap highlighting. Default `true`. */
  interactive?: boolean;
  /** Controlled highlighted pin (synchronised comparison views). */
  highlightedPin?: number | null;
  /** Fired when the user hovers / taps / leaves a pin. */
  onPinHover?: (pinNumber: number | null) => void;
  /** Controlled PCB-mirror state (shared toggle in comparison views). */
  mirrored?: boolean;
  onMirroredChange?: (mirrored: boolean) => void;
  /** Hide the per-diagram mirror toggle (when a parent renders a shared one). */
  hideMirrorToggle?: boolean;
  /** Hide the per-diagram pin inspector bar (when a parent renders a combined one). */
  hideInspector?: boolean;
}

interface RoleTheme {
  fill: string;
  stroke: string;
  text: string;
  tagBg: string;
  tagText: string;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const HIGHLIGHT = '#0284c7';

function getRoleTheme(role: PinRole): RoleTheme {
  switch (role) {
    case 'VIN':
    case 'VCC':
      return { fill: '#fef2f2', stroke: '#dc2626', text: '#991b1b', tagBg: '#dc2626', tagText: '#ffffff' };
    case 'VOUT':
    case 'OUT':
    case 'OUT_A':
    case 'OUT_B':
      return { fill: '#eff6ff', stroke: '#2563eb', text: '#1e40af', tagBg: '#2563eb', tagText: '#ffffff' };
    case 'GND':
    case 'VEE':
      return { fill: '#f1f5f9', stroke: '#334155', text: '#0f172a', tagBg: '#1e293b', tagText: '#ffffff' };
    case 'SW':
    case 'BOOT':
      return { fill: '#fffbeb', stroke: '#d97706', text: '#92400e', tagBg: '#d97706', tagText: '#ffffff' };
    case 'NC':
    case 'OTHER':
      return { fill: '#f8fafc', stroke: '#94a3b8', text: '#64748b', tagBg: '#94a3b8', tagText: '#ffffff' };
    default:
      // EN, FB, ADJ, BYPASS, COMP, SS, PG, IN_POS*, IN_NEG*, VREF, SYNC, MODE, PS
      return { fill: '#f5f3ff', stroke: '#7c3aed', text: '#5b21b6', tagBg: '#7c3aed', tagText: '#ffffff' };
  }
}

function getDiffTheme(status: DiffStatus): {
  stroke: string;
  fill: string;
  leadFill: string;
  badgeBg: string;
  symbol: string;
} {
  switch (status) {
    case 'MATCH':
      return { stroke: '#16a34a', fill: '#dcfce7', leadFill: '#86efac', badgeBg: '#16a34a', symbol: '✓' };
    case 'MISMATCH':
      return { stroke: '#dc2626', fill: '#fee2e2', leadFill: '#fca5a5', badgeBg: '#dc2626', symbol: '!' };
    case 'CAUTION':
      return { stroke: '#d97706', fill: '#fef3c7', leadFill: '#fcd34d', badgeBg: '#d97706', symbol: '~' };
  }
}

function getEpStatusTheme(status: EpDiffStatus): { stroke: string; tint: string; text: string } {
  switch (status) {
    case 'MISMATCH':
      return { stroke: '#dc2626', tint: '#fef2f2', text: '#dc2626' };
    case 'CAUTION':
      return { stroke: '#d97706', tint: '#fef3c7', text: '#b45309' };
    case 'MATCH':
      return { stroke: '#059669', tint: '#d1fae5', text: '#047857' };
  }
}

function shortRoleLabel(role: PinRole): string {
  switch (role) {
    case 'IN_POS':
      return 'IN+';
    case 'IN_NEG':
      return 'IN-';
    case 'IN_POS_A':
      return 'IN+A';
    case 'IN_NEG_A':
      return 'IN-A';
    case 'IN_POS_B':
      return 'IN+B';
    case 'IN_NEG_B':
      return 'IN-B';
    case 'OUT_A':
      return 'OUTA';
    case 'OUT_B':
      return 'OUTB';
    case 'BYPASS':
      return 'BYP';
    default:
      return role;
  }
}

function truncateName(name: string, maxLen = 10): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

type Archetype = 'sot23_3' | 'tab_3' | 'sot23_5' | 'tab_5' | 'dual_row';

function getArchetype(code: PackageCode): Archetype {
  if (code === 'SOT-23-3' || code === 'SOT-23A-3') return 'sot23_3';
  if (code === 'SOT-223-3' || code === 'SOT-89-3' || code === 'TO-252-3') return 'tab_3';
  if (code === 'SOT-23-5' || code === 'TSOT-23-5' || code === 'SC-70-5') return 'sot23_5';
  if (code === 'TO-263-5') return 'tab_5';
  return 'dual_row';
}

function isLeadlessPackage(code: PackageCode): boolean {
  return code === 'DFN-6' || code === 'WSON-6' || code === 'DFN-8' || code === 'VSON-10' || code === 'VSON-14';
}

function hasDipNotch(code: PackageCode): boolean {
  return code === 'SOIC-8' || code === 'SOIC-8E';
}

function getPinEntry(pkg: PackageInfo, num: number): PinEntry {
  return (
    pkg.pinout.find((p) => p.pin === num) ?? {
      pin: num,
      name: `P${num}`,
      role: 'OTHER',
      description: `Pin ${num}`,
    }
  );
}

export function buildPinoutKicadCsv(opn: string, pkg: PackageInfo): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines: string[] = [
    `# Pin2Pin Global KiCad Pin Table — ${opn} (${pkg.code} / ${pkg.mfg_package_code}, ${pkg.pinout_view}, datasheet p.${pkg.pinout_source_page})`,
    'Pin,Name,Role,ElectricalType,Description',
  ];
  const roleToKicadType = (role: PinRole): string => {
    switch (role) {
      case 'VIN':
      case 'VCC':
      case 'GND':
      case 'VEE':
        return 'power_in';
      case 'VOUT':
      case 'SW':
        return 'power_out';
      case 'OUT':
      case 'OUT_A':
      case 'OUT_B':
      case 'PG':
        return 'output';
      case 'NC':
        return 'no_connect';
      case 'EN':
      case 'FB':
      case 'ADJ':
      case 'IN_POS':
      case 'IN_NEG':
      case 'IN_POS_A':
      case 'IN_NEG_A':
      case 'IN_POS_B':
      case 'IN_NEG_B':
      case 'SYNC':
      case 'MODE':
      case 'PS':
        return 'input';
      default:
        return 'passive';
    }
  };
  const sorted = [...pkg.pinout].sort((a, b) => a.pin - b.pin);
  for (const p of sorted) {
    lines.push([String(p.pin), esc(p.name), esc(p.role), roleToKicadType(p.role), esc(p.description)].join(','));
  }
  if (pkg.exposed_pad.present) {
    lines.push(
      [
        'EP',
        esc(`EP_${pkg.exposed_pad.net}`),
        esc(pkg.exposed_pad.net),
        pkg.exposed_pad.net === 'VOUT' || pkg.exposed_pad.net === 'SW' ? 'power_out' : 'power_in',
        esc(pkg.exposed_pad.note ?? `Exposed thermal pad / tab tied to ${pkg.exposed_pad.net}`),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export function buildPinoutMarkdown(opn: string, pkg: PackageInfo): string {
  const lines: string[] = [];
  lines.push(`### ${opn} — ${pkg.code} (${pkg.mfg_package_code}) ${pkg.pinout_view.replace('_', ' ')} Pinout`);
  lines.push('');
  lines.push(`Source: official datasheet p.${pkg.pinout_source_page}${pkg.pinout_vision_verified ? ' (300 DPI vision verified)' : ''}`);
  lines.push('');
  lines.push('| Pin | Name | Role | Description |');
  lines.push('|---:|---|---|---|');
  const sorted = [...pkg.pinout].sort((a, b) => a.pin - b.pin);
  for (const p of sorted) {
    lines.push(`| ${p.pin} | ${p.name} | ${p.role} | ${p.description.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push(
    `Exposed pad / tab: ${pkg.exposed_pad.present ? pkg.exposed_pad.net : 'None'}${pkg.exposed_pad.note ? ` — ${pkg.exposed_pad.note}` : ''}`,
  );
  lines.push('');
  lines.push('> Pin2Pin engineering reference only. Verify against the official manufacturer datasheet before PCB release; not for safety-critical use without independent review.');
  return lines.join('\n');
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface CalloutOpts {
  diffStatus: DiffStatus | undefined;
  highlighted: boolean;
}

function renderPinCallout(
  entry: PinEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  align: 'left' | 'right' | 'center',
  { diffStatus, highlighted }: CalloutOpts,
): React.ReactNode {
  const roleTheme = getRoleTheme(entry.role);
  const diffTheme = diffStatus ? getDiffTheme(diffStatus) : null;
  const rectFill = diffTheme ? diffTheme.fill : roleTheme.fill;
  const rectStroke = diffTheme ? diffTheme.stroke : roleTheme.stroke;
  const strokeWidth = diffStatus === 'MISMATCH' ? 2 : 1.25;
  const pinStr = String(entry.pin);
  const roleStr = shortRoleLabel(entry.role);
  const nameStr = truncateName(entry.name, 13);
  const nameFontSize = nameStr.length > 9 ? '9.5' : '11';

  const badgeW = 22;
  const rolePillW = Math.max(34, roleStr.length * 6 + 9);
  const cy = y + height / 2;
  const pinOnRight = align === 'right';

  const pinBadgeX = pinOnRight ? x + width - badgeW - 3 : x + 3;
  const rolePillX = pinOnRight ? x + 4 : x + width - rolePillW - 4;
  const textX = pinOnRight ? rolePillX + rolePillW + 5 : pinBadgeX + badgeW + 5;
  // Anchor diff status dot on the pin-number badge corner (never overlapping the role pill text).
  const diffDotX = pinOnRight ? pinBadgeX + badgeW - 1 : pinBadgeX + 1;
  const diffDotY = y - 1;

  return (
    <g>
      <title>{`Pin ${entry.pin}: ${entry.name} (${entry.role}) — ${entry.description}`}</title>
      {highlighted && (
        <rect
          x={x - 3.5}
          y={y - 3.5}
          width={width + 7}
          height={height + 7}
          rx={7}
          fill="#e0f2fe"
          stroke={HIGHLIGHT}
          strokeWidth={2.5}
        />
      )}
      <rect x={x} y={y} width={width} height={height} rx={5} fill={rectFill} stroke={rectStroke} strokeWidth={strokeWidth} />
      <rect x={rolePillX} y={y + 4} width={rolePillW} height={height - 8} rx={3} fill={roleTheme.tagBg} />
      <text
        x={rolePillX + rolePillW / 2}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="700"
        fontFamily={MONO}
        fill={roleTheme.tagText}
      >
        {roleStr}
      </text>
      <text x={textX} y={cy + 3.5} textAnchor="start" fontSize={nameFontSize} fontWeight="700" fontFamily={MONO} fill="#0f172a">
        {nameStr}
      </text>
      <rect
        x={pinBadgeX}
        y={y + 3}
        width={badgeW}
        height={height - 6}
        rx={3}
        fill={highlighted ? HIGHLIGHT : diffTheme ? diffTheme.badgeBg : '#0f172a'}
      />
      <text
        x={pinBadgeX + badgeW / 2}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fontFamily={MONO}
        fill="#ffffff"
      >
        {pinStr}
      </text>
      {diffTheme && (
        <g>
          <circle cx={diffDotX} cy={diffDotY} r={6} fill={diffTheme.badgeBg} stroke="#ffffff" strokeWidth={1.5} />
          <text x={diffDotX} y={diffDotY + 3.2} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#ffffff">
            {diffTheme.symbol}
          </text>
        </g>
      )}
    </g>
  );
}

function ViewToggle({
  mirrored,
  onChange,
  datasheetView,
}: {
  mirrored: boolean;
  onChange: (next: boolean) => void;
  datasheetView: 'TOP_VIEW' | 'BOTTOM_VIEW' | 'MIXED';
}) {
  const dsLabel =
    datasheetView === 'BOTTOM_VIEW' ? 'Datasheet Bottom' : datasheetView === 'MIXED' ? 'Datasheet View' : 'Top View';
  const flipLabel =
    datasheetView === 'BOTTOM_VIEW' ? 'Top (Mirror)' : datasheetView === 'MIXED' ? 'PCB Mirror' : 'Bottom (PCB Mirror)';
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300 bg-white text-[11px] font-semibold" role="group" aria-label="Pinout view orientation">
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!mirrored}
        className={`px-2 py-1 ${!mirrored ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
      >
        {dsLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={mirrored}
        className={`border-l border-slate-300 px-2 py-1 ${mirrored ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
      >
        {flipLabel}
      </button>
    </div>
  );
}

export function PackagePinoutSvg({
  opn,
  pkg,
  diffHighlights = null,
  compact = false,
  epDiffStatus = null,
  showExportControls,
  interactive = true,
  highlightedPin,
  onPinHover,
  mirrored: mirroredProp,
  onMirroredChange,
  hideMirrorToggle = false,
  hideInspector = false,
}: PackagePinoutSvgProps) {
  const rawId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPin, setHoverPin] = useState<number | null>(null);
  const [selectedPin, setSelectedPin] = useState<number | null>(null);
  const [mirroredLocal, setMirroredLocal] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [csvCopyState, setCsvCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const exportsVisible = showExportControls ?? !compact;

  const mirrored = mirroredProp ?? mirroredLocal;
  const setMirrored = (next: boolean) => {
    if (mirroredProp === undefined) setMirroredLocal(next);
    onMirroredChange?.(next);
    trackEvent('pinout_view_toggle', { opn, package_code: pkg.code, mirrored: next });
  };

  const activePin: number | null = interactive
    ? highlightedPin !== undefined
      ? highlightedPin
      : (hoverPin ?? selectedPin)
    : null;

  const handleEnter = useCallback(
    (num: number) => {
      setHoverPin(num);
      onPinHover?.(num);
    },
    [onPinHover],
  );
  const handleLeave = useCallback(() => {
    setHoverPin(null);
    onPinHover?.(selectedPin);
  }, [onPinHover, selectedPin]);
  const handleClick = useCallback(
    (num: number) => {
      const next = selectedPin === num ? null : num;
      setSelectedPin(next);
      setHoverPin(null);
      onPinHover?.(next);
    },
    [onPinHover, selectedPin],
  );

  const pinGroupProps = (num: number): React.SVGProps<SVGGElement> => {
    if (!interactive) return {};
    return {
      onMouseEnter: () => handleEnter(num),
      onMouseLeave: handleLeave,
      onClick: () => handleClick(num),
      onFocus: () => handleEnter(num),
      onBlur: handleLeave,
      onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(num);
        }
      },
      tabIndex: 0,
      role: 'button',
      'aria-label': `Inspect pin ${num}`,
      style: { cursor: 'pointer', outline: 'none' },
    };
  };

  const archetype = getArchetype(pkg.code);
  const datasheetBottom = pkg.pinout_view === 'BOTTOM_VIEW';
  // Effective rendered orientation: PCB mirror flips the datasheet view horizontally.
  const isBottomView = datasheetBottom !== mirrored;
  const getPin = (num: number): PinEntry => getPinEntry(pkg, num);
  const getDiff = (num: number): DiffStatus | undefined => (diffHighlights ? diffHighlights[num] : undefined);
  const leadColors = (num: number) => {
    const diff = getDiff(num);
    const hl = activePin === num;
    return {
      diff,
      hl,
      leadFill: hl ? '#7dd3fc' : diff ? getDiffTheme(diff).leadFill : '#cbd5e1',
      leadStroke: hl ? HIGHLIGHT : diff ? getDiffTheme(diff).stroke : '#475569',
      lineWidth: hl ? 2.2 : 1.25,
    };
  };

  const epPresent = pkg.exposed_pad.present;
  const epNet = pkg.exposed_pad.net;
  const epShortNet = epNet === 'THERMAL_GND_RECOMMENDED' ? 'GND*' : epNet;
  const epIsLivePower = epNet === 'VOUT' || epNet === 'VIN' || epNet === 'SW';
  const epTheme = epDiffStatus ? getEpStatusTheme(epDiffStatus) : null;
  const safeId = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const patternId = `ep-hatch-${safeId}`;
  const isTabArchetype = archetype === 'tab_3' || archetype === 'tab_5';
  const epStatusLabel = epDiffStatus
    ? epDiffStatus === 'MISMATCH'
      ? 'EP/TAB CONFLICT'
      : isTabArchetype
        ? epDiffStatus === 'CAUTION'
          ? 'TAB CAUTION'
          : 'TAB MATCH'
        : epDiffStatus === 'CAUTION'
          ? 'EP CAUTION'
          : 'EP MATCH'
    : null;

  const viewWidth = 520;
  let viewHeight = 250;
  let diagramBody: React.ReactNode = null;

  const tabStatusOverlay = (path: string, labelX: number, labelY: number) =>
    epTheme && epStatusLabel ? (
      <g>
        <path d={path} fill={epTheme.tint} fillOpacity={0.55} stroke={epTheme.stroke} strokeWidth={epDiffStatus === 'MISMATCH' ? 3.25 : 2.5} />
        <text x={labelX} y={labelY} textAnchor="start" fontSize="11" fontWeight="800" fontFamily={MONO} fill={epTheme.text}>
          {epStatusLabel}
        </text>
      </g>
    ) : null;

  const renderSideLead = (
    entry: PinEntry,
    y: number,
    side: 'left' | 'right',
    opts: { bx: number; bw: number; leadH: number; calloutX: number; calloutW: number; calloutH: number; lineEnd: number; leadless?: boolean },
  ) => {
    const { diff, hl, leadFill, leadStroke, lineWidth } = leadColors(entry.pin);
    const { bx, bw, leadH, calloutX, calloutW, calloutH, lineEnd, leadless } = opts;
    const leadW = leadless ? 18 : opts.leadH === 12 ? 18 : 22;
    const leadX =
      side === 'left'
        ? leadless
          ? bx + 2
          : bx - leadW
        : leadless
          ? bx + bw - 20
          : bx + bw;
    const lineX1 = side === 'left' ? lineEnd : leadless ? bx + bw - 2 : bx + bw + leadW;
    const lineX2 = side === 'left' ? (leadless ? bx + 2 : bx - leadW) : lineEnd;
    const isXrayBottomPad = Boolean(leadless && !isBottomView);
    return (
      <g key={`${side}-${entry.pin}`} {...pinGroupProps(entry.pin)}>
        <rect
          x={leadX}
          y={y - leadH / 2}
          width={leadW}
          height={leadH}
          rx={2}
          fill={leadFill}
          fillOpacity={isXrayBottomPad ? 0.65 : 1}
          stroke={leadStroke}
          strokeWidth={1.2}
          strokeDasharray={isXrayBottomPad ? '3 2' : undefined}
        />
        <line x1={lineX1} y1={y} x2={lineX2} y2={y} stroke={leadStroke} strokeWidth={lineWidth} strokeDasharray={hl ? undefined : '2 2'} />
        {renderPinCallout(entry, calloutX, y - calloutH / 2, calloutW, calloutH, side === 'left' ? 'right' : 'left', {
          diffStatus: diff,
          highlighted: hl,
        })}
      </g>
    );
  };

  const bodyLabels = (cx: number, cy: number, maxLen: number) => (
    <>
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fontFamily={MONO} fill="#f8fafc">
        {pkg.code}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9.5" fontFamily={MONO} fill="#94a3b8">
        {truncateName(pkg.mfg_package_code, maxLen)}
      </text>
    </>
  );

  if (archetype === 'sot23_3') {
    viewHeight = 236;
    const bx = 196;
    const by = 52;
    const bw = 128;
    const bh = 132;
    const p1 = getPin(1);
    const p2 = getPin(2);
    const p3 = getPin(3);
    // CCW TOP VIEW: 1 (Top-Left), 2 (Bottom-Left), 3 (Mid-Right). Mirrored horizontally for BOTTOM view.
    const twoSide = [
      { entry: p1, y: by + 34 },
      { entry: p2, y: by + bh - 34 },
    ];
    const oneSide = [{ entry: p3, y: by + bh / 2 }];
    const leftPins = isBottomView ? oneSide : twoSide;
    const rightPins = isBottomView ? twoSide : oneSide;
    const common = { bx, bw, leadH: 14, calloutW: 162, calloutH: 30 };

    diagramBody = (
      <g>
        <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="#1e293b" stroke="#0f172a" strokeWidth={2} />
        <rect x={bx + 6} y={by + 6} width={bw - 12} height={bh - 12} rx={5} fill="none" stroke="#334155" strokeWidth={1} />
        <circle cx={isBottomView ? bx + bw - 18 : bx + 18} cy={by + 20} r={4.5} fill="#f8fafc" />
        {bodyLabels(bx + bw / 2, by + bh / 2, 14)}
        {leftPins.map(({ entry, y }) => renderSideLead(entry, y, 'left', { ...common, calloutX: 8, lineEnd: 170 }))}
        {rightPins.map(({ entry, y }) => renderSideLead(entry, y, 'right', { ...common, calloutX: 350, lineEnd: 350 }))}
      </g>
    );
  } else if (archetype === 'tab_3') {
    viewHeight = 290;
    const isDpak = pkg.code === 'TO-252-3';
    const isSot89 = pkg.code === 'SOT-89-3';
    const bx = 166;
    const by = 88;
    const bw = 188;
    const bh = 88;
    const tabW = isDpak ? 148 : isSot89 ? 76 : 108;
    const tabX = bx + (bw - tabW) / 2;
    const tabY = isDpak ? 38 : isSot89 ? 50 : 44;
    const tabStroke = epDiffStatus === 'MISMATCH' ? '#dc2626' : epIsLivePower ? '#dc2626' : '#0f766e';
    const tabBadgeBg = epIsLivePower ? '#dc2626' : '#334155';
    const tabPath = isSot89
      ? `M ${tabX + 4} ${tabY} L ${tabX + tabW - 4} ${tabY} L ${tabX + tabW} ${tabY + 4} L ${tabX + tabW} ${by} L ${tabX} ${by} L ${tabX} ${tabY + 4} Z`
      : `M ${tabX + 8} ${tabY} L ${tabX + tabW - 8} ${tabY} L ${tabX + tabW} ${tabY + 8} L ${tabX + tabW} ${by} L ${tabX} ${by} L ${tabX} ${tabY + 8} Z`;

    const orderedPins = isBottomView ? [getPin(3), getPin(2), getPin(1)] : [getPin(1), getPin(2), getPin(3)];
    const leadXs = [198, 260, 322];
    const calloutXs = [10, 180, 350];

    diagramBody = (
      <g>
        <path d={tabPath} fill={`url(#${patternId})`} stroke={tabStroke} strokeWidth={1.75} />
        {tabStatusOverlay(tabPath, tabX + tabW + 8, tabY + 24)}
        {epPresent && (
          <>
            <rect
              x={isSot89 ? bx + bw / 2 - 48 : tabX + 8}
              y={tabY + (isSot89 ? 8 : 12)}
              width={isSot89 ? 96 : tabW - 16}
              height={20}
              rx={4}
              fill={epTheme && epDiffStatus === 'MISMATCH' ? '#dc2626' : tabBadgeBg}
            />
            <text
              x={bx + bw / 2}
              y={tabY + (isSot89 ? 21.5 : 25.5)}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fontFamily={MONO}
              fill="#ffffff"
            >
              {`TAB: ${epShortNet}`}
            </text>
          </>
        )}
        <rect x={bx} y={by} width={bw} height={bh} rx={6} fill="#1e293b" stroke="#0f172a" strokeWidth={2} />
        {isSot89 && (
          <line x1={bx + bw / 2} y1={by} x2={bx + bw / 2} y2={by + bh} stroke="#334155" strokeWidth={1} strokeDasharray="3 3" />
        )}
        <circle cx={isBottomView ? bx + bw - 16 : bx + 16} cy={by + bh - 16} r={4.5} fill="#f8fafc" />
        <text x={bx + bw / 2} y={by + 38} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily={MONO} fill="#f8fafc">
          {pkg.code}
        </text>
        <text x={bx + bw / 2} y={by + 56} textAnchor="middle" fontSize="9.5" fontFamily={MONO} fill="#94a3b8">
          {truncateName(pkg.mfg_package_code, 22)}
        </text>
        {orderedPins.map((entry, idx) => {
          const lx = leadXs[idx];
          const cx = calloutXs[idx];
          const { diff, hl, leadFill, leadStroke, lineWidth } = leadColors(entry.pin);
          const pillCenterX = cx + 80;
          const isDpakCenterStub = isDpak && idx === 1;
          const leadLen = isDpakCenterStub ? 11 : 26;
          return (
            <g key={`t3-${entry.pin}`} {...pinGroupProps(entry.pin)}>
              <rect
                x={lx - 9}
                y={by + bh}
                width={18}
                height={leadLen}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
                strokeDasharray={isDpakCenterStub ? '2 1.5' : undefined}
              />
              {isDpakCenterStub && (
                <text x={lx} y={by + bh + 22} textAnchor="middle" fontSize="8" fontWeight="700" fontFamily={MONO} fill="#64748b">
                  STUB=TAB
                </text>
              )}
              <polyline
                points={`${lx},${by + bh + (isDpakCenterStub ? 25 : leadLen)} ${lx},${by + bh + 38} ${pillCenterX},${by + bh + 52} ${pillCenterX},${238}`}
                fill="none"
                stroke={leadStroke}
                strokeWidth={lineWidth}
              />
              {renderPinCallout(entry, cx, 238, 160, 32, 'left', { diffStatus: diff, highlighted: hl })}
            </g>
          );
        })}
      </g>
    );
  } else if (archetype === 'sot23_5') {
    viewHeight = 258;
    const bx = 196;
    const by = 48;
    const bw = 128;
    const bh = 166;
    const yRows = [by + 30, by + 83, by + 136];
    const threeSide = [
      { entry: getPin(1), y: yRows[0] },
      { entry: getPin(2), y: yRows[1] },
      { entry: getPin(3), y: yRows[2] },
    ];
    const twoSide = [
      { entry: getPin(5), y: yRows[0] },
      { entry: getPin(4), y: yRows[2] },
    ];
    const leftEntries = isBottomView ? twoSide : threeSide;
    const rightEntries = isBottomView ? threeSide : twoSide;
    const common = { bx, bw, leadH: 13, calloutW: 162, calloutH: 30 };

    diagramBody = (
      <g>
        <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="#1e293b" stroke="#0f172a" strokeWidth={2} />
        <rect x={bx + 6} y={by + 6} width={bw - 12} height={bh - 12} rx={5} fill="none" stroke="#334155" strokeWidth={1} />
        <circle cx={isBottomView ? bx + bw - 18 : bx + 18} cy={by + 20} r={4.5} fill="#f8fafc" />
        {bodyLabels(bx + bw / 2, by + bh / 2, 14)}
        {leftEntries.map(({ entry, y }) => renderSideLead(entry, y, 'left', { ...common, calloutX: 8, lineEnd: 170 }))}
        {rightEntries.map(({ entry, y }) => renderSideLead(entry, y, 'right', { ...common, calloutX: 350, lineEnd: 350 }))}
      </g>
    );
  } else if (archetype === 'tab_5') {
    // TO-263-5 (DDPAK / D2PAK-5): top thermal tab + 5 bottom leads.
    // Collision-free routing: row 1 (pins at slots 1/3/5) sits directly below; row 2 (slots 2/4)
    // is fed by leader lines routed through the 18 px gutters between row-1 callout boxes.
    viewHeight = 348;
    const bx = 148;
    const by = 82;
    const bw = 224;
    const bh = 90;
    const tabX = 176;
    const tabW = 168;
    const tabY = 40;
    const tabStroke = epIsLivePower ? '#dc2626' : '#0f766e';
    const tabBadgeBg = epIsLivePower ? '#dc2626' : '#334155';
    const tabPath = `M ${tabX + 12} ${tabY} L ${tabX + tabW - 12} ${tabY} L ${tabX + tabW} ${tabY + 12} L ${tabX + tabW} ${by} L ${tabX} ${by} L ${tabX} ${tabY + 12} Z`;

    const pins5 = isBottomView
      ? [getPin(5), getPin(4), getPin(3), getPin(2), getPin(1)]
      : [getPin(1), getPin(2), getPin(3), getPin(4), getPin(5)];
    const leadXs = [176, 218, 260, 302, 344];
    const leadBottom = by + bh + 24; // 196
    const row1Y = 236;
    const row2Y = 300;
    const boxW = 156;
    const boxH = 32;
    // Row-1 boxes: [8..164], [182..338], [356..512]  → gutters centred at x=173 and x=347.
    // Row-2 boxes centred on those gutters: [95..251], [269..425].
    const routes: Array<{ cx: number; cy: number; points: (lx: number) => string }> = [
      { cx: 8, cy: row1Y, points: (lx) => `${lx},${leadBottom} ${lx},206 ${86},206 ${86},${row1Y}` },
      { cx: 95, cy: row2Y, points: (lx) => `${lx},${leadBottom} ${lx},220 ${173},220 ${173},${row2Y}` },
      { cx: 182, cy: row1Y, points: (lx) => `${lx},${leadBottom} ${lx},${row1Y}` },
      { cx: 269, cy: row2Y, points: (lx) => `${lx},${leadBottom} ${lx},220 ${347},220 ${347},${row2Y}` },
      { cx: 356, cy: row1Y, points: (lx) => `${lx},${leadBottom} ${lx},206 ${434},206 ${434},${row1Y}` },
    ];

    diagramBody = (
      <g>
        <path d={tabPath} fill={`url(#${patternId})`} stroke={epDiffStatus === 'MISMATCH' ? '#dc2626' : tabStroke} strokeWidth={1.75} />
        {tabStatusOverlay(tabPath, tabX + tabW + 8, tabY + 26)}
        {epPresent && (
          <>
            <rect x={tabX + 20} y={tabY + 11} width={tabW - 40} height={20} rx={4} fill={epTheme && epDiffStatus === 'MISMATCH' ? '#dc2626' : tabBadgeBg} />
            <text x={tabX + tabW / 2} y={tabY + 24.5} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily={MONO} fill="#ffffff">
              {`TAB: ${epShortNet}`}
            </text>
          </>
        )}
        <rect x={bx} y={by} width={bw} height={bh} rx={6} fill="#1e293b" stroke="#0f172a" strokeWidth={2} />
        <circle cx={isBottomView ? bx + bw - 16 : bx + 16} cy={by + bh - 16} r={4.5} fill="#f8fafc" />
        <text x={bx + bw / 2} y={by + 40} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily={MONO} fill="#f8fafc">
          {pkg.code}
        </text>
        <text x={bx + bw / 2} y={by + 58} textAnchor="middle" fontSize="9.5" fontFamily={MONO} fill="#94a3b8">
          {truncateName(pkg.mfg_package_code, 22)}
        </text>
        {pins5.map((entry, idx) => {
          const lx = leadXs[idx];
          const route = routes[idx];
          const { diff, hl, leadFill, leadStroke, lineWidth } = leadColors(entry.pin);
          return (
            <g key={`t5-${entry.pin}`} {...pinGroupProps(entry.pin)}>
              <rect x={lx - 7} y={by + bh} width={14} height={24} rx={2} fill={leadFill} stroke={leadStroke} strokeWidth={1.2} />
              <polyline points={route.points(lx)} fill="none" stroke={leadStroke} strokeWidth={lineWidth} strokeLinejoin="round" />
              {renderPinCallout(entry, route.cx, route.cy, boxW, boxH, 'left', { diffStatus: diff, highlighted: hl })}
            </g>
          );
        })}
      </g>
    );
  } else {
    // Dual-row: 6/8/10/14-pin (SOIC / SOT-23-6 / TSOT / SC-70 / SOT-563 / DFN / WSON / VSON)
    const totalPins = Math.max(6, pkg.pin_count);
    const rows = Math.ceil(totalPins / 2);
    const rowStep = rows >= 7 ? 38 : rows >= 5 ? 42 : 44;
    const by = 48;
    const bh = Math.max(150, rows * rowStep + 26);
    viewHeight = by + bh + 26;

    const bx = 188;
    const bw = 144;
    const leadless = isLeadlessPackage(pkg.code);
    // Only draw an exposed pad when the datasheet actually specifies one.
    const showEp = epPresent;

    const leftPins: PinEntry[] = [];
    const rightPins: PinEntry[] = [];
    for (let i = 0; i < rows; i++) {
      const leftPinNum = isBottomView ? totalPins - i : i + 1;
      const rightPinNum = isBottomView ? i + 1 : totalPins - i;
      leftPins.push(getPin(leftPinNum));
      rightPins.push(getPin(rightPinNum));
    }
    const firstRowY = by + (bh - (rows - 1) * rowStep) / 2;
    const calloutH = rows >= 7 ? 28 : 30;
    const common = { bx, bw, leadH: 12, calloutW: 158, calloutH, leadless };
    const epStroke = epTheme ? epTheme.stroke : epIsLivePower ? '#ef4444' : '#38bdf8';
    const epInfoH = epStatusLabel ? 58 : 44;

    const dipNotch = hasDipNotch(pkg.code);
    const xrayBottomPads = leadless && !isBottomView;

    diagramBody = (
      <g>
        <rect x={bx} y={by} width={bw} height={bh} rx={leadless ? 4 : 7} fill="#1e293b" stroke="#0f172a" strokeWidth={2} />
        {xrayBottomPads && (
          <rect
            x={bx + 5}
            y={by + 5}
            width={bw - 10}
            height={bh - 10}
            rx={3}
            fill="none"
            stroke="#475569"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
        {dipNotch && (
          <path
            d={`M ${bx + bw / 2 - 12} ${by} A 12 12 0 0 0 ${bx + bw / 2 + 12} ${by}`}
            fill="#0f172a"
            stroke="#64748b"
            strokeWidth={1.2}
          />
        )}
        <circle cx={isBottomView ? bx + bw - 18 : bx + 18} cy={by + 18} r={4.5} fill="#f8fafc" />

        {showEp && (
          <g>
            <rect
              x={bx + 32}
              y={by + 28}
              width={bw - 64}
              height={bh - 56}
              rx={4}
              fill={`url(#${patternId})`}
              stroke={epStroke}
              strokeWidth={epTheme ? (epDiffStatus === 'MISMATCH' ? 3.25 : 2.5) : 1.5}
              strokeDasharray={epTheme ? undefined : '4 2'}
            />
            {epTheme && (
              <rect x={bx + 32} y={by + 28} width={bw - 64} height={bh - 56} rx={4} fill={epTheme.tint} fillOpacity={0.5} />
            )}
            <rect x={bx + 34} y={by + bh / 2 - epInfoH / 2} width={bw - 68} height={epInfoH} rx={4} fill="rgba(15, 23, 42, 0.9)" />
            <text
              x={bx + bw / 2}
              y={by + bh / 2 - epInfoH / 2 + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fontFamily={MONO}
              fill="#f8fafc"
            >
              {pkg.code}
            </text>
            <text
              x={bx + bw / 2}
              y={by + bh / 2 - epInfoH / 2 + 32}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fontFamily={MONO}
              fill={epIsLivePower ? '#fca5a5' : '#7dd3fc'}
            >
              {`EP: ${epNet === 'THERMAL_GND_RECOMMENDED' ? 'GND' : epNet}`}
            </text>
            {epStatusLabel && epTheme && (
              <text
                x={bx + bw / 2}
                y={by + bh / 2 - epInfoH / 2 + 48}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="800"
                fontFamily={MONO}
                fill={epDiffStatus === 'MISMATCH' ? '#f87171' : epDiffStatus === 'CAUTION' ? '#fbbf24' : '#34d399'}
              >
                {epStatusLabel}
              </text>
            )}
          </g>
        )}

        {!showEp && bodyLabels(bx + bw / 2, by + bh / 2, 16)}

        {leftPins.map((entry, idx) =>
          renderSideLead(entry, firstRowY + idx * rowStep, 'left', { ...common, calloutX: 6, lineEnd: 164 }),
        )}
        {rightPins.map((entry, idx) =>
          renderSideLead(entry, firstRowY + idx * rowStep, 'right', { ...common, calloutX: 356, lineEnd: 356 }),
        )}
      </g>
    );
  }

  const effectiveViewLabel = isBottomView ? 'BOTTOM VIEW' : 'TOP VIEW';
  const viewBadgeText = mirrored
    ? isBottomView
      ? 'BOTTOM VIEW (PCB UNDERSIDE MIRROR)'
      : 'TOP VIEW (MIRRORED FROM DATASHEET)'
    : effectiveViewLabel;

  const activeEntry = activePin !== null ? pkg.pinout.find((p) => p.pin === activePin) ?? null : null;

  const handleCopyMarkdown = async () => {
    const ok = await copyText(buildPinoutMarkdown(opn, pkg));
    setCopyState(ok ? 'copied' : 'failed');
    trackEvent('pinout_copy_markdown', { opn, package_code: pkg.code, success: ok });
    window.setTimeout(() => setCopyState('idle'), 1800);
  };

  const handleCopyKicadCsv = async () => {
    const ok = await copyText(buildPinoutKicadCsv(opn, pkg));
    setCsvCopyState(ok ? 'copied' : 'failed');
    trackEvent('pinout_copy_kicad_csv', { opn, package_code: pkg.code, success: ok });
    window.setTimeout(() => setCsvCopyState('idle'), 1800);
  };

  const handleDownloadSvg = () => {
    const node = svgRef.current;
    if (!node) return;
    try {
      const clone = node.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.removeAttribute('class');
      const serialized = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${opn.replace(/[^a-zA-Z0-9._-]/g, '_')}_${pkg.code}_${isBottomView ? 'bottom' : 'top'}_pinout.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackEvent('pinout_download_svg', { opn, package_code: pkg.code, mirrored });
    } catch {
      // non-blocking
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden break-inside-avoid">
      {/* Top Technical Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-900 px-3.5 py-2 text-xs text-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-tight text-white">{opn}</span>
          <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">
            {pkg.code} ({pkg.pin_count}-pin)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
              mirrored
                ? 'bg-amber-400 text-slate-950 border border-amber-300'
                : isBottomView
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                  : 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
            }`}
          >
            {viewBadgeText}
          </span>
          <span className="font-mono text-[11px] text-emerald-300">
            {pkg.pinout_vision_verified ? `300 DPI Vision · p.${pkg.pinout_source_page}` : `p.${pkg.pinout_source_page}`}
          </span>
        </div>
      </div>

      {/* Interactive engineering toolbar */}
      {interactive && (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          {!hideMirrorToggle ? (
            <ViewToggle mirrored={mirrored} onChange={setMirrored} datasheetView={pkg.pinout_view} />
          ) : (
            <span className="text-[11px] font-mono text-slate-500">Hover / tap any pin to inspect</span>
          )}
          {exportsVisible && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyKicadCsv}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {csvCopyState === 'copied' ? '✓ Copied CSV' : csvCopyState === 'failed' ? 'Copy failed' : 'Copy KiCad CSV'}
              </button>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {copyState === 'copied' ? '✓ Copied MD' : copyState === 'failed' ? 'Copy failed' : 'Copy MD'}
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Download SVG
              </button>
            </div>
          )}
        </div>
      )}

      {/* SVG Drawing Canvas */}
      <div className={`bg-slate-50/70 ${compact ? 'p-2' : 'p-3 sm:p-4'}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          width={viewWidth}
          height={viewHeight}
          role={interactive ? 'group' : 'img'}
          aria-label={`${opn} ${pkg.code} ${effectiveViewLabel.toLowerCase()} pinout diagram`}
          className="h-auto w-full max-w-[540px] mx-auto block select-none"
        >
          <title>{`${opn} — ${pkg.code} (${pkg.mfg_package_code}) ${effectiveViewLabel} Pinout`}</title>
          <desc>{`Deterministic IC pinout diagram for ${opn} (${pkg.code}), datasheet page ${pkg.pinout_source_page}.${mirrored ? ' Horizontally mirrored from the datasheet view for PCB underside inspection.' : ''}`}</desc>
          <defs>
            <pattern id={patternId} width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#e2e8f0" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2.5" />
            </pattern>
          </defs>
          <rect x="1" y="1" width={viewWidth - 2} height={viewHeight - 2} rx="6" fill="#ffffff" stroke={mirrored ? '#f59e0b' : '#e2e8f0'} strokeWidth={mirrored ? 2 : 1} />
          <text
            x={viewWidth / 2}
            y={22}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.08em"
            fontFamily={MONO}
            fill={mirrored ? '#b45309' : '#475569'}
          >
            {mirrored
              ? `${effectiveViewLabel} · MIRRORED · NOT TO SCALE · PIN 1 DOT MARKED`
              : `${effectiveViewLabel} · NOT TO SCALE · PIN 1 DOT MARKED`}
          </text>
          {diagramBody}
        </svg>
      </div>

      {/* Pin inspector */}
      {interactive && !hideInspector && (
        <div
          className="print:hidden flex min-h-[34px] flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200 bg-sky-50/60 px-3.5 py-1.5 text-xs"
          aria-live="polite"
        >
          {activeEntry ? (
            <>
              <span className="rounded bg-sky-700 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">Pin {activeEntry.pin}</span>
              <span className="font-mono font-bold text-slate-900">{activeEntry.name}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-[11px] font-semibold text-violet-800">{activeEntry.role}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-700">{activeEntry.description}</span>
              {getDiff(activeEntry.pin) && (
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    getDiff(activeEntry.pin) === 'MATCH'
                      ? 'bg-emerald-100 text-emerald-800'
                      : getDiff(activeEntry.pin) === 'CAUTION'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {getDiff(activeEntry.pin)}
                </span>
              )}
            </>
          ) : activePin !== null ? (
            <span className="font-mono text-slate-600">Pin {activePin} · not present on this package</span>
          ) : (
            <span className="text-slate-500">Hover or tap any pin to inspect its name, role and datasheet notes.</span>
          )}
        </div>
      )}

      {/* EP / TAB comparison status strip */}
      {epDiffStatus && (
        <div
          className={`border-t px-3.5 py-1.5 text-xs flex flex-wrap items-center gap-2 ${
            epDiffStatus === 'MISMATCH'
              ? 'border-red-300 bg-red-50 text-red-950'
              : epDiffStatus === 'CAUTION'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-emerald-200 bg-emerald-50 text-emerald-950'
          }`}
        >
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white ${
              epDiffStatus === 'MISMATCH' ? 'bg-red-600' : epDiffStatus === 'CAUTION' ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
          >
            {epStatusLabel ?? epDiffStatus}
          </span>
          <span>
            {epPresent
              ? `This part's ${isTabArchetype ? 'tab' : 'exposed pad'} net: ${epNet}.`
              : 'This part has no exposed pad / tab.'}{' '}
            {epDiffStatus === 'MISMATCH'
              ? 'Pad/tab nets conflict between the compared parts — PCB copper under the pad must be re-assigned.'
              : epDiffStatus === 'CAUTION'
                ? 'Pad/tab differs but may be tolerable — verify thermal copper and net per datasheet.'
                : 'Pad/tab treatment is consistent between the compared parts.'}
          </span>
        </div>
      )}

      {/* Exposed Pad / Tab Warning Banner */}
      {epPresent && (
        <div
          className={`border-t px-3.5 py-2 text-xs flex flex-wrap items-start gap-2 ${
            epIsLivePower ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-amber-200 bg-amber-50/80 text-amber-950'
          }`}
        >
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
              epIsLivePower ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
            }`}
          >
            {`EXPOSED PAD / TAB: ${epNet}`}
          </span>
          <span className="leading-relaxed">
            {pkg.exposed_pad.note
              ? pkg.exposed_pad.note
              : epNet === 'VOUT'
                ? 'Thermal tab is electrically tied to VOUT — DO NOT connect tab directly to GND plane.'
                : epNet === 'GND' || epNet === 'THERMAL_GND_RECOMMENDED'
                  ? 'Solder exposed thermal pad to PCB GND plane with thermal vias to achieve datasheet θJA.'
                  : `Verify electrical connection of exposed thermal pad (${epNet}) in official datasheet.`}
          </span>
        </div>
      )}

      {/* Compact Color Key */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3.5 py-2 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> VIN/VCC
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> VOUT/OUT
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" /> GND/VEE
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-600" /> SW/BOOT
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" /> EN/FB/IN
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> NC
            </span>
          </div>
          {diffHighlights && (
            <div className="flex items-center gap-2.5 font-mono font-semibold">
              <span className="text-emerald-700">✓ Match</span>
              <span className="text-amber-700">~ Caution</span>
              <span className="text-rose-700">! Mismatch</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Side-by-side synchronized comparison view
 * ---------------------------------------------------------------------------------------------- */

export interface VsPinoutComparisonViewProps {
  partAOpn: string;
  partAPkg: PackageInfo;
  partBOpn: string;
  partBPkg: PackageInfo;
  exposedPadMatch: boolean;
  diffHighlights?: Record<number, DiffStatus> | null;
  /** Overrides the status derived from `exposedPadMatch` (e.g. CAUTION). */
  epDiffStatus?: EpDiffStatus;
  partAHref?: string;
  partBHref?: string;
  partAManufacturer?: string;
  partBManufacturer?: string;
  compact?: boolean;
}

export function VsPinoutComparisonView({
  partAOpn,
  partAPkg,
  partBOpn,
  partBPkg,
  exposedPadMatch,
  diffHighlights = null,
  epDiffStatus,
  partAHref,
  partBHref,
  partAManufacturer,
  partBManufacturer,
  compact = false,
}: VsPinoutComparisonViewProps) {
  const [activePin, setActivePin] = useState<number | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const epStatus: EpDiffStatus = epDiffStatus ?? (exposedPadMatch ? 'MATCH' : 'MISMATCH');

  const maxPins = Math.max(partAPkg.pin_count, partBPkg.pin_count, ...partAPkg.pinout.map((p) => p.pin), ...partBPkg.pinout.map((p) => p.pin));
  const pinNumbers = useMemo(() => Array.from({ length: maxPins }, (_, i) => i + 1), [maxPins]);
  const pinA = activePin !== null ? partAPkg.pinout.find((p) => p.pin === activePin) ?? null : null;
  const pinB = activePin !== null ? partBPkg.pinout.find((p) => p.pin === activePin) ?? null : null;
  const activeStatus = activePin !== null && diffHighlights ? diffHighlights[activePin] : undefined;

  const handleMirror = (next: boolean) => {
    setMirrored(next);
    trackEvent('vs_pinout_view_toggle', { part_a: partAOpn, part_b: partBOpn, mirrored: next });
  };

  const header = (label: string, opn: string, href?: string, mfg?: string) => (
    <div className="flex items-center justify-between px-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label} ·{' '}
        {href ? (
          <Link href={href} className="font-mono text-sky-700 hover:underline">
            {opn}
          </Link>
        ) : (
          <span className="font-mono text-slate-900">{opn}</span>
        )}
      </span>
      {mfg && <span className="text-xs text-slate-500">{mfg}</span>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            mirrored={mirrored}
            onChange={handleMirror}
            datasheetView={partAPkg.pinout_view === partBPkg.pinout_view ? partAPkg.pinout_view : 'MIXED'}
          />
          {mirrored && (
            <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900">
              BOTH DIAGRAMS MIRRORED (PCB UNDERSIDE)
            </span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
          Jump to pin
          <select
            value={activePin ?? ''}
            onChange={(e) => setActivePin(e.target.value === '' ? null : Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px]"
          >
            <option value="">—</option>
            {pinNumbers.map((n) => (
              <option key={n} value={n}>
                Pin {n}
                {diffHighlights?.[n] ? ` (${diffHighlights[n]})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {header('Part A', partAOpn, partAHref, partAManufacturer)}
          <PackagePinoutSvg
            opn={partAOpn}
            pkg={partAPkg}
            diffHighlights={diffHighlights}
            epDiffStatus={epStatus}
            compact={compact}
            highlightedPin={activePin}
            onPinHover={setActivePin}
            mirrored={mirrored}
            hideMirrorToggle
            hideInspector
          />
        </div>
        <div className="space-y-2">
          {header('Part B', partBOpn, partBHref, partBManufacturer)}
          <PackagePinoutSvg
            opn={partBOpn}
            pkg={partBPkg}
            diffHighlights={diffHighlights}
            epDiffStatus={epStatus}
            compact={compact}
            highlightedPin={activePin}
            onPinHover={setActivePin}
            mirrored={mirrored}
            hideMirrorToggle
            hideInspector
          />
        </div>
      </div>

      {/* Synchronized combined pin inspector */}
      <div
        className={`print:hidden rounded-lg border px-3.5 py-2 text-xs ${
          activeStatus === 'MISMATCH'
            ? 'border-rose-300 bg-rose-50'
            : activeStatus === 'CAUTION'
              ? 'border-amber-300 bg-amber-50'
              : activeStatus === 'MATCH'
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-slate-300 bg-white'
        }`}
        aria-live="polite"
      >
        {activePin === null ? (
          <span className="text-slate-500">
            Hover or tap a pin on either diagram — both diagrams highlight the same pin number in sync.
          </span>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-start sm:gap-3">
            <span className="w-fit rounded bg-sky-700 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">Pin {activePin}</span>
            <div>
              <div className="font-mono text-[10px] font-bold uppercase text-slate-500">{partAOpn}</div>
              {pinA ? (
                <div>
                  <span className="font-mono font-bold">{pinA.name}</span>{' '}
                  <span className="font-mono text-[11px] text-violet-800">({pinA.role})</span>
                  <div className="text-slate-600">{pinA.description}</div>
                </div>
              ) : (
                <div className="font-semibold text-rose-700">Pin not present</div>
              )}
            </div>
            <div>
              <div className="font-mono text-[10px] font-bold uppercase text-slate-500">{partBOpn}</div>
              {pinB ? (
                <div>
                  <span className="font-mono font-bold">{pinB.name}</span>{' '}
                  <span className="font-mono text-[11px] text-violet-800">({pinB.role})</span>
                  <div className="text-slate-600">{pinB.description}</div>
                </div>
              ) : (
                <div className="font-semibold text-rose-700">Pin not present</div>
              )}
            </div>
            {activeStatus && (
              <span
                className={`w-fit rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white ${
                  activeStatus === 'MATCH' ? 'bg-emerald-600' : activeStatus === 'CAUTION' ? 'bg-amber-600' : 'bg-rose-600'
                }`}
              >
                {activeStatus}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PackagePinoutSvg;
