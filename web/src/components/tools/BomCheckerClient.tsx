'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { BomIndexPart } from '@/types/schema';
import { getCompatibilityStyle, subTopologyLabel } from '@/lib/format';
import { trackEvent } from '@/lib/analytics';

export interface BomCheckerClientProps {
  parts: BomIndexPart[];
  siteUrl: string;
  disclaimerShort: string;
  proWaitlistUrl: string;
}

const FREE_LINE_LIMIT = 25;

const SAMPLE_BOM_CSV = [
  'Designator,Qty,MPN,Footprint,Comment',
  'U1,1,CAT6219-330TD-GT3,TSOT-23-5,3.3V Analog Sensor Rail LDO (EOL Risk)',
  'U2,1,AMS1117-3.3,SOT-223-3,3.3V Main Digital Rail LDO (ESR Trap)',
  'U3,2,AP7313-33SRG-7,SOT-23-3,3.3V Reversed SOT23R Pinout LDO',
  'U4,1,TPS54302DDCR,SOT-23-6,24V to 5V Synchronous Buck Converter',
  'U5,1,LM2596SX-5.0/NOPB,TO-263-5,Legacy 5V Buck (Active-Low EN)',
  'U6,1,AP2112K-3.3TRG1,SOT-23-5,3.3V BLE/Wi-Fi RF LDO',
  'U7,1,LM393DR,SOIC-8,Window Fault Comparator (Open-Collector)',
  'U8,1,TPS613221ADBVR,SOT-23-5,Single-Cell 3.3V Boost Rail',
  'U9,1,opa333aidbvr,SOT-23-5,Zero-Drift Sensor Front-End Op-Amp',
  'U10,1,LM358,SOIC-8,Signal Buffer Amplifier (Generic Family)',
].join('\n');

interface ParsedBomRow {
  lineNumber: number;
  designator: string;
  qty: string;
  rawMpn: string;
  footprint: string;
  comment: string;
}

interface ParseMeta {
  formatLabel: string;
  detectedColumns: string[];
  totalDataLines: number;
  truncatedLines: number;
}

type MatchTier = 'exact' | 'normalized' | 'family_prefix' | 'unmatched';
type RiskLevel = 'CRITICAL' | 'WARNING' | 'OK' | 'UNMATCHED';
type ResultFilter = 'all' | 'matched' | 'eol' | 'gotchas' | 'unmatched';

interface AuditedBomRow {
  input: ParsedBomRow;
  matchTier: MatchTier;
  matchedPart: BomIndexPart | null;
  familyVariantCount: number;
  riskLevel: RiskLevel;
  riskBadges: string[];
  hasDropInAlt: boolean;
}

function normalizeOpn(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectDelimiter(sampleLines: string[]): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestScore = -1;
  for (const delim of candidates) {
    let score = 0;
    for (const line of sampleLines.slice(0, 6)) {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes && ch === delim) {
          count++;
        }
      }
      score += count;
    }
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }
  return bestScore > 0 ? best : ',';
}

function parseCsvRows(rawText: string, delimiter: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

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
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (ch === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.length > 0));
}

const MPN_PRIMARY_HEADERS = new Set([
  'mpn',
  'mfrpart',
  'mfrpartno',
  'mfrpartnum',
  'mfrpartnumber',
  'manufacturerpart',
  'manufacturerpartno',
  'manufacturerpartnum',
  'manufacturerpartnumber',
  'manufacturerpn',
  'mfgpart',
  'mfgpartno',
  'mfgpartnumber',
  'mfgpn',
  'partnumber',
  'partno',
  'partnum',
  'opn',
  'part',
  'supplierpart',
  'supplierpartnumber',
  'manf',
  'manfpart',
]);

const MPN_SECONDARY_HEADERS = new Set([
  'comment',
  'value',
  'device',
  'component',
  'model',
  'name',
  'item',
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
]);

const QTY_HEADERS = new Set(['qty', 'quantity', 'count', 'amount', 'num']);

const FOOTPRINT_HEADERS = new Set([
  'footprint',
  'package',
  'pkg',
  'case',
  'casepackage',
  'pcbfootprint',
  'landpattern',
]);

const COMMENT_HEADERS = new Set(['description', 'desc', 'comment', 'value', 'notes', 'note']);

function parseBomInput(rawText: string): { rows: ParsedBomRow[]; meta: ParseMeta } {
  const cleanedLines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//') && !/^"?DISCLAIMER:/i.test(l));

  if (cleanedLines.length === 0) {
    return {
      rows: [],
      meta: {
        formatLabel: 'Empty Input',
        detectedColumns: [],
        totalDataLines: 0,
        truncatedLines: 0,
      },
    };
  }

  const delimiter = detectDelimiter(cleanedLines);
  const grid = parseCsvRows(cleanedLines.join('\n'), delimiter);

  // Locate header row within the first 5 rows (handles Altium/PADS title preambles)
  let headerRowIdx = -1;
  let mpnIdx = -1;
  let fallbackMpnIdx = -1;
  let desIdx = -1;
  let qtyIdx = -1;
  let fpIdx = -1;
  let commentIdx = -1;

  for (let r = 0; r < Math.min(5, grid.length); r++) {
    const row = grid[r];
    if (row.length < 2) continue;
    let score = 0;
    let rMpn = -1;
    let rFallbackMpn = -1;
    let rDes = -1;
    let rQty = -1;
    let rFp = -1;
    let rComment = -1;

    row.forEach((cell, cIdx) => {
      const h = normalizeHeader(cell);
      if (!h) return;
      if (rMpn === -1 && MPN_PRIMARY_HEADERS.has(h)) {
        rMpn = cIdx;
        score += 3;
      } else if (rFallbackMpn === -1 && MPN_SECONDARY_HEADERS.has(h)) {
        rFallbackMpn = cIdx;
        score += 1;
      }
      if (rDes === -1 && DESIGNATOR_HEADERS.has(h)) {
        rDes = cIdx;
        score += 2;
      }
      if (rQty === -1 && QTY_HEADERS.has(h)) {
        rQty = cIdx;
        score += 2;
      }
      if (rFp === -1 && FOOTPRINT_HEADERS.has(h)) {
        rFp = cIdx;
        score += 1;
      }
      if (rComment === -1 && COMMENT_HEADERS.has(h)) {
        rComment = cIdx;
      }
    });

    if (score >= 3 && (rMpn !== -1 || rFallbackMpn !== -1)) {
      headerRowIdx = r;
      mpnIdx = rMpn;
      fallbackMpnIdx = rFallbackMpn;
      desIdx = rDes;
      qtyIdx = rQty;
      fpIdx = rFp;
      commentIdx = rComment;
      break;
    }
  }

  const allParsed: ParsedBomRow[] = [];
  const detectedColumns: string[] = [];
  let formatLabel = 'Line-by-Line OPN List';

  if (headerRowIdx !== -1) {
    const headers = grid[headerRowIdx];
    const effectiveMpnIdx = mpnIdx !== -1 ? mpnIdx : fallbackMpnIdx;
    if (desIdx !== -1) detectedColumns.push(`Designator: "${headers[desIdx]}"`);
    if (qtyIdx !== -1) detectedColumns.push(`Qty: "${headers[qtyIdx]}"`);
    if (effectiveMpnIdx !== -1) detectedColumns.push(`MPN: "${headers[effectiveMpnIdx]}"`);
    if (fpIdx !== -1) detectedColumns.push(`Package: "${headers[fpIdx]}"`);

    const delimName = delimiter === '\t' ? 'TSV' : delimiter === ';' ? 'Semicolon CSV' : 'Standard CSV';
    formatLabel = `${delimName} (KiCad / Altium / PADS / EasyEDA Auto-Detected)`;

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const cols = grid[r];
      const primaryVal = mpnIdx !== -1 ? (cols[mpnIdx] ?? '').trim() : '';
      const secondaryVal = fallbackMpnIdx !== -1 ? (cols[fallbackMpnIdx] ?? '').trim() : '';
      const rawMpn = primaryVal || secondaryVal;
      if (!rawMpn) continue;

      const designator = desIdx !== -1 && cols[desIdx] ? cols[desIdx].trim() : `LINE-${allParsed.length + 1}`;
      const qty = qtyIdx !== -1 && cols[qtyIdx] ? cols[qtyIdx].trim() : '1';
      const footprint = fpIdx !== -1 && cols[fpIdx] ? cols[fpIdx].trim() : '';
      const comment =
        commentIdx !== -1 && cols[commentIdx] && commentIdx !== effectiveMpnIdx
          ? cols[commentIdx].trim()
          : '';

      allParsed.push({
        lineNumber: allParsed.length + 1,
        designator,
        qty,
        rawMpn,
        footprint,
        comment,
      });
    }
  } else {
    // Headerless CSV or line-by-line OPN list
    detectedColumns.push('Auto-detected OPN tokens (headerless mode)');
    const startIdx =
      grid.length > 1 &&
      grid[0].length === 1 &&
      (MPN_PRIMARY_HEADERS.has(normalizeHeader(grid[0][0])) ||
        MPN_SECONDARY_HEADERS.has(normalizeHeader(grid[0][0])))
        ? 1
        : 0;
    for (let rIdx = startIdx; rIdx < grid.length; rIdx++) {
      const cols = grid[rIdx];
      if (cols.length === 1) {
        const token = cols[0].trim();
        if (!token) continue;
        allParsed.push({
          lineNumber: allParsed.length + 1,
          designator: `LINE-${allParsed.length + 1}`,
          qty: '1',
          rawMpn: token,
          footprint: '',
          comment: '',
        });
      } else {
        // Heuristic for headerless multi-column rows (e.g. "U1, AMS1117-3.3, 2")
        let designator = `LINE-${allParsed.length + 1}`;
        let qty = '1';
        let rawMpn = '';
        const remaining: string[] = [];

        for (const col of cols) {
          const val = col.trim();
          if (!val) continue;
          if (/^[A-Za-z]{1,3}\d+([,-]\s*[A-Za-z]{0,3}\d+)*$/.test(val) && designator.startsWith('LINE-')) {
            designator = val;
          } else if (/^\d{1,5}$/.test(val) && qty === '1') {
            qty = val;
          } else if (!rawMpn) {
            rawMpn = val;
          } else {
            remaining.push(val);
          }
        }
        if (!rawMpn) continue;
        allParsed.push({
          lineNumber: allParsed.length + 1,
          designator,
          qty,
          rawMpn,
          footprint: remaining[0] ?? '',
          comment: remaining.slice(1).join(' '),
        });
      }
    }
  }

  const totalDataLines = allParsed.length;
  const rows = allParsed.slice(0, FREE_LINE_LIMIT);
  const truncatedLines = Math.max(0, totalDataLines - rows.length);

  return {
    rows,
    meta: {
      formatLabel,
      detectedColumns,
      totalDataLines,
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

export function BomCheckerClient({
  parts,
  siteUrl,
  disclaimerShort,
  proWaitlistUrl,
}: BomCheckerClientProps) {
  const [rawInput, setRawInput] = useState<string>('');
  const [submittedText, setSubmittedText] = useState<string>('');
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const indexMaps = useMemo(() => {
    const exactMap = new Map<string, BomIndexPart>();
    const normMap = new Map<string, BomIndexPart>();
    const familyMap = new Map<string, BomIndexPart[]>();
    const entries = parts.map((part) => {
      const normOpn = normalizeOpn(part.opn);
      const normFam = normalizeOpn(part.fam);
      exactMap.set(part.opn.toUpperCase(), part);
      normMap.set(normOpn, part);
      const famList = familyMap.get(normFam) ?? [];
      famList.push(part);
      familyMap.set(normFam, famList);
      return { part, normOpn, normFam };
    });
    return { exactMap, normMap, familyMap, entries };
  }, [parts]);

  const runAudit = useMemo(() => {
    return (text: string) => {
      const { rows: parsedRows, meta } = parseBomInput(text);
      const auditedRows: AuditedBomRow[] = parsedRows.map((row) => {
        const upperMpn = row.rawMpn.trim().toUpperCase();
        const normMpn = normalizeOpn(row.rawMpn);
        const normFp = normalizeOpn(row.footprint);

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
              candidates = indexMaps.entries
                .filter(
                  (e) =>
                    (e.normFam.length >= 4 && normMpn.startsWith(e.normFam)) ||
                    (normMpn.length >= 5 && e.normOpn.startsWith(normMpn)),
                )
                .map((e) => e.part);
            }

            if (candidates.length > 0) {
              candidates.sort((a, b) => {
                const aFp = normFp && normFp.includes(normalizeOpn(a.pkg)) ? 1 : 0;
                const bFp = normFp && normFp.includes(normalizeOpn(b.pkg)) ? 1 : 0;
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
            familyVariantCount: 0,
            riskLevel: 'UNMATCHED',
            riskBadges: [],
            hasDropInAlt: false,
          };
        }

        const riskBadges: string[] = [];
        if (matchedPart.life === 'EOL') riskBadges.push('EOL / Obsolete');
        if (matchedPart.life === 'NRND') riskBadges.push('NRND Lifecycle');
        if (matchedPart.ceramic === false) riskBadges.push('ESR / Non-MLCC Trap');
        if (matchedPart.crit.length > 0) {
          riskBadges.push(
            `${matchedPart.crit.length} Critical Gotcha${matchedPart.crit.length > 1 ? 's' : ''}`,
          );
        }
        if (matchTier === 'family_prefix') {
          riskBadges.push('Verify Exact OPN Package Suffix');
        }

        const isCritical =
          matchedPart.life === 'EOL' ||
          matchedPart.ceramic === false ||
          matchedPart.crit.length > 0;
        const isWarning =
          matchedPart.life === 'NRND' ||
          matchTier === 'family_prefix' ||
          matchedPart.warn.length > 0;

        const riskLevel: RiskLevel = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'OK';
        const hasDropInAlt = matchedPart.alts.some((a) => a.lvl === 'LEVEL_1_CANDIDATE_DROP_IN');

        return {
          input: row,
          matchTier,
          matchedPart,
          familyVariantCount,
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
          (r.matchedPart.crit.length > 0 || r.matchedPart.ceramic === false),
      ).length;
      const dropInFoundCount = auditedRows.filter((r) => r.hasDropInAlt).length;
      const anyAltFoundCount = auditedRows.filter(
        (r) => r.matchedPart !== null && r.matchedPart.alts.length > 0,
      ).length;

      return {
        meta,
        rows: auditedRows,
        kpis: {
          totalLines: auditedRows.length,
          matchedCount,
          eolNrndCount,
          criticalGotchaCount,
          dropInFoundCount,
          anyAltFoundCount,
        },
      };
    };
  }, [indexMaps]);

  const auditState = useMemo(() => {
    if (!submittedText.trim()) return null;
    return runAudit(submittedText);
  }, [submittedText, runAudit]);

  const runScan = (text: string, mode: 'csv_upload' | 'paste' | 'sample', label: string) => {
    setUploadError(null);
    setRawInput(text);
    setSubmittedText(text);
    setSourceLabel(label);
    setFilter('all');

    const result = runAudit(text);
    trackEvent('bom_scan', {
      mode,
      total_lines: result.kpis.totalLines,
      matched_lines: result.kpis.matchedCount,
      eol_alerts: result.kpis.eolNrndCount,
      critical_gotchas: result.kpis.criticalGotchaCount,
      truncated: result.meta.truncatedLines > 0,
    });
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File exceeds 2 MB browser safety cap. Export a standard BOM CSV/TSV file and retry.');
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
    runScan(SAMPLE_BOM_CSV, 'sample', 'Sample Medical/IoT Power BOM (10 lines)');
  };

  const handlePasteAudit = () => {
    if (!rawInput.trim()) {
      setUploadError('Paste a CSV BOM or line-by-line OPN list first, or load the sample BOM.');
      return;
    }
    runScan(rawInput, 'paste', 'Pasted BOM / OPN List');
  };

  const handleReset = () => {
    setRawInput('');
    setSubmittedText('');
    setSourceLabel('');
    setFilter('all');
    setUploadError(null);
  };

  const handleDownloadCsv = () => {
    if (!auditState || auditState.rows.length === 0) return;

    const cleanBaseUrl = siteUrl.replace(/\/+$/, '');
    // Mandatory AUD-04 Engineering Disclaimer in Row 1 of exported BOM report
    const disclaimerRow = [
      `DISCLAIMER: ${disclaimerShort} Generated client-side by Pin2Pin Global (${cleanBaseUrl}/en/tools/bom-checker/).`,
    ];
    const headerRow = [
      'Line',
      'Designator',
      'Qty',
      'Input_MPN',
      'Match_Tier',
      'Verified_OPN',
      'Manufacturer',
      'Category',
      'Package',
      'Lifecycle_Status',
      'Risk_Level',
      'Critical_Gotchas',
      'Top_Candidate_1',
      'Candidate_1_Tier',
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
            ...(p.ceramic === false ? ['NOT CERAMIC-CAP STABLE (ESR REQUIRED)'] : []),
            ...p.crit,
            ...(r.matchTier === 'family_prefix'
              ? ['FAMILY PREFIX MATCH — VERIFY EXACT PACKAGE SUFFIX']
              : []),
          ].join(' | ')
        : 'Outside current verified analog/power pilot DB';

      return [
        String(r.input.lineNumber),
        r.input.designator,
        r.input.qty,
        r.input.rawMpn,
        r.matchTier,
        p?.opn ?? 'UNMATCHED',
        p?.mfg ?? '—',
        p ? subTopologyLabel(p.sub) : '—',
        p?.pkg ?? (r.input.footprint || '—'),
        p?.life ?? 'Unknown',
        r.riskLevel,
        gotchaNotes || 'None flagged',
        alt1 ? `${alt1.opn} (${alt1.pkg})` : '—',
        alt1 ? getCompatibilityStyle(alt1.lvl).shortLabel : '—',
        alt2 ? `${alt2.opn} (${alt2.pkg})` : '—',
        alt2 ? getCompatibilityStyle(alt2.lvl).shortLabel : '—',
        p ? `${cleanBaseUrl}/en/part/${p.slug}/` : '—',
        p && p.hasAlt ? `${cleanBaseUrl}/en/alt/${p.slug}-alternatives/` : '—',
        firstVs ? `${cleanBaseUrl}/en/vs/${firstVs}/` : '—',
      ];
    });

    const csvContent = [disclaimerRow, headerRow, ...dataRows]
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
      matched_lines: auditState.kpis.matchedCount,
      eol_alerts: auditState.kpis.eolNrndCount,
    });
  };

  const visibleRows = useMemo(() => {
    if (!auditState) return [];
    return auditState.rows.filter((r) => {
      if (filter === 'matched') return r.matchedPart !== null;
      if (filter === 'eol') return r.matchedPart?.life === 'EOL' || r.matchedPart?.life === 'NRND';
      if (filter === 'gotchas') {
        return (
          r.matchedPart !== null &&
          (r.matchedPart.crit.length > 0 || r.matchedPart.ceramic === false)
        );
      }
      if (filter === 'unmatched') return r.matchedPart === null;
      return true;
    });
  }, [auditState, filter]);

  return (
    <div className="space-y-6">
      {/* Main Interactive Workbench Card */}
      <div className="rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
        {/* Workbench Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-tight">
              Client-Side BOM CSV Alternative &amp; EOL Risk Workbench
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-200">
              <Lock className="h-3 w-3" aria-hidden="true" />
              100% Client-Side • Zero-Upload Privacy
            </span>
            <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-200">
              Free Open Preview — up to {FREE_LINE_LIMIT} lines
            </span>
          </div>
        </div>

        {/* Input Modes Panel */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Quick Preset & Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs text-sky-950">
              <Sparkles className="h-4 w-4 text-sky-700 shrink-0" aria-hidden="true" />
              <span>
                Want to inspect real EOL, ESR, and reversed-pinout traps immediately?
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Load Sample Medical/IoT Power BOM (10 lines)
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
            {/* Mode A: Drag-and-Drop CSV Upload */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
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
                    Drag &amp; drop KiCad, Altium, PADS, or EasyEDA BOM CSV
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Auto-detects <span className="font-mono">MPN / Part / Comment / Designator / Qty</span> columns locally in RAM.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-label="Choose BOM CSV file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Select Local .CSV File
                </button>
                <p className="text-[10px] font-mono text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Zero bytes transmitted — verify in browser Network tab
                </p>
              </div>
            </div>

            {/* Mode B: Paste Raw CSV or OPN List */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="bom-raw-input"
                  className="text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  2. Or Paste Raw CSV / Line-by-Line OPN List
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  Indexed DB: {parts.length} verified OPNs
                </span>
              </div>
              <textarea
                id="bom-raw-input"
                rows={7}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Paste CSV with headers (Designator,Qty,MPN,Footprint) or one OPN per line:\nCAT6219-330TD-GT3\nAMS1117-3.3\nAP7313-33SRG-7\nTPS54302DDCR`}
                className="w-full flex-1 rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  Matches Exact OPN → Normalized OPN → Family Prefix
                </span>
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
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Audit Results Dashboard */}
      {auditState && (
        <section aria-label="BOM Audit Results" className="space-y-4">
          {/* Truncation Notice for >25 Lines */}
          {auditState.meta.truncatedLines > 0 && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="font-bold">
                    Free Open Preview audited the first {FREE_LINE_LIMIT} of{' '}
                    {auditState.meta.totalDataLines} BOM lines
                  </strong>{' '}
                  ({auditState.meta.truncatedLines} additional lines omitted). Upgrade for 500-line
                  team BOM audits and custom ERP column presets.
                </div>
              </div>
              <a
                href={proWaitlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent('bom_pro_waitlist_click', {
                    source: 'bom_checker_limit',
                    line_count: auditState.meta.totalDataLines,
                  })
                }
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shrink-0"
              >
                Request Pro Early Access ($19/mo) →
              </a>
            </div>
          )}

          {/* Parse Provenance Strip + CSV Export CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900">
                <span>{sourceLabel}</span>
                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                  {auditState.meta.formatLabel}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                {auditState.meta.detectedColumns.join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              Download Audited BOM CSV
            </button>
          </div>

          {/* 5 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border border-slate-300 bg-white p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Total BOM Lines</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
                {auditState.kpis.totalLines}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {auditState.meta.truncatedLines > 0
                  ? `of ${auditState.meta.totalDataLines} in file`
                  : 'Audited in RAM'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Matched Parts</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-sky-700">
                {auditState.kpis.matchedCount}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
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
              <div className="text-[11px] font-semibold text-slate-600">EOL / NRND Risk Alerts</div>
              <div
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  auditState.kpis.eolNrndCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {auditState.kpis.eolNrndCount}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-600">
                {auditState.kpis.eolNrndCount > 0 ? 'Migration required' : 'All matched Active'}
              </div>
            </div>

            <div
              className={`rounded-lg border p-3.5 ${
                auditState.kpis.criticalGotchaCount > 0
                  ? 'border-amber-300 bg-amber-50/70'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div className="text-[11px] font-semibold text-slate-600">
                Pinout / ESR Critical Gotchas
              </div>
              <div
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  auditState.kpis.criticalGotchaCount > 0 ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {auditState.kpis.criticalGotchaCount}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-600">
                Review before layout
              </div>
            </div>

            <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3.5 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-semibold text-emerald-900">
                Candidate Drop-In Alts Found
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-800">
                {auditState.kpis.dropInFoundCount}
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-800">
                {auditState.kpis.anyAltFoundCount} lines w/ ranked alts
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', `All Lines (${auditState.rows.length})`],
                ['matched', `Matched (${auditState.kpis.matchedCount})`],
                ['eol', `EOL / NRND (${auditState.kpis.eolNrndCount})`],
                ['gotchas', `Critical Gotchas (${auditState.kpis.criticalGotchaCount})`],
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

          {/* Interactive Results Table */}
          <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
                <tr>
                  <th className="px-3.5 py-2.5 text-left whitespace-nowrap">Line / Ref</th>
                  <th className="px-3.5 py-2.5 text-left">BOM MPN &amp; Match</th>
                  <th className="px-3.5 py-2.5 text-left whitespace-nowrap">Package &amp; Status</th>
                  <th className="px-3.5 py-2.5 text-left">EOL &amp; Critical Gotcha Audit</th>
                  <th className="px-3.5 py-2.5 text-left">Top Candidate Alternatives &amp; Diffs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No BOM lines match the selected filter view.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const p = row.matchedPart;
                    const matchBadge =
                      row.matchTier === 'exact'
                        ? { text: 'Exact OPN', cls: 'bg-emerald-50 text-emerald-900 border-emerald-300' }
                        : row.matchTier === 'normalized'
                          ? { text: 'Normalized OPN', cls: 'bg-sky-50 text-sky-900 border-sky-300' }
                          : row.matchTier === 'family_prefix'
                            ? { text: 'Family Prefix', cls: 'bg-amber-50 text-amber-900 border-amber-300' }
                            : { text: 'Unmatched', cls: 'bg-slate-100 text-slate-600 border-slate-300' };

                    const lifeBadge =
                      p?.life === 'EOL'
                        ? 'bg-rose-600 text-white'
                        : p?.life === 'NRND'
                          ? 'bg-amber-600 text-white'
                          : p?.life === 'Active'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200';

                    return (
                      <tr
                        key={`${row.input.lineNumber}-${row.input.rawMpn}`}
                        className={
                          p?.life === 'EOL'
                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                            : 'hover:bg-slate-50/80'
                        }
                      >
                        {/* Col 1: Line / Designator / Qty */}
                        <td className="px-3.5 py-3 align-top whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-950">
                            #{row.input.lineNumber} · {row.input.designator}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            Qty: {row.input.qty}
                          </div>
                        </td>

                        {/* Col 2: Input MPN & Matched Part Link */}
                        <td className="px-3.5 py-3 align-top min-w-[200px]">
                          <div className="font-mono font-bold text-slate-950 break-all">
                            {row.input.rawMpn}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${matchBadge.cls}`}
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
                                className="font-mono text-[11px] font-semibold text-sky-700 hover:underline"
                              >
                                {p.opn} →
                              </Link>
                            )}
                          </div>
                          {p && (
                            <div className="mt-1 text-[11px] text-slate-500">
                              {p.mfg} · {subTopologyLabel(p.sub)}
                            </div>
                          )}
                          {!p && row.input.comment && (
                            <div className="mt-1 text-[11px] text-slate-500 truncate max-w-[220px]">
                              {row.input.comment}
                            </div>
                          )}
                        </td>

                        {/* Col 3: Package & Lifecycle */}
                        <td className="px-3.5 py-3 align-top whitespace-nowrap">
                          {p ? (
                            <div className="space-y-1.5">
                              <span className="inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-900">
                                {p.pkg}
                              </span>
                              <div>
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${lifeBadge}`}
                                >
                                  {p.life}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-500">
                              {row.input.footprint || 'Not Verified'}
                            </span>
                          )}
                        </td>

                        {/* Col 4: Risk & Gotchas */}
                        <td className="px-3.5 py-3 align-top min-w-[240px]">
                          {!p ? (
                            <span className="text-slate-500">
                              Outside verified LDO / DC-DC / Op-Amp database.
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              {p.life === 'EOL' && (
                                <div className="flex items-start gap-1.5 text-rose-800 font-semibold">
                                  <AlertOctagon className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                  <span>OBSOLETE / EOL: Plan active second-source migration.</span>
                                </div>
                              )}
                              {p.life === 'NRND' && (
                                <div className="flex items-start gap-1.5 text-amber-800 font-semibold">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                  <span>NRND: Not Recommended for New Designs.</span>
                                </div>
                              )}
                              {row.matchTier === 'family_prefix' && (
                                <div className="flex items-start gap-1.5 text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-[11px]">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                                  <span>
                                    Family prefix match
                                    {row.familyVariantCount > 1
                                      ? ` (${row.familyVariantCount} OPN variants in DB)`
                                      : ''}
                                    : verify exact package suffix before drop-in swap (AUD-02).
                                  </span>
                                </div>
                              )}
                              {p.ceramic === false && (
                                <div className="inline-block rounded bg-rose-100 border border-rose-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-900">
                                  NOT MLCC-STABLE (ESR REQUIRED)
                                </div>
                              )}
                              {p.crit.length > 0 ? (
                                <ul className="space-y-1 text-[11px] text-slate-800">
                                  {p.crit.slice(0, 2).map((title, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                      <AlertCircle
                                        className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span className="leading-snug">{title}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : p.warn.length > 0 ? (
                                <div className="flex items-start gap-1.5 text-[11px] text-amber-900">
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>{p.warn[0]}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span>No critical pinout/ESR traps flagged</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Col 5: Top 2 Candidate Alternatives & Direct Links */}
                        <td className="px-3.5 py-3 align-top min-w-[240px]">
                          {!p ? (
                            <span className="text-slate-400">—</span>
                          ) : p.alts.length === 0 ? (
                            <Link
                              href={`/en/part/${p.slug}`}
                              className="text-sky-700 font-semibold hover:underline"
                            >
                              View Part Specs →
                            </Link>
                          ) : (
                            <div className="space-y-1.5">
                              {p.alts.map((alt) => {
                                const style = getCompatibilityStyle(alt.lvl);
                                return (
                                  <div
                                    key={alt.slug}
                                    className="rounded border border-slate-200 bg-slate-50/90 px-2 py-1.5 space-y-1"
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
                                        className="font-mono text-[11px] font-bold text-slate-950 hover:text-sky-700 hover:underline"
                                      >
                                        {alt.opn}
                                      </Link>
                                      <span
                                        className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                                      >
                                        {style.tierCode}: {style.shortLabel}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                      <span>{alt.pkg}</span>
                                      {alt.vs ? (
                                        <Link
                                          href={`/en/vs/${alt.vs}`}
                                          onClick={() =>
                                            trackEvent('bom_result_link_click', {
                                              link_type: 'vs',
                                              target_slug: alt.vs ?? '',
                                            })
                                          }
                                          className="font-sans font-bold text-sky-700 hover:underline"
                                        >
                                          1:1 Pin Diff →
                                        </Link>
                                      ) : (
                                        <span>Inspect Specs</span>
                                      )}
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
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline pt-0.5"
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
        aria-label="BOM Pro Early Access"
        className="rounded-lg border border-slate-300 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-slate-100 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Pin2Pin BOM Pro · Phase 4 Early Access
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            Need 500-Line Team BOM Audits &amp; Custom ERP Mapping?
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
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
              line_count: auditState?.meta.totalDataLines ?? 0,
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
