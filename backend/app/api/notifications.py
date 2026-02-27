"""Notification system — email and webhook notifications for risk alerts."""

import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
import httpx

router = APIRouter()

# In-memory notification settings (hackathon scope)
_notification_settings: dict = {
    "channel": "email",
    "enabled": False,
    "email_to": None,
    "webhook_url": None,
    "notify_on_critical": True,
}


class NotificationConfig(BaseModel):
    channel: Literal["email", "webhook"] = "email"
    enabled: bool = True
    email_to: Optional[str] = None
    webhook_url: Optional[str] = None
    notify_on_critical: bool = True


@router.get("/settings")
async def get_notification_settings():
    return _notification_settings


@router.post("/configure")
async def configure_notifications(config: NotificationConfig):
    _notification_settings.update(config.model_dump())
    return {"status": "success", "settings": _notification_settings}


@router.post("/test")
async def test_notification():
    settings = _notification_settings
    if not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Notifications are disabled")

    channel = settings.get("channel", "email")
    test_message = "GST Recon Alert: This is a test notification from the GST Reconciliation Engine."

    if channel == "email":
        email_to = settings.get("email_to")
        if not email_to:
            raise HTTPException(status_code=400, detail="Email recipient not configured")
        try:
            _send_email(email_to, "GST Recon - Test Notification", test_message)
            return {"status": "success", "channel": "email", "recipient": email_to}
        except Exception as e:
            return {"status": "simulated", "channel": "email", "recipient": email_to, "message": f"Email sending simulated (SMTP not configured): {str(e)}"}

    elif channel == "webhook":
        webhook_url = settings.get("webhook_url")
        if not webhook_url:
            raise HTTPException(status_code=400, detail="Webhook URL not configured")
        try:
            payload = {
                "text": test_message,
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": test_message}}],
            }
            resp = httpx.post(webhook_url, json=payload, timeout=10)
            return {"status": "success", "channel": "webhook", "response_code": resp.status_code}
        except Exception as e:
            return {"status": "error", "channel": "webhook", "message": str(e)}

    raise HTTPException(status_code=400, detail=f"Unknown channel: {channel}")


def _send_email(to: str, subject: str, body: str):
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = "gstrecon@niheshr.com"
    msg["To"] = to

    with smtplib.SMTP("localhost", 587) as server:
        server.send_message(msg)
