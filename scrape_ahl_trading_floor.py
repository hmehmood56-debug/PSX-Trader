#!/usr/bin/env python3
"""
Install:
  pip install requests beautifulsoup4 pymupdf pandas
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import quote

import fitz  # pymupdf
import requests


BASE_URL = "https://www.arifhabibltd.com"
ALERTS_START_URLS = [
    f"{BASE_URL}/api/research/categories/list/res",
    f"{BASE_URL}/api/research/list/res",
]
MAX_PAGES = 20
REQUEST_DELAY_SECONDS = 2
MAX_PDFS_TO_PROCESS = 20
TRADING_FLOOR_CATEGORY_NAMES = {"from trading floor"}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Optional date filter for listing item timestamp (created timestamp on AHL side).
# Keep as None to include all available.
DATE_FROM = None  # e.g. "2024-01-01"
DATE_TO = None  # e.g. "2026-12-31"

BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = BASE_DIR / "trading_floor_data" / "downloads"
EXTRACTED_TEXT_DIR = BASE_DIR / "trading_floor_data" / "extracted_text"
INDEX_JSON_PATH = BASE_DIR / "trading_floor_data" / "ahl_trading_floor_index.json"

DATE_RE = re.compile(
    r"\b(?:\d{1,2}[-/ ](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/ ,]*\d{2,4}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ -]\d{1,2},?[ -]\d{2,4}|"
    r"\d{4}[-/]\d{1,2}[-/]\d{1,2})\b",
    re.IGNORECASE,
)


@dataclass
class ListingItem:
    item_id: str
    title: str
    description: str
    file_path: str
    created_at: str
    category_name: str
    source_url: str
    pdf_url: str


def ensure_dirs() -> None:
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    EXTRACTED_TEXT_DIR.mkdir(parents=True, exist_ok=True)


def session_with_headers() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def polite_get_json(session: requests.Session, url: str) -> Optional[dict]:
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
    try:
        return resp.json()
    except ValueError:
        print(f"[WARN] Non-JSON response: {url}")
        return None


def polite_get_bytes(session: requests.Session, url: str) -> Optional[bytes]:
    try:
        resp = session.get(url, timeout=60)
    except requests.RequestException as exc:
        print(f"[WARN] Request failed: {url} | {exc}")
        time.sleep(REQUEST_DELAY_SECONDS)
        return None
    time.sleep(REQUEST_DELAY_SECONDS)
    if resp.status_code != 200:
        print(f"[WARN] Non-200 ({resp.status_code}): {url}")
        return None
    ct = resp.headers.get("Content-Type", "").lower()
    if "pdf" not in ct and ".pdf" not in url.lower():
        print(f"[WARN] Not a PDF response: {url}")
        return None
    return resp.content


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
        left = datetime.fromisoformat(f"{DATE_FROM}T00:00:00+00:00")
        if dt < left:
            return False
    if DATE_TO:
        right = datetime.fromisoformat(f"{DATE_TO}T23:59:59+00:00")
        if dt > right:
            return False
    return True


def get_trading_floor_category_ids(session: requests.Session) -> List[Tuple[str, str]]:
    categories_url = ALERTS_START_URLS[0]
    print(f"[INFO] Scanning listing page: {categories_url}")
    payload = polite_get_json(session, categories_url)
    if not payload:
        return []
    out: List[Tuple[str, str]] = []
    for c in payload.get("data", []):
        cid = str(c.get("id", "")).strip()
        name = str(c.get("name", "")).strip()
        if cid and name.lower() in TRADING_FLOOR_CATEGORY_NAMES:
            out.append((cid, name))
    return out


def fetch_listing_items(session: requests.Session) -> Tuple[List[ListingItem], int]:
    list_base = ALERTS_START_URLS[1]
    open_base = f"{BASE_URL}/api/research/open?path="
    listing_pages_scanned = 0

    category_pairs = get_trading_floor_category_ids(session)
    if not category_pairs:
        print("[WARN] Trading Floor category not found.")
        return [], listing_pages_scanned

    all_items: List[ListingItem] = []
    for category_id, category_name in category_pairs:
        for offset in range(0, MAX_PAGES * 100, 100):
            list_url = (
                f"{list_base}?count=100&offset={offset}&category={quote(category_id)}"
            )
            print(f"[INFO] Scanning listing page: {list_url}")
            payload = polite_get_json(session, list_url)
            if not payload:
                break
            listing_pages_scanned += 1
            data = payload.get("data", [])
            if not data:
                break
            for item in data:
                file_path = str(item.get("file", "")).strip()
                if not file_path:
                    continue
                created_at = str(item.get("crt", "")).strip()
                if not in_date_range(created_at):
                    continue
                pdf_url = f"{open_base}{quote(file_path, safe='/')}"
                all_items.append(
                    ListingItem(
                        item_id=str(item.get("id", "")).strip(),
                        title=str(item.get("tt", "")).strip(),
                        description=str(item.get("dsc", "")).strip(),
                        file_path=file_path,
                        created_at=created_at,
                        category_name=category_name,
                        source_url=list_url,
                        pdf_url=pdf_url,
                    )
                )
            if not payload.get("next"):
                break
    return all_items, listing_pages_scanned


def select_diverse_date_items(items: List[ListingItem], max_count: int) -> List[ListingItem]:
    # Prefer one report from each YYYY-MM bucket (newest first), then fill.
    sorted_items = sorted(items, key=lambda x: x.created_at or "", reverse=True)
    bucketed: Dict[str, List[ListingItem]] = {}
    for item in sorted_items:
        dt = parse_iso_dt(item.created_at)
        bucket = dt.strftime("%Y-%m") if dt else "unknown"
        bucketed.setdefault(bucket, []).append(item)

    selected: List[ListingItem] = []
    seen_ids: Set[str] = set()
    # Round-robin through buckets for diversity.
    bucket_keys = sorted(bucketed.keys(), reverse=True)
    while len(selected) < max_count:
        progressed = False
        for b in bucket_keys:
            if not bucketed[b]:
                continue
            cand = bucketed[b].pop(0)
            if cand.item_id in seen_ids:
                continue
            selected.append(cand)
            seen_ids.add(cand.item_id)
            progressed = True
            if len(selected) >= max_count:
                break
        if not progressed:
            break
    return selected


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]+", "_", name).strip("._")
    return cleaned[:180] if cleaned else "report"


def save_pdf(data: bytes, item: ListingItem, seen_hashes: Set[str]) -> Optional[Path]:
    file_hash = sha256_bytes(data)
    if file_hash in seen_hashes:
        print(f"[SKIP] Duplicate by hash: {item.pdf_url}")
        return None
    seen_hashes.add(file_hash)

    base = item.title or Path(item.file_path).name or item.item_id
    filename = sanitize_filename(base)
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    out = DOWNLOADS_DIR / filename
    if out.exists():
        out = DOWNLOADS_DIR / f"{out.stem}_{file_hash[:8]}.pdf"
    out.write_bytes(data)
    return out


def extract_pdf_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    parts: List[str] = []
    for i, page in enumerate(doc, start=1):
        parts.append(f"--- Page {i} ---\n{page.get_text('text')}")
    doc.close()
    return "\n".join(parts)


def guess_report_date(title: str, text: str) -> str:
    m = DATE_RE.search(title) or DATE_RE.search(text)
    return m.group(0).strip() if m else "Not stated"


def main() -> None:
    ensure_dirs()
    session = session_with_headers()

    print("[INFO] Starting AHL Trading Floor scrape...")
    all_items, listing_pages_scanned = fetch_listing_items(session)
    print(f"[INFO] Listing items found in Trading Floor: {len(all_items)}")

    selected_items = select_diverse_date_items(all_items, MAX_PDFS_TO_PROCESS)
    print(f"[INFO] Selected items (date-diverse, max={MAX_PDFS_TO_PROCESS}): {len(selected_items)}")

    seen_urls: Set[str] = set()
    seen_hashes: Set[str] = set()
    processed = 0
    failed = 0
    index_rows: List[dict] = []

    for item in selected_items:
        if item.pdf_url in seen_urls:
            continue
        seen_urls.add(item.pdf_url)

        data = polite_get_bytes(session, item.pdf_url)
        if data is None:
            failed += 1
            continue
        local_pdf = save_pdf(data, item, seen_hashes)
        if local_pdf is None:
            continue

        try:
            raw_text = extract_pdf_text(local_pdf)
        except Exception as exc:
            print(f"[WARN] PDF parse failed: {local_pdf.name} | {exc}")
            failed += 1
            continue

        txt_name = sanitize_filename(local_pdf.stem) + ".txt"
        local_txt = EXTRACTED_TEXT_DIR / txt_name
        local_txt.write_text(raw_text, encoding="utf-8")

        processed += 1
        report_date = guess_report_date(item.title, raw_text)
        index_rows.append(
            {
                "item_id": item.item_id,
                "title": item.title,
                "category": item.category_name,
                "created_at": item.created_at,
                "report_date_guess": report_date,
                "source_url": item.source_url,
                "pdf_url": item.pdf_url,
                "local_pdf_path": str(local_pdf),
                "local_text_path": str(local_txt),
            }
        )
        print(f"[INFO] Saved: {local_pdf.name}")

    INDEX_JSON_PATH.write_text(json.dumps(index_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n[SUMMARY]")
    print(f"listing pages scanned: {listing_pages_scanned}")
    print(f"trading floor items discovered: {len(all_items)}")
    print(f"selected for processing (max cap): {len(selected_items)}")
    print(f"PDFs downloaded and extracted: {processed}")
    print(f"failed: {failed}")
    print(f"index saved: {INDEX_JSON_PATH}")


if __name__ == "__main__":
    main()
