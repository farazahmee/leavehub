"""
Migration: Set default leave balance for employees with zero allocation.
Run if employees have 0/0/0 leave balance and you want Annual 15, Sick 6, Casual 5.
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
            UPDATE leave_balances
            SET annual_leave = 15, sick_leave = 6, casual_leave = 5
            WHERE annual_leave = 0 AND sick_leave = 0 AND casual_leave = 0
        """))
        print("Migration complete: leave balance defaults updated for zero-balance records")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
