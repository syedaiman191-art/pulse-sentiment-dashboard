"""Authenticated SSE stream with generated demo mentions."""
from __future__ import annotations

import asyncio
import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from auth import user_from_token
from database import PLATFORMS, SAMPLE_TEXT, TOPICS, connect
from sentiment import score_text

router = APIRouter(tags=["live stream"])
_rng = random.Random()


def _new_post() -> dict:
	topic = _rng.choice(TOPICS)
	tone = _rng.choices(["positive", "neutral", "negative"], weights=[0.4, 0.2, 0.4])[0]
	if _rng.random() < 0.2:
		topic, tone = "Delivery", "negative"
	text = _rng.choice(SAMPLE_TEXT[topic][tone])
	result = score_text(text)
	now = datetime.now(timezone.utc)
	post = {
		"id": f"live-{uuid.uuid4().hex}", "day": 29, "created_at": now.isoformat(), "hour": now.hour,
		"platform": _rng.choice(PLATFORMS), "topic": topic, "text": text,
		"likes": _rng.randrange(300), "score": result["score"], "label": result["label"],
	}
	connection = connect()
	try:
		with connection:
			connection.execute(
				"INSERT INTO posts (id,day,created_at,hour,platform,topic,text,likes,score,label) VALUES (?,?,?,?,?,?,?,?,?,?)",
				tuple(post[key] for key in ("id", "day", "created_at", "hour", "platform", "topic", "text", "likes", "score", "label")),
			)
			recent_delivery_negatives = connection.execute(
				"SELECT COUNT(*) FROM posts WHERE topic='Delivery' AND label='negative' AND created_at>=?",
				((now - timedelta(minutes=3)).isoformat(),),
			).fetchone()[0]
	finally:
		connection.close()
	post["alertTriggered"] = post["topic"] == "Delivery" and post["label"] == "negative" and recent_delivery_negatives >= 3
	return post


@router.get("/api/stream")
async def stream(request: Request, token: str = Query(min_length=20)) -> StreamingResponse:
	connection = connect()
	try:
		user_from_token(token, connection)
	finally:
		connection.close()

	async def events():
		while not await request.is_disconnected():
			post = _new_post()
			alert_triggered = post.pop("alertTriggered", False)
			yield f"data: {json.dumps({'post': post, 'alertTriggered': alert_triggered}, ensure_ascii=False)}\n\n"
			await asyncio.sleep(_rng.uniform(2.0, 3.0))

	return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
