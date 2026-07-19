# Aasrah Backend

FastAPI + PostgreSQL (Neon) + SQLAlchemy/Alembic backend for the Aasrah
Humanitarian Response Platform.

## Stack

- **FastAPI** (API versioning under `/api/v1`, OpenAPI at `/docs`)
- **SQLAlchemy 2.0** ORM + **Alembic** migrations
- **psycopg v3** driver, **Neon** Postgres
- **JWT** auth (access + rotating refresh tokens), bcrypt password hashing, RBAC
- **slowapi** rate limiting, CORS, centralized exception handling, structured logging
- **Pillow** image processing, cloud-ready `StorageBackend` (local disk now)
- **Nominatim** (OpenStreetMap) reverse-geocode/search proxy

## Setup

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then set AASRAH_DATABASE_URL + SECRET_KEY
```

> **Database URL:** the app reads `AASRAH_DATABASE_URL` first (so a generic
> `DATABASE_URL` in your shell can't hijack the connection). Point it at a
> dedicated, empty Postgres database.

## Database

```bash
python -m scripts.init_db     # run migrations to head
python -m scripts.seed        # optional: admin user + placeholder NGOs

# Migration workflow
python -m alembic revision --autogenerate -m "message"
python -m alembic upgrade head
python -m alembic downgrade -1
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

Or with Docker:

```bash
docker compose up --build
```

## API surface (v1)

| Area    | Endpoints |
|---------|-----------|
| Health  | `GET /health`, `GET /health/db` |
| Auth    | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET /auth/me` |
| Reports | `POST /reports`, `POST /reports/{id}/images`, `GET /reports/track/{tracking_id}`, `GET /reports/{id}` |
| Maps    | `GET /maps/reverse`, `GET /maps/search` |
