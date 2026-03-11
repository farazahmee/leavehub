"""
Add onboarding_date and admin_contact_phone to companies table.
Run from backend folder (no psql needed):

  python -m scripts.run_company_migration
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SQLS = [
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_date DATE;",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_contact_phone VARCHAR(50);",
]


async def main():
    try:
        import asyncpg
    except ImportError:
        print("Install asyncpg: pip install asyncpg")
        sys.exit(1)

    from core.config import settings
    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("Connecting to database...")
    conn = await asyncpg.connect(url)
    try:
        for sql in SQLS:
            await conn.execute(sql)
            print("  OK:", sql.strip().replace("  ", " ")[:70])
        print("Done. Companies table now has onboarding_date and admin_contact_phone.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
