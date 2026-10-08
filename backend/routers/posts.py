"""Post search, summary and feed-creation routes."""
from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from database import PLATFORMS, TOPICS, get_db
from metrics import bounded_days, fetch_posts, make_summary
from models import PostCreate
from sentiment import score_text

router = APIRouter(tags=["posts"])


@router.get("/api/posts")
def get_posts(
    platform: str = "", days: int = Query(default=30, ge=1, le=30), topic: str = "",
    tone: str = "", q: str = "", sort: Literal["newest", "most_liked", "most_negative"] = "newest",
    limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0),
    day: int | None = Query(default=None, ge=0, le=29),
    _user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db),
) -> dict:
    posts = fetch_posts(connection, days=bounded_days(days), platform=platform, topic=topic, tone=tone, query=q, sort=sort, limit=limit, offset=offset, day=day)
    return {"posts": posts, "count": len(posts), "days": days}


@router.get("/api/summary")
def get_summary(
    days: int = Query(default=7, ge=1, le=30), platform: str = "", topic: str = "", tone: str = "", q: str = "",
    _user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db),
) -> dict:
    return make_summary(connection, bounded_days(days), platform, topic, tone, q)


@router.post("/api/posts", status_code=201)
def create_post(payload: PostCreate, user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    if payload.platform not in PLATFORMS or payload.topic not in TOPICS:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Choose a supported platform and topic.")
    result = score_text(payload.text)
    now = datetime.now(timezone.utc)
    post = {
        "id": f"post-{uuid.uuid4().hex}", "day": 29, "created_at": now.isoformat(), "hour": now.hour,
        "platform": payload.platform, "topic": payload.topic, "text": payload.text,
        "likes": 0, "score": result["score"], "label": result["label"], "author_id": user["id"],
    }
    connection.execute(
        "INSERT INTO posts (id,day,created_at,hour,platform,topic,text,likes,score,label) VALUES (?,?,?,?,?,?,?,?,?,?)",
        tuple(post[key] for key in ("id", "day", "created_at", "hour", "platform", "topic", "text", "likes", "score", "label")),
    )
    return {**post, "breakdown": result["breakdown"]}
