from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


UNCLASSIFIED = "未分类"


def load_domain_rules(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("领域配置必须是数组")
    return [rule for rule in data if rule.get("name") and rule.get("keywords")]


def _contains(text: str, keyword: str) -> bool:
    keyword = keyword.strip().lower()
    if not keyword:
        return False
    if re.fullmatch(r"[a-z0-9+-]+", keyword):
        return re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", text) is not None
    return keyword in text


def classify_item(item: dict[str, Any], rules: list[dict[str, Any]]) -> tuple[str, list[str]]:
    title = (item.get("title") or "").lower()
    summary = (item.get("summary") or "").lower()
    tags = " ".join(item.get("tags") or []).lower()
    source = (item.get("source") or "").lower()
    scored: list[tuple[int, int, str]] = []

    for order, rule in enumerate(rules):
        score = 0
        for keyword in rule["keywords"]:
            if _contains(title, keyword):
                score += 5
            if _contains(tags, keyword):
                score += 3
            if _contains(summary, keyword):
                score += 1
            if rule["name"] == "标准与产业演进" and _contains(source, keyword):
                score += 4
        if rule["name"] == "开源实现与测试" and source == "github":
            score += 2
        if score:
            scored.append((score, -order, rule["name"]))

    if not scored:
        return UNCLASSIFIED, [UNCLASSIFIED]
    scored.sort(reverse=True)
    domains = [name for score, _, name in scored if score >= 2]
    return scored[0][2], domains or [scored[0][2]]
