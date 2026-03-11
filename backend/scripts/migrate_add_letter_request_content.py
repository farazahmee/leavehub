"""
Migration: Add content column to letter_requests (for employee-submitted resignation letters)
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
            ALTER TABLE letter_requests
            ADD COLUMN IF NOT EXISTS content TEXT
        """))
        print("Migration complete: letter_requests.content added (or already exists)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
