from __future__ import annotations

import argparse
import json
import os
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template

from .config import Settings
from .content import CONTENT_TYPES, chinese_digest, content_type_for
from .domains import UNCLASSIFIED, classify_item, load_domain_rules


def _decode_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def load_dashboard_data(db_path: Path, limit: int = 300, domain_path: Path | None = None) -> dict[str, Any]:
    resolved_domain_path = domain_path or Path(os.getenv("RADAR_DOMAIN_CONFIG", "./config/domains.json"))
    rules = load_domain_rules(resolved_domain_path)
    if not db_path.exists():
        return {
            "items": [],
            "stats": {"total": 0, "notified": 0, "top_score": 0},
            "sources": [],
            "domains": [{"name": rule["name"], "count": 0} for rule in rules],
            "content_types": [{"name": name, "count": 0} for name in CONTENT_TYPES],
        }

    conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT id, source, title, url, summary, published_at, authors_json,
                   tags_json, score, first_seen_at, last_seen_at, notified_at
            FROM items
            ORDER BY score DESC, COALESCE(published_at, first_seen_at) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    finally:
        conn.close()

    items = []
    for row in rows:
        item = dict(row)
        item["authors"] = _decode_list(item.pop("authors_json"))
        item["tags"] = _decode_list(item.pop("tags_json"))
        item["primary_domain"], item["domains"] = classify_item(item, rules)
        item["content_type"] = content_type_for(item["source"], item["url"])
        item["zh_summary"] = chinese_digest(item)
        items.append(item)

    source_counts = Counter(item["source"] for item in items)
    sources = [{"name": name, "count": count} for name, count in source_counts.most_common()]
    type_counts = Counter(item["content_type"] for item in items)
    content_types = [{"name": name, "count": type_counts.get(name, 0)} for name in CONTENT_TYPES]
    domain_counts = Counter(item["primary_domain"] for item in items)
    domains = [
        {"name": rule["name"], "count": domain_counts.get(rule["name"], 0)}
        for rule in rules
        if domain_counts.get(rule["name"], 0)
    ]
    if domain_counts.get(UNCLASSIFIED, 0):
        domains.append({"name": UNCLASSIFIED, "count": domain_counts[UNCLASSIFIED]})
    stats = {
        "total": len(items),
        "notified": sum(1 for item in items if item["notified_at"]),
        "top_score": max((item["score"] for item in items), default=0),
        "latest": max((item["last_seen_at"] for item in items), default=None),
    }
    return {
        "items": items,
        "stats": stats,
        "sources": sources,
        "domains": domains,
        "content_types": content_types,
    }


def create_app(db_path: Path | None = None, domain_path: Path | None = None) -> Flask:
    app = Flask(__name__)
    resolved_db = db_path or Settings().db_path

    @app.get("/")
    def index() -> str:
        return render_template("index.html", **load_dashboard_data(resolved_db, domain_path=domain_path))

    @app.get("/api/items")
    def api_items():
        return jsonify(load_dashboard_data(resolved_db, domain_path=domain_path))

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "database": str(resolved_db)})

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="通信前沿雷达本地网页")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()
    create_app().run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
