"""In-process background job runner.

A lightweight asyncio-based worker pool for offloading slow work (AI inference,
notification delivery, summaries) off the request path. Jobs run in a thread
pool (they're sync, DB-bound), with retry + backoff and in-memory observability.
For a multi-process deployment this would be swapped for Celery/RQ behind the
same `enqueue` interface.
"""

from __future__ import annotations

import asyncio
import traceback
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable

from app.core.logging import get_logger

logger = get_logger(__name__)


class JobState(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    name: str
    func: Callable[..., Any]
    args: tuple
    kwargs: dict
    max_retries: int = 2
    attempts: int = 0
    state: JobState = JobState.QUEUED
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime | None = None


class JobRunner:
    def __init__(self, *, workers: int = 2, history: int = 200):
        self._queue: asyncio.Queue[Job] = asyncio.Queue()
        self._workers: list[asyncio.Task] = []
        self._n_workers = workers
        self._history: deque[Job] = deque(maxlen=history)
        self._running = False
        # When the pool isn't running, run jobs inline. Disabled in tests where
        # jobs would otherwise open the real (non-test) DB session.
        self.inline_when_stopped = True

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._workers = [asyncio.create_task(self._worker(i)) for i in range(self._n_workers)]
        logger.info("Job runner started with %d workers", self._n_workers)

    async def stop(self) -> None:
        self._running = False
        for w in self._workers:
            w.cancel()
        self._workers = []

    def enqueue(self, name: str, func: Callable[..., Any], *args, max_retries: int = 2, **kwargs) -> str:
        job = Job(id=uuid.uuid4().hex, name=name, func=func, args=args, kwargs=kwargs, max_retries=max_retries)
        self._history.append(job)
        if not self._running:
            if not self.inline_when_stopped:
                # Recorded but not executed (e.g. under tests).
                return job.id
            # No worker pool (scripts / disabled): run inline, best-effort,
            # so enqueued work still happens instead of silently vanishing.
            try:
                func(*args, **kwargs)
                job.state = JobState.SUCCEEDED
            except Exception:  # noqa: BLE001
                job.state = JobState.FAILED
                job.error = traceback.format_exc(limit=4)
                logger.warning("Inline job %s (%s) failed", job.id, name)
            return job.id
        self._queue.put_nowait(job)
        return job.id

    async def _worker(self, idx: int) -> None:
        while self._running:
            try:
                job = await self._queue.get()
            except asyncio.CancelledError:
                return
            await self._run_job(job)
            self._queue.task_done()

    async def _run_job(self, job: Job) -> None:
        while job.attempts <= job.max_retries:
            job.attempts += 1
            job.state = JobState.RUNNING
            try:
                # Jobs are synchronous (DB/CPU/IO); run them off the event loop.
                await asyncio.to_thread(job.func, *job.args, **job.kwargs)
                job.state = JobState.SUCCEEDED
                job.finished_at = datetime.now(timezone.utc)
                return
            except Exception:  # noqa: BLE001
                job.error = traceback.format_exc(limit=4)
                logger.warning("Job %s (%s) attempt %d failed", job.id, job.name, job.attempts)
                if job.attempts > job.max_retries:
                    job.state = JobState.FAILED
                    job.finished_at = datetime.now(timezone.utc)
                    logger.error("Job %s (%s) permanently failed", job.id, job.name)
                    return
                # Exponential backoff before retry.
                await asyncio.sleep(min(2 ** job.attempts, 30))

    def stats(self) -> dict:
        counts: dict[str, int] = {}
        for j in self._history:
            counts[j.state.value] = counts.get(j.state.value, 0) + 1
        return {
            "queued": self._queue.qsize(),
            "workers": self._n_workers,
            "history_counts": counts,
            "recent": [
                {"name": j.name, "state": j.state.value, "attempts": j.attempts}
                for j in list(self._history)[-10:]
            ],
        }


# Module-level singleton.
runner = JobRunner()
