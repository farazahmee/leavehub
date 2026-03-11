"""
Make employee_id unique per tenant (so each tenant has EMP0001, EMP0002, ...).
Run from backend folder (no psql needed):

  python -m scripts.run_employee_id_migration
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SQLS = [
    "ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_id_key;",
    "ALTER TABLE employees DROP CONSTRAINT IF EXISTS ix_employees_employee_id;",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_tenant_employee_id
       ON employees (COALESCE(tenant_id, -1), employee_id);""",
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
        print("Done. Employee IDs are now unique per tenant (1, 2, 3... per company).")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
