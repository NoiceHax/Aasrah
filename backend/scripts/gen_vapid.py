"""Generate a VAPID keypair for Web Push.

Usage: python -m scripts.gen_vapid
Copy the printed keys into backend/.env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
and expose the PUBLIC key to the frontend as NEXT_PUBLIC_VAPID_PUBLIC_KEY.
"""

from __future__ import annotations

from py_vapid import Vapid01


def main() -> None:
    vapid = Vapid01()
    vapid.generate_keys()
    # Application-server keys in the URL-safe base64 form browsers expect.
    private_key = vapid.private_pem().decode()
    public_key = vapid.public_key_urlsafe_base64()  # type: ignore[attr-defined]

    print("VAPID_PUBLIC_KEY (also set NEXT_PUBLIC_VAPID_PUBLIC_KEY in frontend):")
    print(public_key)
    print("\nVAPID_PRIVATE_KEY (PEM; keep secret, backend/.env only):")
    print(private_key)


if __name__ == "__main__":
    main()
