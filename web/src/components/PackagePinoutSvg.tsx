import React from 'react';
import type { PackageCode, PackageInfo, PinEntry, PinRole } from '@/types/schema';

export type DiffStatus = 'MATCH' | 'MISMATCH' | 'CAUTION';

export interface PackagePinoutSvgProps {
  opn: string;
  pkg: PackageInfo;
  diffHighlights?: Record<number, DiffStatus> | null;
  compact?: boolean;
}

interface RoleTheme {
  fill: string;
  stroke: string;
  text: string;
  tagBg: string;
  tagText: string;
}

function getRoleTheme(role: PinRole): RoleTheme {
  switch (role) {
    case 'VIN':
    case 'VCC':
      return {
        fill: '#fef2f2',
        stroke: '#dc2626',
        text: '#991b1b',
        tagBg: '#dc2626',
        tagText: '#ffffff',
      };
    case 'VOUT':
    case 'OUT':
    case 'OUT_A':
    case 'OUT_B':
      return {
        fill: '#eff6ff',
        stroke: '#2563eb',
        text: '#1e40af',
        tagBg: '#2563eb',
        tagText: '#ffffff',
      };
    case 'GND':
    case 'VEE':
      return {
        fill: '#f1f5f9',
        stroke: '#334155',
        text: '#0f172a',
        tagBg: '#1e293b',
        tagText: '#ffffff',
      };
    case 'SW':
    case 'BOOT':
      return {
        fill: '#fffbeb',
        stroke: '#d97706',
        text: '#92400e',
        tagBg: '#d97706',
        tagText: '#ffffff',
      };
    case 'NC':
    case 'OTHER':
      return {
        fill: '#f8fafc',
        stroke: '#94a3b8',
        text: '#64748b',
        tagBg: '#94a3b8',
        tagText: '#ffffff',
      };
    default:
      // EN, FB, ADJ, BYPASS, COMP, SS, PG, IN_POS*, IN_NEG*, VREF, SYNC, MODE, PS
      return {
        fill: '#f5f3ff',
        stroke: '#7c3aed',
        text: '#5b21b6',
        tagBg: '#7c3aed',
        tagText: '#ffffff',
      };
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
      return {
        stroke: '#16a34a',
        fill: '#dcfce7',
        leadFill: '#86efac',
        badgeBg: '#16a34a',
        symbol: '✓',
      };
    case 'MISMATCH':
      return {
        stroke: '#dc2626',
        fill: '#fee2e2',
        leadFill: '#fca5a5',
        badgeBg: '#dc2626',
        symbol: '!',
      };
    case 'CAUTION':
      return {
        stroke: '#d97706',
        fill: '#fef3c7',
        leadFill: '#fcd34d',
        badgeBg: '#d97706',
        symbol: '~',
      };
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
  return (
    code === 'DFN-6' ||
    code === 'WSON-6' ||
    code === 'DFN-8' ||
    code === 'VSON-10' ||
    code === 'VSON-14'
  );
}

function renderPinCallout(
  entry: PinEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  align: 'left' | 'right' | 'center',
  diffStatus: DiffStatus | undefined,
): React.ReactNode {
  const roleTheme = getRoleTheme(entry.role);
  const diffTheme = diffStatus ? getDiffTheme(diffStatus) : null;
  const rectFill = diffTheme ? diffTheme.fill : roleTheme.fill;
  const rectStroke = diffTheme ? diffTheme.stroke : roleTheme.stroke;
  const strokeWidth = diffStatus === 'MISMATCH' ? 2 : 1.25;
  const pinStr = String(entry.pin);
  const roleStr = shortRoleLabel(entry.role);
  const nameStr = truncateName(entry.name, 9);

  const badgeW = 22;
  const rolePillW = Math.max(36, roleStr.length * 6.5 + 10);
  const cy = y + height / 2;

  if (align === 'right') {
    // Callout placed on LEFT side of IC body (pin number closest to IC body on the right)
    const pinBadgeX = x + width - badgeW - 3;
    const rolePillX = x + 4;
    const textX = rolePillX + rolePillW + 6;
    return (
      <g key={`callout-${entry.pin}`}>
        <title>{`Pin ${entry.pin}: ${entry.name} (${entry.role}) — ${entry.description}`}</title>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={5}
          fill={rectFill}
          stroke={rectStroke}
          strokeWidth={strokeWidth}
        />
        {/* Role pill */}
        <rect
          x={rolePillX}
          y={y + 4}
          width={rolePillW}
          height={height - 8}
          rx={3}
          fill={roleTheme.tagBg}
        />
        <text
          x={rolePillX + rolePillW / 2}
          y={cy + 3.5}
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={roleTheme.tagText}
        >
          {roleStr}
        </text>
        {/* Pin Name */}
        <text
          x={textX}
          y={cy + 4}
          textAnchor="start"
          fontSize="11"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#0f172a"
        >
          {nameStr}
        </text>
        {/* Pin Number Box */}
        <rect
          x={pinBadgeX}
          y={y + 3}
          width={badgeW}
          height={height - 6}
          rx={3}
          fill={diffTheme ? diffTheme.badgeBg : '#0f172a'}
        />
        <text
          x={pinBadgeX + badgeW / 2}
          y={cy + 3.5}
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#ffffff"
        >
          {pinStr}
        </text>
        {diffTheme && (
          <g>
            <circle cx={x + 2} cy={y + 2} r={7} fill={diffTheme.badgeBg} />
            <text
              x={x + 2}
              y={y + 5.5}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="800"
              fill="#ffffff"
            >
              {diffTheme.symbol}
            </text>
          </g>
        )}
      </g>
    );
  }

  // Callout placed on RIGHT side (or bottom row): pin number on left, name middle, role pill on right
  const pinBadgeX = x + 3;
  const rolePillX = x + width - rolePillW - 4;
  const textX = pinBadgeX + badgeW + 6;
  return (
    <g key={`callout-${entry.pin}`}>
      <title>{`Pin ${entry.pin}: ${entry.name} (${entry.role}) — ${entry.description}`}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={5}
        fill={rectFill}
        stroke={rectStroke}
        strokeWidth={strokeWidth}
      />
      <rect
        x={pinBadgeX}
        y={y + 3}
        width={badgeW}
        height={height - 6}
        rx={3}
        fill={diffTheme ? diffTheme.badgeBg : '#0f172a'}
      />
      <text
        x={pinBadgeX + badgeW / 2}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="#ffffff"
      >
        {pinStr}
      </text>
      <text
        x={textX}
        y={cy + 4}
        textAnchor="start"
        fontSize="11"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="#0f172a"
      >
        {nameStr}
      </text>
      <rect
        x={rolePillX}
        y={y + 4}
        width={rolePillW}
        height={height - 8}
        rx={3}
        fill={roleTheme.tagBg}
      />
      <text
        x={rolePillX + rolePillW / 2}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={roleTheme.tagText}
      >
        {roleStr}
      </text>
      {diffTheme && (
        <g>
          <circle cx={x + width - 2} cy={y + 2} r={7} fill={diffTheme.badgeBg} />
          <text
            x={x + width - 2}
            y={y + 5.5}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="800"
            fill="#ffffff"
          >
            {diffTheme.symbol}
          </text>
        </g>
      )}
    </g>
  );
}

export function PackagePinoutSvg({
  opn,
  pkg,
  diffHighlights = null,
  compact = false,
}: PackagePinoutSvgProps) {
  const archetype = getArchetype(pkg.code);
  const isBottomView = pkg.pinout_view === 'BOTTOM_VIEW';
  const pinMap = new Map<number, PinEntry>();
  for (const p of pkg.pinout) {
    pinMap.set(p.pin, p);
  }
  const getPin = (num: number): PinEntry =>
    pinMap.get(num) ?? {
      pin: num,
      name: `P${num}`,
      role: 'OTHER',
      description: `Pin ${num}`,
    };

  const getDiff = (num: number): DiffStatus | undefined =>
    diffHighlights ? diffHighlights[num] : undefined;

  const epPresent = pkg.exposed_pad.present;
  const epNet = pkg.exposed_pad.net;
  const epShortNet = epNet === 'THERMAL_GND_RECOMMENDED' ? 'GND*' : epNet;
  const epIsLivePower = epNet === 'VOUT' || epNet === 'VIN' || epNet === 'SW';
  const patternId = `ep-hatch-${opn.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}-${pkg.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}${diffHighlights ? '-d' : ''}`;

  const viewWidth = 520;
  let viewHeight = 250;
  let diagramBody: React.ReactNode = null;

  if (archetype === 'sot23_3') {
    viewHeight = 236;
    const bx = 196;
    const by = 52;
    const bw = 128;
    const bh = 132;
    const p1 = getPin(1);
    const p2 = getPin(2);
    const p3 = getPin(3);

    // CCW TOP VIEW: 1 (Top-Left), 2 (Bottom-Left), 3 (Mid-Right). Mirrored horizontally for BOTTOM_VIEW.
    const leftPins = isBottomView
      ? [{ entry: p3, y: by + bh / 2 }]
      : [
          { entry: p1, y: by + 34 },
          { entry: p2, y: by + bh - 34 },
        ];
    const rightPins = isBottomView
      ? [
          { entry: p1, y: by + 34 },
          { entry: p2, y: by + bh - 34 },
        ]
      : [{ entry: p3, y: by + bh / 2 }];

    diagramBody = (
      <g>
        {/* IC Body */}
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={8}
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth={2}
        />
        <rect
          x={bx + 6}
          y={by + 6}
          width={bw - 12}
          height={bh - 12}
          rx={5}
          fill="none"
          stroke="#334155"
          strokeWidth={1}
        />
        {/* Pin 1 dot */}
        <circle
          cx={isBottomView ? bx + bw - 18 : bx + 18}
          cy={by + 20}
          r={4.5}
          fill="#f8fafc"
        />
        <text
          x={bx + bw / 2}
          y={by + bh / 2 - 4}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#f8fafc"
        >
          {pkg.code}
        </text>
        <text
          x={bx + bw / 2}
          y={by + bh / 2 + 12}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#94a3b8"
        >
          {truncateName(pkg.mfg_package_code, 14)}
        </text>

        {/* Left leads & callouts */}
        {leftPins.map(({ entry, y }) => {
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          return (
            <g key={`l-${entry.pin}`}>
              <rect
                x={bx - 22}
                y={y - 7}
                width={22}
                height={14}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
              />
              <line
                x1={170}
                y1={y}
                x2={bx - 22}
                y2={y}
                stroke={leadStroke}
                strokeWidth={1.25}
                strokeDasharray="2 2"
              />
              {renderPinCallout(entry, 8, y - 15, 162, 30, 'right', diff)}
            </g>
          );
        })}

        {/* Right leads & callouts */}
        {rightPins.map(({ entry, y }) => {
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          return (
            <g key={`r-${entry.pin}`}>
              <rect
                x={bx + bw}
                y={y - 7}
                width={22}
                height={14}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
              />
              <line
                x1={bx + bw + 22}
                y1={y}
                x2={350}
                y2={y}
                stroke={leadStroke}
                strokeWidth={1.25}
                strokeDasharray="2 2"
              />
              {renderPinCallout(entry, 350, y - 15, 162, 30, 'left', diff)}
            </g>
          );
        })}
      </g>
    );
  } else if (archetype === 'tab_3') {
    viewHeight = 290;
    const bx = 166;
    const by = 88;
    const bw = 188;
    const bh = 88;
    const tabX = 206;
    const tabW = 108;
    const tabY = 44;
    const tabH = 44;
    const tabStroke = epIsLivePower ? '#dc2626' : '#0f766e';
    const tabBadgeBg = epIsLivePower ? '#dc2626' : '#334155';

    const orderedPins = isBottomView
      ? [getPin(3), getPin(2), getPin(1)]
      : [getPin(1), getPin(2), getPin(3)];
    const leadXs = [198, 260, 322];
    const calloutXs = [10, 180, 350];

    diagramBody = (
      <g>
        {/* Top Thermal Tab */}
        <path
          d={`M ${tabX + 8} ${tabY} L ${tabX + tabW - 8} ${tabY} L ${tabX + tabW} ${tabY + 8} L ${tabX + tabW} ${by} L ${tabX} ${by} L ${tabX} ${tabY + 8} Z`}
          fill={`url(#${patternId})`}
          stroke={tabStroke}
          strokeWidth={1.75}
        />
        <rect
          x={tabX + 8}
          y={tabY + 12}
          width={tabW - 16}
          height={20}
          rx={4}
          fill={tabBadgeBg}
        />
        <text
          x={tabX + tabW / 2}
          y={tabY + 25.5}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#ffffff"
        >
          {`TAB: ${epPresent ? epShortNet : 'NC'}`}
        </text>

        {/* IC Body */}
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={6}
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth={2}
        />
        <circle
          cx={isBottomView ? bx + bw - 16 : bx + 16}
          cy={by + bh - 16}
          r={4.5}
          fill="#f8fafc"
        />
        <text
          x={bx + bw / 2}
          y={by + 38}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#f8fafc"
        >
          {pkg.code}
        </text>
        <text
          x={bx + bw / 2}
          y={by + 56}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#94a3b8"
        >
          {truncateName(pkg.mfg_package_code, 22)}
        </text>

        {/* Bottom 3 Leads + Fanned Callouts */}
        {orderedPins.map((entry, idx) => {
          const lx = leadXs[idx];
          const cx = calloutXs[idx];
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          const pillCenterX = cx + 80;
          return (
            <g key={`t3-${entry.pin}`}>
              <rect
                x={lx - 9}
                y={by + bh}
                width={18}
                height={26}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
              />
              <polyline
                points={`${lx},${by + bh + 26} ${lx},${by + bh + 38} ${pillCenterX},${by + bh + 52} ${pillCenterX},${238}`}
                fill="none"
                stroke={leadStroke}
                strokeWidth={1.3}
              />
              {renderPinCallout(entry, cx, 238, 160, 32, 'left', diff)}
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

    const leftEntries = isBottomView
      ? [
          { entry: getPin(5), y: yRows[0] },
          { entry: getPin(4), y: yRows[2] },
        ]
      : [
          { entry: getPin(1), y: yRows[0] },
          { entry: getPin(2), y: yRows[1] },
          { entry: getPin(3), y: yRows[2] },
        ];
    const rightEntries = isBottomView
      ? [
          { entry: getPin(1), y: yRows[0] },
          { entry: getPin(2), y: yRows[1] },
          { entry: getPin(3), y: yRows[2] },
        ]
      : [
          { entry: getPin(5), y: yRows[0] },
          { entry: getPin(4), y: yRows[2] },
        ];

    diagramBody = (
      <g>
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={8}
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth={2}
        />
        <rect
          x={bx + 6}
          y={by + 6}
          width={bw - 12}
          height={bh - 12}
          rx={5}
          fill="none"
          stroke="#334155"
          strokeWidth={1}
        />
        <circle
          cx={isBottomView ? bx + bw - 18 : bx + 18}
          cy={by + 20}
          r={4.5}
          fill="#f8fafc"
        />
        <text
          x={bx + bw / 2}
          y={by + bh / 2 - 4}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#f8fafc"
        >
          {pkg.code}
        </text>
        <text
          x={bx + bw / 2}
          y={by + bh / 2 + 12}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#94a3b8"
        >
          {truncateName(pkg.mfg_package_code, 14)}
        </text>

        {leftEntries.map(({ entry, y }) => {
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          return (
            <g key={`l5-${entry.pin}`}>
              <rect
                x={bx - 22}
                y={y - 6.5}
                width={22}
                height={13}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
              />
              <line
                x1={170}
                y1={y}
                x2={bx - 22}
                y2={y}
                stroke={leadStroke}
                strokeWidth={1.25}
                strokeDasharray="2 2"
              />
              {renderPinCallout(entry, 8, y - 15, 162, 30, 'right', diff)}
            </g>
          );
        })}

        {rightEntries.map(({ entry, y }) => {
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          return (
            <g key={`r5-${entry.pin}`}>
              <rect
                x={bx + bw}
                y={y - 6.5}
                width={22}
                height={13}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
              />
              <line
                x1={bx + bw + 22}
                y1={y}
                x2={350}
                y2={y}
                stroke={leadStroke}
                strokeWidth={1.25}
                strokeDasharray="2 2"
              />
              {renderPinCallout(entry, 350, y - 15, 162, 30, 'left', diff)}
            </g>
          );
        })}
      </g>
    );
  } else if (archetype === 'tab_5') {
    // TO-263-5 (DDPAK / D2PAK-5): Top thermal tab + 5 bottom leads
    viewHeight = 342;
    const bx = 148;
    const by = 82;
    const bw = 224;
    const bh = 90;
    const tabX = 176;
    const tabW = 168;
    const tabY = 40;
    const tabStroke = epIsLivePower ? '#dc2626' : '#0f766e';
    const tabBadgeBg = epIsLivePower ? '#dc2626' : '#334155';

    const pins5 = isBottomView
      ? [getPin(5), getPin(4), getPin(3), getPin(2), getPin(1)]
      : [getPin(1), getPin(2), getPin(3), getPin(4), getPin(5)];
    const leadXs = [176, 218, 260, 302, 344];
    const placements = [
      { cx: 10, cy: 232 },
      { cx: 92, cy: 288 },
      { cx: 180, cy: 232 },
      { cx: 268, cy: 288 },
      { cx: 350, cy: 232 },
    ];

    diagramBody = (
      <g>
        <path
          d={`M ${tabX + 12} ${tabY} L ${tabX + tabW - 12} ${tabY} L ${tabX + tabW} ${tabY + 12} L ${tabX + tabW} ${by} L ${tabX} ${by} L ${tabX} ${tabY + 12} Z`}
          fill={`url(#${patternId})`}
          stroke={tabStroke}
          strokeWidth={1.75}
        />
        <rect
          x={tabX + 20}
          y={tabY + 11}
          width={tabW - 40}
          height={20}
          rx={4}
          fill={tabBadgeBg}
        />
        <text
          x={tabX + tabW / 2}
          y={tabY + 24.5}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#ffffff"
        >
          {`TAB: ${epPresent ? epShortNet : 'NC'}`}
        </text>

        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={6}
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth={2}
        />
        <circle
          cx={isBottomView ? bx + bw - 16 : bx + 16}
          cy={by + bh - 16}
          r={4.5}
          fill="#f8fafc"
        />
        <text
          x={bx + bw / 2}
          y={by + 40}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#f8fafc"
        >
          {pkg.code}
        </text>
        <text
          x={bx + bw / 2}
          y={by + 58}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#94a3b8"
        >
          {truncateName(pkg.mfg_package_code, 22)}
        </text>

        {pins5.map((entry, idx) => {
          const lx = leadXs[idx];
          const { cx, cy } = placements[idx];
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          const pillCenterX = cx + 80;
          const elbowY = cy > 250 ? 274 : 216;
          return (
            <g key={`t5-${entry.pin}`}>
              <rect
                x={lx - 7}
                y={by + bh}
                width={14}
                height={24}
                rx={2}
                fill={leadFill}
                stroke={leadStroke}
                strokeWidth={1.2}
              />
              <polyline
                points={`${lx},${by + bh + 24} ${lx},${elbowY} ${pillCenterX},${elbowY} ${pillCenterX},${cy}`}
                fill="none"
                stroke={leadStroke}
                strokeWidth={1.25}
              />
              {renderPinCallout(entry, cx, cy, 160, 32, 'left', diff)}
            </g>
          );
        })}
      </g>
    );
  } else {
    // Dual-row: 6-pin, 8-pin, 10-pin, 14-pin (SOIC / SOT-23-6 / TSOT / SC-70 / SOT-563 / DFN / WSON / VSON)
    const totalPins = Math.max(6, pkg.pin_count);
    const rows = Math.ceil(totalPins / 2);
    const rowStep = rows >= 7 ? 38 : rows >= 5 ? 42 : 44;
    const by = 48;
    const bh = Math.max(150, rows * rowStep + 26);
    viewHeight = by + bh + 26;

    const bx = 188;
    const bw = 144;
    const leadless = isLeadlessPackage(pkg.code);
    const showEp =
      epPresent ||
      pkg.code === 'SOIC-8E' ||
      pkg.code === 'WSON-6' ||
      pkg.code === 'VSON-10' ||
      pkg.code === 'VSON-14';

    const leftPins: PinEntry[] = [];
    const rightPins: PinEntry[] = [];
    for (let i = 0; i < rows; i++) {
      const leftPinNum = isBottomView ? totalPins - i : i + 1;
      const rightPinNum = isBottomView ? i + 1 : totalPins - i;
      leftPins.push(getPin(leftPinNum));
      rightPins.push(getPin(rightPinNum));
    }

    const firstRowY = by + (bh - (rows - 1) * rowStep) / 2;

    diagramBody = (
      <g>
        {/* IC Body */}
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={leadless ? 4 : 7}
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth={2}
        />
        {/* Orientation Notch (top center) */}
        <path
          d={`M ${bx + bw / 2 - 12} ${by} A 12 12 0 0 0 ${bx + bw / 2 + 12} ${by}`}
          fill="#0f172a"
          stroke="#64748b"
          strokeWidth={1.2}
        />
        {/* Pin 1 Index Dot */}
        <circle
          cx={isBottomView ? bx + bw - 18 : bx + 18}
          cy={by + 18}
          r={4.5}
          fill="#f8fafc"
        />

        {/* Center Exposed Pad (if present) */}
        {showEp && (
          <g>
            <rect
              x={bx + 32}
              y={by + 28}
              width={bw - 64}
              height={bh - 56}
              rx={4}
              fill={`url(#${patternId})`}
              stroke={epIsLivePower ? '#ef4444' : '#38bdf8'}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <rect
              x={bx + 34}
              y={by + bh / 2 - 22}
              width={bw - 68}
              height={44}
              rx={4}
              fill="rgba(15, 23, 42, 0.9)"
            />
            <text
              x={bx + bw / 2}
              y={by + bh / 2 - 6}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="#f8fafc"
            >
              {pkg.code}
            </text>
            <text
              x={bx + bw / 2}
              y={by + bh / 2 + 10}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={epIsLivePower ? '#fca5a5' : '#7dd3fc'}
            >
              {`EP: ${epNet === 'THERMAL_GND_RECOMMENDED' ? 'GND' : epNet}`}
            </text>
          </g>
        )}

        {!showEp && (
          <g>
            <text
              x={bx + bw / 2}
              y={by + bh / 2 - 4}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="#f8fafc"
            >
              {pkg.code}
            </text>
            <text
              x={bx + bw / 2}
              y={by + bh / 2 + 12}
              textAnchor="middle"
              fontSize="9.5"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="#94a3b8"
            >
              {truncateName(pkg.mfg_package_code, 16)}
            </text>
          </g>
        )}

        {/* Left Pins */}
        {leftPins.map((entry, idx) => {
          const y = firstRowY + idx * rowStep;
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          const calloutH = rows >= 7 ? 28 : 30;
          return (
            <g key={`dl-${entry.pin}`}>
              {leadless ? (
                <rect
                  x={bx + 2}
                  y={y - 6}
                  width={18}
                  height={12}
                  rx={2}
                  fill={leadFill}
                  stroke={leadStroke}
                  strokeWidth={1.2}
                />
              ) : (
                <rect
                  x={bx - 18}
                  y={y - 6}
                  width={18}
                  height={12}
                  rx={2}
                  fill={leadFill}
                  stroke={leadStroke}
                  strokeWidth={1.2}
                />
              )}
              <line
                x1={164}
                y1={y}
                x2={leadless ? bx + 2 : bx - 18}
                y2={y}
                stroke={leadStroke}
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              {renderPinCallout(entry, 6, y - calloutH / 2, 158, calloutH, 'right', diff)}
            </g>
          );
        })}

        {/* Right Pins */}
        {rightPins.map((entry, idx) => {
          const y = firstRowY + idx * rowStep;
          const diff = getDiff(entry.pin);
          const leadFill = diff ? getDiffTheme(diff).leadFill : '#cbd5e1';
          const leadStroke = diff ? getDiffTheme(diff).stroke : '#475569';
          const calloutH = rows >= 7 ? 28 : 30;
          return (
            <g key={`dr-${entry.pin}`}>
              {leadless ? (
                <rect
                  x={bx + bw - 20}
                  y={y - 6}
                  width={18}
                  height={12}
                  rx={2}
                  fill={leadFill}
                  stroke={leadStroke}
                  strokeWidth={1.2}
                />
              ) : (
                <rect
                  x={bx + bw}
                  y={y - 6}
                  width={18}
                  height={12}
                  rx={2}
                  fill={leadFill}
                  stroke={leadStroke}
                  strokeWidth={1.2}
                />
              )}
              <line
                x1={leadless ? bx + bw - 2 : bx + bw + 18}
                y1={y}
                x2={356}
                y2={y}
                stroke={leadStroke}
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              {renderPinCallout(entry, 356, y - calloutH / 2, 158, calloutH, 'left', diff)}
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      {/* Top Technical Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-900 px-3.5 py-2 text-xs text-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-tight text-white">{opn}</span>
          <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">
            {pkg.code} ({pkg.pin_count}-pin)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
              isBottomView
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                : 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
            }`}
          >
            {isBottomView ? 'BOTTOM VIEW' : 'TOP VIEW'}
          </span>
          <span className="font-mono text-[11px] text-emerald-300">
            {pkg.pinout_vision_verified ? `300 DPI Vision · p.${pkg.pinout_source_page}` : `p.${pkg.pinout_source_page}`}
          </span>
        </div>
      </div>

      {/* SVG Drawing Canvas */}
      <div className={`bg-slate-50/70 ${compact ? 'p-2' : 'p-3 sm:p-4'}`}>
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          width={viewWidth}
          height={viewHeight}
          role="img"
          aria-label={`${opn} ${pkg.code} ${pkg.pinout_view.replace('_', ' ')} pinout diagram`}
          className="h-auto w-full max-w-[540px] mx-auto block select-none"
        >
          <title>{`${opn} — ${pkg.code} (${pkg.mfg_package_code}) ${pkg.pinout_view.replace('_', ' ')} Pinout`}</title>
          <desc>{`Deterministic IC pinout diagram for ${opn} (${pkg.code}), datasheet page ${pkg.pinout_source_page}.`}</desc>
          <defs>
            <pattern
              id={patternId}
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#e2e8f0" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2.5" />
            </pattern>
          </defs>

          {/* Subtle engineering alignment grid */}
          <rect
            x="1"
            y="1"
            width={viewWidth - 2}
            height={viewHeight - 2}
            rx="6"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {/* Top orientation legend inside SVG */}
          <text
            x={viewWidth / 2}
            y={22}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.08em"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill="#475569"
          >
            {`${pkg.pinout_view.replace('_', ' ')} · NOT TO SCALE · PIN 1 DOT MARKED`}
          </text>

          {diagramBody}
        </svg>
      </div>

      {/* Exposed Pad / Tab Warning Banner */}
      {epPresent && (
        <div
          className={`border-t px-3.5 py-2 text-xs flex flex-wrap items-start gap-2 ${
            epIsLivePower
              ? 'border-rose-300 bg-rose-50 text-rose-950'
              : 'border-amber-200 bg-amber-50/80 text-amber-950'
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
