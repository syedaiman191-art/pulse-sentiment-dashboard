"""Shared query and sentiment aggregation helpers."""
from __future__ import annotations

import sqlite3
from typing import Any

from database import PLATFORMS, TOPICS


def bounded_days(value: int) -> int:
    return value if value in (7, 14, 30) else 7


def fetch_posts(connection: sqlite3.Connection, *, days: int = 30, platform: str = "", topic: str = "", tone: str = "", query: str = "", sort: str = "newest", limit: int = 100, offset: int = 0, day: int | None = None) -> list[dict[str, Any]]:
    clauses = ["day >= ?"]
    params: list[Any] = [30 - days]
    if platform in PLATFORMS:
        clauses.append("platform=?"); params.append(platform)
    if topic in TOPICS:
        clauses.append("topic=?"); params.append(topic)
    if tone in ("positive", "neutral", "negative"):
        clauses.append("label=?"); params.append(tone)
    if query:
        clauses.append("text LIKE ?"); params.append(f"%{query[:120]}%")
    if day is not None:
        clauses.append("day=?"); params.append(day)
    order = {"newest": "created_at DESC", "most_liked": "likes DESC, created_at DESC", "most_negative": "score ASC, created_at DESC"}.get(sort, "created_at DESC")
    params.extend((min(500, max(1, limit)), max(0, offset)))
    rows = connection.execute(f"SELECT * FROM posts WHERE {' AND '.join(clauses)} ORDER BY {order} LIMIT ? OFFSET ?", params).fetchall()
    return [dict(row) for row in rows]


def average(rows: list[dict[str, Any]]) -> float:
    return sum(float(row["score"]) for row in rows) / len(rows) if rows else 0.0


def shares(rows: list[dict[str, Any]]) -> dict[str, float]:
    total = len(rows) or 1
    return {tone: sum(row["label"] == tone for row in rows) / total for tone in ("positive", "neutral", "negative")}


def make_summary(connection: sqlite3.Connection, days: int = 7, platform: str = "", topic: str = "", tone: str = "", query: str = "") -> dict[str, Any]:
    days = bounded_days(days)
    start = 30 - days
    topic = topic if topic in TOPICS else ""
    tone = tone if tone in ("positive", "neutral", "negative") else ""
    base_sql = "SELECT * FROM posts WHERE day>=?"
    args: list[Any] = [start]
    if platform in PLATFORMS:
        base_sql += " AND platform=?"; args.append(platform)
    all_current = [dict(row) for row in connection.execute(base_sql, args).fetchall()]
    matching = [row for row in all_current if (tone not in ("positive", "neutral", "negative") or row["label"] == tone) and (not query or query.lower() in row["text"].lower())]
    current = [row for row in matching if not topic or row["topic"] == topic]
    previous_start = max(0, 30 - 2 * days)
    previous_sql = "SELECT * FROM posts WHERE day>=? AND day<?"
    previous_args: list[Any] = [previous_start, start]
    if platform in PLATFORMS:
        previous_sql += " AND platform=?"; previous_args.append(platform)
    if topic in TOPICS:
        previous_sql += " AND topic=?"; previous_args.append(topic)
    previous_rows = [dict(row) for row in connection.execute(previous_sql, previous_args).fetchall()]
    previous = [row for row in previous_rows if (not topic or row["topic"] == topic) and (tone not in ("positive", "neutral", "negative") or row["label"] == tone) and (not query or query.lower() in row["text"].lower())]
    daily = []
    for day in range(start, 30):
        items = [row for row in current if row["day"] == day]
        topic_counts = [{"topic": name, "count": sum(item["topic"] == name for item in items)} for name in TOPICS]
        topic_counts.sort(key=lambda item: item["count"], reverse=True)
        daily.append({"day": day, "date": items[0]["created_at"] if items else None, "mentions": len(items), "net": average(items), **{tone: sum(item["label"] == tone for item in items) for tone in ("positive", "neutral", "negative")}, "topicCounts": topic_counts})
    topic_rows = []
    for name in TOPICS:
        items = [row for row in matching if row["topic"] == name]
        topic_rows.append({"topic": name, "mentions": len(items), "average": average(items), "negativeShare": shares(items)["negative"]})
    topic_rows.sort(key=lambda row: row["average"], reverse=True)
    current_share, previous_share = shares(current), shares(previous)
    return {
        "days": days, "platform": platform or "All", "topic": topic or "All", "tone": tone or "All", "query": query, "mentions": len(current), "net": average(current), **current_share,
        "previous": {"mentions": len(previous), "net": average(previous), **previous_share},
        "comparison": {"mentions": len(current)-len(previous), "net": average(current)-average(previous)},
        "daily": daily, "topics": topic_rows,
        "platforms": [{"platform": item, "mentions": sum(row["platform"] == item for row in current)} for item in PLATFORMS],
    }
