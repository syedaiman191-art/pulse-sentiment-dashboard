"""Authenticated profile preferences."""
import json
import sqlite3
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_db
from models import ProfileUpdate

router = APIRouter(prefix="/api/profile", tags=["profile"])
AVATAR_COLORS = {"#28764f", "#d8765e", "#5478b8", "#aa6b9a", "#b18331", "#398e91"}


def _view(user: dict, connection: sqlite3.Connection) -> dict:
    try:
        notifications = json.loads(user["notifications"])
    except (TypeError, json.JSONDecodeError):
        notifications = {"spike": True, "weekly": True, "tips": False}
    replies = connection.execute("SELECT COUNT(*) FROM inbox_state WHERE user_id=? AND reply_text<>''", (user["id"],)).fetchone()[0]
    return {"email": user["email"], "name": user["name"], "title": user["title"], "avatarColor": user["avatar_color"], "notifications": notifications, "memberSince": user["member_since"], "repliesSent": replies}


@router.get("")
def get_profile(user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    return _view(user, connection)


@router.put("")
def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    if payload.avatarColor not in AVATAR_COLORS:
        raise HTTPException(status_code=422, detail="Choose one of the available avatar colors.")
    notifications = json.dumps(payload.notifications.model_dump())
    connection.execute("UPDATE users SET name=?,title=?,avatar_color=?,notifications=? WHERE id=?", (payload.name, payload.title, payload.avatarColor, notifications, user["id"]))
    updated = dict(connection.execute("SELECT id,email,name,title,avatar_color,notifications,member_since FROM users WHERE id=?", (user["id"],)).fetchone())
    return _view(updated, connection)
