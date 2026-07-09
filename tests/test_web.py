from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from telecom_radar.store import SCHEMA
from telecom_radar.content import chinese_digest, content_type_for
from telecom_radar.domains import classify_item, load_domain_rules
from telecom_radar.web import create_app, load_dashboard_data


class DashboardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tempdir.name) / "radar.sqlite3"
        conn = sqlite3.connect(self.db_path)
        conn.executescript(SCHEMA)
        conn.execute(
            """
            INSERT INTO items
            (id, source, title, url, summary, published_at, authors_json,
             tags_json, score, first_seen_at, last_seen_at, notified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "sample-id",
                "arXiv",
                "NTN positioning",
                "https://example.com/paper",
                "A reproducible sample.",
                "2026-07-01T00:00:00+00:00",
                json.dumps(["Researcher A"]),
                json.dumps(["NTN", "6G"]),
                17,
                "2026-07-02T00:00:00+00:00",
                "2026-07-02T00:00:00+00:00",
                None,
            ),
        )
        conn.commit()
        conn.close()

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def test_load_dashboard_data(self) -> None:
        data = load_dashboard_data(self.db_path)
        self.assertEqual(data["stats"]["total"], 1)
        self.assertEqual(data["stats"]["top_score"], 17)
        self.assertEqual(data["items"][0]["tags"], ["NTN", "6G"])
        self.assertEqual(data["items"][0]["primary_domain"], "NTN 与卫星通信")
        self.assertIn("标准与产业演进", data["items"][0]["domains"])

    def test_item_can_have_primary_and_related_domains(self) -> None:
        rules = load_domain_rules(Path("config/domains.json"))
        primary, domains = classify_item(
            {
                "title": "RIS-assisted ISAC beamforming",
                "summary": "Joint sensing and communication with a metasurface.",
                "tags": ["RIS", "ISAC"],
                "source": "arXiv",
            },
            rules,
        )
        self.assertIn(primary, {"RIS 与智能电磁环境", "ISAC 与通感融合"})
        self.assertIn("RIS 与智能电磁环境", domains)
        self.assertIn("ISAC 与通感融合", domains)

    def test_paper_uses_chinese_digest_instead_of_english_abstract(self) -> None:
        item = {
            "source": "arXiv",
            "url": "https://arxiv.org/abs/1",
            "summary": "This paper proposes a new beamforming method.",
            "primary_domain": "MIMO 与先进天线",
            "tags": ["beamforming", "MIMO"],
        }
        item["content_type"] = content_type_for(item["source"], item["url"])
        digest = chinese_digest(item)
        self.assertEqual(item["content_type"], "论文")
        self.assertIn("该论文聚焦MIMO 与先进天线", digest)
        self.assertNotIn("This paper", digest)

    def test_page_and_api_render_real_data(self) -> None:
        client = create_app(self.db_path).test_client()
        page = client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertIn("NTN positioning".encode(), page.data)
        self.assertIn("该论文聚焦NTN 与卫星通信".encode("utf-8"), page.data)
        payload = client.get("/api/items").get_json()
        self.assertEqual(payload["items"][0]["source"], "arXiv")


if __name__ == "__main__":
    unittest.main()
