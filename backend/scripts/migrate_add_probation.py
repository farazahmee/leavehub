"""
Migration: Add probation_months column to employees
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import engine
from sqlalchemy import text


async def run():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS probation_months INTEGER NOT NULL DEFAULT 0
        """))
        print("Migration complete: probation_months column added to employees")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
