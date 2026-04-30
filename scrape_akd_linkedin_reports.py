#!/usr/bin/env python3
"""
Scrape AKD Securities Result/Earnings Review reports via LinkedIn post links.

This script supports two discovery paths:
1) Crawl AKD LinkedIn company posts page and collect post URLs (best effort).
2) Read explicit LinkedIn post URLs from a seed text file (one URL per line).

From each post page, it extracts outbound links and keeps PDF-style links.
Then it downloads each PDF and accepts only reports that match:
  - broker: AKD Securities
  - report type: Result Review (strict)

Install:
  pip install requests beautifulsoup4 pymupdf
"""

from __future__ import annotations

import argparse
import csv
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import fitz  # pymupdf
import requests
from bs4 import BeautifulSoup


DEFAULT_LINKEDIN_COMPANY_POSTS_URL = "https://www.linkedin.com/company/akd-securities-limited/posts/"
DEFAULT_MAX_POSTS = 300
DEFAULT_MAX_PDFS = 300
REQUEST_DELAY_SECONDS = 1.2
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

OUTPUT_DIR = Path("akd_reports")
OUTPUT_TXT = OUTPUT_DIR / "akd_result_earning_reviews_combined.txt"
OUTPUT_ACCEPTED_CSV = OUTPUT_DIR / "akd_result_earning_reviews_accepted.csv"
OUTPUT_REJECTED_CSV = OUTPUT_DIR / "akd_result_earning_reviews_rejected.csv"
OUTPUT_DISCOVERED_LINKS = OUTPUT_DIR / "akd_linkedin_discovered_links.csv"

LINK_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
PDFISH_RE = re.compile(r"\.pdf(?:$|[?#])", re.IGNORECASE)
AKD_BROKER_RE = re.compile(r"\b(akd securities|akd research|akdsl)\b", re.IGNORECASE)
RESULT_REVIEW_RE = re.compile(r"\bresult review\b", re.IGNORECASE)
TICKER_RE = re.compile(r"\b[A-Z]{3,6}\b")


@dataclass
class AcceptedReport:
    pdf_url: str
    source_post_url: str
    broker: str
    report_type: str
    ticker_guess: str
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
        r = s.get(url, timeout=50)
    except requests.RequestException:
        maybe_sleep()
        return None
    maybe_sleep()
    if r.status_code != 200:
        return None
    return r.text


def get_pdf_bytes(s: requests.Session, url: str) -> Optional[bytes]:
    try:
        r = s.get(url, timeout=70)
    except requests.RequestException:
        maybe_sleep()
        return None
    maybe_sleep()
    if r.status_code != 200:
        return None
    content_type = (r.headers.get("Content-Type") or "").lower()
    if "pdf" not in content_type and not PDFISH_RE.search(url):
        return None
    return r.content


def normalize_url(url: str) -> str:
    return re.sub(r"[)\],.]+$", "", (url or "").strip())


def try_extract_redirect_target(url: str) -> Optional[str]:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    for key in ("url", "redirect", "target"):
        if key in qs and qs[key]:
            return normalize_url(unquote(qs[key][0]))
    return None


def is_probably_pdf_url(url: str) -> bool:
    if not url:
        return False
    low = url.lower()
    return bool(PDFISH_RE.search(low)) or "research" in low or "report" in low


def extract_links_from_html(base_url: str, html: str) -> Set[str]:
    out: Set[str] = set()
    soup = BeautifulSoup(html, "html.parser")

    for a in soup.find_all("a", href=True):
        href = normalize_url(urljoin(base_url, a["href"]))
        if href.startswith("http"):
            out.add(href)
            redirect_target = try_extract_redirect_target(href)
            if redirect_target and redirect_target.startswith("http"):
                out.add(redirect_target)

    for m in LINK_RE.finditer(html):
        raw = normalize_url(m.group(0))
        if not raw.startswith("http"):
            continue
        out.add(raw)
        redirect_target = try_extract_redirect_target(raw)
        if redirect_target and redirect_target.startswith("http"):
            out.add(redirect_target)

    return out


def discover_post_urls_from_company_page(s: requests.Session, company_posts_url: str, max_posts: int) -> Set[str]:
    html = get_text(s, company_posts_url)
    if not html:
        return set()
    links = extract_links_from_html(company_posts_url, html)
    posts = {
        link
        for link in links
        if "linkedin.com" in urlparse(link).netloc.lower() and "/posts/" in link
    }
    return set(sorted(posts)[:max_posts])


def read_seed_post_urls(seed_path: Optional[Path]) -> Set[str]:
    if seed_path is None or not seed_path.exists():
        return set()
    lines = seed_path.read_text(encoding="utf-8").splitlines()
    out = set()
    for ln in lines:
        ln = normalize_url(ln)
        if ln.startswith("http") and "linkedin.com" in urlparse(ln).netloc.lower():
            out.add(ln)
    return out


def discover_pdf_candidates_from_posts(
    s: requests.Session, post_urls: Set[str], max_pdfs: int
) -> Tuple[List[Tuple[str, str]], List[Dict[str, str]]]:
    candidates: List[Tuple[str, str]] = []
    traces: List[Dict[str, str]] = []
    seen_pdf: Set[str] = set()

    for post_url in sorted(post_urls):
        html = get_text(s, post_url)
        if not html:
            traces.append({"source_post_url": post_url, "candidate_url": "", "status": "post_fetch_failed"})
            continue
        links = extract_links_from_html(post_url, html)
        for link in links:
            if not is_probably_pdf_url(link):
                continue
            if link in seen_pdf:
                continue
            seen_pdf.add(link)
            candidates.append((link, post_url))
            traces.append({"source_post_url": post_url, "candidate_url": link, "status": "candidate"})
            if len(candidates) >= max_pdfs:
                return candidates, traces

    return candidates, traces


def extract_pdf_text(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    pages: List[str] = []
    for i, p in enumerate(doc, start=1):
        pages.append(f"--- Page {i} ---\n{p.get_text('text')}")
    doc.close()
    return "\n".join(pages).strip()


def detect_report_type(text: str) -> Optional[str]:
    if RESULT_REVIEW_RE.search(text):
        return "Result Review"
    return None


def guess_ticker(text: str) -> str:
    tokens = TICKER_RE.findall(text.upper())
    deny = {"AKD", "PSX", "FY", "EPS", "DPS", "PAT", "PBT"}
    for t in tokens:
        if t in deny:
            continue
        if len(t) <= 5:
            return t
    return "Not stated"


def guess_title_from_url(url: str) -> str:
    base = Path(urlparse(url).path).name
    base = re.sub(r"\.pdf$", "", base, flags=re.IGNORECASE)
    return re.sub(r"[_\-]+", " ", base).strip() or "Not stated"


def compact_text(s: str) -> str:
    s = re.sub(r"[ \t]+", " ", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def run(
    company_posts_url: str,
    seed_file: Optional[Path],
    max_posts: int,
    max_pdfs: int,
    max_reports: int,
) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    s = session()

    discovered_posts = discover_post_urls_from_company_page(s, company_posts_url, max_posts=max_posts)
    seeded_posts = read_seed_post_urls(seed_file)
    all_posts = discovered_posts | seeded_posts

    print(f"[INFO] discovered posts from company page: {len(discovered_posts)}")
    print(f"[INFO] seeded posts from file: {len(seeded_posts)}")
    print(f"[INFO] total post URLs to scan: {len(all_posts)}")

    pdf_candidates, traces = discover_pdf_candidates_from_posts(s, all_posts, max_pdfs=max_pdfs)
    print(f"[INFO] candidate links discovered from posts: {len(pdf_candidates)}")

    accepted: List[AcceptedReport] = []
    rejected: List[Dict[str, str]] = []

    for idx, (pdf_url, source_post_url) in enumerate(pdf_candidates, start=1):
        if len(accepted) >= max_reports:
            break

        data = get_pdf_bytes(s, pdf_url)
        if not data:
            rejected.append(
                {"pdf_url": pdf_url, "source_post_url": source_post_url, "reason": "download_failed_or_not_pdf"}
            )
            continue
        try:
            text = extract_pdf_text(data)
        except Exception:
            rejected.append({"pdf_url": pdf_url, "source_post_url": source_post_url, "reason": "pdf_parse_failed"})
            continue

        if not AKD_BROKER_RE.search(text):
            rejected.append({"pdf_url": pdf_url, "source_post_url": source_post_url, "reason": "broker_not_akd"})
            continue

        report_type = detect_report_type(text)
        if report_type is None:
            rejected.append(
                {"pdf_url": pdf_url, "source_post_url": source_post_url, "reason": "report_type_not_allowed"}
            )
            continue

        text_compact = compact_text(text)
        accepted.append(
            AcceptedReport(
                pdf_url=pdf_url,
                source_post_url=source_post_url,
                broker="AKD",
                report_type=report_type,
                ticker_guess=guess_ticker(text_compact),
                title_guess=guess_title_from_url(pdf_url),
                text=text_compact,
            )
        )
        print(f"[INFO] Accepted {len(accepted)}/{max_reports} from scanned {idx}")

    with OUTPUT_TXT.open("w", encoding="utf-8") as out:
        out.write("AKD Securities Result/Earnings Reviews Combined\n")
        out.write(f"Generated at: {datetime.utcnow().isoformat()}Z\n")
        out.write(f"Company posts URL: {company_posts_url}\n")
        out.write(f"Discovered posts: {len(discovered_posts)} | Seeded posts: {len(seeded_posts)}\n")
        out.write(f"Candidate links: {len(pdf_candidates)}\n")
        out.write(f"Accepted: {len(accepted)} | Rejected: {len(rejected)}\n")
        out.write("=" * 90 + "\n\n")
        for i, a in enumerate(accepted, start=1):
            out.write(f"## REPORT {i}\n")
            out.write(f"Broker: {a.broker}\n")
            out.write(f"Report Type: {a.report_type}\n")
            out.write(f"Ticker Guess: {a.ticker_guess}\n")
            out.write(f"Title Guess: {a.title_guess}\n")
            out.write(f"Source Post URL: {a.source_post_url}\n")
            out.write(f"PDF URL: {a.pdf_url}\n\n")
            out.write(a.text)
            out.write("\n\n" + "-" * 90 + "\n\n")

    with OUTPUT_ACCEPTED_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=[
                "pdf_url",
                "source_post_url",
                "broker",
                "report_type",
                "ticker_guess",
                "title_guess",
            ],
        )
        w.writeheader()
        for a in accepted:
            w.writerow(
                {
                    "pdf_url": a.pdf_url,
                    "source_post_url": a.source_post_url,
                    "broker": a.broker,
                    "report_type": a.report_type,
                    "ticker_guess": a.ticker_guess,
                    "title_guess": a.title_guess,
                }
            )

    with OUTPUT_REJECTED_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["pdf_url", "source_post_url", "reason"])
        w.writeheader()
        for r in rejected:
            w.writerow(r)

    with OUTPUT_DISCOVERED_LINKS.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["source_post_url", "candidate_url", "status"])
        w.writeheader()
        for t in traces:
            w.writerow(t)

    print("\n[SUMMARY]")
    print(f"posts scanned: {len(all_posts)}")
    print(f"candidate links discovered: {len(pdf_candidates)}")
    print(f"accepted: {len(accepted)}")
    print(f"rejected: {len(rejected)}")
    print(f"combined txt: {OUTPUT_TXT}")
    print(f"accepted csv: {OUTPUT_ACCEPTED_CSV}")
    print(f"rejected csv: {OUTPUT_REJECTED_CSV}")
    print(f"discovered links csv: {OUTPUT_DISCOVERED_LINKS}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--company-posts-url", default=DEFAULT_LINKEDIN_COMPANY_POSTS_URL)
    p.add_argument(
        "--seed-posts-file",
        type=Path,
        default=None,
        help="Optional text file with LinkedIn post URLs (one per line).",
    )
    p.add_argument("--max-posts", type=int, default=DEFAULT_MAX_POSTS)
    p.add_argument("--max-pdfs", type=int, default=DEFAULT_MAX_PDFS)
    p.add_argument("--max-reports", type=int, default=100)
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(
        company_posts_url=args.company_posts_url,
        seed_file=args.seed_posts_file,
        max_posts=args.max_posts,
        max_pdfs=args.max_pdfs,
        max_reports=args.max_reports,
    )
