"""Email delivery via SMTP, with a preview-log fallback when unconfigured.

`send_email` is synchronous and intended to run via the background job runner.
When SMTP_HOST is unset, the message is logged (preview) rather than sent, so
the platform works end-to-end in development without credentials.
"""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("aasrah.email")


def send_email(to: str, subject: str, html: str, text: str) -> bool:
    """Send (or preview) an email. Returns True if dispatched/previewed."""
    if not settings.smtp_enabled:
        logger.info("[EMAIL PREVIEW] to=%s subject=%r\n%s", to, subject, text)
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.send_message(msg)
        logger.info("Email sent to %s (%r)", to, subject)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send email to %s", to)
        return False


def queue_email(to: str, built: tuple[str, str, str]) -> None:
    """Enqueue an email (built = (subject, html, text)) on the job runner."""
    from app.services.jobs import runner

    subject, html, text = built
    runner.enqueue("email.send", send_email, to, subject, html, text)
