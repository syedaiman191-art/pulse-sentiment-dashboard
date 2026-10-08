# Pulse

Pulse is an interactive social listening and sentiment dashboard for the fictional Lumen phone. The frontend is plain HTML, CSS, and JavaScript. The API uses FastAPI, SQLite, JWT authentication, and VADER sentiment analysis.

## Requirements

- Python 3.10+
- A terminal in the `pulse` project folder

## Run locally

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example to .env
uvicorn main:app --reload
```

On macOS and Linux, activate the environment with `source venv/bin/activate` instead. Edit `.env` and replace `JWT_SECRET` with a private random value of at least 24 characters before starting the server.

Open **http://localhost:8000**. FastAPI serves the frontend from this origin. Interactive API docs are at **http://localhost:8000/docs**.

## Demo account and data

- Email: `demo@pulse.test`
- Password: `pulse-demo`

Sign up to create another account. The 600 deterministic demo posts are seeded only when the posts table is empty and include a negative Delivery spike around days 19–24. The SQLite file and `.env` are local-only and excluded from version control.

## Configuration

- `JWT_SECRET`: private JWT signing secret; required at startup.
- `DATABASE_URL`: SQLite URL, defaults to `sqlite:///./pulse.sqlite3`.
- `FRONTEND_ORIGIN`: exact allowed CORS origin, defaults to `http://localhost:8000`.

## API overview

Public authentication: `POST /api/auth/signup` and `POST /api/auth/login`.

JWT-protected endpoints: `GET/POST /api/posts`, `GET /api/summary`, `POST /api/analyze`, `GET/PATCH /api/inbox`, `GET /api/trends`, `GET /api/alerts`, `GET /api/reports`, `GET/POST/PATCH/DELETE /api/team`, `GET/PUT /api/profile`, and `GET /api/stream` (SSE; the JWT is passed as an EventSource query parameter).

## Ideas for real-data upgrades

1. Ingest posts through the Reddit and YouTube APIs with approved credentials, rate limits, and source attribution.
2. Add a Hugging Face sentiment model for richer context, multilingual posts, and calibrated confidence scores.
3. Move production data to PostgreSQL with scheduled ingestion, deduplication, retention controls, and audit logs.
