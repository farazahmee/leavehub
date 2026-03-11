"""
Phase 1 schema migration: add companies, roles, permissions, and tenant_id/user_type.
Run once against your existing database so the app can start and login works.

Usage (from backend folder):
  python -m scripts.migrate_phase1_schema

Uses DATABASE_URL from .env (postgresql+asyncpg or postgresql).
"""
import asyncio
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Build list of SQL statements (order matters)
MIGRATIONS = [
    # 1. Enum for user_type (drop if exists so we control values; column may not exist yet)
    "ALTER TABLE users DROP COLUMN IF EXISTS user_type;",
    "DROP TYPE IF EXISTS usertype;",
    "CREATE TYPE usertype AS ENUM ('platform_admin', 'tenant_user');",
    # 2. Companies table
    """
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      domain VARCHAR(255) UNIQUE,
      admin_contact_email VARCHAR(255),
      admin_contact_name VARCHAR(255),
      subscription_plan VARCHAR(50) DEFAULT 'free',
      logo_url VARCHAR(500),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_companies_slug ON companies(slug);",
    # 3. Users: user_type and tenant_id
    "ALTER TABLE users ADD COLUMN user_type usertype DEFAULT 'tenant_user'::usertype;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users(tenant_id);",
    # 4. Roles and permissions tables
    """
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      codename VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255)
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_permissions_codename ON permissions(codename);",
    """
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES companies(id),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system_default BOOLEAN DEFAULT FALSE,
      UNIQUE(tenant_id, name)
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_roles_tenant_id ON roles(tenant_id);",
    """
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
    """,
    # 5. tenant_id on all tenant-scoped tables
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_employees_tenant_id ON employees(tenant_id);",
    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_teams_tenant_id ON teams(tenant_id);",
    "ALTER TABLE attendances ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_attendances_tenant_id ON attendances(tenant_id);",
    "ALTER TABLE overtimes ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_overtimes_tenant_id ON overtimes(tenant_id);",
    "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_leaves_tenant_id ON leaves(tenant_id);",
    "ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_leave_balances_tenant_id ON leave_balances(tenant_id);",
    "ALTER TABLE document_categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_document_categories_tenant_id ON document_categories(tenant_id);",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_documents_tenant_id ON documents(tenant_id);",
    "ALTER TABLE letters ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_letters_tenant_id ON letters(tenant_id);",
    "ALTER TABLE letter_requests ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_letter_requests_tenant_id ON letter_requests(tenant_id);",
    "ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_payrolls_tenant_id ON payrolls(tenant_id);",
    "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_announcements_tenant_id ON announcements(tenant_id);",
]


async def run():
    from core.config import settings
    try:
        import asyncpg
    except ImportError:
        print("Install asyncpg: pip install asyncpg")
        sys.exit(1)

    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    elif not url.startswith("postgresql://"):
        print("DATABASE_URL must be postgresql:// or postgresql+asyncpg://")
        sys.exit(1)

    print("Connecting to database...")
    conn = await asyncpg.connect(url)
    try:
        # Check if user_type already exists (idempotent re-run)
        row = await conn.fetchrow(
            "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_type'"
        )
        skip_user_type = row is not None
        if skip_user_type:
            print("  (users.user_type already exists, skipping enum/user_type steps)")

        step = 0
        for i, sql in enumerate(MIGRATIONS, 1):
            stmt = sql.strip()
            if not stmt:
                continue
            # Skip enum/user_type steps if column already present
            if skip_user_type and (
                "DROP COLUMN IF EXISTS user_type" in stmt
                or "DROP TYPE IF EXISTS usertype" in stmt
                or "CREATE TYPE usertype" in stmt
                or ("ADD COLUMN user_type" in stmt and "users" in stmt)
            ):
                step += 1
                print(f"  [{step}] (skip, user_type exists)")
                continue
            step += 1
            try:
                await conn.execute(stmt)
                print(f"  [{step}] OK")
            except Exception as e:
                # Ignore "already exists" for idempotent re-runs
                msg = str(e).lower()
                if "already exists" in msg or "duplicate" in msg:
                    print(f"  [{step}] (exists) skipped")
                else:
                    print(f"  [{step}] ERROR: {e}")
                    raise
        print("Phase 1 schema migration completed.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
