#!/usr/bin/env python3
"""
Strict khistocks broker review scraper.

Rules:
- Source: khistocks research-report pages only
- Broker must be one of: AKD, Topline, JS Global
- Report type must be one of: Result Review, Earnings Review, Earnings Report
- Strict reject all others

Install:
  pip install requests beautifulsoup4 pymupdf
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import fitz  # pymupdf
import requests
from bs4 import BeautifulSoup


START_URL = "https://khistocks.com/research-reports/sectors.html"
AUTHORS_URL = "https://khistocks.com/ajax/getauthorlist"
SECTORS_URL = "https://khistocks.com/ajax/reportsectors"
REPORTS_URL = "https://khistocks.com/ajax/getresearchreport"
REQUEST_DELAY_SECONDS = 0
MAX_REPORTS_TO_PROCESS = 50
MAX_PAGES_TO_SCAN = 60
MAX_PDFS_TO_SCAN = 500
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

OUTPUT_TXT = Path("trading_floor_data/khistocks_broker_reviews_combined.txt")
OUTPUT_REJECTED_CSV = Path("trading_floor_data/khistocks_broker_reviews_rejected.csv")
OUTPUT_ACCEPTED_CSV = Path("trading_floor_data/khistocks_broker_reviews_accepted.csv")

BROKER_PATTERNS = {
    "AKD": re.compile(r"\b(akd securities|akd research|akdsl)\b", re.IGNORECASE),
    "Topline": re.compile(r"\b(topline securities|topline research)\b", re.IGNORECASE),
    "JS Global": re.compile(r"\b(js global capital|js research)\b", re.IGNORECASE),
}

TYPE_PATTERNS = {
    "Result Review": re.compile(r"\bresult review\b", re.IGNORECASE),
    "Earnings Review": re.compile(r"\bearnings review\b", re.IGNORECASE),
    "Earnings Report": re.compile(r"\bearnings report\b", re.IGNORECASE),
}


@dataclass
class Accepted:
    pdf_url: str
    source_page: str
    broker: str
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


def post_json(s: requests.Session, url: str, data: dict) -> Optional[dict]:
    try:
        r = s.post(url, data=data, timeout=40)
    except requests.RequestException:
        maybe_sleep()
        return None
    maybe_sleep()
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except ValueError:
        try:
            return json.loads(r.text)
        except Exception:
            return None


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


def is_khistocks_url(url: str) -> bool:
    netloc = urlparse(url).netloc.lower()
    return "khistocks.com" in netloc


def normalize_space(x: str) -> str:
    return re.sub(r"\s+", " ", (x or "")).strip()


def discover_pdf_urls(s: requests.Session, max_pages: int, max_pdfs: int) -> List[Tuple[str, str]]:
    # Uses khistocks documented AJAX endpoints from research page.
    pdfs: List[Tuple[str, str]] = []
    seen_pdfs: Set[str] = set()

    publishers_payload = get_text(s, AUTHORS_URL)
    sectors_payload = get_text(s, SECTORS_URL)
    if not publishers_payload or not sectors_payload:
        return pdfs

    try:
        publishers = json.loads(publishers_payload)
        sectors = json.loads(sectors_payload)
    except ValueError:
        return pdfs

    # Iterate publisher x sector and fetch recent research rows from API.
    # Prioritize "All other Sectors" (id=73), where broker reports are commonly listed.
    sector_ids = [str(s.get("id", "")).strip() for s in sectors if str(s.get("id", "")).strip()]
    sector_ids = sorted(set(sector_ids), key=lambda x: (x != "73", x))
    max_pairs = max_pages * 500
    loops = 0
    for pub in publishers:
        pubid = str(pub.get("publisher_id", "")).strip()
        if not pubid:
            continue
        for sectorid in sector_ids:
            loops += 1
            if loops > max_pairs:  # safety guard
                break
            payload = post_json(
                s,
                REPORTS_URL,
                data={"id": pubid, "report_date": "", "sectorid": sectorid},
            )
            if not payload:
                continue
            for row in payload.get("data", []):
                filedate = str(row.get("filedate", "")).strip()
                filename = str(row.get("filename", "")).strip()
                pubid_row = str(row.get("pubid", "")).strip() or pubid
                sec_row = str(row.get("sectorid", "")).strip() or sectorid
                if not filedate or not filename:
                    continue
                pdf_url = (
                    f"https://www.khistocks.com/assets/research_reports/sectorwise/"
                    f"{sec_row}/{filedate}/{pubid_row}-{filename}"
                )
                if pdf_url in seen_pdfs:
                    continue
                seen_pdfs.add(pdf_url)
                pdfs.append((pdf_url, REPORTS_URL))
                if len(pdfs) >= max_pdfs:
                    break
            if len(pdfs) >= max_pdfs:
                break
        if len(pdfs) >= max_pdfs:
            break
    return pdfs


def extract_pdf_text(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    pages: List[str] = []
    for i, p in enumerate(doc, start=1):
        pages.append(f"--- Page {i} ---\n{p.get_text('text')}")
    doc.close()
    return "\n".join(pages).strip()


def detect_broker(text: str) -> Optional[str]:
    for name, pat in BROKER_PATTERNS.items():
        if pat.search(text):
            return name
    return None


def detect_report_type(text: str) -> Optional[str]:
    for name, pat in TYPE_PATTERNS.items():
        if pat.search(text):
            return name
    return None


def title_guess_from_url(url: str) -> str:
    path = urlparse(url).path
    return normalize_space(Path(path).name.replace(".pdf", "").replace("-", " ").replace("_", " "))


def run(max_reports: int, max_pages: int, max_pdfs: int) -> None:
    OUTPUT_TXT.parent.mkdir(parents=True, exist_ok=True)
    s = session()

    print("[INFO] Discovering khistocks research-report PDF links...")
    pdf_candidates = discover_pdf_urls(s, max_pages=max_pages, max_pdfs=max_pdfs)
    print(f"[INFO] PDF candidates discovered: {len(pdf_candidates)}")

    accepted: List[Accepted] = []
    rejected: List[Dict[str, str]] = []

    for idx, (pdf_url, source_page) in enumerate(pdf_candidates, start=1):
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

        broker = detect_broker(text)
        if broker is None:
            rejected.append({"pdf_url": pdf_url, "source_page": source_page, "reason": "broker_not_allowed"})
            continue

        report_type = detect_report_type(text)
        if report_type is None:
            rejected.append({"pdf_url": pdf_url, "source_page": source_page, "reason": "report_type_not_allowed"})
            continue

        accepted.append(
            Accepted(
                pdf_url=pdf_url,
                source_page=source_page,
                broker=broker,
                report_type=report_type,
                title_guess=title_guess_from_url(pdf_url),
                text=normalize_space(text).replace(" --- Page ", "\n--- Page "),
            )
        )
        print(f"[INFO] Accepted {len(accepted)}/{max_reports} from scanned {idx}")

    with OUTPUT_TXT.open("w", encoding="utf-8") as out:
        out.write("Khistocks Strict Broker Reviews Combined\n")
        out.write(f"Generated at: {datetime.utcnow().isoformat()}Z\n")
        out.write(f"Rules: broker in [AKD, Topline, JS Global] AND type in [Result Review, Earnings Review, Earnings Report]\n")
        out.write(f"Accepted: {len(accepted)} | Rejected: {len(rejected)}\n")
        out.write("=" * 90 + "\n\n")
        for i, row in enumerate(accepted, start=1):
            out.write(f"## REPORT {i}\n")
            out.write(f"Broker: {row.broker}\n")
            out.write(f"Report Type: {row.report_type}\n")
            out.write(f"Title Guess: {row.title_guess}\n")
            out.write(f"Source Page: {row.source_page}\n")
            out.write(f"PDF URL: {row.pdf_url}\n\n")
            out.write(row.text)
            out.write("\n\n" + "-" * 90 + "\n\n")

    with OUTPUT_REJECTED_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["pdf_url", "source_page", "reason"])
        w.writeheader()
        for r in rejected:
            w.writerow(r)

    with OUTPUT_ACCEPTED_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["pdf_url", "source_page", "broker", "report_type", "title_guess"])
        w.writeheader()
        for a in accepted:
            w.writerow(
                {
                    "pdf_url": a.pdf_url,
                    "source_page": a.source_page,
                    "broker": a.broker,
                    "report_type": a.report_type,
                    "title_guess": a.title_guess,
                }
            )

    print("\n[SUMMARY]")
    print(f"PDF candidates discovered: {len(pdf_candidates)}")
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
