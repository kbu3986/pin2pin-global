'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  GitCompareArrows,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { BomIndexPart, PartCategory } from '@/types/schema';
import {
  buildCompareHref,
  categoryShortLabel,
  getCompatibilityStyle,
  subTopologyLabel,
} from '@/lib/format';
import { trackCompareLaunch, trackEvent } from '@/lib/analytics';

export interface BomPartExtraMeta {
  voutV: number | null;
  voutFixed: boolean;
  pkg: string;
  mfgPkg: string;
}

export interface BomCheckerClientProps {
  parts: BomIndexPart[];
  partMetaBySlug?: Record<string, BomPartExtraMeta>;
  siteUrl: string;
  disclaimerShort: string;
  proWaitlistUrl: string;
}

const FREE_LINE_LIMIT = 100;

const SAMPLE_BOM_CSV = [
  'Designator,Qty,MPN,Footprint,Comment',
  'U1,1,CAT6219-330TD-GT3,TSOT-23-5,3.3V Analog Sensor Rail LDO (EOL Risk)',
  'U2,1,AMS1117-3.3,SOT-223-3,3.3V Main Digital Rail LDO (ESR Trap)',
  'U3,2,AP7313-33SRG-7,SOT-23-3,3.3V Reversed SOT23R Pinout LDO',
  'U4,1,TPS54302DDCR,SOT-23-6,24V to 5V Synchronous Buck Converter',
  'U5,1,LM2596SX-5.0/NOPB,TO-263-5,Legacy 5V Buck (Active-Low EN)',
  'U6,1,AP2112K-1.8TRG1,SOT-23-5,1.8V RF Sensor LDO (Voltage Check Demo)',
  'U7,1,LM393DR,SOIC-8,Window Fault Comparator (Open-Collector)',
  'U8,1,TPS613221ADBVR,SOT-23-5,Single-Cell 3.3V Boost Rail',
  'U9,1,opa333aidbvr,SOT-23-5,Zero-Drift Sensor Front-End Op-Amp',
  'U10,1,LM358,DIP-8,Signal Buffer Amplifier (Footprint Conflict Demo)',
  '"R1, R2, R3",3,RC0603FR-0710KL,0603,RES 10k 1% Pull-Up',
  '"C1-C6",6,GRM188R71C104KA01D,0603,CAP CER 100nF 16V X7R MLCC',
  '"TP1, TP2",2,TESTPOINT_1MM,TP_1MM,Test Point 3.3V / GND',
].join('\n');

interface ParsedBomRow {
  lineNumber: number;
  designator: string;
  hasExplicitDesignator: boolean;
  qty: string;
  rawMpn: string;
  footprint: string;
  comment: string;
}

interface SkippedPassiveRow {
  designator: string;
  rawMpn: string;
  reason: string;
}

interface ParseMeta {
  formatLabel: string;
  detectedColumns: string[];
  totalRawRows: number;
  skippedPassiveCount: number;
  skippedPassiveSample: SkippedPassiveRow[];
  totalIcLines: number;
  truncatedLines: number;
}

type MatchTier = 'exact' | 'normalized' | 'family_prefix' | 'unmatched';
type RiskLevel = 'CRITICAL' | 'WARNING' | 'OK' | 'UNMATCHED';
type ResultFilter = 'all' | 'matched' | 'eol' | 'gotchas' | 'unmatched';
type CategoryFilter = 'all' | PartCategory;

interface ExtractedVoltage {
  kind: 'fixed' | 'adj';
  volts: number | null;
  label: string;
}

interface AuditedBomRow {
  input: ParsedBomRow;
  matchTier: MatchTier;
  matchedPart: BomIndexPart | null;
  matchedMeta: BomPartExtraMeta | null;
  familyVariantCount: number;
  voltageMismatch: {
    inputLabel: string;
    dbLabel: string;
    note: string;
  } | null;
  footprintMismatch: {
    bomFootprint: string;
    bomCanonical: string;
    dbPackage: string;
    dbCanonical: string;
  } | null;
  riskLevel: RiskLevel;
  riskBadges: string[];
  hasDropInAlt: boolean;
}

function normalizeOpn(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Normalize header cell while preserving `#` as `num` so `Manf#` never collides with `Manf`. */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/#/g, 'num')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Quote-aware RFC 4180 delimiter detector.
 * Scans up to 40 logical records (supporting Altium/PADS preambles and multi-line quoted cells),
 * counts delimiters strictly OUTSIDE quotes, and prefers `\t` when consistently present.
 */
function detectDelimiter(rawText: string): string {
  const text = rawText.replace(/^\uFEFF/, '');
  const candidates = ['\t', ',', ';'] as const;
  const recordCounts: Array<Record<string, number>> = [];

  let inQuotes = false;
  let fieldLen = 0;
  let counts: Record<string, number> = { '\t': 0, ',': 0, ';': 0 };
  let rowHasContent = false;

  const flushRecord = () => {
    if (rowHasContent) {
      recordCounts.push(counts);
    }
    counts = { '\t': 0, ',': 0, ';': 0 };
    rowHasContent = false;
    fieldLen = 0;
  };

  for (let i = 0; i < text.length && recordCounts.length < 40; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          i++;
        } else {
          inQuotes = false;
        }
      }
      rowHasContent = true;
    } else {
      if (ch === '"' && fieldLen === 0) {
        inQuotes = true;
        rowHasContent = true;
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') i++;
        flushRecord();
      } else if (ch === '\n') {
        flushRecord();
      } else {
        if (ch === '\t' || ch === ',' || ch === ';') {
          counts[ch]++;
          fieldLen = 0;
          rowHasContent = true;
        } else {
          if (ch.trim().length > 0) {
            fieldLen++;
            rowHasContent = true;
          }
        }
      }
    }
  }
  if (recordCounts.length < 40) flushRecord();

  if (recordCounts.length === 0) return ',';

  const stats = candidates.map((delim) => {
    const freq = new Map<number, number>();
    let rowsWithDelim = 0;
    let totalCount = 0;
    for (const rec of recordCounts) {
      const c = rec[delim];
      if (c > 0) {
        rowsWithDelim++;
        totalCount += c;
        freq.set(c, (freq.get(c) ?? 0) + 1);
      }
    }
    let modeFreq = 0;
    let modeCount = 0;
    for (const [cnt, f] of freq.entries()) {
      if (f > modeFreq || (f === modeFreq && cnt > modeCount)) {
        modeFreq = f;
        modeCount = cnt;
      }
    }
    return { delim, rowsWithDelim, totalCount, modeFreq, modeCount };
  });

  const tabStat = stats[0];
  const commaStat = stats[1];
  const semiStat = stats[2];

  // Prefer tab when present consistently across records (TSV often has unquoted commas in comments)
  if (tabStat.rowsWithDelim > 0) {
    const tabConsistent =
      (tabStat.modeFreq >= 2 && tabStat.rowsWithDelim >= 2) ||
      (recordCounts.length <= 2 && tabStat.totalCount >= 1);
    if (
      tabConsistent &&
      tabStat.rowsWithDelim >= Math.max(commaStat.rowsWithDelim, semiStat.rowsWithDelim) * 0.6
    ) {
      return '\t';
    }
  }

  let best: string = ',';
  let bestScore = -1;
  for (const s of stats) {
    if (s.totalCount === 0) continue;
    // Consistency (same column count across rows) weighs heaviest
    const consistencyBonus = s.rowsWithDelim > 0 ? (s.modeFreq / s.rowsWithDelim) * 10 : 0;
    const tabTieBreaker = s.delim === '\t' ? 2 : 0;
    const score =
      s.modeFreq * 4 + s.rowsWithDelim * 2 + consistencyBonus + Math.min(s.totalCount, 80) * 0.05 + tabTieBreaker;
    if (score > bestScore) {
      bestScore = score;
      best = s.delim;
    }
  }

  return bestScore > 0 ? best : ',';
}

/**
 * Proper RFC 4180 CSV/TSV state-machine parser.
 * - Preserves multi-line quoted cells and escaped `""` quotes.
 * - Does NOT pre-trim lines, preserving leading empty tab/comma columns.
 * - Safely tolerates unquoted inch marks (e.g. `0.1" Header`) mid-field.
 */
function parseCsvRows(rawText: string, delimiter: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const cleanCell = (raw: string) =>
    raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]*\n[ \t]*/g, ' ')
      .trim();

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"' && currentField.trim().length === 0) {
        currentField = '';
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(cleanCell(currentField));
        currentField = '';
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') i++;
        currentRow.push(cleanCell(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (ch === '\n') {
        currentRow.push(cleanCell(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(cleanCell(currentField));
    rows.push(currentRow);
  }

  // Filter empty rows and comment/disclaimer rows WITHOUT mutating column offsets
  return rows.filter((row) => {
    const firstNonEmpty = row.find((cell) => cell.length > 0);
    if (!firstNonEmpty) return false;
    if (
      firstNonEmpty.startsWith('#') ||
      firstNonEmpty.startsWith('//') ||
      /^DISCLAIMER:/i.test(firstNonEmpty)
    ) {
      return false;
    }
    return true;
  });
}

// Tier 1: Explicit Manufacturer Part Number headers (Manf# -> manfnum, never bare "manf")
const MPN_TIER1_HEADERS = new Set([
  'mpn',
  'mfrpart',
  'mfrpartno',
  'mfrpartnum',
  'mfrpartnumber',
  'mfrpn',
  'mfrnum',
  'manufacturerpart',
  'manufacturerpartno',
  'manufacturerpartnum',
  'manufacturerpartnumber',
  'manufacturerpn',
  'manufacturernum',
  'mfgpart',
  'mfgpartno',
  'mfgpartnum',
  'mfgpartnumber',
  'mfgpn',
  'mfgnum',
  'manfpart',
  'manfpartno',
  'manfpartnum',
  'manfpartnumber',
  'manfpn',
  'manfnum',
  'partnumber',
  'partno',
  'partnum',
  'opn',
  'orderablepart',
  'orderablepartnumber',
]);

// Tier 2: Generic Part / Supplier Part headers
const MPN_TIER2_HEADERS = new Set([
  'part',
  'partname',
  'supplierpart',
  'supplierpartno',
  'supplierpartnum',
  'supplierpartnumber',
  'lcscpart',
  'lcscpartnum',
  'digikeypart',
  'digikeypartnumber',
  'mouserpart',
  'mouserpartnumber',
  'libref',
  'device',
]);

// Tier 3: Fallback value/comment headers when no explicit MPN column exists
const MPN_TIER3_HEADERS = new Set(['comment', 'value', 'component', 'model', 'name', 'item']);

// Bare manufacturer name column (must NEVER be chosen as MPN)
const MANUFACTURER_HEADERS = new Set([
  'manf',
  'manufacturer',
  'mfr',
  'mfg',
  'vendor',
  'brand',
  'maker',
  'supplier',
]);

const DESIGNATOR_HEADERS = new Set([
  'designator',
  'designators',
  'reference',
  'references',
  'refdes',
  'ref',
  'refs',
  'partreference',
  'componentreference',
]);

const QTY_HEADERS = new Set(['qty', 'quantity', 'count', 'amount', 'num', 'pcs']);

const FOOTPRINT_HEADERS = new Set([
  'footprint',
  'package',
  'pkg',
  'case',
  'casepackage',
  'pcbfootprint',
  'landpattern',
  'packagecase',
]);

const COMMENT_HEADERS = new Set(['description', 'desc', 'comment', 'value', 'notes', 'note']);

// Strict whitelist of standard PCB reference designator prefixes (prevents MPNs like LM358/TL072/AMS1117/TLV9001 from being treated as RefDes)
const PASSIVE_REFDES_PREFIXES = new Set([
  'R',
  'RN',
  'RP',
  'RV',
  'RT',
  'C',
  'CP',
  'CN',
  'L',
  'FB',
  'J',
  'JP',
  'P',
  'TP',
  'FID',
  'MH',
  'H',
  'LED',
  'SW',
  'X',
  'Y',
  'BT',
  'F',
  'FU',
  'ANT',
  'NT',
  'CON',
  'CONN',
  'MTG',
  'SH',
  'MP',
]);

const ACTIVE_REFDES_PREFIXES = new Set([
  'U',
  'IC',
  'Q',
  'M',
  'D',
  'CR',
  'VR',
  'REG',
  'A',
  'K',
  'T',
  'Z',
  'E',
  'G',
]);

const ALL_REFDES_PREFIXES = new Set([...PASSIVE_REFDES_PREFIXES, ...ACTIVE_REFDES_PREFIXES]);

function isRefDesTokenWithSet(token: string, prefixSet: Set<string>): boolean {
  const cleaned = token.trim().toUpperCase();
  if (!cleaned) return false;
  // Support ranges like R1-R10, C1-12, U1..U4, TP1~TP4
  const rangeMatch = cleaned.match(
    /^([A-Z]{1,4})(\d{1,4}[A-D]?)\s*(?:-|–|\.\.|~)\s*([A-Z]{0,4})(\d{1,4}[A-D]?)$/,
  );
  if (rangeMatch) {
    const p1 = rangeMatch[1];
    const p2 = rangeMatch[3];
    if (!prefixSet.has(p1)) return false;
    if (p2 && !prefixSet.has(p2)) return false;
    return true;
  }
  const singleMatch = cleaned.match(/^([A-Z]{1,4})(\d{1,4}[A-D]?)$/);
  if (!singleMatch) return false;
  const prefix = singleMatch[1];
  const digitsPart = singleMatch[2].replace(/[A-D]$/, '');
  if (!prefixSet.has(prefix)) return false;
  // Guard against 4-digit IC part numbers like L7805 or T4910
  if (prefix === 'L' && digitsPart.length >= 4 && /^(78|79|29|49)/.test(digitsPart)) {
    return false;
  }
  return true;
}

function isLikelyRefDesCell(value: string, knownDbStems?: Set<string>): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (knownDbStems && knownDbStems.has(normalizeOpn(trimmed))) return false;
  const tokens = trimmed.split(/[,;\s]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => isRefDesTokenWithSet(tok, ALL_REFDES_PREFIXES));
}

function isAllPassiveRefDes(designator: string): boolean {
  const trimmed = designator.trim();
  if (!trimmed || /^LINE-\d+$/i.test(trimmed)) return false;
  const tokens = trimmed.split(/[,;\s]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => isRefDesTokenWithSet(tok, PASSIVE_REFDES_PREFIXES));
}

function isActiveIcRefDes(designator: string): boolean {
  const trimmed = designator.trim();
  if (!trimmed || /^LINE-\d+$/i.test(trimmed)) return false;
  const tokens = trimmed.split(/[,;\s]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.some((tok) => isRefDesTokenWithSet(tok, ACTIVE_REFDES_PREFIXES));
}

const PASSIVE_VALUE_MPN_RE =
  /^(?:\d+(?:\.\d+)?\s*(?:R|OHM|OHMS|K|KR|KOHM|M|MR|MOHM|PF|NF|UF|µF|MF|NH|UH|µH|MH|HZ|KHZ|MHZ)(?:\s+\d+%?)?|\d+(?:\.\d+)?[RKMG]\d*|0(?:201|402|603|805|1206)|1206|1210|DNP|DNI|DO\s*NOT\s*POPULATE|NO\s*STUFF)$/i;

const PASSIVE_KEYWORD_RE =
  /(?:^|[^A-Z0-9])(RES|RESISTOR|CAP|CAPACITOR|MLCC|IND|INDUCTOR|HEADER|TESTPOINT|TEST\s*POINT|CONN|CONNECTOR|FERRITE|BEAD|FIDUCIAL|MOUNTING\s*HOLE|STANDOFF|SPACER|JUMPER|SHUNT|FUSE|CRYSTAL|XTAL|TACTILE|PUSHBUTTON|SWITCH|BATTERY\s*HOLDER|ANTENNA|NET\s*TIE|POTENTIOMETER|THERMISTOR|VARISTOR|LED)(?=$|[^A-Z0-9])/i;

const ACTIVE_IC_CUE_RE =
  /(?:^|[^A-Z0-9])(LDO|BUCK|BOOST|REGULATOR|OPAMP|OP-AMP|COMPARATOR|AMPLIFIER|CONVERTER|MOSFET|TRANSISTOR|DRIVER|MCU|MICROCONTROLLER|FPGA|ASIC|SENSOR|TRANSCEIVER|ISOLATOR|CONTROLLER|PMIC|SUPERVISOR)(?=$|[^A-Z0-9])/i;

function classifyPassiveRow(row: ParsedBomRow): { isPassive: boolean; reason: string } {
  // 1. Explicit RefDes check (handles grouped "R1, R2" and ranges "C1-C12")
  if (row.hasExplicitDesignator && isAllPassiveRefDes(row.designator)) {
    return { isPassive: true, reason: `Passive/Mech RefDes (${row.designator})` };
  }

  // 2. If explicitly tagged as an active IC RefDes (U*, IC*, Q*, VR*), never skip via comment keywords
  if (row.hasExplicitDesignator && isActiveIcRefDes(row.designator)) {
    return { isPassive: false, reason: '' };
  }

  // 3. Pure passive value/DNP in MPN field (e.g. "10k", "100nF", "4.7uH", "DNP")
  if (PASSIVE_VALUE_MPN_RE.test(row.rawMpn.trim())) {
    return { isPassive: true, reason: `Passive Value (${row.rawMpn.trim()})` };
  }

  // 4. Passive keywords in MPN or comment/description (unless active IC cues are present)
  const combined = `${row.rawMpn} ${row.comment}`.trim();
  if (!ACTIVE_IC_CUE_RE.test(combined)) {
    const kwMatch = combined.match(PASSIVE_KEYWORD_RE);
    if (kwMatch) {
      return { isPassive: true, reason: `Passive Keyword (${kwMatch[1].toUpperCase()})` };
    }
  }

  return { isPassive: false, reason: '' };
}

/**
 * Normalize PCB footprint / JEDEC package string to a canonical package family
 * for accurate footprint conflict detection (e.g. DIP-8 vs SOIC-8, SOT23-5 vs SOT23-3).
 */
function normalizeFootprintFamily(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;

  // Strip KiCad library prefix if present (e.g. "Package_TO_SOT_SMD:SOT-23-5")
  const afterColon = s.includes(':') ? s.slice(s.lastIndexOf(':') + 1) : s;
  const compact = afterColon.replace(/[_\s]+/g, '-');

  // Through-hole DIP / PDIP / CDIP
  const dipMatch = compact.match(/(?:^|[^A-Z])(?:P|C|S)?DIP[- ]?(\d{1,2})(?=$|[^0-9])/);
  if (dipMatch) return `DIP-${dipMatch[1]}`;
  if (/(?:^|[^A-Z])PDIP(?=$|[^A-Z0-9])/.test(compact)) return 'DIP';

  // TO-92 / TO-220 / TO-252 (DPAK) / TO-263 (D2PAK)
  const to263 = compact.match(/TO[- ]?263[- ]?(\d)?|D2PAK[- ]?(\d)?|DDPAK[- ]?(\d)?/);
  if (to263) {
    const pins = to263[1] || to263[2] || to263[3];
    return pins ? `TO-263-${pins}` : 'TO-263';
  }
  const to252 = compact.match(/TO[- ]?252[- ]?(\d)?|(?<![A-Z0-9])DPAK[- ]?(\d)?/);
  if (to252) {
    const pins = to252[1] || to252[2];
    return pins ? `TO-252-${pins}` : 'TO-252';
  }
  const to220 = compact.match(/TO[- ]?220[- ]?(\d)?/);
  if (to220) {
    return to220[1] ? `TO-220-${to220[1]}` : 'TO-220';
  }
  if (/TO[- ]?92/.test(compact)) return 'TO-92';

  // SOT-223 / SOT-89 / SOT-563
  if (/SOT[- ]?223/.test(compact)) return 'SOT-223';
  if (/SOT[- ]?89/.test(compact)) return 'SOT-89';
  if (/SOT[- ]?563/.test(compact)) return 'SOT-563';

  // SC-70 / SOT-353 / SOT-363
  if (/SC[- ]?70[- ]?5|SOT[- ]?353/.test(compact)) return 'SC-70-5';
  if (/SC[- ]?70[- ]?6|SOT[- ]?363/.test(compact)) return 'SC-70-6';
  if (/SC[- ]?70[- ]?3|SOT[- ]?323/.test(compact)) return 'SC-70-3';

  // SOT-23 / TSOT-23 / SOT25 / SOT26 / TSOP-5 (TSOT-23-5 & SOT-23-5 share PCB land pattern)
  if (/(?:T?SOT[- ]?23[- ]?8|TSOT28)/.test(compact)) return 'SOT-23-8';
  if (/(?:T?SOT[- ]?23[- ]?6|T?SOT[- ]?26(?=$|[^0-9]))/.test(compact)) return 'SOT-23-6';
  if (/(?:T?SOT[- ]?23[- ]?5|T?SOT[- ]?25(?=$|[^0-9])|TSOP[- ]?5|SC[- ]?74A)/.test(compact))
    return 'SOT-23-5';
  if (/(?:T?SOT[- ]?23A?[- ]?3|SOT[- ]?23R?(?=$|[^0-9-]|-TAB|-R)|TO[- ]?236)/.test(compact))
    return 'SOT-23-3';

  // MSOP / VSSOP / TSSOP / SSOP (must check BEFORE generic SOP/SOIC)
  const msop = compact.match(/(?:MSOP|VSSOP|MINISO)[- ]?(\d{1,2})/);
  if (msop) return `MSOP-${msop[1]}`;
  const tssop = compact.match(/TSSOP[- ]?(\d{1,2})/);
  if (tssop) return `TSSOP-${tssop[1]}`;
  const ssop = compact.match(/(?:^|[^T])SSOP[- ]?(\d{1,2})/);
  if (ssop) return `SSOP-${ssop[1]}`;

  // SOIC / SO-8 / SOP-8 / HSOP-8
  const soic = compact.match(/(?:^|[^A-Z])(?:H?SOIC|H?SOP|SO)[- ]?(\d{1,2})[A-Z]?(?=$|[^0-9])/);
  if (soic) return `SOIC-${soic[1]}`;

  // DFN / WSON / VSON / SON / QFN
  const son = compact.match(/(?:U?DFN|WSON|VSON|X2?SON|SON)[- ]?(\d{1,2})/);
  if (son) return `DFN/SON-${son[1]}`;
  const qfn = compact.match(/(?:V|W|U|T)?QFN[- ]?(\d{1,2})/);
  if (qfn) return `QFN-${qfn[1]}`;
  const qfp = compact.match(/(?:L|T|P)?QFP[- ]?(\d{2,3})/);
  if (qfp) return `QFP-${qfp[1]}`;

  return null;
}

function areFootprintsCompatible(bomCanonical: string, dbCanonical: string): boolean {
  if (bomCanonical === dbCanonical) return true;
  // Allow pin-count omitted TO-263 / TO-252 / TO-220 to match TO-263-5 / TO-252-3 / TO-220-5
  if (
    (bomCanonical === 'TO-263' && dbCanonical.startsWith('TO-263')) ||
    (dbCanonical === 'TO-263' && bomCanonical.startsWith('TO-263'))
  ) {
    return true;
  }
  if (
    (bomCanonical === 'TO-252' && dbCanonical.startsWith('TO-252')) ||
    (dbCanonical === 'TO-252' && bomCanonical.startsWith('TO-252'))
  ) {
    return true;
  }
  return false;
}

function isLikelyFootprintToken(value: string): boolean {
  return normalizeFootprintFamily(value) !== null;
}

const TWO_DIGIT_VOLTAGE_MAP: Record<string, number> = {
  '10': 1.0,
  '12': 1.2,
  '15': 1.5,
  '18': 1.8,
  '25': 2.5,
  '28': 2.8,
  '30': 3.0,
  '33': 3.3,
  '36': 3.6,
  '50': 5.0,
};

const THREE_DIGIT_VOLTAGE_MAP: Record<string, number> = {
  '100': 1.0,
  '120': 1.2,
  '150': 1.5,
  '180': 1.8,
  '250': 2.5,
  '280': 2.8,
  '300': 3.0,
  '330': 3.3,
  '360': 3.6,
  '500': 5.0,
};

/**
 * Extract output voltage specification token from an MPN (after stripping family stem)
 * so e.g. `AMS1117-5.0`, `AP2112K-1.8TRG1`, `AP7313-18SRG-7`, `TLV70018DDCR`, `LM2596SX-ADJ`
 * never silently match a 3.3 V or 5.0 V DB entry.
 */
function extractVoltageFromMpn(rawMpn: string, matchedFamily?: string): ExtractedVoltage | null {
  const upper = rawMpn.trim().toUpperCase();
  if (!upper) return null;

  // Compute suffix after the family stem (so family numbers like AP7333 or LM2596 are not misread)
  let suffix = upper;
  if (matchedFamily) {
    const famStem = matchedFamily.trim().toUpperCase().replace(/P$/, '');
    const idx = upper.indexOf(famStem);
    if (idx !== -1) {
      suffix = upper.slice(idx + famStem.length);
    }
  }

  // 1. Explicit ADJ token
  if (/(?:^|[-_\s/A-Z])ADJ(?=$|[-_\s/A-Z0-9])/.test(suffix)) {
    return { kind: 'adj', volts: null, label: 'ADJ (Adjustable)' };
  }

  // 2. Explicit decimal voltage (e.g. -3.3, -5.0, -1.8, -2.5, 3.3V, 12.0)
  const decMatch = suffix.match(/(?:^|[-_/\sA-Z])(0\.\d|1\.\d{1,2}|2\.\d{1,2}|3\.\d{1,2}|4\.\d|5\.0|9\.0|12\.0|15\.0)V?(?=$|[^0-9.])/);
  if (decMatch) {
    const volts = Number(decMatch[1]);
    if (Number.isFinite(volts)) {
      return { kind: 'fixed', volts, label: `${volts.toFixed(1)} V` };
    }
  }

  // 3. xVy notation (e.g. 1V8, 2V5, 3V3, 5V0)
  const vNotation = suffix.match(/(?:^|[-_/\sA-Z])([1-9])V([0-9])(?=$|[^0-9])/);
  if (vNotation) {
    const volts = Number(`${vNotation[1]}.${vNotation[2]}`);
    return { kind: 'fixed', volts, label: `${volts.toFixed(1)} V` };
  }

  // 4. 3-digit voltage code (e.g. CAT6219-180TD-GT3, NCP114ASN180T1G, CAT6219-330TD-GT3)
  const threeDigit = suffix.match(/(?:^|[-_/]|[A-Z]{1,3})(100|120|150|180|250|280|300|330|360|500)(?=[A-Z]|$)/);
  if (threeDigit) {
    const volts = THREE_DIGIT_VOLTAGE_MAP[threeDigit[1]];
    if (volts !== undefined) {
      return { kind: 'fixed', volts, label: `${volts.toFixed(1)} V` };
    }
  }

  // 5. Explicit higher-voltage integer after hyphen/slash (e.g. LM2596-12, AMS1117-5, LM2596-15)
  const highInt = suffix.match(/[-_/](5|12|15|24)V?(?=$|[A-Z/]|[^0-9])/);
  if (highInt) {
    const code = highInt[1];
    // For `-12`, distinguish 12 V (LM2596-12, AMS1117-12) vs 1.2 V low-voltage LDOs (AP7313-12)
    if (code === '12' && /^(AP73|AP21|AP22|TLV7|TPS7|NCP114|NCP500|CAT62)/.test(upper)) {
      return { kind: 'fixed', volts: 1.2, label: '1.2 V' };
    }
    const volts = Number(code);
    return { kind: 'fixed', volts, label: `${volts.toFixed(1)} V` };
  }

  // 6. 2-digit voltage code in suffix (e.g. -33, -18, -25, -50, TLV70018DDCR, NCP1117ST50T3G)
  const twoDigit = suffix.match(/(?:^|[-_/]|[A-Z]{1,2})(10|12|15|18|25|28|30|33|36|50)(?=[A-Z]|[-_/]|$)/);
  if (twoDigit) {
    const volts = TWO_DIGIT_VOLTAGE_MAP[twoDigit[1]];
    if (volts !== undefined) {
      return { kind: 'fixed', volts, label: `${volts.toFixed(1)} V` };
    }
  }

  return null;
}

function parseBomInput(
  rawText: string,
  options: {
    skipPassives: boolean;
    knownDbStems: Set<string>;
    isKnownDbMpn: (rawMpn: string) => boolean;
  },
): { rows: ParsedBomRow[]; meta: ParseMeta } {
  const trimmedRaw = rawText.replace(/^\uFEFF/, '');
  if (!trimmedRaw.trim()) {
    return {
      rows: [],
      meta: {
        formatLabel: 'Empty Input',
        detectedColumns: [],
        totalRawRows: 0,
        skippedPassiveCount: 0,
        skippedPassiveSample: [],
        totalIcLines: 0,
        truncatedLines: 0,
      },
    };
  }

  const delimiter = detectDelimiter(trimmedRaw);
  const grid = parseCsvRows(trimmedRaw, delimiter);

  if (grid.length === 0) {
    return {
      rows: [],
      meta: {
        formatLabel: 'Empty Input',
        detectedColumns: [],
        totalRawRows: 0,
        skippedPassiveCount: 0,
        skippedPassiveSample: [],
        totalIcLines: 0,
        truncatedLines: 0,
      },
    };
  }

  // Locate header row within the first 15 rows (handles Altium / PADS / OrCAD title preambles)
  let headerRowIdx = -1;
  let mpnIdx = -1;
  let fallbackMpnIdx = -1;
  let desIdx = -1;
  let qtyIdx = -1;
  let fpIdx = -1;
  let commentIdx = -1;
  let mfgIdx = -1;

  for (let r = 0; r < Math.min(15, grid.length); r++) {
    const row = grid[r];
    if (row.length < 2) continue;

    let score = 0;
    let matchedColTypes = 0;
    let rMpnTier = 99;
    let rMpn = -1;
    let rFallbackMpn = -1;
    let rDes = -1;
    let rQty = -1;
    let rFp = -1;
    let rComment = -1;
    let rMfg = -1;

    row.forEach((cell, cIdx) => {
      const h = normalizeHeader(cell);
      if (!h) return;

      // Never treat bare Manufacturer name column as MPN
      if (MANUFACTURER_HEADERS.has(h)) {
        if (rMfg === -1) {
          rMfg = cIdx;
          score += 1;
          matchedColTypes++;
        }
        return;
      }

      if (MPN_TIER1_HEADERS.has(h)) {
        if (rMpnTier > 1) {
          rMpn = cIdx;
          rMpnTier = 1;
          score += 4;
          matchedColTypes++;
        }
      } else if (MPN_TIER2_HEADERS.has(h)) {
        if (rMpnTier > 2) {
          rMpn = cIdx;
          rMpnTier = 2;
          score += 3;
          matchedColTypes++;
        }
      } else if (MPN_TIER3_HEADERS.has(h)) {
        if (rFallbackMpn === -1) {
          rFallbackMpn = cIdx;
          score += 1;
          matchedColTypes++;
        }
      }

      if (rDes === -1 && DESIGNATOR_HEADERS.has(h)) {
        rDes = cIdx;
        score += 2;
        matchedColTypes++;
      }
      if (rQty === -1 && QTY_HEADERS.has(h)) {
        rQty = cIdx;
        score += 2;
        matchedColTypes++;
      }
      if (rFp === -1 && FOOTPRINT_HEADERS.has(h)) {
        rFp = cIdx;
        score += 2;
        matchedColTypes++;
      }
      if (rComment === -1 && COMMENT_HEADERS.has(h)) {
        rComment = cIdx;
      }
    });

    if (score >= 3 && matchedColTypes >= 2 && (rMpn !== -1 || rFallbackMpn !== -1)) {
      headerRowIdx = r;
      mpnIdx = rMpn;
      fallbackMpnIdx = rFallbackMpn;
      desIdx = rDes;
      qtyIdx = rQty;
      fpIdx = rFp;
      commentIdx = rComment;
      mfgIdx = rMfg;
      break;
    }
  }

  const allRawParsed: ParsedBomRow[] = [];
  const detectedColumns: string[] = [];
  let formatLabel = 'Line-by-Line OPN List';

  if (headerRowIdx !== -1) {
    const headers = grid[headerRowIdx];
    const effectiveMpnIdx = mpnIdx !== -1 ? mpnIdx : fallbackMpnIdx;
    if (desIdx !== -1) detectedColumns.push(`Designator: "${headers[desIdx]}"`);
    if (qtyIdx !== -1) detectedColumns.push(`Qty: "${headers[qtyIdx]}"`);
    if (mfgIdx !== -1) detectedColumns.push(`Mfr: "${headers[mfgIdx]}"`);
    if (effectiveMpnIdx !== -1) detectedColumns.push(`MPN: "${headers[effectiveMpnIdx]}"`);
    if (fpIdx !== -1) detectedColumns.push(`Package: "${headers[fpIdx]}"`);
    if (headerRowIdx > 0) detectedColumns.push(`Skipped ${headerRowIdx} preamble row${headerRowIdx > 1 ? 's' : ''}`);

    const delimName =
      delimiter === '\t' ? 'TSV' : delimiter === ';' ? 'Semicolon CSV' : 'Standard CSV';
    formatLabel = `${delimName} (KiCad / Altium / PADS / EasyEDA Auto-Detected)`;

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const cols = grid[r];
      const primaryVal = mpnIdx !== -1 ? (cols[mpnIdx] ?? '').trim() : '';
      const secondaryVal = fallbackMpnIdx !== -1 ? (cols[fallbackMpnIdx] ?? '').trim() : '';
      const rawMpn = primaryVal || secondaryVal;
      if (!rawMpn) continue;

      const rawDes = desIdx !== -1 ? (cols[desIdx] ?? '').trim() : '';
      const hasExplicitDesignator = rawDes.length > 0;
      const designator = hasExplicitDesignator ? rawDes : `LINE-${allRawParsed.length + 1}`;
      const qty = qtyIdx !== -1 && cols[qtyIdx] ? cols[qtyIdx].trim() : '1';
      const footprint = fpIdx !== -1 && cols[fpIdx] ? cols[fpIdx].trim() : '';
      const comment =
        commentIdx !== -1 && cols[commentIdx] && commentIdx !== effectiveMpnIdx
          ? cols[commentIdx].trim()
          : '';

      allRawParsed.push({
        lineNumber: allRawParsed.length + 1,
        designator,
        hasExplicitDesignator,
        qty,
        rawMpn,
        footprint,
        comment,
      });
    }
  } else {
    // Headerless CSV/TSV or line-by-line OPN list
    const delimName =
      delimiter === '\t' ? 'Headerless TSV' : delimiter === ';' ? 'Headerless Semicolon CSV' : 'Line-by-Line / Headerless List';
    formatLabel = delimName;
    detectedColumns.push('Auto-detected OPN tokens (headerless mode)');

    const firstCellNorm = grid[0].length === 1 ? normalizeHeader(grid[0][0]) : '';
    const startIdx =
      grid.length > 1 &&
      grid[0].length === 1 &&
      (MPN_TIER1_HEADERS.has(firstCellNorm) ||
        MPN_TIER2_HEADERS.has(firstCellNorm) ||
        MPN_TIER3_HEADERS.has(firstCellNorm))
        ? 1
        : 0;

    for (let rIdx = startIdx; rIdx < grid.length; rIdx++) {
      const cols = grid[rIdx];
      const nonEmptyCols = cols.map((c) => c.trim()).filter(Boolean);
      if (nonEmptyCols.length === 0) continue;

      if (nonEmptyCols.length === 1) {
        allRawParsed.push({
          lineNumber: allRawParsed.length + 1,
          designator: `LINE-${allRawParsed.length + 1}`,
          hasExplicitDesignator: false,
          qty: '1',
          rawMpn: nonEmptyCols[0],
          footprint: '',
          comment: '',
        });
      } else {
        // Headerless multi-column heuristic (strict RefDes whitelist prevents LM358/TL072/AMS1117 misclassification)
        let designator = `LINE-${allRawParsed.length + 1}`;
        let hasExplicitDesignator = false;
        let qty = '1';
        let qtyAssigned = false;
        let rawMpn = '';
        let footprint = '';
        const remaining: string[] = [];

        for (const val of nonEmptyCols) {
          if (!hasExplicitDesignator && isLikelyRefDesCell(val, options.knownDbStems)) {
            designator = val;
            hasExplicitDesignator = true;
          } else if (!qtyAssigned && /^\d{1,5}$/.test(val)) {
            qty = val;
            qtyAssigned = true;
          } else if (!footprint && rawMpn && isLikelyFootprintToken(val)) {
            footprint = val;
          } else if (!rawMpn) {
            // Avoid grabbing a pure footprint as MPN if another token remains
            if (isLikelyFootprintToken(val) && !footprint) {
              footprint = val;
            } else {
              rawMpn = val;
            }
          } else {
            remaining.push(val);
          }
        }

        // Fallback: if all tokens were eaten by RefDes/Footprint leaving rawMpn empty, rescue it
        if (!rawMpn && hasExplicitDesignator) {
          rawMpn = designator;
          designator = `LINE-${allRawParsed.length + 1}`;
          hasExplicitDesignator = false;
        }
        if (!rawMpn) continue;

        allRawParsed.push({
          lineNumber: allRawParsed.length + 1,
          designator,
          hasExplicitDesignator,
          qty,
          rawMpn,
          footprint: footprint || remaining[0] || '',
          comment: footprint ? remaining.join(' ') : remaining.slice(1).join(' '),
        });
      }
    }
  }

  // Smart Passive-Skip BEFORE applying the 100-IC row limit
  const icRows: ParsedBomRow[] = [];
  const skippedPassiveSample: SkippedPassiveRow[] = [];
  let skippedPassiveCount = 0;

  for (const row of allRawParsed) {
    if (options.skipPassives && !options.isKnownDbMpn(row.rawMpn)) {
      const passiveCheck = classifyPassiveRow(row);
      if (passiveCheck.isPassive) {
        skippedPassiveCount++;
        if (skippedPassiveSample.length < 8) {
          skippedPassiveSample.push({
            designator: row.designator,
            rawMpn: row.rawMpn,
            reason: passiveCheck.reason,
          });
        }
        continue;
      }
    }
    icRows.push({
      ...row,
      lineNumber: icRows.length + 1,
    });
  }

  const totalIcLines = icRows.length;
  const rows = icRows.slice(0, FREE_LINE_LIMIT);
  const truncatedLines = Math.max(0, totalIcLines - rows.length);

  return {
    rows,
    meta: {
      formatLabel,
      detectedColumns,
      totalRawRows: allRawParsed.length,
      skippedPassiveCount,
      skippedPassiveSample,
      totalIcLines,
      truncatedLines,
    },
  };
}

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^[A-Za-z0-9]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function escapeMdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function BomCheckerClient({
  parts,
  partMetaBySlug = {},
  siteUrl,
  disclaimerShort,
  proWaitlistUrl,
}: BomCheckerClientProps) {
  const [rawInput, setRawInput] = useState<string>('');
  const [submittedText, setSubmittedText] = useState<string>('');
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [skipPassives, setSkipPassives] = useState<boolean>(true);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const indexMaps = useMemo(() => {
    const exactMap = new Map<string, BomIndexPart>();
    const normMap = new Map<string, BomIndexPart>();
    const familyMap = new Map<string, BomIndexPart[]>();
    const knownDbStems = new Set<string>();

    const entries = parts.map((part) => {
      const normOpn = normalizeOpn(part.opn);
      const normFam = normalizeOpn(part.fam);
      const normFamStem = normFam.replace(/P$/, '');
      exactMap.set(part.opn.toUpperCase(), part);
      normMap.set(normOpn, part);
      knownDbStems.add(normOpn);
      knownDbStems.add(normFam);
      if (normFamStem.length >= 4) knownDbStems.add(normFamStem);

      const famList = familyMap.get(normFam) ?? [];
      famList.push(part);
      familyMap.set(normFam, famList);

      if (normFamStem !== normFam && normFamStem.length >= 5) {
        const stemList = familyMap.get(normFamStem) ?? [];
        stemList.push(part);
        familyMap.set(normFamStem, stemList);
      }

      return { part, normOpn, normFam, normFamStem };
    });

    const isKnownDbMpn = (rawMpn: string): boolean => {
      const upper = rawMpn.trim().toUpperCase();
      if (exactMap.has(upper)) return true;
      const norm = normalizeOpn(rawMpn);
      if (norm.length < 4) return false;
      if (normMap.has(norm) || familyMap.has(norm)) return true;
      return entries.some(
        (e) =>
          (e.normFam.length >= 4 && norm.startsWith(e.normFam)) ||
          (e.normFamStem.length >= 5 && norm.startsWith(e.normFamStem)),
      );
    };

    return { exactMap, normMap, familyMap, entries, knownDbStems, isKnownDbMpn };
  }, [parts]);

  const runAudit = useMemo(() => {
    return (text: string, shouldSkipPassives: boolean) => {
      const { rows: parsedRows, meta } = parseBomInput(text, {
        skipPassives: shouldSkipPassives,
        knownDbStems: indexMaps.knownDbStems,
        isKnownDbMpn: indexMaps.isKnownDbMpn,
      });

      const auditedRows: AuditedBomRow[] = parsedRows.map((row) => {
        const upperMpn = row.rawMpn.trim().toUpperCase();
        const normMpn = normalizeOpn(row.rawMpn);
        const bomCanonicalFp = normalizeFootprintFamily(row.footprint);

        let matchTier: MatchTier = 'unmatched';
        let matchedPart: BomIndexPart | null = null;
        let familyVariantCount = 0;

        // 1. Exact OPN match
        const exactHit = indexMaps.exactMap.get(upperMpn);
        if (exactHit) {
          matchTier = 'exact';
          matchedPart = exactHit;
        } else if (normMpn.length >= 4) {
          // 2. Normalized OPN match (ignoring case, hyphens, punctuation)
          const normHit = indexMaps.normMap.get(normMpn);
          if (normHit) {
            matchTier = 'normalized';
            matchedPart = normHit;
          } else {
            // 3. Family prefix match
            const directFam = indexMaps.familyMap.get(normMpn);
            let candidates: BomIndexPart[] = directFam ? [...directFam] : [];

            if (candidates.length === 0) {
              const seen = new Set<string>();
              for (const e of indexMaps.entries) {
                const hit =
                  (e.normFam.length >= 4 && normMpn.startsWith(e.normFam)) ||
                  (e.normFamStem.length >= 5 && normMpn.startsWith(e.normFamStem)) ||
                  (normMpn.length >= 5 && e.normOpn.startsWith(normMpn));
                if (hit && !seen.has(e.part.slug)) {
                  seen.add(e.part.slug);
                  candidates.push(e.part);
                }
              }
            }

            if (candidates.length > 0) {
              candidates.sort((a, b) => {
                const aMeta = partMetaBySlug[a.slug];
                const bMeta = partMetaBySlug[b.slug];
                const aInV = extractVoltageFromMpn(row.rawMpn, a.fam);
                const bInV = extractVoltageFromMpn(row.rawMpn, b.fam);

                const voltScore = (
                  inV: ExtractedVoltage | null,
                  m: BomPartExtraMeta | undefined,
                ): number => {
                  if (!inV || !m) return 0;
                  if (inV.kind === 'fixed' && m.voutFixed && m.voutV !== null) {
                    return Math.abs(m.voutV - (inV.volts ?? -1)) < 0.05 ? 2 : -1;
                  }
                  if (inV.kind === 'adj' && !m.voutFixed) return 2;
                  return -1;
                };

                const aV = voltScore(aInV, aMeta);
                const bV = voltScore(bInV, bMeta);
                if (aV !== bV) return bV - aV;

                const aDbFp = normalizeFootprintFamily(a.pkg);
                const bDbFp = normalizeFootprintFamily(b.pkg);
                const aFp = bomCanonicalFp && aDbFp && areFootprintsCompatible(bomCanonicalFp, aDbFp) ? 1 : 0;
                const bFp = bomCanonicalFp && bDbFp && areFootprintsCompatible(bomCanonicalFp, bDbFp) ? 1 : 0;
                if (aFp !== bFp) return bFp - aFp;

                return (
                  normalizeOpn(b.fam).length - normalizeOpn(a.fam).length ||
                  a.opn.localeCompare(b.opn)
                );
              });
              matchTier = 'family_prefix';
              matchedPart = candidates[0];
              familyVariantCount = candidates.length;
            }
          }
        }

        if (!matchedPart) {
          return {
            input: row,
            matchTier: 'unmatched',
            matchedPart: null,
            matchedMeta: null,
            familyVariantCount: 0,
            voltageMismatch: null,
            footprintMismatch: null,
            riskLevel: 'UNMATCHED',
            riskBadges: [],
            hasDropInAlt: false,
          };
        }

        const matchedMeta = partMetaBySlug[matchedPart.slug] ?? null;

        // 4. Voltage-aware family check (LDO / DC-DC)
        let voltageMismatch: AuditedBomRow['voltageMismatch'] = null;
        if (
          (matchedPart.cat === 'ldo' || matchedPart.cat === 'dcdc') &&
          matchedMeta &&
          matchTier !== 'exact'
        ) {
          const extractedV = extractVoltageFromMpn(row.rawMpn, matchedPart.fam);
          if (extractedV) {
            if (extractedV.kind === 'fixed' && extractedV.volts !== null) {
              if (matchedMeta.voutFixed && matchedMeta.voutV !== null) {
                if (Math.abs(matchedMeta.voutV - extractedV.volts) >= 0.05) {
                  voltageMismatch = {
                    inputLabel: extractedV.label,
                    dbLabel: `${matchedMeta.voutV.toFixed(1)} V fixed`,
                    note: `Input specifies ${extractedV.label} vs DB ${matchedMeta.voutV.toFixed(1)} V (${matchedPart.opn}) — family match only; verify fixed Vout.`,
                  };
                }
              } else if (!matchedMeta.voutFixed) {
                voltageMismatch = {
                  inputLabel: extractedV.label,
                  dbLabel: 'Adjustable (ADJ)',
                  note: `Input specifies fixed ${extractedV.label} vs adjustable DB OPN (${matchedPart.opn}) — family match only; verify fixed Vout and FB pinout.`,
                };
              }
            } else if (extractedV.kind === 'adj' && matchedMeta.voutFixed && matchedMeta.voutV !== null) {
              voltageMismatch = {
                inputLabel: 'ADJ (Adjustable)',
                dbLabel: `${matchedMeta.voutV.toFixed(1)} V fixed`,
                note: `Input specifies ADJ vs fixed ${matchedMeta.voutV.toFixed(1)} V DB OPN (${matchedPart.opn}) — family match only; verify fixed Vout vs ADJ pinout.`,
              };
            }
          }
        }

        // 5. Footprint / Package conflict check
        let footprintMismatch: AuditedBomRow['footprintMismatch'] = null;
        const dbCanonicalFp = normalizeFootprintFamily(matchedPart.pkg);
        if (bomCanonicalFp && dbCanonicalFp && !areFootprintsCompatible(bomCanonicalFp, dbCanonicalFp)) {
          footprintMismatch = {
            bomFootprint: row.footprint,
            bomCanonical: bomCanonicalFp,
            dbPackage: matchedPart.pkg,
            dbCanonical: dbCanonicalFp,
          };
        }

        const riskBadges: string[] = [];
        if (matchedPart.life === 'EOL') riskBadges.push('EOL / Obsolete');
        if (matchedPart.life === 'NRND') riskBadges.push('NRND Lifecycle');
        if (footprintMismatch) riskBadges.push('FOOTPRINT MISMATCH');
        if (voltageMismatch) riskBadges.push('VOLTAGE_MISMATCH');
        if (matchedPart.ceramic === false) riskBadges.push('ESR / Non-MLCC Trap');
        if (matchedPart.crit.length > 0) {
          riskBadges.push(
            `${matchedPart.crit.length} Critical Gotcha${matchedPart.crit.length > 1 ? 's' : ''}`,
          );
        }
        if (matchTier === 'family_prefix') {
          riskBadges.push('Verify Exact OPN Suffix');
        }

        const isCritical =
          matchedPart.life === 'EOL' ||
          matchedPart.ceramic === false ||
          matchedPart.crit.length > 0 ||
          footprintMismatch !== null;
        const isWarning =
          matchedPart.life === 'NRND' ||
          matchTier === 'family_prefix' ||
          voltageMismatch !== null ||
          matchedPart.warn.length > 0;

        const riskLevel: RiskLevel = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'OK';
        const hasDropInAlt =
          !voltageMismatch &&
          !footprintMismatch &&
          matchedPart.alts.some((a) => a.lvl === 'LEVEL_1_CANDIDATE_DROP_IN');

        return {
          input: row,
          matchTier,
          matchedPart,
          matchedMeta,
          familyVariantCount,
          voltageMismatch,
          footprintMismatch,
          riskLevel,
          riskBadges,
          hasDropInAlt,
        };
      });

      const matchedCount = auditedRows.filter((r) => r.matchedPart !== null).length;
      const eolNrndCount = auditedRows.filter(
        (r) => r.matchedPart?.life === 'EOL' || r.matchedPart?.life === 'NRND',
      ).length;
      const criticalGotchaCount = auditedRows.filter(
        (r) =>
          r.matchedPart !== null &&
          (r.matchedPart.crit.length > 0 ||
            r.matchedPart.ceramic === false ||
            r.voltageMismatch !== null ||
            r.footprintMismatch !== null),
      ).length;
      const mismatchCount = auditedRows.filter(
        (r) => r.voltageMismatch !== null || r.footprintMismatch !== null,
      ).length;
      const dropInFoundCount = auditedRows.filter((r) => r.hasDropInAlt).length;
      const anyAltFoundCount = auditedRows.filter(
        (r) => r.matchedPart !== null && r.matchedPart.alts.length > 0,
      ).length;

      const categoryCounts: Record<PartCategory, number> = {
        ldo: auditedRows.filter((r) => r.matchedPart?.cat === 'ldo').length,
        dcdc: auditedRows.filter((r) => r.matchedPart?.cat === 'dcdc').length,
        opamp: auditedRows.filter((r) => r.matchedPart?.cat === 'opamp').length,
      };

      return {
        meta,
        rows: auditedRows,
        kpis: {
          totalLines: auditedRows.length,
          matchedCount,
          eolNrndCount,
          criticalGotchaCount,
          mismatchCount,
          dropInFoundCount,
          anyAltFoundCount,
          categoryCounts,
        },
      };
    };
  }, [indexMaps, partMetaBySlug]);

  const auditState = useMemo(() => {
    if (!submittedText.trim()) return null;
    return runAudit(submittedText, skipPassives);
  }, [submittedText, skipPassives, runAudit]);

  const runScan = (text: string, mode: 'csv_upload' | 'paste' | 'sample', label: string) => {
    setUploadError(null);
    setRawInput(text);
    setSubmittedText(text);
    setSourceLabel(label);
    setFilter('all');
    setCategoryFilter('all');

    const result = runAudit(text, skipPassives);
    trackEvent('bom_scan', {
      mode,
      total_lines: result.kpis.totalLines,
      skipped_passives: result.meta.skippedPassiveCount,
      matched_lines: result.kpis.matchedCount,
      eol_alerts: result.kpis.eolNrndCount,
      critical_gotchas: result.kpis.criticalGotchaCount,
      mismatches: result.kpis.mismatchCount,
      truncated: result.meta.truncatedLines > 0,
    });
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(
        'File exceeds 2 MB browser safety cap. Export a standard BOM CSV/TSV file and retry.',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (!content.trim()) {
        setUploadError('The selected file appears empty.');
        return;
      }
      runScan(content, 'csv_upload', `Local File: ${file.name}`);
    };
    reader.onerror = () => {
      setUploadError('Could not read the selected file in browser memory.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleLoadSample = () => {
    runScan(
      SAMPLE_BOM_CSV,
      'sample',
      'Sample Industrial IoT Sensor Power BOM (10 ICs + 3 passives)',
    );
  };

  const handlePasteAudit = () => {
    if (!rawInput.trim()) {
      setUploadError('Paste a CSV/TSV BOM or line-by-line OPN list first, or load the sample BOM.');
      return;
    }
    runScan(rawInput, 'paste', 'Pasted BOM / OPN List');
  };

  const handleReset = () => {
    setRawInput('');
    setSubmittedText('');
    setSourceLabel('');
    setFilter('all');
    setCategoryFilter('all');
    setUploadError(null);
    setCopiedMarkdown(false);
  };

  const handleDownloadCsv = () => {
    if (!auditState || auditState.rows.length === 0) return;

    const cleanBaseUrl = siteUrl.replace(/\/+$/, '');
    // Mandatory AUD-04 Engineering Disclaimer in Row 1 + Parse/Truncation summary in Row 2
    const disclaimerRow = [
      `DISCLAIMER: ${disclaimerShort} Generated client-side by Pin2Pin Global (${cleanBaseUrl}/en/tools/bom-checker/).`,
    ];
    const summaryRow = [
      `AUDIT_SUMMARY: RawRows=${auditState.meta.totalRawRows} | SkippedPassives=${auditState.meta.skippedPassiveCount} | AuditedICs=${auditState.rows.length}/${auditState.meta.totalIcLines} | TruncatedICs=${auditState.meta.truncatedLines} | Matched=${auditState.kpis.matchedCount} | EOL_NRND=${auditState.kpis.eolNrndCount} | Mismatches=${auditState.kpis.mismatchCount}`,
    ];
    const headerRow = [
      'Line',
      'Designator',
      'Qty',
      'Input_MPN',
      'BOM_Footprint',
      'Match_Tier',
      'Verified_OPN',
      'Manufacturer',
      'Category',
      'DB_Package',
      'Footprint_Check',
      'Voltage_Check',
      'Lifecycle_Status',
      'Risk_Level',
      'Critical_Gotchas',
      'Top_Candidate_1',
      'Candidate_1_Tier',
      'Candidate_1_Compare_URL',
      'Top_Candidate_2',
      'Candidate_2_Tier',
      'Part_Reference_URL',
      'Alternatives_URL',
      'VS_Diff_URL',
    ];

    const dataRows = auditState.rows.map((r) => {
      const p = r.matchedPart;
      const alt1 = p?.alts[0] ?? null;
      const alt2 = p?.alts[1] ?? null;
      const firstVs = alt1?.vs ?? alt2?.vs ?? null;
      const gotchaNotes = p
        ? [
            ...(p.life === 'EOL' ? ['OBSOLETE / EOL DEVICE'] : []),
            ...(p.life === 'NRND' ? ['NRND LIFECYCLE'] : []),
            ...(r.footprintMismatch
              ? [
                  `FOOTPRINT MISMATCH: BOM "${r.footprintMismatch.bomFootprint}" vs DB "${r.footprintMismatch.dbPackage}"`,
                ]
              : []),
            ...(r.voltageMismatch ? [`VOLTAGE_MISMATCH: ${r.voltageMismatch.note}`] : []),
            ...(p.ceramic === false ? ['NOT CERAMIC-CAP STABLE (ESR REQUIRED)'] : []),
            ...p.crit,
            ...(r.matchTier === 'family_prefix'
              ? ['FAMILY PREFIX MATCH — VERIFY EXACT PACKAGE & VOLTAGE SUFFIX']
              : []),
          ].join(' | ')
        : 'Outside current verified analog/power DB';

      return [
        String(r.input.lineNumber),
        r.input.designator,
        r.input.qty,
        r.input.rawMpn,
        r.input.footprint || '—',
        r.matchTier,
        p?.opn ?? 'UNMATCHED',
        p?.mfg ?? '—',
        p ? subTopologyLabel(p.sub) : '—',
        p?.pkg ?? '—',
        r.footprintMismatch
          ? `FOOTPRINT MISMATCH (${r.footprintMismatch.bomCanonical} vs ${r.footprintMismatch.dbCanonical})`
          : p && r.input.footprint
            ? 'OK'
            : '—',
        r.voltageMismatch ? `VOLTAGE_MISMATCH (${r.voltageMismatch.inputLabel} vs ${r.voltageMismatch.dbLabel})` : p ? 'OK' : '—',
        p?.life ?? 'Unknown',
        r.riskLevel,
        gotchaNotes || 'None flagged',
        alt1 ? `${alt1.opn} (${alt1.pkg})` : '—',
        alt1 ? getCompatibilityStyle(alt1.lvl).shortLabel : '—',
        p && alt1 ? `${cleanBaseUrl}${buildCompareHref(p.slug, alt1.slug)}` : '—',
        alt2 ? `${alt2.opn} (${alt2.pkg})` : '—',
        alt2 ? getCompatibilityStyle(alt2.lvl).shortLabel : '—',
        p ? `${cleanBaseUrl}/en/part/${p.slug}/` : '—',
        p && p.hasAlt ? `${cleanBaseUrl}/en/alt/${p.slug}-alternatives/` : '—',
        firstVs ? `${cleanBaseUrl}/en/vs/${firstVs}/` : '—',
      ];
    });

    const csvContent = [disclaimerRow, summaryRow, headerRow, ...dataRows]
      .map((cols) => cols.map((c) => escapeCsvCell(c)).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pin2pin-audited-bom-${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent('bom_export_csv', {
      exported_lines: auditState.rows.length,
      skipped_passives: auditState.meta.skippedPassiveCount,
      matched_lines: auditState.kpis.matchedCount,
      eol_alerts: auditState.kpis.eolNrndCount,
    });
  };

  const handleCopyMarkdown = async () => {
    if (!auditState || auditState.rows.length === 0) return;

    const cleanBaseUrl = siteUrl.replace(/\/+$/, '');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const lines: string[] = [
      `# Pin2Pin Global — Local BOM Risk Audit (${dateStamp})`,
      '',
      `> **Engineering Disclaimer (AUD-04):** ${disclaimerShort}`,
      '',
      `- **Source:** ${sourceLabel} (${auditState.meta.formatLabel})`,
      `- **Input Summary:** ${auditState.meta.totalRawRows} raw BOM rows → **${auditState.meta.skippedPassiveCount} passive/mechanical lines skipped**, **${auditState.rows.length} of ${auditState.meta.totalIcLines} IC lines audited**${auditState.meta.truncatedLines > 0 ? ` (${auditState.meta.truncatedLines} IC lines truncated at ${FREE_LINE_LIMIT}-IC free preview cap)` : ''}`,
      `- **Audit KPIs:** ${auditState.kpis.matchedCount} matched | ${auditState.kpis.eolNrndCount} EOL/NRND | ${auditState.kpis.mismatchCount} Voltage/Footprint conflicts | ${auditState.kpis.dropInFoundCount} Candidate Drop-In alts found`,
      '',
      '| # | RefDes | Qty | Input MPN | Match | Verified OPN | Package | Status | Flags & Gotchas | Top Candidate & Compare |',
      '|---:|---|---:|---|---|---|---|---|---|---|',
    ];

    for (const r of auditState.rows) {
      const p = r.matchedPart;
      const flags: string[] = [];
      if (p?.life === 'EOL') flags.push('**EOL**');
      if (p?.life === 'NRND') flags.push('NRND');
      if (r.footprintMismatch) {
        flags.push(
          `**FOOTPRINT MISMATCH** (${r.footprintMismatch.bomFootprint} vs ${r.footprintMismatch.dbPackage})`,
        );
      }
      if (r.voltageMismatch) {
        flags.push(
          `**VOLTAGE_MISMATCH** (${r.voltageMismatch.inputLabel} vs ${r.voltageMismatch.dbLabel}; family match only, verify fixed Vout)`,
        );
      }
      if (p?.ceramic === false) flags.push('NOT MLCC-STABLE');
      if (p && p.crit.length > 0) flags.push(p.crit[0]);
      if (r.matchTier === 'family_prefix' && !r.voltageMismatch) {
        flags.push('Verify exact OPN suffix');
      }

      const alt1 = p?.alts[0] ?? null;
      const altText =
        p && alt1
          ? `[${alt1.opn}](${cleanBaseUrl}/en/part/${alt1.slug}/) (${getCompatibilityStyle(alt1.lvl).shortLabel}) · [Compare](${cleanBaseUrl}${buildCompareHref(p.slug, alt1.slug)})${alt1.vs ? ` · [1:1 Diff](${cleanBaseUrl}/en/vs/${alt1.vs}/)` : ''}`
          : p
            ? `[Specs](${cleanBaseUrl}/en/part/${p.slug}/)`
            : '—';

      lines.push(
        `| ${r.input.lineNumber} | ${escapeMdCell(r.input.designator)} | ${escapeMdCell(r.input.qty)} | \`${escapeMdCell(r.input.rawMpn)}\` | ${r.matchTier} | ${p ? `[${escapeMdCell(p.opn)}](${cleanBaseUrl}/en/part/${p.slug}/)` : 'Unmatched'} | ${escapeMdCell(p?.pkg ?? (r.input.footprint || '—'))} | ${p?.life ?? '—'} | ${escapeMdCell(flags.join('; ') || (p ? 'OK' : 'Outside DB'))} | ${altText} |`,
      );
    }

    const md = lines.join('\n');
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = md;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    setCopiedMarkdown(true);
    window.setTimeout(() => setCopiedMarkdown(false), 2500);

    trackEvent('bom_export_markdown', {
      exported_lines: auditState.rows.length,
      skipped_passives: auditState.meta.skippedPassiveCount,
      matched_lines: auditState.kpis.matchedCount,
    });
  };

  const visibleRows = useMemo(() => {
    if (!auditState) return [];
    return auditState.rows.filter((r) => {
      if (categoryFilter !== 'all' && r.matchedPart?.cat !== categoryFilter) {
        return false;
      }
      if (filter === 'matched') return r.matchedPart !== null;
      if (filter === 'eol') return r.matchedPart?.life === 'EOL' || r.matchedPart?.life === 'NRND';
      if (filter === 'gotchas') {
        return (
          r.matchedPart !== null &&
          (r.matchedPart.crit.length > 0 ||
            r.matchedPart.ceramic === false ||
            r.voltageMismatch !== null ||
            r.footprintMismatch !== null)
        );
      }
      if (filter === 'unmatched') return r.matchedPart === null;
      return true;
    });
  }, [auditState, filter, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Main Interactive Workbench Card */}
      <div className="rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
        {/* Workbench Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-tight">
              Client-Side BOM CSV / TSV Alternative &amp; EOL Risk Workbench
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-200">
              <Lock className="h-3 w-3" aria-hidden="true" />
              100% Client-Side • Zero-Upload Privacy
            </span>
            <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-100">
              Free Local Audit — up to {FREE_LINE_LIMIT} IC rows
            </span>
          </div>
        </div>

        {/* Input Modes Panel */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Quick Preset & Smart Passive-Skip Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs text-sky-950">
              <Sparkles className="h-4 w-4 text-sky-700 shrink-0" aria-hidden="true" />
              <span>
                Inspect real EOL, ESR, reversed-pinout, voltage-mismatch, and footprint-conflict
                traps immediately:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Load Sample Industrial IoT Sensor Power BOM
              </button>
              {(rawInput || submittedText) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Mode A: Drag-and-Drop CSV/TSV Upload */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                1. Drop or Select CAD BOM File (.csv / .tsv)
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex-1 rounded-lg border-2 border-dashed p-5 text-center flex flex-col items-center justify-center gap-2.5 transition-colors ${
                  isDragging
                    ? 'border-emerald-600 bg-emerald-50/70'
                    : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
                }`}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700 shadow-xs">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900">
                    Drag &amp; drop KiCad, Altium, PADS, or EasyEDA BOM CSV / TSV
                  </p>
                  <p className="text-xs text-slate-600">
                    RFC 4180 parser handles multi-line quotes, Altium preambles (15 rows),{' '}
                    <span className="font-mono">Manf#</span> vs <span className="font-mono">Manf</span>,
                    and semicolon/tab files locally in RAM.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-label="Choose BOM CSV or TSV file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Select Local .CSV / .TSV File
                </button>
                <p className="text-xs font-mono text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Zero bytes transmitted — verify in browser Network tab
                </p>
              </div>
            </div>

            {/* Mode B: Paste Raw CSV/TSV or OPN List */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="bom-raw-input"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  2. Or Paste Raw CSV / TSV / Line-by-Line OPN List
                </label>
                <span className="font-mono text-xs text-slate-600">
                  Indexed DB: {parts.length} verified OPNs
                </span>
              </div>
              <textarea
                id="bom-raw-input"
                rows={7}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Paste CSV/TSV with headers (Designator,Qty,Manf#,Footprint) or one OPN per line:\nCAT6219-330TD-GT3\nAMS1117-5.0\nAP7313-33SRG-7\nTPS54302DDCR`}
                className="w-full flex-1 rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipPassives}
                    onChange={(e) => setSkipPassives(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>
                    <strong>Smart Passive-Skip</strong> (skip R/C/L/FB/J/TP/LED/SW before 100-IC
                    cap)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handlePasteAudit}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  Run Local BOM Risk Audit
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="rounded-md border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900 flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Audit Results Dashboard */}
      {auditState && (
        <section aria-labelledby="bom-audit-results-heading" className="space-y-4">
          <h2 id="bom-audit-results-heading" className="sr-only">
            BOM Audit Results
          </h2>

          {/* Truncation Notice for >100 IC Lines */}
          {auditState.meta.truncatedLines > 0 && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="font-bold">
                    Free Local Audit processed the first {FREE_LINE_LIMIT} of{' '}
                    {auditState.meta.totalIcLines} IC lines
                  </strong>{' '}
                  ({auditState.meta.truncatedLines} additional IC lines omitted
                  {auditState.meta.skippedPassiveCount > 0
                    ? ` after skipping ${auditState.meta.skippedPassiveCount} passive/mechanical rows`
                    : ''}
                  ). Upgrade for 500-line team BOM audits and custom ERP column presets.
                </div>
              </div>
              <a
                href={proWaitlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent('bom_pro_waitlist_click', {
                    source: 'bom_checker_limit',
                    line_count: auditState.meta.totalIcLines,
                  })
                }
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shrink-0"
              >
                Request Pro Early Access ($19/mo) →
              </a>
            </div>
          )}

          {/* Parse Provenance Strip + Passive-Skip Summary + Export CTAs */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900">
                <span>{sourceLabel}</span>
                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                  {auditState.meta.formatLabel}
                </span>
                {auditState.meta.skippedPassiveCount > 0 && (
                  <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-900">
                    {auditState.meta.skippedPassiveCount} passive/mech row
                    {auditState.meta.skippedPassiveCount === 1 ? '' : 's'} skipped
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-600">
                {auditState.meta.detectedColumns.join(' · ')}
              </p>
              {auditState.meta.skippedPassiveSample.length > 0 && (
                <p className="text-xs text-slate-600">
                  Skipped examples:{' '}
                  {auditState.meta.skippedPassiveSample
                    .slice(0, 4)
                    .map((s) => `${s.designator} (${s.rawMpn})`)
                    .join(', ')}
                  {auditState.meta.skippedPassiveCount > 4
                    ? ` +${auditState.meta.skippedPassiveCount - 4} more`
                    : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {copiedMarkdown ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    Copied Markdown
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                    Copy Markdown Report
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                Download Audited BOM CSV
              </button>
            </div>
          </div>

          {/* 5 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border border-slate-300 bg-white p-3.5">
              <div className="text-xs font-semibold text-slate-600">Audited IC Lines</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
                {auditState.kpis.totalLines}
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                {auditState.meta.skippedPassiveCount > 0
                  ? `${auditState.meta.skippedPassiveCount} passives skipped`
                  : auditState.meta.truncatedLines > 0
                    ? `of ${auditState.meta.totalIcLines} IC lines`
                    : 'Audited in RAM'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-3.5">
              <div className="text-xs font-semibold text-slate-600">Matched Parts</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-sky-700">
                {auditState.kpis.matchedCount}
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                {auditState.kpis.totalLines > 0
                  ? `${Math.round((auditState.kpis.matchedCount / auditState.kpis.totalLines) * 100)}% DB coverage`
                  : '0% coverage'}
              </div>
            </div>

            <div
              className={`rounded-lg border p-3.5 ${
                auditState.kpis.eolNrndCount > 0
                  ? 'border-rose-300 bg-rose-50/70'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div className="text-xs font-semibold text-slate-700">EOL / NRND Alerts</div>
              <div
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  auditState.kpis.eolNrndCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {auditState.kpis.eolNrndCount}
              </div>
              <div className="mt-0.5 text-xs text-slate-700">
                {auditState.kpis.eolNrndCount > 0 ? 'Migration review needed' : 'All matched Active'}
              </div>
            </div>

            <div
              className={`rounded-lg border p-3.5 ${
                auditState.kpis.criticalGotchaCount > 0
                  ? 'border-amber-300 bg-amber-50/70'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div className="text-xs font-semibold text-slate-700">
                Gotchas &amp; Mismatches
              </div>
              <div
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  auditState.kpis.criticalGotchaCount > 0 ? 'text-amber-900' : 'text-emerald-700'
                }`}
              >
                {auditState.kpis.criticalGotchaCount}
              </div>
              <div className="mt-0.5 text-xs text-slate-700">
                {auditState.kpis.mismatchCount > 0
                  ? `${auditState.kpis.mismatchCount} Vout/Pkg conflict${auditState.kpis.mismatchCount > 1 ? 's' : ''}`
                  : 'Review before layout'}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3.5 col-span-2 sm:col-span-1">
              <div className="text-xs font-semibold text-emerald-950">
                Candidate Drop-In Alts
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-800">
                {auditState.kpis.dropInFoundCount}
              </div>
              <div className="mt-0.5 text-xs text-emerald-900">
                {auditState.kpis.anyAltFoundCount} lines w/ ranked alts
              </div>
            </div>
          </div>

          {/* Status & Category Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Risk / Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by audit status">
              {(
                [
                  ['all', `All IC Lines (${auditState.rows.length})`],
                  ['matched', `Matched (${auditState.kpis.matchedCount})`],
                  ['eol', `EOL / NRND (${auditState.kpis.eolNrndCount})`],
                  ['gotchas', `Gotchas & Mismatches (${auditState.kpis.criticalGotchaCount})`],
                  [
                    'unmatched',
                    `Unmatched (${auditState.rows.length - auditState.kpis.matchedCount})`,
                  ],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-md border px-3 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                    filter === key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category Filter Toggle */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by part category">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 mr-0.5">
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Category:
              </span>
              {(
                [
                  ['all', 'All'],
                  ['ldo', `${categoryShortLabel('ldo')} (${auditState.kpis.categoryCounts.ldo})`],
                  ['dcdc', `${categoryShortLabel('dcdc')} (${auditState.kpis.categoryCounts.dcdc})`],
                  [
                    'opamp',
                    `${categoryShortLabel('opamp')} (${auditState.kpis.categoryCounts.opamp})`,
                  ],
                ] as const
              ).map(([catKey, catLabel]) => (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setCategoryFilter(catKey)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                    categoryFilter === catKey
                      ? 'border-sky-800 bg-sky-800 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {catLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Results Table */}
          <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-900 text-slate-100 font-mono text-xs uppercase">
                <tr>
                  <th className="px-3.5 py-2.5 text-left whitespace-nowrap">Line / Ref</th>
                  <th className="px-3.5 py-2.5 text-left">BOM MPN &amp; Match</th>
                  <th className="px-3.5 py-2.5 text-left whitespace-nowrap">Package &amp; Status</th>
                  <th className="px-3.5 py-2.5 text-left">EOL, Vout &amp; Gotcha Audit</th>
                  <th className="px-3.5 py-2.5 text-left">Candidate Alternatives &amp; Compare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-600">
                      No BOM lines match the selected status and category filter.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const p = row.matchedPart;
                    const matchBadge =
                      row.matchTier === 'exact'
                        ? {
                            text: 'Exact OPN',
                            cls: 'bg-emerald-50 text-emerald-900 border-emerald-300',
                          }
                        : row.matchTier === 'normalized'
                          ? { text: 'Normalized OPN', cls: 'bg-sky-50 text-sky-900 border-sky-300' }
                          : row.matchTier === 'family_prefix'
                            ? {
                                text: 'Family Prefix',
                                cls: 'bg-amber-50 text-amber-950 border-amber-300',
                              }
                            : {
                                text: 'Unmatched',
                                cls: 'bg-slate-100 text-slate-700 border-slate-300',
                              };

                    const lifeBadge =
                      p?.life === 'EOL'
                        ? 'bg-rose-700 text-white'
                        : p?.life === 'NRND'
                          ? 'bg-amber-700 text-white'
                          : p?.life === 'Active'
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300';

                    return (
                      <tr
                        key={`${row.input.lineNumber}-${row.input.rawMpn}`}
                        className={
                          p?.life === 'EOL' || row.footprintMismatch
                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                            : row.voltageMismatch
                              ? 'bg-amber-50/40 hover:bg-amber-50/70'
                              : 'hover:bg-slate-50/80'
                        }
                      >
                        {/* Col 1: Line / Designator / Qty */}
                        <td className="px-3.5 py-3 align-top whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-950">
                            #{row.input.lineNumber} · {row.input.designator}
                          </div>
                          <div className="font-mono text-xs text-slate-600">
                            Qty: {row.input.qty}
                          </div>
                        </td>

                        {/* Col 2: Input MPN & Matched Part Link */}
                        <td className="px-3.5 py-3 align-top min-w-[210px]">
                          <div className="font-mono font-bold text-slate-950 break-all">
                            {row.input.rawMpn}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${matchBadge.cls}`}
                            >
                              {matchBadge.text}
                            </span>
                            {p && (
                              <Link
                                href={`/en/part/${p.slug}`}
                                onClick={() =>
                                  trackEvent('bom_result_link_click', {
                                    link_type: 'part',
                                    target_slug: p.slug,
                                  })
                                }
                                className="font-mono text-xs font-semibold text-sky-800 hover:underline"
                              >
                                {p.opn} →
                              </Link>
                            )}
                          </div>
                          {p && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                              <span>
                                {p.mfg} · {subTopologyLabel(p.sub)}
                              </span>
                              {p.pdf_url && (
                                <a
                                  href={p.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 font-semibold text-slate-700 hover:text-sky-800 hover:underline"
                                >
                                  PDF
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          )}
                          {!p && row.input.comment && (
                            <div className="mt-1 text-xs text-slate-600 truncate max-w-[220px]">
                              {row.input.comment}
                            </div>
                          )}
                        </td>

                        {/* Col 3: Package, Footprint Conflict & Lifecycle */}
                        <td className="px-3.5 py-3 align-top whitespace-nowrap">
                          {p ? (
                            <div className="space-y-1.5">
                              <span className="inline-block rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900">
                                {p.pkg}
                              </span>
                              {row.footprintMismatch && (
                                <div className="rounded border border-rose-400 bg-rose-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-950 whitespace-normal max-w-[175px]">
                                  FOOTPRINT MISMATCH
                                  <div className="font-normal text-rose-900">
                                    BOM: {row.footprintMismatch.bomFootprint} ≠ DB:{' '}
                                    {row.footprintMismatch.dbPackage}
                                  </div>
                                </div>
                              )}
                              <div>
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${lifeBadge}`}
                                >
                                  {p.life}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-slate-600">
                              {row.input.footprint || 'Not Verified'}
                            </span>
                          )}
                        </td>

                        {/* Col 4: Risk, Voltage Mismatch & Gotchas */}
                        <td className="px-3.5 py-3 align-top min-w-[260px]">
                          {!p ? (
                            <span className="text-slate-600">
                              Outside verified LDO / DC-DC / Op-Amp database.
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              {p.life === 'EOL' && (
                                <div className="flex items-start gap-1.5 text-rose-900 font-semibold">
                                  <AlertOctagon
                                    className="h-3.5 w-3.5 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>OBSOLETE / EOL: Plan active second-source migration.</span>
                                </div>
                              )}
                              {p.life === 'NRND' && (
                                <div className="flex items-start gap-1.5 text-amber-900 font-semibold">
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>NRND: Not Recommended for New Designs.</span>
                                </div>
                              )}
                              {row.footprintMismatch && (
                                <div className="flex items-start gap-1.5 text-rose-950 bg-rose-50 border border-rose-300 rounded px-2 py-1 text-xs">
                                  <AlertOctagon
                                    className="h-3.5 w-3.5 shrink-0 text-rose-700 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    <strong>FOOTPRINT MISMATCH:</strong> BOM specifies{' '}
                                    <code className="font-mono font-bold">
                                      {row.footprintMismatch.bomFootprint}
                                    </code>{' '}
                                    but matched DB OPN is{' '}
                                    <code className="font-mono font-bold">
                                      {row.footprintMismatch.dbPackage}
                                    </code>
                                    . Not physically drop-in compatible.
                                  </span>
                                </div>
                              )}
                              {row.voltageMismatch && (
                                <div className="flex items-start gap-1.5 text-amber-950 bg-amber-100 border border-amber-400 rounded px-2 py-1 text-xs">
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 shrink-0 text-amber-800 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    <strong className="font-mono">VOLTAGE_MISMATCH:</strong>{' '}
                                    {row.voltageMismatch.note}
                                  </span>
                                </div>
                              )}
                              {row.matchTier === 'family_prefix' && !row.voltageMismatch && (
                                <div className="flex items-start gap-1.5 text-amber-950 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Family prefix match
                                    {row.familyVariantCount > 1
                                      ? ` (${row.familyVariantCount} OPN variants in DB)`
                                      : ''}
                                    : verify exact package &amp; voltage suffix before drop-in swap
                                    (AUD-02).
                                  </span>
                                </div>
                              )}
                              {p.ceramic === false && (
                                <div className="inline-block rounded bg-rose-100 border border-rose-300 px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-950">
                                  NOT MLCC-STABLE (ESR REQUIRED)
                                </div>
                              )}
                              {p.crit.length > 0 ? (
                                <ul className="space-y-1 text-xs text-slate-800">
                                  {p.crit.slice(0, 2).map((title, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                      <AlertCircle
                                        className="h-3.5 w-3.5 shrink-0 text-rose-700 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span className="leading-snug">{title}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : p.warn.length > 0 ? (
                                <div className="flex items-start gap-1.5 text-xs text-amber-950">
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>{p.warn[0]}</span>
                                </div>
                              ) : !row.voltageMismatch && !row.footprintMismatch ? (
                                <div className="flex items-center gap-1 text-xs text-emerald-800 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span>No critical pinout/ESR traps flagged</span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>

                        {/* Col 5: Top Candidate Alternatives, Live Compare & 1:1 Pin Diff Links */}
                        <td className="px-3.5 py-3 align-top min-w-[260px]">
                          {!p ? (
                            <span className="text-slate-600">—</span>
                          ) : p.alts.length === 0 ? (
                            <Link
                              href={`/en/part/${p.slug}`}
                              className="text-sky-800 font-semibold hover:underline"
                            >
                              View Part Specs →
                            </Link>
                          ) : (
                            <div className="space-y-1.5">
                              {(row.voltageMismatch || row.footprintMismatch) && (
                                <p className="text-[11px] font-semibold text-amber-950 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                  Alternatives below reference {p.opn} ({p.pkg}) — confirm matching
                                  Vout &amp; package before use.
                                </p>
                              )}
                              {p.alts.map((alt) => {
                                const style = getCompatibilityStyle(alt.lvl);
                                return (
                                  <div
                                    key={alt.slug}
                                    className="rounded border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 space-y-1"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                      <Link
                                        href={`/en/part/${alt.slug}`}
                                        onClick={() =>
                                          trackEvent('bom_result_link_click', {
                                            link_type: 'part',
                                            target_slug: alt.slug,
                                          })
                                        }
                                        className="font-mono text-xs font-bold text-slate-950 hover:text-sky-800 hover:underline"
                                      >
                                        {alt.opn}
                                      </Link>
                                      <span
                                        className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                                      >
                                        {style.tierCode}: {style.shortLabel}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700 font-mono">
                                      <span>{alt.pkg}</span>
                                      <div className="flex items-center gap-2.5 font-sans">
                                        <Link
                                          href={buildCompareHref(p.slug, alt.slug)}
                                          onClick={() =>
                                            trackCompareLaunch('bom_checker', p.slug, alt.slug)
                                          }
                                          className="inline-flex items-center gap-0.5 font-bold text-emerald-800 hover:underline"
                                        >
                                          <GitCompareArrows
                                            className="h-3 w-3"
                                            aria-hidden="true"
                                          />
                                          Compare
                                        </Link>
                                        {alt.vs && (
                                          <Link
                                            href={`/en/vs/${alt.vs}`}
                                            onClick={() =>
                                              trackEvent('bom_result_link_click', {
                                                link_type: 'vs',
                                                target_slug: alt.vs ?? '',
                                              })
                                            }
                                            className="font-bold text-sky-800 hover:underline"
                                          >
                                            1:1 Pin Diff →
                                          </Link>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {p.hasAlt && (
                                <Link
                                  href={`/en/alt/${p.slug}-alternatives`}
                                  onClick={() =>
                                    trackEvent('bom_result_link_click', {
                                      link_type: 'alt',
                                      target_slug: `${p.slug}-alternatives`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 hover:underline pt-0.5"
                                >
                                  All Ranked Alternatives
                                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                </Link>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Non-Intrusive Phase 4 Micro-SaaS Pro Early Access Funnel */}
      <section
        aria-labelledby="bom-pro-heading"
        className="rounded-lg border border-slate-300 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-slate-100 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Pin2Pin BOM Pro · Phase 4 Early Access
          </div>
          <h2 id="bom-pro-heading" className="text-sm sm:text-base font-bold text-white">
            Need 500-Line Team BOM Audits &amp; Custom ERP Mapping?
          </h2>
          <p className="text-xs text-slate-200 leading-relaxed">
            Unlock 500-line client-side batch audits, saved Altium/KiCad/ERP column profiles,
            multi-package pin-diff batch reports, and priority datasheet onboarding for your team.
          </p>
        </div>
        <a
          href={proWaitlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackEvent('bom_pro_waitlist_click', {
              source: 'bom_checker_banner',
              line_count: auditState?.meta.totalIcLines ?? 0,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shrink-0"
        >
          Request Pro Early Access ($19/mo)
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
