"""WebSocket endpoint for real-time per-user events."""

from __future__ import annotations

import asyncio

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.db.session import get_db
from app.repositories.user import UserRepository
from app.services.realtime import bus

router = APIRouter(tags=["realtime"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = "") -> None:
    """Authenticated event stream. Client connects with ?token=<access_token>.

    The server pushes JSON messages: {"type": "...", "payload": {...}}.
    """
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        user_id = payload["sub"]
    except (jwt.PyJWTError, ValueError, KeyError):
        await websocket.close(code=4401)
        return

    # Enforce account status at connect time, mirroring get_current_user: a
    # still-valid token for a suspended/deleted account must not get a stream.
    db_gen = get_db()
    db = next(db_gen)
    try:
        account = UserRepository(db).get(user_id)
    finally:
        db_gen.close()
    if account is None or not account.is_active:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    queue = await bus.subscribe(user_id)
    await websocket.send_json({"type": "connected", "payload": {"user_id": user_id}})

    try:
        while True:
            # Race the outbound queue against client pings/closes.
            recv_task = asyncio.ensure_future(websocket.receive_text())
            send_task = asyncio.ensure_future(queue.get())
            done, pending = await asyncio.wait(
                {recv_task, send_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            if send_task in done:
                message = send_task.result()
                await websocket.send_json(message)
            if recv_task in done:
                # We don't process inbound messages beyond keep-alive; a result
                # here just means the client sent something (e.g. a ping).
                recv_task.result()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await bus.unsubscribe(user_id, queue)
