#!/usr/bin/env python3
"""
Install:
  pip install requests beautifulsoup4 pymupdf pandas
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import quote, urlparse

import fitz  # pymupdf
import requests


ALERTS_START_URLS = [
    "https://www.arifhabibltd.com/api/research/categories/list/res",
    "https://www.arifhabibltd.com/api/research/list/res",
]

APPROVED_TICKERS = [
    "PSO", "APL", "ATRL", "PRL", "NRL", "HUBC", "KAPCO", "NCPL", "NPL", "OGDC",
    "PPL", "MARI", "POL", "FFC", "EFERT", "FATIMA", "FFBL", "LUCK", "DGKC",
    "MLCF", "FCCL", "CHCC", "KOHC", "PIOC", "HBL", "UBL", "MCB", "MEBL", "BAHL",
    "FABL", "BOP", "NBP", "INDU", "HCAR", "PSMC", "SAZEW", "AIRLINK", "SYS",
    "AVN", "NETSOL", "TRG", "ILP", "NML", "GATM", "KTML", "SEARL", "FEROZ", "AGP",
    "GLAXO", "MACTER", "COLG", "NESTLE", "MUREB", "UNITY", "NATF", "LCI", "EPCL",
    "LOTCHEM",
]

MAX_PAGES = 20
REQUEST_DELAY_SECONDS = 2
MAX_PDFS_TO_PROCESS = 20
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = BASE_DIR / "downloads"
EXTRACTED_TEXT_DIR = BASE_DIR / "extracted_text"
READABLE_PATH = BASE_DIR / "ahl_reports_structured_readable.txt"
JSONL_PATH = BASE_DIR / "ahl_reports_candidate.jsonl"
INDEX_CSV_PATH = BASE_DIR / "ahl_reports_index.csv"

INSTRUCTION_TEXT = (
    "Analyze the following PSX earnings report snapshot. Focus on reported financial "
    "results, operating drivers, margins, costs, taxation, dividends, and stated risks. "
    "Do not make predictions or investment recommendations."
)

STOP_ANALYSIS_HEADING_RE = re.compile(
    r"\b(recommendation|valuation|analyst contact|disclaimer|rating definitions|"
    r"disclosure|important disclosures)\b",
    re.IGNORECASE,
)
ANALYSIS_START_RE = re.compile(
    r"\b(result review|earnings review|financial result|key highlights?|ahl alert)\b",
    re.IGNORECASE,
)
PERIOD_RE = re.compile(
    r"\b(?:[1-4]Q(?:FY|CY)\d{2}|[1-2]H(?:FY|CY)\d{2}|9M(?:FY|CY)\d{2}|"
    r"(?:FY|CY)\d{2})\b",
    re.IGNORECASE,
)
DATE_RE = re.compile(
    r"\b(?:\d{1,2}[-/ ](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/ ,]*\d{2,4}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ -]\d{1,2},?[ -]\d{2,4}|"
    r"\d{4}[-/]\d{1,2}[-/]\d{1,2})\b",
    re.IGNORECASE,
)
RESULT_KEYWORDS_RE = re.compile(
    r"\b(result review|earnings review|financial result|results?|eps|dps|"
    r"[1-4]q|1h|9m|fy|ahl alert)\b",
    re.IGNORECASE,
)
REJECT_KEYWORDS_RE = re.compile(
    r"\b(earnings preview|market wrap|strategy|weekly|daily market|valuation note|"
    r"technical|sector note|top picks?)\b",
    re.IGNORECASE,
)
RECOMMENDATION_LINE_RE = re.compile(
    r"\b(BUY|SELL|HOLD|Neutral|Underperform|Overweight|Underweight|top pick|preferred pick|"
    r"target price|TP|upside|downside|stance|valuation call|investment case|attractive|"
    r"cheap|expensive|rerating|P/E trading at|EV/EBITDA trading at|fair value|recommendation)\b",
    re.IGNORECASE,
)
FINANCIAL_LINE_RE = re.compile(
    r"\b(Net Revenue|Revenue|Gross Profit|Gross Margin|Finance Cost|Profit After Tax|"
    r"PAT|PBT|EPS|DPS|Effective Tax Rate|tax|provision|receivable|dispatch|offtake|"
    r"production|volume|utilization|cash|borrowing|deposit)\b",
    re.IGNORECASE,
)


@dataclass
class ReportRecord:
    ticker: str
    company: str
    report_type: str
    report_date: str
    period: str
    financial_lines: List[str]
    analysis_text: str
    source_url: str
    pdf_url: str
    local_pdf_path: Path
    local_text_path: Path
    notes: List[str]
    recommendation_removed: bool


def ensure_dirs() -> None:
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    EXTRACTED_TEXT_DIR.mkdir(parents=True, exist_ok=True)


def session_with_headers() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def polite_get(session: requests.Session, url: str) -> Optional[requests.Response]:
    try:
        resp = session.get(url, timeout=40)
    except requests.RequestException as exc:
        print(f"[WARN] Request failed: {url} | {exc}")
        time.sleep(REQUEST_DELAY_SECONDS)
        return None
    time.sleep(REQUEST_DELAY_SECONDS)
    if resp.status_code != 200:
        print(f"[WARN] Non-200 ({resp.status_code}): {url}")
        return None
    return resp


def is_public_ahl_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and "arifhabib" in parsed.netloc.lower()


def fetch_json(session: requests.Session, url: str) -> Optional[dict]:
    resp = polite_get(session, url)
    if resp is None:
        return None
    try:
        return resp.json()
    except ValueError:
        print(f"[WARN] Non-JSON response from listing endpoint: {url}")
        return None


def discover_pdf_urls_from_public_listing_api(
    session: requests.Session,
) -> Tuple[Set[str], Dict[str, str], int]:
    categories_endpoint = ALERTS_START_URLS[0]
    list_endpoint_base = ALERTS_START_URLS[1]
    open_endpoint = "https://www.arifhabibltd.com/api/research/open?path="

    found_pdf_urls: Set[str] = set()
    pdf_source_map: Dict[str, str] = {}
    listing_pages_scanned = 0

    print(f"[INFO] Scanning listing page: {categories_endpoint}")
    categories_json = fetch_json(session, categories_endpoint)
    if not categories_json:
        return found_pdf_urls, pdf_source_map, listing_pages_scanned
    listing_pages_scanned += 1

    categories = categories_json.get("data", [])
    for category in categories:
        category_id = category.get("id")
        if not category_id:
            continue
        for offset in range(0, MAX_PAGES * 100, 100):
            list_url = (
                f"{list_endpoint_base}?count=100&offset={offset}&category={quote(str(category_id))}"
            )
            print(f"[INFO] Scanning listing page: {list_url}")
            page_json = fetch_json(session, list_url)
            if not page_json:
                break
            listing_pages_scanned += 1
            items = page_json.get("data", [])
            if not items:
                break

            for item in items:
                file_path = item.get("file") or item.get("filename")
                if not file_path:
                    continue
                pdf_url = f"{open_endpoint}{quote(str(file_path), safe='/')}"
                if not is_public_ahl_url(pdf_url):
                    continue
                found_pdf_urls.add(pdf_url)
                pdf_source_map.setdefault(pdf_url, list_url)

            next_url = page_json.get("next")
            if not next_url:
                break

    return found_pdf_urls, pdf_source_map, listing_pages_scanned


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]+", "_", name).strip("._")
    return cleaned[:180] if cleaned else "report"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download_pdf(session: requests.Session, url: str, seen_hashes: Set[str]) -> Optional[Path]:
    resp = polite_get(session, url)
    if resp is None:
        return None
    content_type = resp.headers.get("Content-Type", "").lower()
    if ".pdf" not in url.lower() and "pdf" not in content_type:
        print(f"[SKIP] Not a PDF response: {url}")
        return None

    data = resp.content
    file_hash = sha256_bytes(data)
    if file_hash in seen_hashes:
        print(f"[SKIP] Duplicate PDF by hash: {url}")
        return None

    seen_hashes.add(file_hash)
    parsed = urlparse(url)
    base = Path(parsed.path).name or f"report_{file_hash[:10]}.pdf"
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"
    filename = sanitize_filename(base)
    out_path = DOWNLOADS_DIR / filename
    if out_path.exists():
        out_path = DOWNLOADS_DIR / f"{out_path.stem}_{file_hash[:8]}.pdf"
    out_path.write_bytes(data)
    return out_path


def extract_pdf_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    pages: List[str] = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text")
        pages.append(f"--- Page {i} ---\n{text}")
    doc.close()
    return "\n".join(pages)


def guess_ticker(text: str) -> str:
    u = text.upper()
    for t in APPROVED_TICKERS:
        if re.search(rf"\b{re.escape(t)}\b", u):
            return t
    return "Not stated"


def guess_company(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for ln in lines[:40]:
        if len(ln.split()) > 1 and len(ln) < 120:
            if not re.search(r"\b(page|result|review|earnings|financial|alert)\b", ln, re.IGNORECASE):
                return ln
    return "Not stated"


def guess_report_type(text: str) -> str:
    if re.search(r"\bresult review\b", text, re.IGNORECASE):
        return "Result Review"
    if re.search(r"\bearnings review\b", text, re.IGNORECASE):
        return "Earnings Review"
    if re.search(r"\bfinancial result\b", text, re.IGNORECASE):
        return "Financial Result"
    if re.search(r"\bahl alert\b", text, re.IGNORECASE):
        return "AHL Alert"
    return "Not stated"


def guess_report_date(text: str) -> str:
    m = DATE_RE.search(text)
    return m.group(0).strip() if m else "Not stated"


def guess_period(text: str) -> str:
    m = PERIOD_RE.search(text)
    return m.group(0).upper() if m else "Not stated"


def collect_financial_lines(text: str) -> List[str]:
    out: List[str] = []
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for i, ln in enumerate(lines):
        if FINANCIAL_LINE_RE.search(ln):
            out.append(ln)
            if i + 1 < len(lines) and re.search(r"\d", lines[i + 1]):
                out.append(lines[i + 1])
    # Keep ordering and dedupe.
    deduped: List[str] = []
    seen: Set[str] = set()
    for ln in out:
        if ln not in seen:
            seen.add(ln)
            deduped.append(ln)
    return deduped[:80]


def extract_analysis_text(text: str) -> Tuple[str, bool, bool]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    start_idx = 0
    for i, ln in enumerate(lines):
        if ANALYSIS_START_RE.search(ln):
            start_idx = i
            break

    collected: List[str] = []
    removed_reco = False
    for ln in lines[start_idx:]:
        if STOP_ANALYSIS_HEADING_RE.search(ln):
            break
        if RECOMMENDATION_LINE_RE.search(ln):
            removed_reco = True
            continue
        ln_clean = re.sub(r"^[\-\u2022\u25CF\u25AA\*\u00B7]+\s*", "", ln).strip()
        if ln_clean:
            collected.append(ln_clean)

    analysis = "\n".join(collected).strip()
    return analysis, removed_reco, bool(analysis)


def strongly_looks_like_result_report(title_and_text: str) -> bool:
    txt = title_and_text.lower()
    if REJECT_KEYWORDS_RE.search(txt):
        return False
    if not RESULT_KEYWORDS_RE.search(txt):
        return False
    # Require at least one result-ish numerical clue.
    numeric_clue = bool(re.search(r"\b(eps|dps|pat|pbt|revenue|margin|profit|tax)\b", txt))
    period_clue = bool(PERIOD_RE.search(txt))
    return numeric_clue or period_clue


def to_model_input(record: ReportRecord) -> str:
    lines = [
        f"Ticker: {record.ticker}",
        f"Company: {record.company}",
        f"Report Type: {record.report_type}",
        f"Date of Report: {record.report_date}",
        f"Period: {record.period}",
        "",
    ]
    lines.extend(record.financial_lines or ["Financial fields: Not stated"])
    return "\n".join(lines).strip()


def write_readable_block(fh, record: ReportRecord) -> None:
    fh.write("---\n")
    fh.write(f"Ticker: {record.ticker}\n")
    fh.write(f"Company: {record.company}\n")
    fh.write(f"Report Type: {record.report_type}\n")
    fh.write(f"Date of Report: {record.report_date}\n\n")
    fh.write(f"Period: {record.period}\n\n")
    if record.financial_lines:
        for ln in record.financial_lines:
            fh.write(f"{ln}\n")
    else:
        fh.write("Financial fields: Not stated\n")
    fh.write("\nAnalysis:\n")
    fh.write(f"{record.analysis_text}\n\n")
    fh.write("Data Notes:\n")
    for n in record.notes:
        fh.write(f"- {n}\n")
    fh.write(
        f"- source URL: {record.source_url}\n"
        f"- local PDF path: {record.local_pdf_path}\n"
        f"- local extracted text path: {record.local_text_path}\n"
        f"- recommendation lines removed: {record.recommendation_removed}\n\n"
    )


def validate_jsonl(path: Path) -> bool:
    ok = True
    with path.open("r", encoding="utf-8") as fh:
        for i, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                print(f"[ERR] Empty JSONL line at {i}")
                ok = False
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as exc:
                print(f"[ERR] Invalid JSON at line {i}: {exc}")
                ok = False
                continue
            keys = set(obj.keys())
            if keys != {"instruction", "input", "output"}:
                print(f"[ERR] Wrong keys at line {i}: {keys}")
                ok = False
            if not obj.get("input", "").strip() or not obj.get("output", "").strip():
                print(f"[ERR] Empty input/output at line {i}")
                ok = False
    return ok


def run() -> None:
    ensure_dirs()
    session = session_with_headers()

    listing_pages_scanned = 0
    pdf_links_found = 0
    pdfs_downloaded = 0
    candidates_accepted = 0
    rejected_reports = 0
    rows_written = 0
    ticker_not_stated_count = 0
    empty_analysis_rejected = 0
    rejection_reasons: Dict[str, int] = {}

    found_pdf_urls: Set[str] = set()
    pdf_source_map: Dict[str, str] = {}
    seen_pdf_hashes: Set[str] = set()

    reports: List[ReportRecord] = []

    print("[INFO] Starting AHL alerts/research scrape...")
    found_pdf_urls, pdf_source_map, listing_pages_scanned = discover_pdf_urls_from_public_listing_api(
        session
    )

    pdf_links_found = len(found_pdf_urls)
    print(f"[INFO] PDF links found: {pdf_links_found}")

    with READABLE_PATH.open("w", encoding="utf-8") as readable_fh, JSONL_PATH.open(
        "w", encoding="utf-8"
    ) as jsonl_fh:
        for pdf_url in sorted(found_pdf_urls):
            if pdfs_downloaded >= MAX_PDFS_TO_PROCESS:
                print(f"[INFO] Reached MAX_PDFS_TO_PROCESS={MAX_PDFS_TO_PROCESS}. Stopping run.")
                break
            local_pdf = download_pdf(session, pdf_url, seen_pdf_hashes)
            if local_pdf is None:
                continue
            pdfs_downloaded += 1
            print(f"[INFO] Downloaded PDF: {local_pdf.name}")

            source_url = pdf_source_map.get(pdf_url, "Not stated")

            try:
                raw_text = extract_pdf_text(local_pdf)
            except Exception as exc:
                rejected_reports += 1
                reason = "pdf_text_extraction_failed"
                rejection_reasons[reason] = rejection_reasons.get(reason, 0) + 1
                print(f"[WARN] Failed to parse PDF {local_pdf.name}: {exc}")
                continue

            text_filename = sanitize_filename(local_pdf.stem) + ".txt"
            local_txt = EXTRACTED_TEXT_DIR / text_filename
            local_txt.write_text(raw_text, encoding="utf-8")

            title_and_text = f"{local_pdf.stem}\n{raw_text[:12000]}"
            if not strongly_looks_like_result_report(title_and_text):
                rejected_reports += 1
                reason = "not_result_review_style"
                rejection_reasons[reason] = rejection_reasons.get(reason, 0) + 1
                continue

            ticker = guess_ticker(title_and_text)
            if ticker == "Not stated":
                ticker_not_stated_count += 1

            company = guess_company(raw_text)
            report_type = guess_report_type(title_and_text)
            report_date = guess_report_date(title_and_text)
            period = guess_period(title_and_text)
            financial_lines = collect_financial_lines(raw_text)
            analysis_text, reco_removed, has_analysis = extract_analysis_text(raw_text)

            if not has_analysis:
                rejected_reports += 1
                empty_analysis_rejected += 1
                reason = "empty_analysis"
                rejection_reasons[reason] = rejection_reasons.get(reason, 0) + 1
                continue

            notes = []
            if company == "Not stated":
                notes.append("Company could not be reliably extracted.")
            if report_date == "Not stated":
                notes.append("Report date could not be reliably extracted.")
            if period == "Not stated":
                notes.append("Period could not be reliably extracted.")
            if not financial_lines:
                notes.append("No financial metric lines matched extraction patterns.")

            record = ReportRecord(
                ticker=ticker,
                company=company,
                report_type=report_type,
                report_date=report_date,
                period=period,
                financial_lines=financial_lines,
                analysis_text=analysis_text,
                source_url=source_url,
                pdf_url=pdf_url,
                local_pdf_path=local_pdf,
                local_text_path=local_txt,
                notes=notes,
                recommendation_removed=reco_removed,
            )
            reports.append(record)
            candidates_accepted += 1

            write_readable_block(readable_fh, record)
            model_input = to_model_input(record)
            obj = {"instruction": INSTRUCTION_TEXT, "input": model_input, "output": analysis_text}
            jsonl_fh.write(json.dumps(obj, ensure_ascii=False) + "\n")
            rows_written += 1

    index_columns = [
        "ticker",
        "company",
        "report_type",
        "report_date",
        "period",
        "source_url",
        "pdf_url",
        "local_pdf_path",
        "local_text_path",
        "recommendation_removed",
        "notes",
    ]
    with INDEX_CSV_PATH.open("w", encoding="utf-8", newline="") as csv_fh:
        writer = csv.DictWriter(csv_fh, fieldnames=index_columns)
        writer.writeheader()
        for r in reports:
            writer.writerow(
                {
                    "ticker": r.ticker,
                    "company": r.company,
                    "report_type": r.report_type,
                    "report_date": r.report_date,
                    "period": r.period,
                    "source_url": r.source_url,
                    "pdf_url": r.pdf_url,
                    "local_pdf_path": str(r.local_pdf_path),
                    "local_text_path": str(r.local_text_path),
                    "recommendation_removed": r.recommendation_removed,
                    "notes": " | ".join(r.notes) if r.notes else "",
                }
            )

    jsonl_ok = validate_jsonl(JSONL_PATH)

    print("\n[SUMMARY]")
    print(f"listing pages scanned: {listing_pages_scanned}")
    print(f"PDF links found: {pdf_links_found}")
    print(f"PDFs downloaded: {pdfs_downloaded}")
    print(f"candidate reports accepted: {candidates_accepted}")
    print(f"rejected reports and reason: {rejection_reasons or '{}'}")
    print(f"rows written: {rows_written}")
    print(f"JSONL validation passed/failed: {'passed' if jsonl_ok else 'failed'}")
    print(f"reports with ticker Not stated: {ticker_not_stated_count}")
    print(f"reports with empty analysis rejected: {empty_analysis_rejected}")


if __name__ == "__main__":
    run()
