"""In-process real-time event bus + per-user WebSocket fan-out.

A single-process pub/sub: each connected client gets an asyncio.Queue, and
events are published by user id (or broadcast). For multi-process deployments
this would be swapped for Redis pub/sub behind the same `publish` interface.
"""

from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from typing import Any, Iterable


class EventBus:
    def __init__(self) -> None:
        # user_id -> set of subscriber queues
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # user_id -> role, captured at connect time so events can be delivered
        # to an audience rather than to everyone. Without this, the only
        # fan-out primitive is broadcast(), and any authenticated account —
        # including a self-registered, never-approved volunteer — receives
        # every event on the platform.
        self._roles: dict[str, str] = {}
        # The event loop that owns the subscriber queues. Publishers may run in
        # a threadpool (FastAPI runs sync endpoints off the loop), so puts must
        # be marshalled back onto this loop with call_soon_threadsafe; a bare
        # put_nowait from another thread does not wake the awaiting consumer.
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = asyncio.Lock()

    async def subscribe(self, user_id: str, role: str | None = None) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._loop = asyncio.get_running_loop()
        async with self._lock:
            self._subscribers[user_id].add(q)
            if role is not None:
                self._roles[user_id] = role
        return q

    async def unsubscribe(self, user_id: str, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subscribers[user_id].discard(q)
            if not self._subscribers[user_id]:
                self._subscribers.pop(user_id, None)
                self._roles.pop(user_id, None)

    def _deliver(self, queues: list[asyncio.Queue], message: dict[str, Any]) -> None:
        def _put(q: asyncio.Queue) -> None:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass  # drop for slow consumers; client refetches on reconnect

        loop = self._loop
        for q in queues:
            if loop is not None and loop.is_running():
                # Marshal onto the loop thread so the awaiting consumer wakes.
                loop.call_soon_threadsafe(_put, q)
            else:
                _put(q)

    def publish(self, user_id: uuid.UUID | str, event_type: str, payload: dict[str, Any]) -> None:
        """Enqueue an event for a specific user's live connections (non-blocking)."""
        key = str(user_id)
        self._deliver(list(self._subscribers.get(key, ())), {"type": event_type, "payload": payload})

    def publish_to_roles(
        self, roles: Iterable[str], event_type: str, payload: dict[str, Any]
    ) -> None:
        """Enqueue an event for every connected user holding one of `roles`.

        Prefer this over `broadcast` for anything case-related: it bounds the
        audience to staff who are entitled to act on the event.
        """
        wanted = {str(r) for r in roles}
        queues = [
            q
            for uid, subs in list(self._subscribers.items())
            if self._roles.get(uid) in wanted
            for q in subs
        ]
        self._deliver(queues, {"type": event_type, "payload": payload})

    def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        """Send an event to every connected user.

        Reserved for genuinely platform-wide notices (e.g. admin
        announcements). Never use it to carry case data: every authenticated
        socket receives it, whatever the account's role or approval state.
        """
        queues = [q for subs in list(self._subscribers.values()) for q in subs]
        self._deliver(queues, {"type": event_type, "payload": payload})

    @property
    def connection_count(self) -> int:
        return sum(len(s) for s in self._subscribers.values())


# Module-level singleton.
bus = EventBus()
