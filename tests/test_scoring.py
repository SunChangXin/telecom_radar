from __future__ import annotations

import unittest

from telecom_radar.models import RadarItem
from telecom_radar.scoring import score_item


class ScoringTests(unittest.TestCase):
    def test_short_acronyms_do_not_match_inside_unrelated_words(self) -> None:
        item = RadarItem(
            source="arXiv",
            title="Matrix simulation for manufacturing",
            url="https://example.com/unrelated",
            summary="A generic analysis of physical materials.",
        )
        score_item(item, ["SA", "NR", "RIC", "RIS", "MAC", "PHY"], [])
        self.assertEqual(item.tags, [])

    def test_short_acronyms_match_as_standalone_terms(self) -> None:
        item = RadarItem(
            source="arXiv",
            title="RIS and NR beam management",
            url="https://example.com/relevant",
        )
        score_item(item, ["NR", "RIS"], [])
        self.assertIn("NR", item.tags)
        self.assertIn("RIS", item.tags)


if __name__ == "__main__":
    unittest.main()
