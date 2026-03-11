"""
One-time migration: Change letters.letter_type from PostgreSQL enum to VARCHAR.
Run: python -m scripts.fix_letter_type_column
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from core.database import engine


async def main():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE letters 
            ALTER COLUMN letter_type TYPE VARCHAR(50) 
            USING letter_type::text
        """))
        print("Done: letter_type column changed to VARCHAR(50)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
