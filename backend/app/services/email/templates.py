"""Polished HTML email templates (self-contained, inline-styled)."""

from __future__ import annotations

_PRIMARY = "#091426"
_ACCENT = "#4648d4"


def _layout(title: str, body_html: str) -> str:
    return f"""\
<!doctype html>
<html><body style="margin:0;background:#f7f9fb;font-family:Inter,Arial,sans-serif;color:#191c1e;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:{_PRIMARY};color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">Aasrah</span>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px;">
      <h1 style="font-size:20px;margin:0 0 12px;color:{_PRIMARY};">{title}</h1>
      {body_html}
    </div>
    <p style="text-align:center;color:#75777d;font-size:12px;margin-top:16px;">
      Aasrah Humanitarian Response Platform
    </p>
  </div>
</body></html>"""


def _button(label: str, url: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:{_ACCENT};color:#fff;'
        f'text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;margin-top:8px;">{label}</a>'
    )


# Each builder returns (subject, html, text).

def welcome(name: str) -> tuple[str, str, str]:
    subject = "Welcome to Aasrah"
    html = _layout("Welcome aboard", f"""
      <p>Hi {name},</p>
      <p>Thanks for joining Aasrah. Together we make sure no call for help goes unanswered.</p>
      {_button("Go to Aasrah", "https://aasrah.org")}
    """)
    return subject, html, f"Hi {name}, welcome to Aasrah."


def password_reset(name: str, reset_url: str) -> tuple[str, str, str]:
    subject = "Reset your Aasrah password"
    html = _layout("Reset your password", f"""
      <p>Hi {name},</p>
      <p>We received a request to reset your password. This link expires shortly.</p>
      {_button("Reset password", reset_url)}
      <p style="color:#75777d;font-size:13px;margin-top:16px;">If you didn't request this, you can ignore this email.</p>
    """)
    return subject, html, f"Reset your password: {reset_url}"


def ngo_approved(name: str, org: str) -> tuple[str, str, str]:
    subject = "Your NGO has been verified"
    html = _layout("Organization verified", f"""
      <p>Hi {name},</p>
      <p><strong>{org}</strong> has been verified. You can now claim reports and coordinate rescues.</p>
      {_button("Open the NGO portal", "https://aasrah.org/portal")}
    """)
    return subject, html, f"{org} has been verified."


def volunteer_approved(name: str) -> tuple[str, str, str]:
    subject = "You're an approved Aasrah volunteer"
    html = _layout("Volunteer approved", f"""
      <p>Hi {name},</p>
      <p>You're approved. Assignments will appear in your volunteer dashboard.</p>
      {_button("Open the volunteer portal", "https://aasrah.org/volunteer-portal")}
    """)
    return subject, html, f"Hi {name}, you're an approved volunteer."


def report_confirmation(tracking_id: str) -> tuple[str, str, str]:
    subject = f"Report received: {tracking_id}"
    html = _layout("Report received", f"""
      <p>Thank you for your report. Keep this reference to track its progress:</p>
      <p style="font-size:22px;font-weight:700;color:{_PRIMARY};">{tracking_id}</p>
      {_button("Track this report", f"https://aasrah.org/track")}
    """)
    return subject, html, f"Report received. Tracking ID: {tracking_id}"


def assignment_notification(name: str, tracking_id: str) -> tuple[str, str, str]:
    subject = f"New rescue assignment: {tracking_id}"
    html = _layout("New assignment", f"""
      <p>Hi {name},</p>
      <p>You've been assigned to case <strong>{tracking_id}</strong>.</p>
      {_button("View assignment", "https://aasrah.org/volunteer-portal/assignments")}
    """)
    return subject, html, f"New assignment: {tracking_id}"


def case_completion(tracking_id: str) -> tuple[str, str, str]:
    subject = f"Rescue completed: {tracking_id}"
    html = _layout("Rescue completed", f"""
      <p>Case <strong>{tracking_id}</strong> has been resolved. Thank you to everyone involved.</p>
      {_button("View case", "https://aasrah.org/track")}
    """)
    return subject, html, f"Rescue completed: {tracking_id}"


def weekly_summary(name: str, claimed: int, completed: int) -> tuple[str, str, str]:
    subject = "Your weekly Aasrah summary"
    html = _layout("Weekly summary", f"""
      <p>Hi {name},</p>
      <p>This week your organization claimed <strong>{claimed}</strong> cases and
         completed <strong>{completed}</strong> rescues.</p>
      {_button("Open analytics", "https://aasrah.org/portal/analytics")}
    """)
    return subject, html, f"This week: {claimed} claimed, {completed} completed."
