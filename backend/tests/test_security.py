"""Regression tests for previously-open access paths.

Each test here corresponds to a hole that was live in a deployed build. They
assert the *absence* of an exposure, so they look trivial — that is the point:
none of these paths had any test at all, which is how they shipped.
"""

import asyncio

from app.core.config import Settings
from app.core.observability import _route_label
from app.services.realtime import EventBus


def test_metrics_requires_admin(client):
    """/metrics sits outside API_V1_PREFIX and inherits no router guard.

    It exposes the route table and per-route request/error counts.
    """
    assert client.get("/metrics").status_code in (401, 403)


def test_debug_defaults_off():
    """DEBUG must default off.

    Reads the declared field default rather than the loaded settings, so a
    developer's local .env cannot mask a regression here.
    """
    assert Settings.model_fields["DEBUG"].default is False


def test_route_label_never_echoes_a_concrete_path():
    """Metrics keys must be route templates.

    Falling back to the concrete path put live tracking IDs and report UUIDs
    into /metrics, and grew the registry without bound.
    """

    class FakeRequest:
        scope: dict = {}

    assert _route_label(FakeRequest()) == "__unmatched__"


def test_case_events_are_scoped_to_staff_roles():
    """A volunteer socket must not receive report events.

    Report creation previously went out via broadcast() carrying the tracking
    ID, so any authenticated account — including an unapproved volunteer —
    received an identifier that resolved to a person's location.
    """

    async def check() -> None:
        bus = EventBus()
        volunteer_q = await bus.subscribe("vol-1", role="volunteer")
        ngo_q = await bus.subscribe("ngo-1", role="ngo")

        bus.publish_to_roles(("ngo", "admin"), "report_created", {})
        await asyncio.sleep(0.01)

        assert volunteer_q.empty(), "volunteer must not receive case events"
        assert not ngo_q.empty(), "NGO should receive the refresh signal"
        # The signal must carry no case content of any kind.
        assert ngo_q.get_nowait() == {"type": "report_created", "payload": {}}

    asyncio.run(check())


def test_data_rights_endpoints_are_mounted(client):
    """The DPDP export/erasure routes must exist on the real application.

    Their own test module mounts the router itself if absent, so it would keep
    passing even if the router were never registered in app/api/v1/router.py —
    while the deployed app 404s and the privacy policy promises a right that
    cannot be exercised. This asserts against the app as assembled.
    """
    paths = {r.path for r in client.app.routes}
    assert "/api/v1/me/export" in paths
    assert "/api/v1/me" in paths
