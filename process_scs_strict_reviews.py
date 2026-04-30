#!/usr/bin/env python3
"""
Strict SCS research collector.

Rules:
- Source: scstrade.com research pages / linked PDFs
- Accept only report types:
  * Result Review
  * Earnings Review
  * Earnings Report
- Reject everything else

Install:
  pip install requests beautifulsoup4 pymupdf
"""

from __future__ import annotations

import argparse
import csv
import re
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import fitz  # pymupdf
import requests
from bs4 import BeautifulSoup


START_URLS = [
    "https://www.scstrade.com/research/RE_Reports.aspx",
    "https://www.scstrade.com/research/RE_Gen_Reports.aspx",
]
ALLOWED_HOSTS = {"www.scstrade.com", "scstrade.com", "ftp.scstrade.com"}
MAX_REPORTS_TO_PROCESS = 50
MAX_PAGES_TO_SCAN = 80
MAX_PDFS_TO_SCAN = 1000
REQUEST_DELAY_SECONDS = 0
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

OUTPUT_TXT = Path("trading_floor_data/scs_strict_reviews_combined.txt")
OUTPUT_ACCEPTED_CSV = Path("trading_floor_data/scs_strict_reviews_accepted.csv")
OUTPUT_REJECTED_CSV = Path("trading_floor_data/scs_strict_reviews_rejected.csv")

TYPE_PATTERNS = {
    "Result Review": re.compile(r"\bresult review\b", re.IGNORECASE),
    "Earnings Review": re.compile(r"\bearnings review\b", re.IGNORECASE),
    "Earnings Report": re.compile(r"\bearnings report\b", re.IGNORECASE),
}


@dataclass
class Accepted:
    pdf_url: str
    source_page: str
    report_type: str
    title_guess: str
    text: str


def maybe_sleep() -> None:
    if REQUEST_DELAY_SECONDS > 0:
        time.sleep(REQUEST_DELAY_SECONDS)


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def normalize_space(x: str) -> str:
    return re.sub(r"\s+", " ", (x or "")).strip()


def is_allowed_host(url: str) -> bool:
    netloc = urlparse(url).netloc.lower()
    return netloc in ALLOWED_HOSTS


def get_text(s: requests.Session, url: str) -> Optional[str]:
    try:
        r = s.get(url, timeout=40)
    except requests.RequestException:
        maybe_sleep()
        return None
    maybe_sleep()
    if r.status_code != 200:
        return None
    return r.text


def get_pdf_bytes(s: requests.Session, url: str) -> Optional[bytes]:
    try:
        r = s.get(url, timeout=60)
    except requests.RequestException:
        maybe_sleep()
        return None
    maybe_sleep()
    if r.status_code != 200:
        return None
    return r.content


def discover_pdf_urls(s: requests.Session, max_pages: int, max_pdfs: int) -> List[Tuple[str, str]]:
    q = deque(START_URLS)
    seen_pages: Set[str] = set()
    seen_pdfs: Set[str] = set()
    results: List[Tuple[str, str]] = []

    while q and len(seen_pages) < max_pages and len(results) < max_pdfs:
        page = q.popleft()
        if page in seen_pages:
            continue
        seen_pages.add(page)
        html = get_text(s, page)
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.select("a[href]"):
            href = (a.get("href") or "").strip()
            if not href:
                continue
            abs_url = urljoin(page, href)
            if not is_allowed_host(abs_url):
                continue
            lower = abs_url.lower()
            if lower.endswith(".pdf") and "/research/" in lower:
                if abs_url not in seen_pdfs:
                    seen_pdfs.add(abs_url)
                    results.append((abs_url, page))
                    if len(results) >= max_pdfs:
                        break
            elif ("/research/" in lower or "ss_researchreports.aspx" in lower) and abs_url not in seen_pages:
                q.append(abs_url)

    return results


def extract_pdf_text(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    pages: List[str] = []
    for i, p in enumerate(doc, start=1):
        pages.append(f"--- Page {i} ---\n{p.get_text('text')}")
    doc.close()
    return "\n".join(pages).strip()


def detect_report_type(text: str) -> Optional[str]:
    for name, pat in TYPE_PATTERNS.items():
        if pat.search(text):
            return name
    return None


def title_guess(url: str) -> str:
    p = Path(urlparse(url).path).name
    p = p.replace(".pdf", "")
    p = p.replace("%20", " ")
    p = p.replace("_", " ")
    p = p.replace("-", " ")
    return normalize_space(p)


def run(max_reports: int, max_pages: int, max_pdfs: int) -> None:
    OUTPUT_TXT.parent.mkdir(parents=True, exist_ok=True)
    s = session()

    print("[INFO] Discovering SCS research PDFs...")
    candidates = discover_pdf_urls(s, max_pages=max_pages, max_pdfs=max_pdfs)
    print(f"[INFO] PDF candidates discovered: {len(candidates)}")

    accepted: List[Accepted] = []
    rejected: List[Dict[str, str]] = []

    for i, (pdf_url, source_page) in enumerate(candidates, start=1):
        if len(accepted) >= max_reports:
            break

        data = get_pdf_bytes(s, pdf_url)
        if not data:
            rejected.append({"pdf_url": pdf_url, "source_page": source_page, "reason": "download_failed"})
            continue
        try:
            text = extract_pdf_text(data)
        except Exception:
            rejected.append({"pdf_url": pdf_url, "source_page": source_page, "reason": "pdf_parse_failed"})
            continue

        rtype = detect_report_type(text)
        if not rtype:
            rejected.append({"pdf_url": pdf_url, "source_page": source_page, "reason": "report_type_not_allowed"})
            continue

        accepted.append(
            Accepted(
                pdf_url=pdf_url,
                source_page=source_page,
                report_type=rtype,
                title_guess=title_guess(pdf_url),
                text=text,
            )
        )
        print(f"[INFO] Accepted {len(accepted)}/{max_reports} from scanned {i}")

    with OUTPUT_TXT.open("w", encoding="utf-8") as out:
        out.write("SCS Strict Result/Earnings Reviews Combined\n")
        out.write(f"Generated at: {datetime.utcnow().isoformat()}Z\n")
        out.write("Allowed types: Result Review, Earnings Review, Earnings Report\n")
        out.write(f"Accepted: {len(accepted)} | Rejected: {len(rejected)}\n")
        out.write("=" * 90 + "\n\n")
        for idx, a in enumerate(accepted, start=1):
            out.write(f"## REPORT {idx}\n")
            out.write(f"Report Type: {a.report_type}\n")
            out.write(f"Title Guess: {a.title_guess}\n")
            out.write(f"Source Page: {a.source_page}\n")
            out.write(f"PDF URL: {a.pdf_url}\n\n")
            out.write(a.text)
            out.write("\n\n" + "-" * 90 + "\n\n")

    with OUTPUT_ACCEPTED_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["pdf_url", "source_page", "report_type", "title_guess"])
        w.writeheader()
        for a in accepted:
            w.writerow(
                {
                    "pdf_url": a.pdf_url,
                    "source_page": a.source_page,
                    "report_type": a.report_type,
                    "title_guess": a.title_guess,
                }
            )

    with OUTPUT_REJECTED_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["pdf_url", "source_page", "reason"])
        w.writeheader()
        for r in rejected:
            w.writerow(r)

    print("\n[SUMMARY]")
    print(f"PDF candidates discovered: {len(candidates)}")
    print(f"Accepted: {len(accepted)}")
    print(f"Rejected: {len(rejected)}")
    print(f"Combined TXT: {OUTPUT_TXT}")
    print(f"Accepted CSV: {OUTPUT_ACCEPTED_CSV}")
    print(f"Rejected CSV: {OUTPUT_REJECTED_CSV}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--max-reports", type=int, default=MAX_REPORTS_TO_PROCESS)
    p.add_argument("--max-pages", type=int, default=MAX_PAGES_TO_SCAN)
    p.add_argument("--max-pdfs", type=int, default=MAX_PDFS_TO_SCAN)
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(max_reports=args.max_reports, max_pages=args.max_pages, max_pdfs=args.max_pdfs)
