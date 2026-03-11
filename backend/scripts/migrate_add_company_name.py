"""
Migration: Add company_name column to employees table
Run this if you have an existing database and added the company_name field to the Employee model.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import engine
from sqlalchemy import text


async def run():
    async with engine.begin() as conn:
        # Add company_name if it doesn't exist (PostgreSQL)
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'employees' AND column_name = 'company_name'
                ) THEN
                    ALTER TABLE employees ADD COLUMN company_name VARCHAR;
                END IF;
            END $$;
        """))
        print("✓ Migration complete: company_name column added to employees (or already exists)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
