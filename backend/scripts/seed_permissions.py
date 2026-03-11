"""
Seed platform-wide permissions. Run once or on app startup.
Creates permissions if they don't exist (idempotent).
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# From plan 3.4
PLATFORM_PERMISSIONS = [
    ("manage_employees", "Manage employees"),
    ("view_reports", "View reports"),
    ("upload_documents", "Upload documents"),
    ("approve_requests", "Approve leave/letter requests"),
    ("manage_teams", "Manage teams"),
    ("manage_payroll", "Manage payroll"),
    ("manage_attendance", "Manage attendance"),
    ("manage_leave", "Manage leave"),
    ("manage_letters", "Manage letters"),
    ("manage_announcements", "Manage announcements"),
    ("manage_company_settings", "Manage company settings"),
]


async def seed():
    from core.database import AsyncSessionLocal
    from models.role import Permission
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        for codename, description in PLATFORM_PERMISSIONS:
            r = await db.execute(select(Permission).where(Permission.codename == codename))
            if r.scalar_one_or_none():
                continue
            db.add(Permission(codename=codename, description=description))
        await db.commit()
    print("Permissions seeded.")


if __name__ == "__main__":
    asyncio.run(seed())
