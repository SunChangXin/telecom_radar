from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


class Settings:
    def __init__(self) -> None:
        load_dotenv()
        self.config_path = Path(os.getenv("RADAR_CONFIG", "./config/config.example.json"))
        self.db_path = Path(os.getenv("RADAR_DB", "./data/radar.sqlite3"))
        self.report_dir = Path(os.getenv("RADAR_REPORT_DIR", "./data/reports"))
        self.timezone = os.getenv("RADAR_TIMEZONE", "Asia/Shanghai")
        self.max_items_per_run = int(os.getenv("MAX_ITEMS_PER_RUN", "12"))
        self.min_score_to_notify = int(os.getenv("MIN_SCORE_TO_NOTIFY", "2"))

        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip()
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        self.github_token = os.getenv("GITHUB_TOKEN", "").strip()

        self.ntfy_server = os.getenv("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
        self.ntfy_topic = os.getenv("NTFY_TOPIC", "").strip()
        self.serverchan_url = os.getenv("SERVERCHAN_URL", "").strip()
        self.sct_sendkey = os.getenv("SCT_SENDKEY", "").strip()
        self.webhook_url = os.getenv("WEBHOOK_URL", "").strip()

    def load_config(self) -> dict[str, Any]:
        with self.config_path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def ensure_dirs(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.report_dir.mkdir(parents=True, exist_ok=True)
