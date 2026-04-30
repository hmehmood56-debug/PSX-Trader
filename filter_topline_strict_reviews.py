#!/usr/bin/env python3
"""
Strict filter for Topline review titles.

Accept only:
- Market Review
- Results Review
- Earnings Review
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Tuple


ALLOWED_TITLES = {
    "market review",
    "results review",
    "earnings review",
}


@dataclass
class FilterResult:
    accepted: bool
    matched_title: str
    reason: str


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip().lower()


def strict_title_filter(text: str) -> FilterResult:
    n = normalize(text)
    for title in ALLOWED_TITLES:
        if re.search(rf"\b{re.escape(title)}\b", n, flags=re.IGNORECASE):
            return FilterResult(True, title.title(), "Accepted: strict title match")
    return FilterResult(False, "", "Rejected: title is not one of allowed strict labels")


def run_two_tests() -> Tuple[FilterResult, FilterResult]:
    test_1 = strict_title_filter("Topline Securities - Market Review - Apr 30, 2026")
    test_2 = strict_title_filter("Topline Securities - Strategy Update")
    return test_1, test_2


if __name__ == "__main__":
    a, b = run_two_tests()
    print("TEST 1:", a)
    print("TEST 2:", b)
