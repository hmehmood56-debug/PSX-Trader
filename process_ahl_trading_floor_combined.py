#!/usr/bin/env python3
"""
Install:
  pip install requests pymupdf
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote

import fitz  # pymupdf
import requests


BASE_URL = "https://www.arifhabibltd.com"
CATEGORIES_URL = f"{BASE_URL}/api/research/categories/list/res"
LIST_URL_BASE = f"{BASE_URL}/api/research/list/res"
OPEN_URL_BASE = f"{BASE_URL}/api/research/open?path="

TARGET_CATEGORY_NAMES = {"from trading floor"}
MAX_PAGES = 50
REQUEST_DELAY_SECONDS = 2
MAX_REPORTS_TO_PROCESS = 200
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Optional date filters (listing item created timestamp). Keep None for all.
DATE_FROM = None  # "2020-01-01"
DATE_TO = None  # "2026-12-31"

OUTPUT_PATH = Path("trading_floor_data/ahl_trading_floor_combined_200.txt")


@dataclass
class ListingItem:
    item_id: str
    title: str
    description: str
    file_path: str
    created_at: str
    source_url: str
    pdf_url: str


def parse_iso_dt(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def in_date_range(created_at: str) -> bool:
    dt = parse_iso_dt(created_at)
    if dt is None:
        return True
    if DATE_FROM:
        start = datetime.fromisoformat(f"{DATE_FROM}T00:00:00+00:00")
        if dt < start:
            return False
    if DATE_TO:
        end = datetime.fromisoformat(f"{DATE_TO}T23:59:59+00:00")
        if dt > end:
            return False
    return True


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def polite_get_json(s: requests.Session, url: str) -> Optional[dict]:
    try:
        r = s.get(url, timeout=40)
    except requests.RequestException as exc:
        print(f"[WARN] Request failed: {url} | {exc}")
        time.sleep(REQUEST_DELAY_SECONDS)
        return None
    time.sleep(REQUEST_DELAY_SECONDS)
    if r.status_code != 200:
        print(f"[WARN] Non-200 ({r.status_code}): {url}")
        return None
    try:
        return r.json()
    except ValueError:
        print(f"[WARN] Non-JSON response: {url}")
        return None


def polite_get_pdf_bytes(s: requests.Session, url: str) -> Optional[bytes]:
    try:
        r = s.get(url, timeout=60)
    except requests.RequestException as exc:
        print(f"[WARN] PDF request failed: {url} | {exc}")
        time.sleep(REQUEST_DELAY_SECONDS)
        return None
    time.sleep(REQUEST_DELAY_SECONDS)
    if r.status_code != 200:
        print(f"[WARN] PDF non-200 ({r.status_code}): {url}")
        return None
    return r.content


def get_category_ids(s: requests.Session) -> List[str]:
    print(f"[INFO] Scanning listing page: {CATEGORIES_URL}")
    payload = polite_get_json(s, CATEGORIES_URL)
    if not payload:
        return []
    out: List[str] = []
    for c in payload.get("data", []):
        name = str(c.get("name", "")).strip().lower()
        cid = str(c.get("id", "")).strip()
        if cid and name in TARGET_CATEGORY_NAMES:
            out.append(cid)
    return out


def fetch_items(s: requests.Session, category_ids: List[str]) -> Tuple[List[ListingItem], int]:
    items: List[ListingItem] = []
    pages_scanned = 0

    for cid in category_ids:
        for offset in range(0, MAX_PAGES * 100, 100):
            url = f"{LIST_URL_BASE}?count=100&offset={offset}&category={quote(cid)}"
            print(f"[INFO] Scanning listing page: {url}")
            payload = polite_get_json(s, url)
            if not payload:
                break
            pages_scanned += 1

            data = payload.get("data", [])
            if not data:
                break

            for row in data:
                file_path = str(row.get("file", "")).strip()
                created_at = str(row.get("crt", "")).strip()
                if not file_path or not in_date_range(created_at):
                    continue
                items.append(
                    ListingItem(
                        item_id=str(row.get("id", "")).strip(),
                        title=str(row.get("tt", "")).strip(),
                        description=str(row.get("dsc", "")).strip(),
                        file_path=file_path,
                        created_at=created_at,
                        source_url=url,
                        pdf_url=f"{OPEN_URL_BASE}{quote(file_path, safe='/')}",
                    )
                )

            if not payload.get("next"):
                break
    return items, pages_scanned


def select_diverse(items: List[ListingItem], limit: int) -> List[ListingItem]:
    by_newest = sorted(items, key=lambda x: x.created_at or "", reverse=True)
    buckets: Dict[str, List[ListingItem]] = {}
    for item in by_newest:
        dt = parse_iso_dt(item.created_at)
        key = dt.strftime("%Y-%m") if dt else "unknown"
        buckets.setdefault(key, []).append(item)

    selected: List[ListingItem] = []
    seen = set()
    keys = sorted(buckets.keys(), reverse=True)
    while len(selected) < limit:
        progressed = False
        for k in keys:
            if not buckets[k]:
                continue
            item = buckets[k].pop(0)
            if item.item_id in seen:
                continue
            seen.add(item.item_id)
            selected.append(item)
            progressed = True
            if len(selected) >= limit:
                break
        if not progressed:
            break
    return selected


def extract_text_from_pdf_bytes(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for i, page in enumerate(doc, start=1):
        pages.append(f"--- Page {i} ---\n{page.get_text('text')}")
    doc.close()
    return "\n".join(pages).strip()


def compact_text(s: str) -> str:
    # Keep original wording; only normalize excessive blank lines.
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    s = session()

    print("[INFO] Starting AHL Trading Floor in-memory processing...")
    cids = get_category_ids(s)
    if not cids:
        print("[ERR] No matching Trading Floor category found.")
        return

    all_items, pages_scanned = fetch_items(s, cids)
    print(f"[INFO] Trading Floor items discovered: {len(all_items)}")
    selected = select_diverse(all_items, MAX_REPORTS_TO_PROCESS)
    print(f"[INFO] Selected for processing (max={MAX_REPORTS_TO_PROCESS}): {len(selected)}")

    processed = 0
    failed = 0

    with OUTPUT_PATH.open("w", encoding="utf-8") as out:
        out.write("AHL Trading Floor Combined Text\n")
        out.write(f"Generated at: {datetime.utcnow().isoformat()}Z\n")
        out.write(f"Requested max reports: {MAX_REPORTS_TO_PROCESS}\n")
        out.write(f"Listing pages scanned: {pages_scanned}\n")
        out.write("=" * 80 + "\n\n")

        for i, item in enumerate(selected, start=1):
            data = polite_get_pdf_bytes(s, item.pdf_url)
            if data is None:
                failed += 1
                continue
            try:
                raw = extract_text_from_pdf_bytes(data)
            except Exception as exc:
                print(f"[WARN] PDF parse failed for {item.item_id}: {exc}")
                failed += 1
                continue

            text = compact_text(raw)
            if not text:
                failed += 1
                continue

            out.write(f"## REPORT {i}\n")
            out.write(f"Title: {item.title or 'Not stated'}\n")
            out.write(f"Created At: {item.created_at or 'Not stated'}\n")
            out.write(f"Item ID: {item.item_id or 'Not stated'}\n")
            out.write(f"Source URL: {item.source_url}\n")
            out.write(f"PDF URL: {item.pdf_url}\n")
            out.write("\n")
            out.write(text)
            out.write("\n\n" + "-" * 80 + "\n\n")

            processed += 1
            print(f"[INFO] Processed {processed}/{len(selected)}: {item.title}")

    print("\n[SUMMARY]")
    print(f"listing pages scanned: {pages_scanned}")
    print(f"items discovered: {len(all_items)}")
    print(f"selected: {len(selected)}")
    print(f"processed into combined txt: {processed}")
    print(f"failed: {failed}")
    print(f"combined output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
