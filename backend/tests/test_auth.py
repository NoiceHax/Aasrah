"""Authentication tests."""

from tests.conftest import auth_header, register


def test_register_creates_pending_volunteer(client):
    data = register(client, "alice@example.com")
    assert data["user"]["email"] == "alice@example.com"
    # Public registration always yields a VOLUNTEER (role not client-selectable).
    assert data["user"]["role"] == "volunteer"
    assert data["tokens"]["access_token"]
    assert data["tokens"]["refresh_token"]

    # The new volunteer is pending approval and cannot yet act on the portal.
    header = auth_header(data)
    profile = client.get("/api/v1/volunteer/profile", headers=header)
    assert profile.status_code == 200
    assert profile.json()["status"] == "pending"


def test_register_ignores_client_supplied_role(client):
    # Even if a client tries to self-assign admin, the account is a volunteer.
    resp = client.post("/api/v1/auth/register", json={
        "email": "sneaky@example.com", "password": "Secret123!",
        "full_name": "Sneaky", "role": "admin",
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["user"]["role"] == "volunteer"


def test_register_duplicate_email_conflicts(client):
    register(client, "bob@example.com")
    resp = client.post("/api/v1/auth/register", json={
        "email": "bob@example.com", "password": "Secret123!",
    })
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "email_taken"


def test_login_success_and_wrong_password(client):
    register(client, "carol@example.com", password="Secret123!")
    ok = client.post("/api/v1/auth/login", json={"email": "carol@example.com", "password": "Secret123!"})
    assert ok.status_code == 200
    assert ok.json()["tokens"]["access_token"]

    bad = client.post("/api/v1/auth/login", json={"email": "carol@example.com", "password": "WRONG"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401

    data = register(client, "dave@example.com")
    me = client.get("/api/v1/auth/me", headers=auth_header(data))
    assert me.status_code == 200
    assert me.json()["email"] == "dave@example.com"


def test_refresh_rotates_token(client):
    data = register(client, "erin@example.com")
    refresh = data["tokens"]["refresh_token"]
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 200
    assert resp.json()["access_token"]
    # Old refresh token is now revoked (rotation).
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert again.status_code == 401
