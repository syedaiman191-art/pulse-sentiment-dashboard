"""Alert threshold evaluation."""
import sqlite3
from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from database import TOPICS, get_db
from metrics import average

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def get_alerts(
    neg_threshold: float = Query(default=35, ge=5, le=90),
    volume_multiplier: float = Query(default=1.7, ge=1.1, le=5), topic: str = "",
    _user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db),
) -> dict:
    rows = [dict(row) for row in connection.execute("SELECT * FROM posts ORDER BY day").fetchall()]
    if topic in TOPICS:
        rows = [row for row in rows if row["topic"] == topic]
    baseline = len(rows) / 30
    alerts = []
    for day in range(30):
        group = [row for row in rows if row["day"] == day]
        if not group:
            continue
        negative_share = sum(row["label"] == "negative" for row in group) / len(group)
        reasons = []
        if negative_share * 100 >= neg_threshold:
            reasons.append({"type": "negative-share", "value": round(negative_share * 100)})
        if len(group) >= baseline * volume_multiplier:
            reasons.append({"type": "volume-spike", "value": round(len(group) / max(1, baseline), 1)})
        if reasons:
            alerts.append({"day": day, "date": group[0]["created_at"], "mentions": len(group), "net": average(group), "negativeShare": negative_share, "reasons": reasons})
    return {"thresholds": {"neg_threshold": neg_threshold, "volume_multiplier": volume_multiplier, "topic": topic or "All"}, "alerts": alerts}
