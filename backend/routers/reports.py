"""Plain-text period reports."""
import sqlite3
from datetime import datetime
from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from database import PLATFORMS, TOPICS, get_db
from metrics import average, bounded_days, make_summary

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
def get_report(days: int = Query(default=7, ge=1, le=30), _user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    days = bounded_days(days)
    summary = make_summary(connection, days)
    rows = [dict(row) for row in connection.execute("SELECT * FROM posts WHERE day>=?", (30-days,)).fetchall()]
    ranked = sorted(((topic, [row for row in rows if row["topic"] == topic]) for topic in TOPICS), key=lambda item: average(item[1]), reverse=True)
    busiest = max(PLATFORMS, key=lambda platform: sum(row["platform"] == platform for row in rows))
    worst = min((day for day in summary["daily"] if day["mentions"]), key=lambda day: day["net"], default=None)
    worst_date = datetime.fromisoformat(worst["date"]).astimezone().strftime("%b %d").replace(" 0", " ") if worst and worst.get("date") else "N/A"
    text = "\n".join([
        "PULSE · LUMEN PHONE REPORT", f"Last {days} days", "",
        f"Mentions: {summary['mentions']}", f"Net sentiment: {round(summary['net']*100)}%",
        f"Most loved topic: {ranked[0][0]} ({round(average(ranked[0][1])*100)}%)",
        f"Biggest pain point: {ranked[-1][0]} ({round(average(ranked[-1][1])*100)}%)",
        f"Busiest platform: {busiest} ({sum(row['platform'] == busiest for row in rows)} mentions)",
        f"Worst day: {worst_date} ({round(worst['net']*100) if worst else 0}% net)",
    ])
    return {"days": days, "text": text}
