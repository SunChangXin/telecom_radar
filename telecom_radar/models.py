from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import hashlib


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class RadarItem:
    source: str
    title: str
    url: str
    summary: str = ""
    published_at: datetime | None = None
    authors: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)
    score: int = 0

    @property
    def stable_id(self) -> str:
        key = self.url.strip().lower() or f"{self.source}:{self.title}".lower()
        return hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.stable_id,
            "source": self.source,
            "title": self.title,
            "url": self.url,
            "summary": self.summary,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "authors": self.authors,
            "tags": self.tags,
            "score": self.score,
        }
