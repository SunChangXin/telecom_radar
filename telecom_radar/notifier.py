from __future__ import annotations

import json
from email.header import Header
from typing import Any
from urllib.parse import quote

import requests

from .models import RadarItem


def compact_text(md: str, max_chars: int = 3500) -> str:
    if len(md) <= max_chars:
        return md
    return md[:max_chars] + "\n\n……内容过长，已截断；完整报告请看本地 data/reports 目录。"


class Notifier:
    def __init__(
        self,
        ntfy_server: str = "https://ntfy.sh",
        ntfy_topic: str = "",
        serverchan_url: str = "",
        sct_sendkey: str = "",
        webhook_url: str = "",
    ) -> None:
        self.ntfy_server = ntfy_server.rstrip("/")
        self.ntfy_topic = ntfy_topic.strip()
        self.serverchan_url = serverchan_url.strip()
        self.sct_sendkey = sct_sendkey.strip()
        self.webhook_url = webhook_url.strip()

    def enabled(self) -> bool:
        return bool(self.ntfy_topic or self.serverchan_url or self.sct_sendkey or self.webhook_url)

    def send(self, title: str, markdown: str, items: list[RadarItem]) -> list[str]:
        results: list[str] = []
        if self.ntfy_topic:
            results.append(self._send_ntfy(title, markdown))
        if self.serverchan_url or self.sct_sendkey:
            results.append(self._send_serverchan(title, markdown))
        if self.webhook_url:
            results.append(self._send_webhook(title, markdown, items))
        return results

    def _send_ntfy(self, title: str, markdown: str) -> str:
        url = f"{self.ntfy_server}/{quote(self.ntfy_topic)}"
        resp = requests.post(
            url,
            data=compact_text(markdown).encode("utf-8"),
            headers={"Title": Header(title, "utf-8").encode(), "Priority": "default", "Tags": "satellite,radio"},
            timeout=20,
        )
        resp.raise_for_status()
        return "ntfy: ok"

    def _serverchan_endpoint(self) -> str:
        if self.serverchan_url:
            return self.serverchan_url
        return f"https://sctapi.ftqq.com/{self.sct_sendkey}.send"

    def _send_serverchan(self, title: str, markdown: str) -> str:
        resp = requests.post(
            self._serverchan_endpoint(),
            data={"title": title, "desp": compact_text(markdown, 12000)},
            timeout=20,
        )
        resp.raise_for_status()
        return "serverchan: ok"

    def _send_webhook(self, title: str, markdown: str, items: list[RadarItem]) -> str:
        payload: dict[str, Any] = {"title": title, "text": markdown, "items": [i.as_dict() for i in items]}
        resp = requests.post(self.webhook_url, json=payload, timeout=20)
        resp.raise_for_status()
        return "webhook: ok"
