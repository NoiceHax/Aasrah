# Aasrah: Engineering Write-up

A candid account of *why* Aasrah is built the way it is: the problem, the
hardest engineering challenges, the decisions and trade-offs behind them, and
what I'd do next. Pairs with the technical [ARCHITECTURE.md](ARCHITECTURE.md).

## The problem

Humanitarian response is often coordinated over spreadsheets, phone calls, and
group chats. That fragmentation costs time when minutes matter: reports get
lost, two NGOs duplicate effort on the same person, volunteers aren't matched to
the nearest case, and citizens who report have no idea whether help is coming.

Aasrah models the whole rescue lifecycle as first-class software:
**report → verify → claim → assign → rescue → close**, with four roles
(Citizen, NGO, Volunteer, Admin), real-time coordination, and AI-assisted triage
that speeds up human judgment without ever replacing it.

## Scope at a glance

| | |
|---|---|
| User roles | 4 (Citizen, NGO, Volunteer, Admin) |
| Backend API routes | 79 across a versioned `/api/v1` surface |
| Frontend routes | 40 (public site + 3 role portals + auth) |
| Database tables | 16, UUID PKs, native enums, indexes + FKs |
| Backend tests | 24 (auth, reporting, full rescue lifecycle, admin, units) |
| Real-time | Authenticated WebSocket + in-process pub/sub bus |
| AI | Vision + text (NVIDIA NIM) with an offline heuristic fallback |
| Delivered in | 5 phases + polish milestones |

## Engineering challenges (and how I solved them)

### 1. AI that works with *and* without a provider
AI features shouldn't hard-fail when a key is missing or a call times out, but
they should be genuinely useful when one is present. I put all inference behind
an `AIProvider` interface with two implementations: a NVIDIA NIM client
(OpenAI-compatible) and a **heuristic fallback** that derives summaries,
analysis flags, and search filters from the report's own structured fields and
keyword rules. Any error, timeout, or missing key silently degrades to the
heuristic. Result: the platform is fully demonstrable offline, and upgrades to
live AI by setting one env var. Vision and text use separate, individually
optimal models.

### 2. Keeping AI advisory, not authoritative
For a humanitarian tool, an AI that silently decides priority or flags injuries
is dangerous. Every AI output is stored as a *suggestion*: NGO staff can toggle
any observation, and overriding the auto-priority sets `priority_auto = false`
so the scoring engine never clobbers a human's call. The UI labels the source
(AI / Heuristic / Reviewed) so trust is explicit.

### 3. Concurrency on claims and assignments
Two NGOs must never claim the same report; a double-submit must not double-count
a rescue or fire duplicate notifications. I used Postgres row locking
(`SELECT … FOR UPDATE`) on the claim and assignment-transition paths so the
second transaction blocks, then fails the status guard cleanly; the database is
the lock authority. An adversarial review caught that the volunteer-completion
path *lacked* this lock; it's now consistent across both services.

### 4. An adversarial review that found 13 real bugs
After building the volunteer + admin phase, I ran a multi-agent review across
authorization, correctness, and data-exposure dimensions, then verified each
finding against the code. It surfaced **13 confirmed defects** (all fixed),
including: a WebSocket auth path that didn't check `is_active` (suspended users
kept a live stream), reporter PII leaking on unclaimed-report detail views, a
completion path that skipped metric bookkeeping, an analytics bucketing bug that
fabricated counts, and a client reconnect loop on an expired token. The lesson:
building fast is cheap; *verifying* is where quality comes from, so verification
became a first-class step, not an afterthought.

### 5. Backend-portable models for fast, hermetic tests
The models used Postgres-specific types (`gen_random_uuid()`, `JSONB`), which
made the test suite depend on a real database. I made the models
backend-portable (a Python-side UUID default alongside the server default, and
a `JSONType` that is `JSONB` on Postgres and plain `JSON` elsewhere) so tests
run against in-memory/file SQLite in seconds. This also fixed a latent bug:
`db.get(Model, "<uuid-string>")` worked on psycopg but broke on SQLite, so the
repository now coerces string IDs to `UUID` for *all* backends.

### 6. Background work without a message broker
Phase 5 needed async processing (AI inference, email, push) and scheduled
automation, but adding Redis/Celery to a portfolio project is over-engineering
until it's actually needed. I built an in-process asyncio worker pool with retry
+ backoff and an observable job history, plus a scheduler loop, all behind an
`enqueue()` interface that maps cleanly onto Celery/RQ later. A subtle bug: the
runner kept the test client's lifespan alive (hanging pytest), and running jobs
inline in tests opened the *real* database session. Fixed with explicit modes:
worker-pool in production, inline in scripts, record-only in tests.

### 7. Isolating the app on a shared database
The provided database URL pointed at a Neon instance already hosting an
unrelated app (with a conflicting `users` table). Rather than risk a collision,
the app reads a dedicated `AASRAH_DATABASE_URL` that intentionally overrides any
generic `DATABASE_URL` in the environment, and normalizes the driver to psycopg
v3. A small config decision that prevented a real data-integrity hazard.

### 8. Faithful screenshots of an animated UI
Capturing the marketing site with Playwright produced blank below-the-fold
sections: Framer Motion's `whileInView` reveals stay at `opacity: 0` until
scrolled into view, and a full-page screenshot never scrolls. The capture script
now scrolls through the page to trigger every reveal before shooting, so the
portfolio images show the real, fully-rendered product.

## Key decisions & trade-offs

- **In-process bus/jobs over Redis/Celery**: zero-infra simplicity now, with a
  clean interface for a later swap. Trade-off: single-process fan-out until Redis
  is introduced (documented in the scaling section).
- **Heuristic AI fallback over a hard AI dependency**: the product always works
  and demos offline. Trade-off: lower-quality output until a key is set.
- **SQLite in tests, Postgres in production**: fast hermetic tests; required
  backend-portable models. A couple of Postgres-specific behaviors (row-lock
  semantics) are covered by live end-to-end runs rather than unit tests.
- **Layered architecture (routers → services → repositories → ORM)**: more
  files, but business logic is testable in isolation and routers stay thin.
- **Two AI models over one omni model**: a dedicated high-reliability text model
  improves summaries and query parsing; cost is one extra model id to manage.

## Performance & operational notes

- Report AI processing runs off the request path: `POST /reports` returns a
  tracking ID immediately (201) and enqueues summary + analysis + scoring, so
  submission latency is unaffected by inference time.
- Nearby-report discovery pre-filters with a lat/lon bounding box before the
  exact haversine pass, keeping the geo query index-friendly.
- Request latency and error rates are tracked per route template in-process and
  exposed at `/metrics` and the admin monitoring dashboard.
- The frontend ships as a Next.js standalone build and an installable PWA with
  offline app-shell caching.

## Lessons learned

1. **Verification is a feature.** The adversarial review paid for itself many
   times over; I now treat "build" and "prove it works" as separate, mandatory steps.
2. **Design for the missing dependency.** Interfaces with graceful fallbacks
   (AI, email, push, storage) made the system demonstrable and deployable in
   stages instead of all-or-nothing.
3. **Portability is a testing strategy.** Making the ORM backend-agnostic didn't
   just speed up tests; it exposed a real cross-database bug.
4. **The database is the source of truth for concurrency.** Row locks beat
   application-level coordination for claim contention, and they scale with
   replicas for free.

## Future roadmap

Redis (multi-replica real-time, distributed locks, response cache) · PostGIS for
accurate geo + heatmap tiles · vector embeddings for semantic search and smarter
dedup · cloud object storage + CDN · Celery/RQ workers with a dashboard · a
React Native app reusing the same API/WS/push. See
[ARCHITECTURE.md](ARCHITECTURE.md#future-roadmap).
