from __future__ import annotations

from statistics import median
from typing import Any


def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result > 0 else None


def _touch_episodes(indices: list[int], separation: int = 3) -> list[int]:
    episodes: list[int] = []
    for index in indices:
        if not episodes or index - episodes[-1] >= separation:
            episodes.append(index)
        else:
            episodes[-1] = index
    return episodes


def calculate_review_zones(raw_bars: list[dict[str, Any]], max_zones: int = 3) -> list[dict[str, Any]]:
    """Return evidence-scored support zones from daily OHLCV bars.

    Zones come from repeated swing-low reactions. ATR determines zone width,
    while independent touches, relative volume, recency, and time span determine
    strength. The function intentionally returns fewer than ``max_zones`` when
    the price history does not contain enough evidence.
    """
    bars: list[dict[str, Any]] = []
    for raw in raw_bars[-180:]:
        close = _number(raw.get("close"))
        if close is None:
            continue
        bars.append({
            "date": str(raw.get("date") or ""),
            "open": _number(raw.get("open")) or close,
            "high": _number(raw.get("high")) or close,
            "low": _number(raw.get("low")) or close,
            "close": close,
            "volume": max(float(raw.get("volume") or 0), 0),
        })
    if len(bars) < 15:
        return []

    current = bars[-1]["close"]
    true_ranges: list[float] = []
    for index, bar in enumerate(bars):
        previous_close = bars[index - 1]["close"] if index else bar["close"]
        true_ranges.append(max(
            bar["high"] - bar["low"],
            abs(bar["high"] - previous_close),
            abs(bar["low"] - previous_close),
        ))
    atr_window = true_ranges[-14:]
    atr = sum(atr_window) / len(atr_window)
    tolerance = max(atr * 0.7, current * 0.006)
    prior = bars[:-1]

    pivots: list[tuple[int, float]] = []
    for index in range(2, len(prior) - 2):
        low = prior[index]["low"]
        neighbor_lows = [item["low"] for offset, item in enumerate(prior[index - 2:index + 3]) if offset != 2]
        if low < min(neighbor_lows) and low < current - tolerance * 0.5:
            pivots.append((index, low))
    if not pivots:
        return []

    clusters: list[list[tuple[int, float]]] = []
    for pivot in sorted(pivots, key=lambda item: item[1]):
        target = next(
            (cluster for cluster in clusters if abs(pivot[1] - median(value for _, value in cluster)) <= tolerance),
            None,
        )
        if target is None:
            clusters.append([pivot])
        else:
            target.append(pivot)

    average_volume = sum(item["volume"] for item in prior) / max(len(prior), 1)
    zones: list[dict[str, Any]] = []
    for cluster in clusters:
        center = float(median(value for _, value in cluster))
        lower = center - tolerance * 0.5
        upper = center + tolerance * 0.5
        episodes = _touch_episodes(sorted(index for index, _ in cluster))
        touches = len(episodes)
        if touches < 2 or center >= current:
            continue

        touch_volume = sum(prior[index]["volume"] for index in episodes) / touches
        volume_ratio = touch_volume / average_volume if average_volume > 0 else 1.0
        last_touch = episodes[-1]
        recency = 1 - ((len(prior) - 1 - last_touch) / max(len(prior) - 1, 1))
        span = (episodes[-1] - episodes[0]) / max(len(prior) - 1, 1) if touches > 1 else 0
        score_breakdown = {
            "touches": round(min(touches / 4, 1) * 45, 1),
            "volume": round(min(volume_ratio / 1.5, 1) * 20, 1),
            "recency": round(recency * 20, 1),
            "time_span": round(min(span * 2, 1) * 15, 1),
        }
        score = round(sum(score_breakdown.values()), 1)
        confidence = "high" if score >= 70 and touches >= 3 else "medium" if score >= 45 else "low"
        zones.append({
            "lower": round(lower, 2),
            "upper": round(upper, 2),
            "center": round(center, 2),
            "touches": touches,
            "volume_ratio": round(volume_ratio, 2),
            "last_touch_date": prior[last_touch]["date"],
            "distance_pct": round((center - current) / current * 100, 2),
            "score": score,
            "score_breakdown": score_breakdown,
            "confidence": confidence,
            "method": "swing-low cluster · ATR width · touch/volume/recency score",
        })

    strongest = sorted(zones, key=lambda zone: (zone["score"], zone["touches"]), reverse=True)[:max_zones]
    return sorted(strongest, key=lambda zone: zone["center"], reverse=True)
