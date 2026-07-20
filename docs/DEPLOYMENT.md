# Deployment Guide

Aasrah is deployment-ready. This guide covers the current split
(frontend on Vercel, backend on EC2 behind Caddy, Postgres on Neon), plus
environment, migrations, monitoring, and rollback. All external integrations are
**optional** and dormant until you provide credentials; deploy first, enable them later.

- [Topology](#topology)
- [Backend: EC2](#backend-ec2)
- [Frontend: Vercel](#frontend-vercel)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Optional integrations](#optional-integrations)
- [Monitoring](#monitoring)
- [CI/CD](#cicd)
- [Rollback strategy](#rollback-strategy)
- [Alternatives](#alternatives)

## Topology

```
Vercel (Next.js)  ──HTTPS/WSS──▶  EC2: Caddy (TLS) ──▶ FastAPI container
                                          │
                                          ▼
                                     Neon Postgres
```

- **Frontend:** Vercel, native Next.js support, preview deployments per PR, CDN, HTTPS.
- **Backend:** EC2 instance running `backend/Dockerfile` behind Caddy, which fetches a Let's Encrypt cert automatically.
- **Database:** Neon Postgres.
- **Storage:** local disk by default (behind `StorageBackend`); swap to S3/Cloudinary for production persistence (see [Alternatives](#alternatives)).

## Backend: EC2

Deploys are driven by `backend/deploy/ec2-run.sh`, which builds the image, runs
it on an internal Docker network, and puts Caddy in front for HTTPS.

1. Run `backend/deploy/ec2-setup.sh` once (installs Docker).
2. Create `/home/ec2-user/aasrah.env` with your values. Write them **unquoted**:
   `docker --env-file` does no shell parsing, so quotes become part of the value.
3. Ensure the security group allows inbound **80 and 443** (80 is required for
   Let's Encrypt's challenge, not just redirects).
4. Run `backend/deploy/ec2-run.sh`. Redeploy by rerunning it after `git pull`.
5. Health check: `https://<API_HOST>/api/v1/health`.

The public hostname defaults to a [nip.io](https://nip.io) wildcard resolving to
the instance's public IP, so no domain purchase is needed. `API_HOST` in
`ec2-run.sh` must match the instance's current public IP with dots replaced by
dashes (e.g. `3-109-144-164.nip.io`).

> The instance has **no Elastic IP**, so its public IP changes on stop/start.
> When that happens the nip.io hostname changes too, which breaks the TLS cert,
> `API_HOST`, and both Vercel env vars. Allocate an Elastic IP to avoid this.

Migrations are not run by the deploy script; apply them explicitly on release:
```bash
docker exec aasrah-backend python -m scripts.init_db
```

## Frontend: Vercel

1. In Vercel: **New Project** → import the repo → set **Root Directory** to `frontend`.
2. Framework auto-detects as Next.js (`frontend/vercel.json` pins build settings + headers).
3. Set the two public env vars (below) to your deployed backend URL.
4. Deploy. PRs get automatic **preview deployments**.

> `NEXT_PUBLIC_*` are baked at build time; a change requires a rebuild.

## Environment variables

**Backend** (`/home/ec2-user/aasrah.env` on the instance / `backend/.env` locally):

| Variable | Required | Notes |
|----------|----------|-------|
| `AASRAH_DATABASE_URL` | ✅ | Neon Postgres URL |
| `SECRET_KEY` | ✅ | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `ENVIRONMENT` | ✅ | `production` (enables HSTS, hides `/docs`, suppresses reset-token echo) |
| `DEBUG` | ✅ | `false`. Defaults to `false`, but set it explicitly so it is never inherited from a stray shell/`.env` value. |
| `CORS_ORIGINS` | ✅ | Your frontend origin(s), comma-separated, **unquoted**, scheme included, no trailing slash (e.g. `https://aasrah.vercel.app`). A mismatch here is rejected before routing and surfaces in the browser as a generic network failure. The effective list is logged at startup. |
| `NVIDIA_API_KEY` | optional | Enables live AI (heuristic fallback otherwise) |
| `SMTP_*` | optional | Enables email (preview-log otherwise) |
| `VAPID_*` | optional | Enables web push (`python -m scripts.gen_vapid`) |
| `SENTRY_DSN` | optional | Enables error tracking |

**Frontend** (Vercel):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<backend-host>/api/v1` |
| `NEXT_PUBLIC_API_ORIGIN` | `https://<backend-host>` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (only if web push is enabled) |

## Database migrations

Alembic manages the schema. The EC2 deploy script does not apply migrations, so
run them explicitly on release:
```bash
cd backend
python -m alembic upgrade head     # apply
python -m alembic downgrade -1     # roll back one revision
python -m scripts.init_db          # convenience wrapper (upgrade head)
python -m scripts.seed             # admin + placeholder NGOs (first deploy only)
```

## Optional integrations

Each is off until configured; the platform runs fully without them:

- **AI (NVIDIA NIM):** set `NVIDIA_API_KEY`. Analysis/summaries/search switch from
  heuristic to live inference. Vision/text model IDs are configurable.
- **Email (SMTP):** set `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`.
  Unset → emails are rendered and logged as previews.
- **Web Push (VAPID):** `python -m scripts.gen_vapid`, paste keys into the backend
  env, set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on the frontend.
- **Sentry:** set `SENTRY_DSN` (`sentry-sdk` is already in requirements).

## Monitoring

- **Health:** `GET /api/v1/health` and `/api/v1/health/db` (readiness).
- **Metrics:** `GET /metrics` (per-route request counts, error counts, avg latency)
  and the in-app admin **Monitoring** dashboard (`/admin/monitoring`), which includes
  background job stats.
- **Request tracing:** every response carries `X-Request-ID` and `X-Response-Time-ms`;
  structured logs include the request id.
- **Error tracking:** Sentry when `SENTRY_DSN` is set.
- **Uptime:** point an external uptime monitor at `/api/v1/health`.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR:
- **Backend:** install → lint → `pytest`.
- **Frontend:** install → `eslint` → `next build`.

Vercel auto-deploys on push to `main` and builds previews on PRs. The EC2
backend is deployed manually by rerunning `backend/deploy/ec2-run.sh`.

## Rollback strategy

- **Frontend (Vercel):** every deploy is immutable and versioned; use
  **Instant Rollback** to promote the previous deployment (seconds, no rebuild).
- **Backend (EC2):** `git checkout <previous-sha>` on the instance and rerun
  `ec2-run.sh`. Because migrations are additive, prefer forward-fixes; for a
  schema rollback run `alembic downgrade <rev>` against the database **before**
  starting the older image.
- **Database:** enable Neon's point-in-time recovery / daily backups before
  going live.
- **Config:** env changes are versioned in each platform's dashboard and can be
  reverted independently of code.

## Alternatives

- **Backend host:** Railway, Fly.io, or DigitalOcean App Platform all run the
  same `backend/Dockerfile`; adjust the health-check path to `/api/v1/health`.
- **Full stack in one place:** `docker compose up --build` (root
  `docker-compose.yml`) runs Postgres + backend + frontend together, good for a
  single VPS or a demo box.
- **Object storage:** implement an S3/Cloudinary `StorageBackend` and switch the
  `get_storage()` factory; no call-site changes needed.
- **Scale-out:** introduce Redis for the real-time bus, distributed locks, and a
  response cache, and move background jobs to Celery/RQ (see
  [ARCHITECTURE.md](ARCHITECTURE.md#scaling-strategy)).
