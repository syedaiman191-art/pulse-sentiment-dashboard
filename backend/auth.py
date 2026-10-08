"""Password hashing and JWT authentication dependencies."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import get_db

ALGORITHM = "HS256"
_TOKEN_TTL = timedelta(hours=12)
_passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)


def _secret() -> str:
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 24 or value.startswith("replace-with-"):
        raise RuntimeError("Set JWT_SECRET to a private value of at least 24 characters in .env.")
    return value


def hash_password(password: str) -> str:
    return _passwords.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _passwords.verify(password, hashed)


def create_access_token(user: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user["id"]), "email": user["email"], "iat": now, "exp": now + _TOKEN_TTL}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def user_from_token(token: str, connection) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", ""))
    except (JWTError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or expired.") from exc
    row = connection.execute("SELECT id,email,name,title,avatar_color,notifications,member_since FROM users WHERE id=?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists.")
    return dict(row)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer), connection=Depends(get_db)) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user_from_token(credentials.credentials, connection)
