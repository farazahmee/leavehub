r"""Test SMTP - run from backend: venv\Scripts\python.exe scripts\test_smtp.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import smtplib
from core.config import settings

print(f"Connecting to {settings.SMTP_HOST}:{settings.SMTP_PORT}...")
try:
    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as s:
            s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            print("Login OK - SMTP is working!")
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
            s.starttls()
            s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            print("Login OK - SMTP is working!")
except Exception as e:
    print("Error:", type(e).__name__, str(e))
