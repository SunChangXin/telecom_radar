from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

from .config import Settings
from .models import RadarItem
from .sources import ArxivSource, GitHubSource, RssOrHtmlSource
from .scoring import score_item
from .store import Store
from .summarizer import OpenAISummarizer, fallback_summary
from .notifier import Notifier


def configure_console() -> None:
    """Keep fetched Unicode text printable on Windows consoles."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")


def collect(settings: Settings, cfg: dict) -> list[RadarItem]:
    items: list[RadarItem] = []

    arxiv_cfg = cfg.get("arxiv", {})
    if arxiv_cfg.get("enabled", True):
        source = ArxivSource(
            max_results_per_query=int(arxiv_cfg.get("max_results_per_query", 20)),
            days_back=int(arxiv_cfg.get("days_back", 10)),
        )
        try:
            items.extend(source.fetch(arxiv_cfg.get("queries", [])))
        except Exception as exc:
            items.append(RadarItem(source="arXiv", title="arXiv 抓取失败", url="https://export.arxiv.org/api/query", summary=str(exc), score=-99))

    github_cfg = cfg.get("github", {})
    if github_cfg.get("enabled", True):
        source = GitHubSource(
            token=settings.github_token,
            max_results_per_query=int(github_cfg.get("max_results_per_query", 10)),
            days_back=int(github_cfg.get("days_back", 30)),
        )
        try:
            items.extend(source.fetch(github_cfg.get("queries", [])))
        except Exception as exc:
            items.append(RadarItem(source="GitHub", title="GitHub 抓取失败", url="https://api.github.com/search/repositories", summary=str(exc), score=-99))

    rss_cfg = cfg.get("rss", {})
    if rss_cfg.get("enabled", True):
        try:
            items.extend(RssOrHtmlSource().fetch(rss_cfg.get("feeds", [])))
        except Exception as exc:
            items.append(RadarItem(source="RSS/HTML", title="RSS/HTML 抓取失败", url="", summary=str(exc), score=-99))

    keywords = cfg.get("keywords", [])
    negative = cfg.get("negative_keywords", [])
    return [score_item(i, keywords, negative) for i in items if i.title and i.score > -50]


def save_report(settings: Settings, report_md: str) -> Path:
    settings.report_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = settings.report_dir / f"telecom-radar-{ts}.md"
    path.write_text(report_md, encoding="utf-8")
    return path


def run_once(args: argparse.Namespace) -> int:
    settings = Settings()
    settings.ensure_dirs()
    cfg = settings.load_config()
    store = Store(settings.db_path)

    all_items = collect(settings, cfg)
    new_items = store.upsert_items(all_items)

    candidates = [i for i in new_items if i.score >= settings.min_score_to_notify]
    candidates.sort(key=lambda x: x.score, reverse=True)
    candidates = candidates[: settings.max_items_per_run]

    if settings.openai_api_key and candidates:
        summarizer = OpenAISummarizer(settings.openai_api_key, settings.openai_model, settings.openai_base_url)
        report = summarizer.summarize(candidates)
    else:
        report = fallback_summary(candidates)

    report_path = save_report(settings, report)

    if args.print:
        print(report)
        print(f"\n[report] {report_path}")

    if candidates and not args.no_notify:
        notifier = Notifier(
            ntfy_server=settings.ntfy_server,
            ntfy_topic=settings.ntfy_topic,
            serverchan_url=settings.serverchan_url,
            sct_sendkey=settings.sct_sendkey,
            webhook_url=settings.webhook_url,
        )
        if notifier.enabled():
            title = f"通信前沿雷达：{len(candidates)} 条新动态"
            try:
                results = notifier.send(title, report, candidates)
                store.mark_notified(candidates)
                print("; ".join(results))
            except Exception as exc:
                print(f"推送失败：{exc}", file=sys.stderr)
                return 2
        else:
            print("未配置推送渠道。已生成报告，但不会标记为已推送。")
    elif not candidates:
        print("本轮没有达到阈值的新内容。")

    store.close()
    return 0


def show_config(_: argparse.Namespace) -> int:
    settings = Settings()
    cfg = settings.load_config()
    print(json.dumps(cfg, ensure_ascii=False, indent=2))
    return 0


def daemon(args: argparse.Namespace) -> int:
    interval = max(int(args.interval), 3600)
    while True:
        ns = argparse.Namespace(print=True, no_notify=args.no_notify)
        code = run_once(ns)
        if code not in (0, 2):
            print(f"run_once exited with code {code}", file=sys.stderr)
        print(f"下一次运行将在 {interval} 秒后。")
        time.sleep(interval)


def main() -> int:
    configure_console()
    parser = argparse.ArgumentParser(description="通信前沿自动情报系统")
    sub = parser.add_subparsers(dest="command", required=True)

    p1 = sub.add_parser("run-once", help="立即抓取、去重、摘要并推送一次")
    p1.add_argument("--print", action="store_true", help="在终端打印报告")
    p1.add_argument("--no-notify", action="store_true", help="只生成报告，不推送到手机")
    p1.set_defaults(func=run_once)

    p2 = sub.add_parser("daemon", help="常驻运行，按间隔重复执行")
    p2.add_argument("--interval", type=int, default=6 * 3600, help="运行间隔，单位秒；最低 3600 秒")
    p2.add_argument("--no-notify", action="store_true", help="只生成报告，不推送到手机")
    p2.set_defaults(func=daemon)

    p3 = sub.add_parser("show-config", help="显示当前配置")
    p3.set_defaults(func=show_config)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
