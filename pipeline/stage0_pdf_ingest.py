#!/usr/bin/env python3
"""
Stage 0: Dual-Path Official Datasheet Ingestion & Quality Classifier (AUD-01, AUD-03)

- Downloads datasheet strictly from official manufacturer URLs (blocks distributor/aggregator domains).
- Path A: Extracts [PAGE N] tagged text and structured tables via pdfplumber / pymupdf.
- Path B: Classifies PDF text quality (flags UNSUPPORTED_SCAN if image-only / low text density)
  and renders high-priority pages (pinout, package, absolute maximum ratings, electrical specs,
  thermal info, ordering table) at 300 DPI PNG for multimodal Vision verification.

Usage:
  python pipeline/stage0_pdf_ingest.py --slug xc6206p332mr-g --url https://... --out-dir data/pdfs/ldo-a
  python pipeline/stage0_pdf_ingest.py --slug sample-scan --local-pdf path/to/file.pdf --out-dir data/pdfs/test
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Any

import pdfplumber
import pymupdf
import requests

FORBIDDEN_DOMAINS = (
    "digikey.com",
    "mouser.com",
    "lcsc.com",
    "alldatasheet.com",
    "datasheetcatalog.com",
    "octopart.com",
    "arrow.com",
    "farnell.com",
    "newark.com",
    "rs-online.com",
    "alibaba.com",
    "aliexpress.com",
)

KEY_SECTION_PATTERNS = {
    "pinout": re.compile(
        r"(pin\s*config|pin\s*assign|pin\s*out|pinout|pin\s*description|pin\s*functions|terminal\s*functions|top\s*view)",
        re.IGNORECASE,
    ),
    "abs_max": re.compile(
        r"(absolute\s*maximum\s*ratings|maximum\s*ratings|esd\s*ratings)",
        re.IGNORECASE,
    ),
    "thermal": re.compile(
        r"(thermal\s*information|thermal\s*resistance|theta|rθja|r\s*ja|junction\s*temperature|power\s*dissipation)",
        re.IGNORECASE,
    ),
    "elec_specs": re.compile(
        r"(electrical\s*characteristics|recommended\s*operating\s*conditions)",
        re.IGNORECASE,
    ),
    "ordering": re.compile(
        r"(ordering\s*information|device\s*comparison|package\s*option|part\s*marking)",
        re.IGNORECASE,
    ),
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,application/octet-stream,*/*;q=0.8",
}


def assert_official_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if not host or parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid datasheet URL: {url}")
    for forbidden in FORBIDDEN_DOMAINS:
        if host == forbidden or host.endswith(f".{forbidden}"):
            raise ValueError(
                f"AUD-03 violation: forbidden distributor/aggregator domain '{host}'"
            )
    return host


def download_pdf(url: str, dest: Path, timeout: int = 35) -> dict[str, Any]:
    host = assert_official_url(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
    resp.raise_for_status()
    final_host = assert_official_url(resp.url)
    content = resp.content
    if not content[:5].startswith(b"%PDF"):
        raise ValueError(
            f"Response from {resp.url} is not a valid PDF (magic={content[:16]!r}, content-type={resp.headers.get('Content-Type')})"
        )
    dest.write_bytes(content)
    return {
        "requested_url": url,
        "final_url": resp.url,
        "source_domain": final_host or host,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def classify_and_extract(
    pdf_path: Path,
    out_dir: Path,
    slug: str,
    explicit_pages: list[int] | None = None,
    max_vision_pages: int = 6,
    dpi: int = 300,
) -> dict[str, Any]:
    part_dir = out_dir / slug
    png_dir = part_dir / "png_300dpi"
    part_dir.mkdir(parents=True, exist_ok=True)
    png_dir.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(str(pdf_path))
    page_count = len(doc)

    pages_text: list[dict[str, Any]] = []
    total_chars = 0
    low_text_pages = 0
    category_hits: dict[str, list[int]] = {k: [] for k in KEY_SECTION_PATTERNS}

    for idx in range(page_count):
        page_num = idx + 1
        page = doc[idx]
        text = page.get_text("text") or ""
        clean_len = len(re.sub(r"\s+", "", text))
        total_chars += clean_len
        if clean_len < 80:
            low_text_pages += 1

        matched_tags = []
        for tag, pattern in KEY_SECTION_PATTERNS.items():
            if pattern.search(text):
                category_hits[tag].append(page_num)
                matched_tags.append(tag)

        pages_text.append(
            {
                "page": page_num,
                "char_count": clean_len,
                "image_count": len(page.get_images(full=False)),
                "matched_tags": matched_tags,
                "text": text,
            }
        )

    avg_chars_per_page = total_chars / max(page_count, 1)
    low_text_ratio = low_text_pages / max(page_count, 1)

    # Quality classifier (AUD-01)
    if avg_chars_per_page < 100 or (low_text_ratio > 0.75 and total_chars < 600):
        parse_source_mode = "UNSUPPORTED_SCAN"
        quality_status = "QUARANTINED_UNSUPPORTED_SCAN"
    elif low_text_ratio > 0.35:
        parse_source_mode = "VISION_PRIMARY"
        quality_status = "OK_VISION_PRIMARY"
    else:
        parse_source_mode = "DUAL_PATH_TEXT_VISION"
        quality_status = "OK_DUAL_PATH"

    # Extract tables on key pages with pdfplumber (Path A structured tables)
    selected_pages: list[int] = []
    if explicit_pages:
        selected_pages = [p for p in explicit_pages if 1 <= p <= page_count]
    else:
        # Always include page 1 (overview/pinout), plus first hits from each key section
        candidates = [1]
        for key in ("pinout", "abs_max", "thermal", "elec_specs", "ordering"):
            for p in category_hits[key][:2]:
                if p not in candidates:
                    candidates.append(p)
        if page_count >= 2 and 2 not in candidates:
            candidates.insert(1, 2)
        if page_count >= 3 and 3 not in candidates:
            candidates.insert(2, 3)
        selected_pages = sorted(candidates[:max_vision_pages])

    tables_by_page: dict[int, list[list[list[str | None]]]] = {}
    if parse_source_mode != "UNSUPPORTED_SCAN":
        try:
            with pdfplumber.open(str(pdf_path)) as plumber_doc:
                for p in selected_pages:
                    t_list = plumber_doc.pages[p - 1].extract_tables() or []
                    if t_list:
                        tables_by_page[p] = t_list[:6]
        except Exception as exc:
            tables_by_page[-1] = [[[f"pdfplumber_warning: {exc}"]]]

    # Write [PAGE N] tagged text bundle (Path A)
    tagged_lines: list[str] = []
    for pinfo in pages_text:
        pnum = pinfo["page"]
        tags_str = ",".join(pinfo["matched_tags"]) if pinfo["matched_tags"] else "general"
        tagged_lines.append(f"===== [PAGE {pnum}] (chars={pinfo['char_count']}, tags={tags_str}) =====")
        tagged_lines.append(pinfo["text"].strip())
        if pnum in tables_by_page:
            tagged_lines.append(f"--- [PAGE {pnum} EXTRACTED TABLES] ---")
            for t_idx, tbl in enumerate(tables_by_page[pnum], start=1):
                tagged_lines.append(f"[Table {t_idx}]")
                for row in tbl:
                    cells = [(c or "").replace("\n", " ").strip() for c in row]
                    tagged_lines.append(" | ".join(cells))
        tagged_lines.append("")

    text_out = part_dir / "extracted_pages.txt"
    text_out.write_text("\n".join(tagged_lines), encoding="utf-8")

    # Path B: Render selected pages at 300 DPI PNG for multimodal Vision verification
    rendered_pngs: list[dict[str, Any]] = []
    zoom = dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    pages_to_render = selected_pages if parse_source_mode != "UNSUPPORTED_SCAN" else [1]
    for pnum in pages_to_render:
        page = doc[pnum - 1]
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        png_path = png_dir / f"page_{pnum:03d}.png"
        pix.save(str(png_path))
        rendered_pngs.append(
            {
                "page": pnum,
                "path": str(png_path.resolve()),
                "width": pix.width,
                "height": pix.height,
                "dpi": dpi,
            }
        )

    doc.close()

    report = {
        "slug": slug,
        "pdf_path": str(pdf_path.resolve()),
        "page_count": page_count,
        "total_chars": total_chars,
        "avg_chars_per_page": round(avg_chars_per_page, 1),
        "low_text_pages": low_text_pages,
        "low_text_ratio": round(low_text_ratio, 3),
        "parse_source_mode": parse_source_mode,
        "quality_status": quality_status,
        "category_hits": category_hits,
        "selected_vision_pages": pages_to_render,
        "extracted_text_path": str(text_out.resolve()),
        "rendered_pngs": rendered_pngs,
    }
    report_path = part_dir / "ingest_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 0 Dual-Path PDF Ingestor")
    parser.add_argument("--slug", required=True, help="OPN slug (kebab-case)")
    parser.add_argument("--url", help="Official manufacturer PDF URL")
    parser.add_argument("--local-pdf", help="Existing local PDF path (skip download)")
    parser.add_argument("--out-dir", default="data/pdfs", help="Output base directory")
    parser.add_argument(
        "--pages",
        help="Comma-separated 1-based page numbers to render at 300 DPI (overrides auto selection)",
    )
    parser.add_argument("--max-vision-pages", type=int, default=6)
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    pdf_path = out_dir / args.slug / f"{args.slug}.pdf"

    download_meta: dict[str, Any] | None = None
    if args.local_pdf:
        pdf_path = Path(args.local_pdf)
        if not pdf_path.exists():
            print(f"ERROR: local PDF not found: {pdf_path}", file=sys.stderr)
            return 2
    elif args.url:
        try:
            download_meta = download_pdf(args.url, pdf_path)
        except Exception as exc:
            print(json.dumps({"slug": args.slug, "error": str(exc)}, indent=2))
            return 1
    else:
        print("ERROR: provide either --url or --local-pdf", file=sys.stderr)
        return 2

    explicit_pages = None
    if args.pages:
        explicit_pages = [int(x.strip()) for x in args.pages.split(",") if x.strip()]

    report = classify_and_extract(
        pdf_path=pdf_path,
        out_dir=out_dir,
        slug=args.slug,
        explicit_pages=explicit_pages,
        max_vision_pages=args.max_vision_pages,
        dpi=args.dpi,
    )
    if download_meta:
        report["download"] = download_meta
        (out_dir / args.slug / "ingest_report.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )

    print(json.dumps(report, indent=2))
    if report["parse_source_mode"] == "UNSUPPORTED_SCAN":
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
