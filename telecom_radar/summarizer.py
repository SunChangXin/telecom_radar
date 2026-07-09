from __future__ import annotations

import json
import textwrap
from datetime import datetime
from typing import Iterable

import requests

from .models import RadarItem


def item_line(item: RadarItem) -> str:
    date = item.published_at.date().isoformat() if item.published_at else "未知日期"
    authors = ", ".join([a for a in item.authors if a][:3])
    author_part = f" | {authors}" if authors else ""
    tags = ", ".join(item.tags[:6])
    tag_part = f" | 命中: {tags}" if tags else ""
    return f"- [{item.source}] {item.title}（{date}，score={item.score}{author_part}{tag_part}）\n  {item.url}\n  {item.summary[:260]}"


def fallback_summary(items: list[RadarItem]) -> str:
    if not items:
        return "本轮没有发现达到阈值的新内容。"
    lines = ["# 通信前沿情报摘要", "", f"生成时间：{datetime.now().isoformat(timespec='seconds')}", ""]
    lines.append("## 本轮重点")
    for item in items:
        lines.append(item_line(item))
    lines.append("")
    lines.append("## 建议阅读顺序")
    lines.append("1. 先看 3GPP / ITU / 工业报告类内容，判断标准和产业方向。")
    lines.append("2. 再看 arXiv 论文，找可复现实验或可做课题的技术点。")
    lines.append("3. 最后看 GitHub 项目，判断是否有可运行代码或 SDR/OAI/srsRAN 相关实现。")
    return "\n".join(lines)


class OpenAISummarizer:
    def __init__(self, api_key: str, model: str, base_url: str = "https://api.openai.com/v1") -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    def summarize(self, items: list[RadarItem]) -> str:
        if not self.api_key:
            return fallback_summary(items)
        payload_items = [item.as_dict() for item in items]
        prompt = f"""
你是通信工程方向的研究助理。请根据下面的新论文、标准动态、工业资讯和开源项目，写一份中文技术雷达摘要。
要求：
1. 先给出 3-6 条“今日值得关注”。
2. 每条说明：它是什么、为什么重要、通信工程学生可以如何跟进。
3. 按方向归类：标准/产业、论文、开源工程。
4. 不要编造原文没有的信息。没有日期就写“页面未提供日期”。
5. 保留每条原始 URL。

数据如下：
{json.dumps(payload_items, ensure_ascii=False, indent=2)}
""".strip()
        try:
            resp = requests.post(
                f"{self.base_url}/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": prompt,
                    "temperature": 0.2,
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            text = data.get("output_text")
            if text:
                return text
            # 兼容部分 Responses API 返回结构
            chunks = []
            for out in data.get("output", []):
                for content in out.get("content", []):
                    if content.get("type") in {"output_text", "text"}:
                        chunks.append(content.get("text", ""))
            joined = "\n".join([c for c in chunks if c]).strip()
            return joined or fallback_summary(items)
        except Exception as exc:
            return fallback_summary(items) + "\n\n> LLM 总结失败，已降级为规则摘要：" + textwrap.shorten(str(exc), width=200)
