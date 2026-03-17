"""
Email utilities for sending notifications
"""
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Tuple
import logging

from core.config import settings

logger = logging.getLogger(__name__)


def send_email_sync(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    attachments: Optional[List[Tuple[str, bytes, str]]] = None,
) -> bool:
    """
    Send email via SMTP.
    attachments: list of (filename, file_bytes, mime_type)
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured. Skipping email send.")
        return False

    try:
        if attachments:
            msg = MIMEMultipart("mixed")
        else:
            msg = MIMEMultipart("alternative")

        msg["Subject"] = subject
        from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        msg["From"] = from_addr
        msg["To"] = to_email

        if attachments:
            body_part = MIMEMultipart("alternative")
            if body_text:
                body_part.attach(MIMEText(body_text, "plain"))
            body_part.attach(MIMEText(body_html, "html"))
            msg.attach(body_part)
            for filename, file_bytes, mime_type in attachments:
                part = MIMEBase(mime_type.split("/")[0], mime_type.split("/")[1])
                part.set_payload(file_bytes)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", "attachment", filename=filename)
                msg.attach(part)
        else:
            if body_text:
                msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

        def _send_via_ssl():
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_addr, to_email, msg.as_string())

        def _send_via_starttls():
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_addr, to_email, msg.as_string())

        if getattr(settings, "SMTP_USE_SSL", False) or settings.SMTP_PORT == 465:
            try:
                _send_via_ssl()
            except (smtplib.SMTPException, OSError) as e:
                # Fallback to 587/STARTTLS (e.g. send.one.com supports both)
                if settings.SMTP_HOST in ("send.one.com", "smtp.gmail.com", "smtp.office365.com"):
                    logger.warning(f"SSL/465 failed ({e}), trying 587/STARTTLS...")
                    try:
                        with smtplib.SMTP(settings.SMTP_HOST, 587) as server:
                            server.starttls()
                            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                            server.sendmail(from_addr, to_email, msg.as_string())
                    except Exception:
                        raise
                else:
                    raise
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_addr, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.exception(
            f"Failed to send email to {to_email}: {e} "
            f"(SMTP_HOST={getattr(settings, 'SMTP_HOST', '?')}). "
            "If getaddrinfo failed: check DNS/network, try 'ping send.one.com', or use port 587 in .env"
        )
        return False


def send_new_user_set_password(
    to_email: str,
    username: str,
    first_name: str,
    set_password_url: str,
) -> bool:
    """Send new user welcome email with username and set-password link."""
    subject = "Your LeaveHub Employee Portal - Set Your Password"
    body_text = f"""
Hello {first_name},

Your LeaveHub employee account has been created.

Username: {username}

Please set your password and access the portal by clicking the link below:
{set_password_url}

This link is valid for 7 days.

Best regards,
LeaveHub Team
"""
    body_html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
  .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
  .card {{ background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }}
  .btn {{ display: inline-block; padding: 14px 28px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: 600; }}
  .username {{ font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 4px; display: inline-block; }}
  .note {{ color: #6b7280; font-size: 14px; margin-top: 16px; }}
</style></head>
<body>
<div class="container">
  <h2>Welcome to LeaveHub</h2>
  <p>Hello {first_name},</p>
  <p>Your employee portal account has been created.</p>
  <div class="card">
    <p><strong>Username:</strong> <span class="username">{username}</span></p>
    <p>Click the button below to set your password and access your dashboard:</p>
    <a href="{set_password_url}" class="btn">Set Password &amp; Access Portal</a>
    <p class="note">This link is valid for 7 days.</p>
  </div>
  <p>Best regards,<br>LeaveHub Team</p>
</div>
</body>
</html>
"""
    return send_email(to_email, subject, body_html, body_text)


def send_new_user_credentials(
    to_email: str,
    username: str,
    password: str,
    first_name: str,
    login_url: str = "http://localhost:5174/login",
) -> bool:
    """Send new user credentials to employee email."""
    subject = "Your LeaveHub Account"
    body_text = f"""
Hello {first_name},

Your LeaveHub account has been created.

Username: {username}
Password: {password}

Please log in at: {login_url}
We recommend changing your password after first login.

Best regards,
LeaveHub Team
"""
    body_html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
  .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
  .card {{ background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }}
  .credentials {{ background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }}
  .label {{ font-weight: 600; color: #6b7280; }}
  .value {{ font-family: monospace; }}
  .btn {{ display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px; }}
  .warning {{ color: #92400e; font-size: 14px; margin-top: 16px; }}
</style></head>
<body>
<div class="container">
  <h2>Welcome to LeaveHub</h2>
  <p>Hello {first_name},</p>
  <p>Your LeaveHub account has been created.</p>
  <div class="card">
    <div class="credentials">
      <p><span class="label">Username:</span> <span class="value">{username}</span></p>
      <p><span class="label">Password:</span> <span class="value">{password}</span></p>
    </div>
    <a href="{login_url}" class="btn">Log in to LeaveHub</a>
    <p class="warning">We recommend changing your password after your first login.</p>
  </div>
  <p>Best regards,<br>LeaveHub Team</p>
</div>
</body>
</html>
"""
    return send_email(to_email, subject, body_html, body_text)


def send_letter_email(
    to_email: str,
    employee_name: str,
    letter_type: str,
    title: str,
    content: str,
) -> bool:
    """Send HR letter to employee's email as PDF attachment."""
    from core.pdf_letter import generate_letter_pdf

    subject = f"Your {letter_type.replace('_', ' ').title()} Letter - {title}"
    body_text = f"""
Dear {employee_name},

Please find your {letter_type.replace('_', ' ')} letter attached as a PDF file.

Best regards,
LeaveHub HR Team
"""
    body_html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #111827; }}
  .container {{ max-width: 600px; margin: 0 auto; padding: 24px; }}
</style></head>
<body>
<div class="container">
  <p>Dear {employee_name},</p>
  <p>Please find your <strong>{letter_type.replace('_', ' ').title()}</strong> letter attached as a PDF file.</p>
  <p style="margin-top: 24px;">Best regards,<br>LeaveHub HR Team</p>
</div>
</body>
</html>
"""
    try:
        pdf_bytes = generate_letter_pdf(employee_name, letter_type, title, content)
        safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)
        filename = f"{safe_title}.pdf"
        attachments = [(filename, pdf_bytes, "application/pdf")]
        return send_email(to_email, subject, body_html, body_text, attachments=attachments)
    except Exception as e:
        logger.warning(f"PDF generation failed, falling back to text: {e}")
        body_text_fallback = f"Dear {employee_name},\n\n{content}\n\nBest regards,\nLeaveHub HR Team"
        body_html_fallback = f"""
<!DOCTYPE html><html><body>
<p>Dear {employee_name},</p>
<pre style="white-space: pre-wrap; font-family: Arial;">{content.replace('<', '&lt;').replace('>', '&gt;')}</pre>
<p>Best regards,<br>LeaveHub HR Team</p>
</body></html>
"""
        return send_email(to_email, subject, body_html_fallback, body_text_fallback)

def send_email(to_email: str, subject: str, body: str, html_body: str = None, attachments=None) -> bool:
    """Send email in background thread to avoid blocking requests."""
    def _send():
        try:
            send_email_sync(to_email, subject, body, html_body, attachments=attachments)
        except Exception as e:
            logger.error(f"Background email error: {e}")
    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
    return True
