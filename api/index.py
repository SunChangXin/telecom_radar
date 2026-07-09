from __future__ import annotations

from pathlib import Path

from telecom_radar.web import create_app


PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Vercel runs this Flask app as a Python Serverless Function.
# It is intended for the read-only dashboard. The crawler, scheduler,
# mobile push and SQLite writing should continue to run locally or on a VPS.
app = create_app(
    db_path=PROJECT_ROOT / "data" / "radar.sqlite3",
    domain_path=PROJECT_ROOT / "config" / "domains.json",
)
