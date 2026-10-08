"""Per-user customer mention status and replies."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from database import get_db
from models import InboxUpdate

router = APIRouter(prefix="/api/inbox", tags=["inbox"])


@router.get("")
def list_inbox(status_filter: str = Query(default="", alias="status"), sort: str = "newest", user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    valid = status_filter if status_filter in ("New", "Replied", "Resolved") else ""
    ordering = {"newest": "p.created_at DESC", "most_liked": "p.likes DESC, p.created_at DESC", "most_negative": "p.score ASC, p.created_at DESC"}.get(sort, "p.created_at DESC")
    params = (user["id"], valid, valid)
    rows = connection.execute(f"""
        SELECT p.*, COALESCE(s.status,'New') AS status, COALESCE(s.reply_text,'') AS reply_text
        FROM posts p LEFT JOIN inbox_state s ON s.post_id=p.id AND s.user_id=?
        WHERE p.label IN ('negative','neutral') AND (?='' OR COALESCE(s.status,'New')=?)
        ORDER BY {ordering} LIMIT 30
    """, params).fetchall()
    total = connection.execute("""
        SELECT COUNT(*) FROM posts p LEFT JOIN inbox_state s ON s.post_id=p.id AND s.user_id=?
        WHERE p.label IN ('negative','neutral') AND (?='' OR COALESCE(s.status,'New')=?)
    """, params).fetchone()[0]
    return {"mentions": [dict(row) for row in rows], "total": total}


@router.patch("/{post_id}")
def update_inbox(post_id: str, payload: InboxUpdate, user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    post = connection.execute("SELECT id FROM posts WHERE id=? AND label IN ('negative','neutral')", (post_id,)).fetchone()
    if post is None:
        raise HTTPException(status_code=404, detail="Mention not found.")
    current = connection.execute("SELECT status,reply_text FROM inbox_state WHERE user_id=? AND post_id=?", (user["id"], post_id)).fetchone()
    reply_text = payload.replyText if payload.replyText is not None else (current["reply_text"] if current else "")
    next_status = payload.status or ("Replied" if payload.replyText else current["status"] if current else "New")
    previous = {"status": current["status"] if current else "New", "replyText": current["reply_text"] if current else ""}
    connection.execute("""
        INSERT INTO inbox_state (user_id,post_id,status,reply_text,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(user_id,post_id) DO UPDATE SET status=excluded.status,reply_text=excluded.reply_text,updated_at=excluded.updated_at
    """, (user["id"], post_id, next_status, reply_text, datetime.now(timezone.utc).isoformat()))
    return {"id": post_id, "status": next_status, "replyText": reply_text, "previous": previous}
