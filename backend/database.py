"""SQLite connection management and deterministic demo data."""
from __future__ import annotations

import json
import os
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator, Iterator

from passlib.context import CryptContext

from sentiment import score_text

TOPICS = ["Battery life", "Camera", "Price", "Support", "Delivery", "Design"]
PLATFORMS = ["X", "Reddit", "Instagram", "YouTube"]
SAMPLE_TEXT = {
    "Battery life": {
        "positive": ["The Lumen phone battery lasts all day and then some.", "Battery life is fantastic, even with heavy use."],
        "neutral": ["Battery life is fine for my usual day."],
        "negative": ["The battery drains too quickly by afternoon.", "I am disappointed that the battery barely lasts."],
    },
    "Camera": {
        "positive": ["The camera takes beautiful photos in low light.", "Lumen camera details look crisp and natural."],
        "neutral": ["The camera is about what I expected."],
        "negative": ["The camera struggles with focus at night.", "Photos look muddy and the camera disappoints."],
    },
    "Price": {
        "positive": ["The price feels fair for such a polished phone.", "Great value, the Lumen phone is worth every dollar."],
        "neutral": ["The price is close to other phones."],
        "negative": ["The price is too high for these features.", "I regret paying so much for this phone."],
    },
    "Support": {
        "positive": ["Support solved my problem quickly and kindly.", "The support team was helpful and thoughtful."],
        "neutral": ["Support answered my question today."],
        "negative": ["Support ignored my request for days.", "The support experience was frustrating and rude."],
    },
    "Delivery": {
        "positive": ["My Lumen phone arrived early and in perfect shape.", "Delivery was quick and the package was secure."],
        "neutral": ["The delivery arrived on the estimated date."],
        "negative": ["My delivery is really late and the box is damaged.", "The shipment was delayed and nobody gave an update."],
    },
    "Design": {
        "positive": ["The design feels elegant and comfortable to hold.", "I love the clean design and premium finish."],
        "neutral": ["The design looks similar to the product photos."],
        "negative": ["The design feels cheap and slippery.", "I dislike the bulky design of this phone."],
    },
}
_PASSWORDS = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _database_path() -> Path:
    url = os.getenv("DATABASE_URL", "sqlite:///./pulse.sqlite3")
    if not url.startswith("sqlite:///"):
        raise RuntimeError("DATABASE_URL must use sqlite:/// for this demo backend.")
    raw_path = url.removeprefix("sqlite:///")
    path = Path(raw_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


DB_PATH = _database_path()


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _schema(connection: sqlite3.Connection) -> None:
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT 'Product Analyst',
            avatar_color TEXT NOT NULL DEFAULT '#28764f',
            notifications TEXT NOT NULL DEFAULT '{"spike":true,"weekly":true,"tips":false}',
            member_since TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            day INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            hour INTEGER NOT NULL,
            platform TEXT NOT NULL,
            topic TEXT NOT NULL,
            text TEXT NOT NULL,
            likes INTEGER NOT NULL,
            score REAL NOT NULL,
            label TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_posts_day ON posts(day, platform, topic);
        CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
        CREATE TABLE IF NOT EXISTS inbox_state (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK(status IN ('New','Replied','Resolved')),
            reply_text TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            PRIMARY KEY(user_id, post_id)
        );
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            email TEXT NOT NULL COLLATE NOCASE,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('Admin','Analyst','Viewer')),
            UNIQUE(owner_id, email)
        );
    """)


def _seed(connection: sqlite3.Connection) -> None:
    if connection.execute("SELECT COUNT(*) FROM posts").fetchone()[0] == 0:
        rng = random.Random(934821)
        now = datetime.now(timezone.utc)
        post_rows = []
        for day in range(30):
            for index in range(20):
                topic = rng.choice(TOPICS)
                bucket = rng.random()
                tone = "positive" if bucket < 0.4 else "neutral" if bucket < 0.6 else "negative"
                if 18 <= day <= 23 and rng.random() < 0.48:
                    topic, tone = "Delivery", "negative"
                text = rng.choice(SAMPLE_TEXT[topic][tone])
                hour = rng.randrange(24)
                created = (now - timedelta(days=29 - day)).replace(hour=hour, minute=0, second=0, microsecond=0)
                result = score_text(text)
                post_rows.append((f"seed-{day}-{index}", day, created.isoformat(), hour,
                                  rng.choice(PLATFORMS), topic, text, rng.randrange(840),
                                  result["score"], result["label"]))
        connection.executemany(
            "INSERT INTO posts (id,day,created_at,hour,platform,topic,text,likes,score,label) VALUES (?,?,?,?,?,?,?,?,?,?)",
            post_rows,
        )

    user = connection.execute("SELECT id FROM users WHERE email=?", ("demo@pulse.test",)).fetchone()
    if user is None:
        cursor = connection.execute(
            "INSERT INTO users (email,password_hash,name,member_since) VALUES (?,?,?,?)",
            ("demo@pulse.test", _PASSWORDS.hash("pulse-demo"), "Demo User", datetime.now(timezone.utc).date().isoformat()),
        )
        user_id = cursor.lastrowid
        connection.executemany(
            "INSERT OR IGNORE INTO team_members (owner_id,email,name,role) VALUES (?,?,?,?)",
            [(user_id, "morgan.lee@pulse.demo", "Morgan Lee", "Analyst"),
             (user_id, "jules.park@pulse.demo", "Jules Park", "Viewer")],
        )


def init_db() -> None:
    with transaction() as connection:
        _schema(connection)
        _seed(connection)


def seed_team(connection: sqlite3.Connection, owner_id: int) -> None:
    connection.executemany(
        "INSERT OR IGNORE INTO team_members (owner_id,email,name,role) VALUES (?,?,?,?)",
        [(owner_id, "morgan.lee@pulse.demo", "Morgan Lee", "Analyst"),
         (owner_id, "jules.park@pulse.demo", "Jules Park", "Viewer")],
    )
