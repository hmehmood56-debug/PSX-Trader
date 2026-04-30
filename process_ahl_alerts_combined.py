#!/usr/bin/env python3
"""
Install:
  pip install requests pymupdf
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import quote

import fitz  # pymupdf
import requests


BASE_URL = "https://www.arifhabibltd.com"
CATEGORIES_URL = f"{BASE_URL}/api/research/categories/list/res"
LIST_URL_BASE = f"{BASE_URL}/api/research/list/res"
OPEN_URL_BASE = f"{BASE_URL}/api/research/open?path="

MAX_PAGES = 60
MAX_REPORTS_TO_PROCESS = 200
REQUEST_DELAY_SECONDS = 0  # User requested no delay.
STRICT_TITLE_MODE = True  # If True, require strong title tags such as "Result Review" or "AHL Alert".
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Last 4 years rolling window.
NOW_UTC = datetime.now(timezone.utc)
DATE_FROM = (NOW_UTC - timedelta(days=365 * 4)).date().isoformat()
DATE_TO = NOW_UTC.date().isoformat()

OUTPUT_PATH = Path("trading_floor_data/ahl_alerts_result_reviews_combined_200.txt")

INCLUDE_KEYWORDS_RE = re.compile(
    r"\b(result review|earnings review|financial result|ahl alert|eps|dps|"
    r"[1-4]q|1h|9m|fy|cy|result)\b",
    re.IGNORECASE,
)
EXCLUDE_KEYWORDS_RE = re.compile(
    r"\b(earnings preview|market wrap|strategy|weekly|daily market|technical|"
    r"valuation|top pick|recommended|recommendation|sector note)\b",
    re.IGNORECASE,
)
STRICT_TITLE_INCLUDE_RE = re.compile(
    r"\b(result review|earnings review|ahl alert)\b",
    re.IGNORECASE,
)


@dataclass
class ListingItem:
    item_id: str
    title: str
    description: str
    file_path: str
    created_at: str
    source_url: str
    pdf_url: str
    tickers: List[str]
    sectors: List[str]


def parse_iso_dt(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def in_last_4_years(created_at: str) -> bool:
    dt = parse_iso_dt(created_at)
    if dt is None:
        return False
    start = datetime.fromisoformat(f"{DATE_FROM}T00:00:00+00:00")
    end = datetime.fromisoformat(f"{DATE_TO}T23:59:59+00:00")
    return start <= dt <= end


def is_result_review_style(title: str, desc: str) -> bool:
    blob = f"{title}\n{desc}"
    if EXCLUDE_KEYWORDS_RE.search(blob):
        return False
    if STRICT_TITLE_MODE and not STRICT_TITLE_INCLUDE_RE.search(title or ""):
        return False
    return bool(INCLUDE_KEYWORDS_RE.search(blob))


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def maybe_sleep() -> None:
    if REQUEST_DELAY_SECONDS > 0:
        time.sleep(REQUEST_DELAY_SECONDS)


def polite_get_json(s: requests.Session, url: str) -> Optional[dict]:
    try:
        r = s.get(url, timeout=40)
    except requests.RequestException as exc:
        print(f"[WARN] Request failed: {url} | {exc}")
        maybe_sleep()
        return None
    maybe_sleep()
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
        maybe_sleep()
        return None
    maybe_sleep()
    if r.status_code != 200:
        print(f"[WARN] PDF non-200 ({r.status_code}): {url}")
        return None
    return r.content


def get_research_category_ids(s: requests.Session) -> List[str]:
    print(f"[INFO] Scanning listing page: {CATEGORIES_URL}")
    payload = polite_get_json(s, CATEGORIES_URL)
    if not payload:
        return []
    out = []
    for c in payload.get("data", []):
        cid = str(c.get("id", "")).strip()
        if cid:
            out.append(cid)
    return out


def fetch_candidate_items(s: requests.Session, category_ids: List[str]) -> Tuple[List[ListingItem], int]:
    items: List[ListingItem] = []
    pages_scanned = 0
    seen_ids: Set[str] = set()

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
                item_id = str(row.get("id", "")).strip()
                if not item_id or item_id in seen_ids:
                    continue
                seen_ids.add(item_id)

                title = str(row.get("tt", "")).strip()
                desc = str(row.get("dsc", "")).strip()
                file_path = str(row.get("file", "")).strip()
                created_at = str(row.get("crt", "")).strip()
                if not file_path:
                    continue
                if not in_last_4_years(created_at):
                    continue
                if not is_result_review_style(title, desc):
                    continue

                sy = row.get("sy") or []
                if not isinstance(sy, list):
                    sy = []
                tickers = [str(x).strip().upper() for x in sy if str(x).strip()]

                sc = row.get("sc") or []
                if not isinstance(sc, list):
                    sc = []
                sectors = [str(x).strip() for x in sc if str(x).strip()]

                items.append(
                    ListingItem(
                        item_id=item_id,
                        title=title,
                        description=desc,
                        file_path=file_path,
                        created_at=created_at,
                        source_url=url,
                        pdf_url=f"{OPEN_URL_BASE}{quote(file_path, safe='/')}",
                        tickers=tickers,
                        sectors=sectors,
                    )
                )

            if not payload.get("next"):
                break

    return items, pages_scanned


def month_bucket(created_at: str) -> str:
    dt = parse_iso_dt(created_at)
    return dt.strftime("%Y-%m") if dt else "unknown"


def diversity_score(item: ListingItem, ticker_seen: Dict[str, int], sector_seen: Dict[str, int], month_seen: Dict[str, int]) -> float:
    tickers = item.tickers or ["NO_TICKER"]
    sectors = item.sectors or ["NO_SECTOR"]
    month = month_bucket(item.created_at)

    ticker_component = sum(1.0 / (1 + ticker_seen.get(t, 0)) for t in tickers) / len(tickers)
    sector_component = sum(1.0 / (1 + sector_seen.get(s, 0)) for s in sectors) / len(sectors)
    month_component = 1.0 / (1 + month_seen.get(month, 0))

    # Weight ticker and date slightly higher than sector.
    return (0.45 * ticker_component) + (0.25 * sector_component) + (0.30 * month_component)


def select_diverse(items: List[ListingItem], limit: int) -> List[ListingItem]:
    pool = sorted(items, key=lambda x: x.created_at or "", reverse=True)
    selected: List[ListingItem] = []
    ticker_seen: Dict[str, int] = {}
    sector_seen: Dict[str, int] = {}
    month_seen: Dict[str, int] = {}

    while pool and len(selected) < limit:
        best_idx = 0
        best_score = -1.0
        # Look at a front window to keep some recency while improving diversity.
        window = min(len(pool), 300)
        for i in range(window):
            score = diversity_score(pool[i], ticker_seen, sector_seen, month_seen)
            if score > best_score:
                best_score = score
                best_idx = i

        chosen = pool.pop(best_idx)
        selected.append(chosen)

        for t in (chosen.tickers or ["NO_TICKER"]):
            ticker_seen[t] = ticker_seen.get(t, 0) + 1
        for s in (chosen.sectors or ["NO_SECTOR"]):
            sector_seen[s] = sector_seen.get(s, 0) + 1
        mb = month_bucket(chosen.created_at)
        month_seen[mb] = month_seen.get(mb, 0) + 1

    return selected


def extract_text_from_pdf_bytes(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for i, page in enumerate(doc, start=1):
        pages.append(f"--- Page {i} ---\n{page.get_text('text')}")
    doc.close()
    return "\n".join(pages).strip()


def compact_text(s: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    s = session()

    print("[INFO] Starting AHL Alerts result-review combined processing...")
    print(f"[INFO] Date filter window: {DATE_FROM} to {DATE_TO}")
    print(f"[INFO] STRICT_TITLE_MODE: {STRICT_TITLE_MODE}")
    cids = get_research_category_ids(s)
    if not cids:
        print("[ERR] No research categories found.")
        return

    candidates, pages_scanned = fetch_candidate_items(s, cids)
    print(f"[INFO] Candidate items after filter: {len(candidates)}")
    selected = select_diverse(candidates, MAX_REPORTS_TO_PROCESS)
    print(f"[INFO] Selected for processing (max={MAX_REPORTS_TO_PROCESS}): {len(selected)}")

    processed = 0
    failed = 0

    with OUTPUT_PATH.open("w", encoding="utf-8") as out:
        out.write("AHL Alert Result/Earnings Reviews Combined Text\n")
        out.write(f"Generated at: {datetime.now(timezone.utc).isoformat()}\n")
        out.write(f"Date window (last 4 years): {DATE_FROM} to {DATE_TO}\n")
        out.write(f"Max reports requested: {MAX_REPORTS_TO_PROCESS}\n")
        out.write(f"Listing pages scanned: {pages_scanned}\n")
        out.write("=" * 90 + "\n\n")

        for i, item in enumerate(selected, start=1):
            pdf_data = polite_get_pdf_bytes(s, item.pdf_url)
            if pdf_data is None:
                failed += 1
                continue
            try:
                raw = extract_text_from_pdf_bytes(pdf_data)
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
            out.write(f"Tickers: {', '.join(item.tickers) if item.tickers else 'Not stated'}\n")
            out.write(f"Sectors: {', '.join(item.sectors) if item.sectors else 'Not stated'}\n")
            out.write(f"Item ID: {item.item_id or 'Not stated'}\n")
            out.write(f"Source URL: {item.source_url}\n")
            out.write(f"PDF URL: {item.pdf_url}\n")
            out.write("\n")
            out.write(text)
            out.write("\n\n" + "-" * 90 + "\n\n")

            processed += 1
            print(f"[INFO] Processed {processed}/{len(selected)}: {item.title}")

    print("\n[SUMMARY]")
    print(f"listing pages scanned: {pages_scanned}")
    print(f"candidates after result-review filter: {len(candidates)}")
    print(f"selected for diversity processing: {len(selected)}")
    print(f"processed into combined txt: {processed}")
    print(f"failed: {failed}")
    print(f"combined output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
