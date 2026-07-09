from __future__ import annotations

import re
from typing import Any


CONTENT_TYPES = ("论文", "标准组织", "产业资讯", "开源项目")

STANDARD_SOURCES = ("3gpp", "itu", "etsi", "o-ran alliance", "gsma", "6g-ia", "next g alliance", "nist")
INDUSTRY_SOURCES = ("ericsson", "nokia", "qualcomm", "ieee comsoc")


def content_type_for(source: str, url: str = "") -> str:
    normalized = source.lower()
    if normalized.startswith("arxiv") or "doi.org" in url:
        return "论文"
    if normalized.startswith("github"):
        return "开源项目"
    if any(name in normalized for name in STANDARD_SOURCES):
        return "标准组织"
    if any(name in normalized for name in INDUSTRY_SOURCES):
        return "产业资讯"
    return "产业资讯"


def _meaningful_tags(tags: list[str]) -> list[str]:
    ignored = {"sa", "nr", "ran", "ric", "phy", "mac"}
    result = []
    for tag in tags:
        normalized = tag.lower()
        if "." in normalized and normalized.split(".", 1)[0] in {"cs", "eess", "math", "physics", "stat"}:
            continue
        if normalized not in ignored and len(tag) > 1 and tag not in result:
            result.append(tag)
    return result[:5]


def has_chinese(text: str) -> bool:
    return len(re.findall(r"[\u4e00-\u9fff]", text or "")) >= 8


def chinese_digest(item: dict[str, Any]) -> str:
    summary = (item.get("summary") or "").strip()
    if has_chinese(summary):
        return summary

    content_type = item.get("content_type") or content_type_for(item.get("source", ""), item.get("url", ""))
    domain = item.get("primary_domain") or "通信技术"
    tags = _meaningful_tags(item.get("tags") or [])
    tech = "、".join(tags)
    if content_type == "论文":
        core = f"该论文聚焦{domain}，围绕标题所述问题开展研究"
        if tech:
            core += f"，涉及{tech}等技术要素"
        return core + "。建议重点核对原文中的系统模型、实验设置、对比基线与性能增益。"
    if content_type == "开源项目":
        core = f"该开源项目属于{domain}方向"
        if tech:
            core += f"，涉及{tech}"
        return core + "。建议查看仓库文档、许可证、最近提交和可复现实验说明后再决定是否采用。"
    if content_type == "标准组织":
        return f"该动态来自标准或行业组织，主题归入{domain}。建议关注涉及的版本、工作组、时间节点以及对后续技术规范的影响。"
    return f"该产业资讯聚焦{domain}。建议结合发布机构、技术范围和公开数据判断其工程成熟度与产业参考价值。"
