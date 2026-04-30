#!/usr/bin/env python3
"""
X-only Topline review collector (strict labels only).

Install:
  pip install requests

Usage:
  1) Optional: put one X status URL per line in: topline_x_urls.txt
     Example:
       https://x.com/toplinesec/status/1917726623641847939
  2) Run:
       /usr/bin/python3 process_topline_x_reviews.py

Rules:
  - Accept ONLY titles/text containing one of:
      * Market Review
      * Results Review
      * Earnings Review
  - Reject everything else.
"""

from __future__ import annotations

import csv
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests


INPUT_URLS_PATH = Path("topline_x_urls.txt")
OUTPUT_TXT_PATH = Path("trading_floor_data/topline_x_reviews_combined.txt")
OUTPUT_REJECTED_CSV_PATH = Path("trading_floor_data/topline_x_reviews_rejected.csv")
MAX_POSTS_TO_PROCESS = 200
REQUEST_DELAY_SECONDS = 0
TARGET_SCREEN_NAME = "toplinesec"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

STRICT_ALLOWED = {
    "market review": "Market Review",
    "results review": "Results Review",
    "earnings review": "Earnings Review",
}

TWEET_ID_RE = re.compile(r"/status/(\d+)")


@dataclass
class PostRecord:
    url: str
    tweet_id: str
    created_at: str
    author_screen_name: str
    text: str
    matched_label: str


def parse_tweet_id(url: str) -> Optional[str]:
    m = TWEET_ID_RE.search(url)
    return m.group(1) if m else None


def extract_status_urls_from_text(text: str, screen_name: str) -> List[str]:
    ids = set(re.findall(r"/status/(\d+)", text or ""))
    return [f"https://x.com/{screen_name}/status/{tweet_id}" for tweet_id in sorted(ids, reverse=True)]


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def strict_match_label(text: str) -> Optional[str]:
    n = normalize_space(text).lower()
    for key, label in STRICT_ALLOWED.items():
        if re.search(rf"\b{re.escape(key)}\b", n, flags=re.IGNORECASE):
            return label
    return None


def get_json(session: requests.Session, url: str) -> Optional[dict]:
    try:
        r = session.get(url, timeout=30)
    except requests.RequestException:
        return None
    if REQUEST_DELAY_SECONDS > 0:
        import time

        time.sleep(REQUEST_DELAY_SECONDS)
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except ValueError:
        return None


def get_text(session: requests.Session, url: str) -> Optional[str]:
    try:
        r = session.get(url, timeout=30)
    except requests.RequestException:
        return None
    if r.status_code != 200:
        return None
    return r.text


def fetch_tweet_payload(session: requests.Session, tweet_id: str) -> Optional[dict]:
    # Public syndication endpoint, no login required for many tweets.
    api = f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}&lang=en"
    return get_json(session, api)


def extract_text(payload: dict) -> str:
    full_text = payload.get("text") or ""
    return normalize_space(full_text)


def discover_urls_from_nitter_rss(session: requests.Session, screen_name: str) -> List[str]:
    # Try multiple public Nitter instances; any one may work.
    rss_sources = [
        f"https://nitter.net/{screen_name}/rss",
        f"https://nitter.privacydev.net/{screen_name}/rss",
        f"https://nitter.poast.org/{screen_name}/rss",
    ]
    urls: List[str] = []
    for src in rss_sources:
        xml_text = get_text(session, src)
        if not xml_text:
            continue
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            continue
        for link_el in root.findall(".//item/link"):
            link = normalize_space(link_el.text or "")
            tweet_id = parse_tweet_id(link)
            if tweet_id:
                urls.append(f"https://x.com/{screen_name}/status/{tweet_id}")
    return urls


def discover_urls_via_jina_mirror(session: requests.Session, screen_name: str) -> List[str]:
    # Best-effort text mirror that sometimes exposes status links.
    mirror_urls = [
        f"https://r.jina.ai/http://x.com/{screen_name}",
        f"https://r.jina.ai/http://twitter.com/{screen_name}",
    ]
    out: List[str] = []
    for m in mirror_urls:
        txt = get_text(session, m)
        if not txt:
            continue
        out.extend(extract_status_urls_from_text(txt, screen_name))
    return out


def discover_recent_status_urls(session: requests.Session, screen_name: str, cap: int) -> List[str]:
    discovered: List[str] = []
    discovered.extend(discover_urls_from_nitter_rss(session, screen_name))
    discovered.extend(discover_urls_via_jina_mirror(session, screen_name))
    deduped = []
    seen = set()
    for u in discovered:
        if u in seen:
            continue
        seen.add(u)
        deduped.append(u)
        if len(deduped) >= cap:
            break
    return deduped


def run() -> None:
    OUTPUT_TXT_PATH.parent.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # 1) Auto-discover recent posts (best effort).
    auto_urls = discover_recent_status_urls(session, TARGET_SCREEN_NAME, MAX_POSTS_TO_PROCESS)
    print(f"[INFO] Auto-discovered URLs: {len(auto_urls)}")

    # 2) Merge optional manual URL list.
    raw_urls: List[str] = []
    if INPUT_URLS_PATH.exists():
        raw_urls = [normalize_space(x) for x in INPUT_URLS_PATH.read_text(encoding="utf-8").splitlines()]
    manual_urls = [u for u in raw_urls if u and not u.startswith("#")]

    urls = []
    seen = set()
    for u in auto_urls + manual_urls:
        if u in seen:
            continue
        seen.add(u)
        urls.append(u)
        if len(urls) >= MAX_POSTS_TO_PROCESS:
            break

    if not urls:
        print("[ERR] No status URLs found from auto-discovery or input file.")
        return

    accepted: List[PostRecord] = []
    rejected: List[Dict[str, str]] = []

    for idx, url in enumerate(urls, start=1):
        tweet_id = parse_tweet_id(url)
        if not tweet_id:
            rejected.append({"url": url, "reason": "invalid_status_url"})
            continue

        payload = fetch_tweet_payload(session, tweet_id)
        if not payload:
            rejected.append({"url": url, "reason": "tweet_fetch_failed_or_private"})
            continue

        text = extract_text(payload)
        label = strict_match_label(text)
        if not label:
            rejected.append({"url": url, "reason": "strict_label_not_matched"})
            continue

        accepted.append(
            PostRecord(
                url=url,
                tweet_id=tweet_id,
                created_at=str(payload.get("created_at", "Not stated")),
                author_screen_name=str((payload.get("user") or {}).get("screen_name", "Not stated")),
                text=text,
                matched_label=label,
            )
        )
        print(f"[INFO] Accepted {len(accepted)} | {idx}/{len(urls)} | {label}")

    with OUTPUT_TXT_PATH.open("w", encoding="utf-8") as out:
        out.write("Topline X Strict Reviews Combined\n")
        out.write(f"Generated at: {datetime.utcnow().isoformat()}Z\n")
        out.write(f"Input URL count (capped): {len(urls)}\n")
        out.write(f"Accepted: {len(accepted)}\n")
        out.write(f"Rejected: {len(rejected)}\n")
        out.write("=" * 80 + "\n\n")
        for i, rec in enumerate(accepted, start=1):
            out.write(f"## POST {i}\n")
            out.write(f"Label: {rec.matched_label}\n")
            out.write(f"Date: {rec.created_at}\n")
            out.write(f"Author: {rec.author_screen_name}\n")
            out.write(f"URL: {rec.url}\n\n")
            out.write(rec.text + "\n\n")
            out.write("-" * 80 + "\n\n")

    with OUTPUT_REJECTED_CSV_PATH.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["url", "reason"])
        writer.writeheader()
        for row in rejected:
            writer.writerow(row)

    print("\n[SUMMARY]")
    print(f"Input URLs processed (cap={MAX_POSTS_TO_PROCESS}): {len(urls)}")
    print(f"Accepted: {len(accepted)}")
    print(f"Rejected: {len(rejected)}")
    print(f"Combined TXT: {OUTPUT_TXT_PATH}")
    print(f"Rejected CSV: {OUTPUT_REJECTED_CSV_PATH}")


if __name__ == "__main__":
    run()
