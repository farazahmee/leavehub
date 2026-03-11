"""
Comprehensive multi-tenant migration: schema changes, permissions seeding, and
optional platform admin creation.

Designed to be idempotent -- safe to re-run on an already-migrated database.

Usage (from backend folder):
  python -m scripts.migrate_multitenant
  python -m scripts.migrate_multitenant --create-admin admin@example.com
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ---- Schema SQL (order matters) -----------------------------------------

SCHEMA_SQL = [
    # 1. user_type enum
    "DO $$ BEGIN CREATE TYPE usertype AS ENUM ('platform_admin', 'tenant_user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;",

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
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type usertype DEFAULT 'tenant_user'::usertype;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES companies(id);",
    "CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users(tenant_id);",

    # 4. Permissions table (platform-wide)
    """
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      codename VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255)
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_permissions_codename ON permissions(codename);",

    # 5. Roles table (tenant-scoped)
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

    # 6. Role-Permission join
    """
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
    """,

    # 7. User-Role join
    """
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
    """,

    # 8. tenant_id on all tenant-scoped tables
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

# ---- Permissions seed data -----------------------------------------------

PERMISSIONS = [
    ("manage_employees", "Manage employees"),
    ("view_reports", "View reports"),
    ("upload_documents", "Upload documents"),
    ("approve_requests", "Approve leave/letter requests"),
    ("manage_teams", "Manage teams"),
    ("manage_payroll", "Manage payroll"),
    ("manage_attendance", "Manage attendance"),
    ("manage_leave", "Manage leave"),
    ("manage_letters", "Manage letters"),
    ("manage_announcements", "Manage announcements"),
    ("manage_company_settings", "Manage company settings"),
]


async def run(create_admin_email: str | None = None):
    from core.config import settings
    try:
        import asyncpg
    except ImportError:
        print("Install asyncpg: pip install asyncpg")
        sys.exit(1)

    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("Connecting to database...")
    conn = await asyncpg.connect(url)
    try:
        # --- 1. Schema migrations ---
        print("\n=== Schema Migrations ===")
        for i, sql in enumerate(SCHEMA_SQL, 1):
            stmt = sql.strip()
            if not stmt:
                continue
            try:
                await conn.execute(stmt)
                print(f"  [{i:02d}] OK")
            except Exception as e:
                msg = str(e).lower()
                if "already exists" in msg or "duplicate" in msg:
                    print(f"  [{i:02d}] (exists) skipped")
                else:
                    print(f"  [{i:02d}] ERROR: {e}")
                    raise

        # --- 2. Seed permissions ---
        print("\n=== Seed Permissions ===")
        for codename, description in PERMISSIONS:
            row = await conn.fetchrow(
                "SELECT 1 FROM permissions WHERE codename = $1", codename
            )
            if row:
                print(f"  {codename}: exists")
                continue
            await conn.execute(
                "INSERT INTO permissions (codename, description) VALUES ($1, $2)",
                codename, description,
            )
            print(f"  {codename}: created")

        # --- 3. Promote existing super_admin users to platform_admin ---
        # SQLAlchemy Enum(UserRole) may store values as uppercase names (SUPER_ADMIN)
        # or lowercase values (super_admin) depending on how the enum was created.
        # We detect the actual format and use it.
        print("\n=== Promote Existing Super Admins ===")
        probe = await conn.fetchrow(
            "SELECT unnest(enum_range(NULL::userrole))::text AS val LIMIT 1"
        )
        if probe and probe["val"] == "SUPER_ADMIN":
            sa_val, tu_val = "SUPER_ADMIN", "tenant_user"
        else:
            sa_val, tu_val = "super_admin", "tenant_user"
        updated = await conn.execute(
            f"UPDATE users SET user_type = 'platform_admin' WHERE role = '{sa_val}' AND (user_type IS NULL OR user_type = '{tu_val}')"
        )
        print(f"  {updated}")

        # --- 4. Optional: create platform admin ---
        if create_admin_email:
            print(f"\n=== Create Platform Admin: {create_admin_email} ===")
            existing = await conn.fetchrow(
                "SELECT id FROM users WHERE email = $1", create_admin_email.lower()
            )
            if existing:
                await conn.execute(
                    f"UPDATE users SET user_type = 'platform_admin', role = '{sa_val}' WHERE id = $1",
                    existing["id"],
                )
                print(f"  Existing user promoted to platform_admin")
            else:
                import bcrypt
                import secrets
                temp_pw = secrets.token_urlsafe(16)
                hashed = bcrypt.hashpw(temp_pw.encode(), bcrypt.gensalt()).decode()
                username = create_admin_email.split("@")[0].replace(".", "_")[:30]
                await conn.execute(
                    f"""
                    INSERT INTO users (email, username, hashed_password, role, user_type, is_active)
                    VALUES ($1, $2, $3, '{sa_val}', 'platform_admin', true)
                    """,
                    create_admin_email.lower(), username, hashed,
                )
                print(f"  Created platform admin: {create_admin_email}")
                print(f"  Temporary password: {temp_pw}")
                print(f"  (Change this immediately!)")

        print("\nMigration completed successfully.")
    finally:
        await conn.close()


if __name__ == "__main__":
    admin_email = None
    if "--create-admin" in sys.argv:
        idx = sys.argv.index("--create-admin")
        if idx + 1 < len(sys.argv):
            admin_email = sys.argv[idx + 1]
        else:
            print("--create-admin requires an email argument")
            sys.exit(1)
    asyncio.run(run(admin_email))
