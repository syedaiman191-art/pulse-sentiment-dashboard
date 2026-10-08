"""Signup and login routes."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import EmailStr

from auth import create_access_token, hash_password, verify_password
from database import get_db, seed_team
from models import LoginRequest, SignupRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public_user(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "email": row["email"], "name": row["name"], "title": row["title"], "avatarColor": row["avatar_color"]}


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, connection: sqlite3.Connection = Depends(get_db)) -> dict:
    email = str(payload.email).lower()
    if connection.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    try:
        with connection:
            cursor = connection.execute(
                "INSERT INTO users (email,password_hash,name,member_since) VALUES (?,?,?,?)",
                (email, hash_password(payload.password), payload.name, datetime.now(timezone.utc).date().isoformat()),
            )
            user_id = cursor.lastrowid
            seed_team(connection, user_id)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc
    user = dict(connection.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
    return {"token": create_access_token(user), "user": _public_user(connection.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())}


@router.post("/login")
def login(payload: LoginRequest, connection: sqlite3.Connection = Depends(get_db)) -> dict:
    user = connection.execute("SELECT * FROM users WHERE email=?", (str(payload.email).lower(),)).fetchone()
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return {"token": create_access_token(dict(user)), "user": _public_user(user)}
