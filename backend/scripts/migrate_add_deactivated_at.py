"""
Migration: Add deactivated_at column to employees table
Run this if you have an existing database and added the deactivated_at field.
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
                    WHERE table_name = 'employees' AND column_name = 'deactivated_at'
                ) THEN
                    ALTER TABLE employees ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE;
                END IF;
            END $$;
        """))
        print("Migration complete: deactivated_at column added to employees (or already exists)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
