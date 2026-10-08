# Pulse: Social Media Sentiment Dashboard

Know how people feel, the day it changes.

Pulse is an interactive dashboard that turns social media posts into clear sentiment signals. It scores each post as positive, neutral or negative, then lets you filter, drill down, reply and set alerts, all in one workspace.

## Features

- **Login and profile:** demo sign-in, editable name, job title and avatar color
- **Home dashboard:** weekly sentiment, mentions, open inbox items and alerts at a glance
- **Sentiment dashboard:** filters by platform, date range and topic; daily bar chart, donut chart, topic ranking, searchable post feed and a live text analyzer
- **Mentions inbox:** reply to posts with templates and mark them resolved
- **Trend explorer:** compare the last 7 days with the week before, with sparklines
- **Alerts:** sliders that flag days with negative spikes
- **Reports:** a shareable summary for 7, 14 or 30 days
- **Team:** invite members and manage roles

## Tech stack

- Frontend: HTML, CSS, JavaScript
- Backend: Python (FastAPI), SQLite
- Sentiment scoring: word-list rules with negation and intensifier handling

## How it works

1. Posts are collected (demo data: 600 posts over 30 days about a fictional "Lumen phone").
2. Each post gets a score from -1 to +1 and a label.
3. The dashboard visualizes the results and updates instantly as you filter.
4. You act on what you find through the inbox, alerts and reports.

## Run it

Frontend only: open `frontend/index.html` in a browser.

With the Python API:
    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    copy .env.example .env
    uvicorn main:app --reload
Then open http://localhost:8000

## Note

This is a demo project. Login is simulated and the data is generated, so don't use real passwords or personal data.

## Roadmap

- Live data from the Reddit and YouTube APIs
- A trained model (such as Hugging Face) for better accuracy
- PostgreSQL and real user accounts
- 
