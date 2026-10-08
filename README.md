# Pulse: Social Media Sentiment Dashboard

Know how people feel, the day it changes.

Pulse is an interactive dashboard that turns social media posts into clear sentiment signals. It scores each post as positive, neutral or negative, then lets you filter, drill down, reply and set alerts in one workspace.

## Features

- Login and profile with editable name, job title, avatar color and notification preferences
- Home dashboard with weekly sentiment, mentions, inbox items and alerts
- Sentiment dashboard with global filters, interactive charts, feed, and live analyzer
- Mentions inbox with reply templates, status updates, undo, and keyboard navigation
- Trend explorer, configurable alerts, shareable reports and team management
- Live mode powered by authenticated server-sent events

## Tech stack

- Frontend: plain HTML, CSS and JavaScript
- Backend: Python 3.10+, FastAPI, SQLite, JWT authentication
- Sentiment: VADER with negation and intensifier adjustments

## How it works

The demo seeds 600 repeatable posts over 30 days about the fictional Lumen phone, including a negative Delivery spike. Posts receive a normalized sentiment score and label. Filters, charts, inbox actions and live posts use the Python API and local SQLite database.

## GitHub Pages demo

The repository root `index.html` opens the frontend on GitHub Pages. Since GitHub Pages only hosts static files and cannot run FastAPI, the frontend detects the `github.io` domain and uses a browser-local demo API instead. Demo accounts, posts, inbox updates and profile/team edits are kept in that browser's local storage; the static demo does not send data to a server. Use the local run steps below for the full SQLite/JWT API.

## Run locally

From this `pulse` directory:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example to .env
uvicorn main:app --reload
```

On macOS and Linux, activate the environment with `source venv/bin/activate`. Set a private `JWT_SECRET` of at least 24 characters in `.env`. Then open **http://localhost:8000**. Interactive API docs are at **http://localhost:8000/docs**.

Demo account: `demo@pulse.test` / `pulse-demo`. Sign up to create an account. This is a demo app; use non-sensitive credentials and data.

## Configuration

- `JWT_SECRET`: private JWT signing secret, required at startup.
- `DATABASE_URL`: SQLite URL; defaults to `sqlite:///./pulse.sqlite3`.
- `FRONTEND_ORIGIN`: exact allowed CORS origin; defaults to `http://localhost:8000`.

## API overview

Public: `POST /api/auth/signup`, `POST /api/auth/login`.

JWT protected: `GET/POST /api/posts`, `GET /api/summary`, `POST /api/analyze`, `GET/PATCH /api/inbox`, `GET /api/trends`, `GET /api/alerts`, `GET /api/reports`, `GET/POST/PATCH/DELETE /api/team`, `GET/PUT /api/profile`, and `GET /api/stream`.

## Ideas for real-data upgrades

1. Connect approved Reddit and YouTube APIs with rate limits and source attribution.
2. Add a Hugging Face sentiment model for richer context and multilingual posts.
3. Move production data to PostgreSQL with scheduled ingestion and retention controls.
