"""Workspace team membership management."""
import sqlite3
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_db
from models import TeamInvite, TeamRole

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("")
def get_team(user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    members = connection.execute("SELECT id,email,name,role FROM team_members WHERE owner_id=? ORDER BY id", (user["id"],)).fetchall()
    return {"owner": {"id": user["id"], "email": user["email"], "name": user["name"], "role": "Owner"}, "members": [dict(row) for row in members]}


@router.post("", status_code=201)
def invite(payload: TeamInvite, user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    email = str(payload.email).lower()
    if email == user["email"].lower():
        raise HTTPException(status_code=409, detail="The owner is already on this team.")
    name = (payload.name or email.split("@")[0].replace(".", " ").replace("_", " ")).strip()[:60]
    try:
        cursor = connection.execute("INSERT INTO team_members (owner_id,email,name,role) VALUES (?,?,?,?)", (user["id"], email, name or email, payload.role))
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="This email is already on the team.") from exc
    return dict(connection.execute("SELECT id,email,name,role FROM team_members WHERE id=?", (cursor.lastrowid,)).fetchone())


@router.patch("/{member_id}")
def change_role(member_id: int, payload: TeamRole, user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    result = connection.execute("UPDATE team_members SET role=? WHERE id=? AND owner_id=?", (payload.role, member_id, user["id"]))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Team member not found.")
    return dict(connection.execute("SELECT id,email,name,role FROM team_members WHERE id=?", (member_id,)).fetchone())


@router.delete("/{member_id}")
def remove_member(member_id: int, user: dict = Depends(get_current_user), connection: sqlite3.Connection = Depends(get_db)) -> dict:
    result = connection.execute("DELETE FROM team_members WHERE id=? AND owner_id=?", (member_id, user["id"]))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Team member not found.")
    return {"ok": True}
