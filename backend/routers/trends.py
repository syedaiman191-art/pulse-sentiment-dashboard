"""Topic momentum summaries."""
import sqlite3

from fastapi import APIRouter, Depends

from auth import get_current_user
from database import PLATFORMS, TOPICS, get_db

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("")
def get_trends(platform: str = "", _user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    sql = "SELECT * FROM posts"
    params: tuple = ()
    if platform in PLATFORMS:
        sql += " WHERE platform=?"; params = (platform,)
    rows = [dict(row) for row in connection.execute(sql, params).fetchall()]
    trends = []
    for topic in TOPICS:
        items = [row for row in rows if row["topic"] == topic]
        recent = [row for row in items if row["day"] >= 23]
        previous = [row for row in items if 16 <= row["day"] < 23]
        counts = [sum(row["day"] == day for row in items) for day in range(30)]
        trends.append({"topic": topic, "mentions": len(items), "last7": len(recent), "previous7": len(previous),
                       "change": (len(recent)-len(previous))/max(1, len(previous)),
                       "negativeShare": sum(row["label"] == "negative" for row in items)/max(1, len(items)), "series": counts})
    return {"trends": trends, "platform": platform or "All"}
