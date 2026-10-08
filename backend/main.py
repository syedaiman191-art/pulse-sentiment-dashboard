"""Pulse FastAPI application and static frontend host."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name(".env"))

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import init_db
from routers import alerts, analyze, auth, inbox, posts, profile, reports, stream, team, trends

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:8000")

app = FastAPI(title="Pulse API", version="1.0.0", description="Lumen phone sentiment dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

for api_router in (auth.router, posts.router, analyze.router, inbox.router, trends.router, alerts.router, reports.router, team.router, profile.router, stream.router):
    app.include_router(api_router)


@app.on_event("startup")
def startup() -> None:
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 24 or secret.startswith("replace-with-"):
        raise RuntimeError("Set a private JWT_SECRET (at least 24 characters) in backend/.env before starting Pulse.")
    if not FRONTEND_DIR.is_dir():
        raise RuntimeError(f"Frontend folder was not found: {FRONTEND_DIR}")
    init_db()


@app.exception_handler(StarletteHTTPException)
async def http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request validation failed."
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{"field": ".".join(str(part) for part in item["loc"] if part != "body"), "message": item["msg"]} for item in exc.errors()]
    return JSONResponse(status_code=422, content={"error": errors[0]["message"] if errors else "Invalid request.", "details": errors})


@app.exception_handler(Exception)
async def server_error(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "Internal server error."})


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Pulse API"}


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
