from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse
import re
import time

import feedparser
import requests
from bs4 import BeautifulSoup

from .models import RadarItem


UA = "telecom-radar/0.1 (+personal research alert tool)"


def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            dt = parsedate_to_datetime(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            try:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                return None
    return None


def strip_html(text: str) -> str:
    return BeautifulSoup(text or "", "html.parser").get_text(" ", strip=True)


class ArxivSource:
    endpoint = "https://export.arxiv.org/api/query"

    def __init__(self, max_results_per_query: int = 20, days_back: int = 10) -> None:
        self.max_results = max_results_per_query
        self.days_back = days_back

    def fetch(self, queries: list[str]) -> list[RadarItem]:
        out: list[RadarItem] = []
        since = datetime.now(timezone.utc) - timedelta(days=self.days_back)
        for q in queries:
            params = {
                "search_query": q,
                "start": 0,
                "max_results": self.max_results,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
            }
            url = f"{self.endpoint}?{urlencode(params)}"
            resp = requests.get(url, headers={"User-Agent": UA}, timeout=30)
            resp.raise_for_status()
            feed = feedparser.parse(resp.text)
            for e in feed.entries:
                published = parse_dt(getattr(e, "published", None))
                if published and published < since:
                    continue
                authors = [a.get("name", "") for a in getattr(e, "authors", []) if a.get("name")]
                tags = [t.get("term", "") for t in getattr(e, "tags", []) if t.get("term")]
                pdf = ""
                for link in getattr(e, "links", []):
                    if link.get("title") == "pdf" or link.get("type") == "application/pdf":
                        pdf = link.get("href", "")
                out.append(
                    RadarItem(
                        source="arXiv",
                        title=strip_html(getattr(e, "title", "")),
                        url=getattr(e, "link", "") or pdf,
                        summary=strip_html(getattr(e, "summary", "")),
                        published_at=published,
                        authors=authors,
                        tags=tags,
                        raw={"query": q, "pdf": pdf},
                    )
                )
            time.sleep(3)  # 对 arXiv 友好，避免频繁请求。
        return out


class GitHubSource:
    endpoint = "https://api.github.com/search/repositories"

    def __init__(self, token: str = "", max_results_per_query: int = 10, days_back: int = 30) -> None:
        self.token = token
        self.max_results = max_results_per_query
        self.days_back = days_back

    def fetch(self, queries: list[str]) -> list[RadarItem]:
        out: list[RadarItem] = []
        since = (datetime.now(timezone.utc) - timedelta(days=self.days_back)).date().isoformat()
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": UA,
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        for q in queries:
            full_q = f"{q} pushed:>={since}"
            params = {"q": full_q, "sort": "updated", "order": "desc", "per_page": self.max_results}
            resp = requests.get(self.endpoint, params=params, headers=headers, timeout=30)
            if resp.status_code == 403:
                raise RuntimeError("GitHub API 频率限制或权限不足。建议配置 GITHUB_TOKEN。")
            resp.raise_for_status()
            for r in resp.json().get("items", []):
                pushed = parse_dt(r.get("pushed_at")) or parse_dt(r.get("updated_at"))
                topics = r.get("topics") or []
                out.append(
                    RadarItem(
                        source="GitHub",
                        title=r.get("full_name") or r.get("name") or "",
                        url=r.get("html_url") or "",
                        summary=r.get("description") or "",
                        published_at=pushed,
                        authors=[r.get("owner", {}).get("login", "")],
                        tags=topics,
                        raw={
                            "stars": r.get("stargazers_count"),
                            "forks": r.get("forks_count"),
                            "language": r.get("language"),
                            "query": q,
                        },
                    )
                )
            time.sleep(1)
        return out


class RssOrHtmlSource:
    def fetch_feed(self, name: str, url: str) -> list[RadarItem]:
        parsed = feedparser.parse(url)
        out: list[RadarItem] = []
        for e in parsed.entries[:30]:
            out.append(
                RadarItem(
                    source=name,
                    title=strip_html(getattr(e, "title", "")),
                    url=getattr(e, "link", ""),
                    summary=strip_html(getattr(e, "summary", "")),
                    published_at=parse_dt(getattr(e, "published", None) or getattr(e, "updated", None)),
                    authors=[],
                    tags=[],
                    raw={"feed": url},
                )
            )
        return out

    def fetch_html_list(
        self,
        name: str,
        url: str,
        include_keywords: list[str] | None = None,
        exclude_keywords: list[str] | None = None,
        selectors: list[str] | None = None,
        path_keywords: list[str] | None = None,
    ) -> list[RadarItem]:
        resp = requests.get(url, headers={"User-Agent": UA}, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        out: list[RadarItem] = []
        seen: set[str] = set()

        include = [value.lower() for value in (include_keywords or [])]
        exclude = [value.lower() for value in (exclude_keywords or [])]
        anchors = []
        if selectors:
            for selector in selectors:
                anchors.extend(soup.select(selector))
        else:
            anchors = soup.find_all("a", href=True)

        for a in anchors:
            if not a.get("href"):
                continue
            title = a.get_text(" ", strip=True)
            href = a["href"]
            if not title or len(title) < 5:
                continue
            if href.startswith("#") or href.startswith("mailto:"):
                continue
            full_url = urljoin(url, href)
            norm = re.sub(r"\s+", " ", title).strip()
            parent_text = a.parent.get_text(" ", strip=True) if a.parent else ""
            path_text = urlparse(full_url).path.replace("-", " ").replace("_", " ")
            searchable = f"{norm} {path_text}".lower()
            if path_keywords and not any(keyword.lower() in full_url.lower() for keyword in path_keywords):
                continue
            if include and not any(keyword in searchable for keyword in include):
                continue
            if exclude and any(keyword in searchable for keyword in exclude):
                continue
            key = full_url.lower()
            if key in seen:
                continue
            seen.add(key)
            summary = parent_text if len(parent_text) > len(norm) else ""
            out.append(
                RadarItem(
                    source=name,
                    title=norm,
                    url=full_url,
                    summary=summary[:500],
                    published_at=None,
                    raw={"html_page": url},
                )
            )
            if len(out) >= 40:
                break
        return out

    def fetch(self, feeds: list[dict[str, Any]]) -> list[RadarItem]:
        out: list[RadarItem] = []
        for f in feeds:
            name = f.get("name") or "RSS"
            url = f.get("url")
            if not url:
                continue
            typ = f.get("type", "rss")
            try:
                if typ == "html-list":
                    out.extend(
                        self.fetch_html_list(
                            name,
                            url,
                            include_keywords=f.get("include_keywords"),
                            exclude_keywords=f.get("exclude_keywords"),
                            selectors=f.get("selectors"),
                            path_keywords=f.get("path_keywords"),
                        )
                    )
                else:
                    out.extend(self.fetch_feed(name, url))
            except Exception as exc:
                out.append(RadarItem(source=name, title=f"抓取失败：{url}", url=url, summary=str(exc), score=-99))
        return out
