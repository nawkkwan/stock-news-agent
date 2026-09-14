from __future__ import annotations

import unittest
from datetime import date, timedelta

from packages.shared.technical_levels import calculate_review_zones


def bar(day: int, close: float, low: float | None = None, volume: int = 1_000) -> dict[str, object]:
    value_low = low if low is not None else close - 1
    return {
        "date": (date(2026, 1, 1) + timedelta(days=day)).isoformat(),
        "open": close - 0.5,
        "high": close + 1,
        "low": value_low,
        "close": close,
        "volume": volume,
    }


class TechnicalReviewZoneTests(unittest.TestCase):
    def test_repeated_swing_lows_create_an_evidence_zone(self) -> None:
        bars = [bar(index, 112) for index in range(90)]
        for index, low, volume in ((20, 100.0, 1_800), (45, 100.4, 2_000), (70, 99.8, 2_200)):
            bars[index] = bar(index, 104, low=low, volume=volume)
        bars[-1] = bar(89, 120)

        zones = calculate_review_zones(bars)

        self.assertTrue(zones)
        self.assertGreaterEqual(zones[0]["touches"], 3)
        self.assertLess(zones[0]["lower"], 100.5)
        self.assertGreater(zones[0]["upper"], 99.5)
        self.assertGreater(zones[0]["volume_ratio"], 1)

    def test_a_chart_without_repeated_reactions_does_not_force_three_zones(self) -> None:
        bars = [bar(index, 80 + index * 0.5) for index in range(80)]

        self.assertEqual(calculate_review_zones(bars), [])

    def test_returns_at_most_three_strongest_zones_sorted_near_to_deep(self) -> None:
        bars = [bar(index, 142) for index in range(130)]
        for level, indices in ((110, (10, 40)), (100, (20, 50)), (90, (30, 60)), (80, (70, 100))):
            for index in indices:
                bars[index] = bar(index, level + 4, low=level, volume=1_600)
        bars[-1] = bar(129, 150)

        zones = calculate_review_zones(bars)

        self.assertLessEqual(len(zones), 3)
        self.assertGreaterEqual(len(zones), 2)
        self.assertEqual([zone["center"] for zone in zones], sorted((zone["center"] for zone in zones), reverse=True))


if __name__ == "__main__":
    unittest.main()
