"""
Migration: Add cnic, personal_email columns to employees table
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import engine
from sqlalchemy import text


async def run():
    async with engine.begin() as conn:
        for col in ("cnic", "personal_email"):
            await conn.execute(text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'employees' AND column_name = '{col}'
                    ) THEN
                        ALTER TABLE employees ADD COLUMN {col} VARCHAR;
                    END IF;
                END $$;
            """))
        print("Migration complete: cnic, personal_email columns added to employees (or already exist)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
