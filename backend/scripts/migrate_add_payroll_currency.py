"""
Migration: Add currency column to payrolls table
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
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'payrolls' AND column_name = 'currency'
                ) THEN
                    ALTER TABLE payrolls ADD COLUMN currency VARCHAR(3);
                END IF;
            END $$;
        """))
        print("Migration complete: currency column added to payrolls (or already exists)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
