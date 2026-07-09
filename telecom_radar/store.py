from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Iterable

from .models import RadarItem, utcnow


SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    published_at TEXT,
    authors_json TEXT,
    tags_json TEXT,
    score INTEGER DEFAULT 0,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    notified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_notified ON items(notified_at);
CREATE INDEX IF NOT EXISTS idx_items_score ON items(score DESC);
"""


class Store:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path))
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def upsert_items(self, items: Iterable[RadarItem]) -> list[RadarItem]:
        """插入或更新，返回第一次出现的新 item。"""
        new_items: list[RadarItem] = []
        now = utcnow().isoformat()
        for item in items:
            row = self.conn.execute("SELECT id FROM items WHERE id=?", (item.stable_id,)).fetchone()
            if row is None:
                new_items.append(item)
                self.conn.execute(
                    """
                    INSERT INTO items
                    (id, source, title, url, summary, published_at, authors_json, tags_json, score, first_seen_at, last_seen_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.stable_id,
                        item.source,
                        item.title,
                        item.url,
                        item.summary,
                        item.published_at.isoformat() if item.published_at else None,
                        json.dumps(item.authors, ensure_ascii=False),
                        json.dumps(item.tags, ensure_ascii=False),
                        item.score,
                        now,
                        now,
                    ),
                )
            else:
                self.conn.execute(
                    """
                    UPDATE items SET summary=?, tags_json=?, score=?, last_seen_at=? WHERE id=?
                    """,
                    (
                        item.summary,
                        json.dumps(item.tags, ensure_ascii=False),
                        item.score,
                        now,
                        item.stable_id,
                    ),
                )
        self.conn.commit()
        return new_items

    def mark_notified(self, items: Iterable[RadarItem]) -> None:
        now = utcnow().isoformat()
        with self.conn:
            for item in items:
                self.conn.execute("UPDATE items SET notified_at=? WHERE id=?", (now, item.stable_id))

    def recent_unnotified(self, limit: int = 20, min_score: int = 1) -> list[dict]:
        rows = self.conn.execute(
            """
            SELECT id, source, title, url, summary, published_at, authors_json, tags_json, score
            FROM items
            WHERE notified_at IS NULL AND score >= ?
            ORDER BY score DESC, first_seen_at DESC
            LIMIT ?
            """,
            (min_score, limit),
        ).fetchall()
        return [
            {
                "id": r[0],
                "source": r[1],
                "title": r[2],
                "url": r[3],
                "summary": r[4],
                "published_at": r[5],
                "authors": json.loads(r[6] or "[]"),
                "tags": json.loads(r[7] or "[]"),
                "score": r[8],
            }
            for r in rows
        ]

    def close(self) -> None:
        self.conn.close()
