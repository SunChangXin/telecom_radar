from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from .models import RadarItem


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _contains(text: str, keyword: str) -> bool:
    if re.fullmatch(r"[a-z0-9+-]+", keyword):
        return re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", text) is not None
    return keyword in text


def score_item(item: RadarItem, keywords: list[str], negative_keywords: list[str]) -> RadarItem:
    text = _norm(" ".join([item.title, item.summary, " ".join(item.tags)]))
    score = 0
    matched: list[str] = []

    for kw in keywords:
        k = _norm(kw)
        if not k:
            continue
        if _contains(text, k):
            # 标题里命中更重要
            score += 3 if _contains(_norm(item.title), k) else 1
            matched.append(kw)

    for nkw in negative_keywords:
        if _contains(text, _norm(nkw)):
            score -= 5

    if item.source.lower() in {"3gpp", "3gpp news", "3gpp specs"}:
        score += 3
    elif item.source.lower().startswith("arxiv"):
        score += 2
    elif item.source.lower().startswith("github"):
        score += 1

    if item.published_at:
        age_days = (datetime.now(timezone.utc) - item.published_at.astimezone(timezone.utc)).days
        if age_days <= 2:
            score += 3
        elif age_days <= 7:
            score += 2
        elif age_days <= 30:
            score += 1

    # 多关键词命中说明更相关
    c = Counter(matched)
    item.score = score + min(len(c), 5)
    item.tags = sorted(set(item.tags + matched))[:20]
    return item
