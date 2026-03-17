"""
Database setup script
Creates database and initializes tables with admin user
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from core.config import settings
from core.database import Base, engine
from core.security import get_password_hash
from models.user import User, UserRole, UserType
from models.employee import Employee
from datetime import date


async def check_database_exists():
    """Check if database exists"""
    # Extract database name from DATABASE_URL
    db_url = settings.DATABASE_URL
    # Format: postgresql+asyncpg://user:password@host:port/database
    db_name = db_url.split('/')[-1]
    
    # Connect to postgres database to check if our database exists
    postgres_url = db_url.rsplit('/', 1)[0] + '/postgres'
    postgres_url = postgres_url.replace('+asyncpg', '')
    
    try:
        conn = await asyncpg.connect(postgres_url.replace('postgresql+asyncpg://', 'postgresql://'))
        result = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            db_name
        )
        await conn.close()
        return result is not None
    except Exception as e:
        print(f"Error checking database: {e}")
        return False


async def create_database():
    """Create database if it doesn't exist"""
    db_url = settings.DATABASE_URL
    db_name = db_url.split('/')[-1]
    postgres_url = db_url.rsplit('/', 1)[0] + '/postgres'
    postgres_url = postgres_url.replace('+asyncpg', '')
    
    try:
        conn = await asyncpg.connect(postgres_url.replace('postgresql+asyncpg://', 'postgresql://'))
        # Check if database exists
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            db_name
        )
        
        if not exists:
            # Create database
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"✓ Database '{db_name}' created successfully")
        else:
            print(f"✓ Database '{db_name}' already exists")
        
        await conn.close()
        return True
    except Exception as e:
        print(f"✗ Error creating database: {e}")
        print("\nPlease create the database manually:")
        print(f"  psql -U postgres")
        print(f"  CREATE DATABASE {db_name};")
        return False


async def create_tables():
    """Create all database tables"""
    try:
        print("Creating database tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✓ Database tables created successfully")
        return True
    except Exception as e:
        print(f"✗ Error creating tables: {e}")
        return False


async def create_admin_user():
    """Create super admin user"""
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            # Check if super admin exists
            result = await session.execute(
                select(User).where(User.role == UserRole.SUPER_ADMIN)
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print("✓ Super admin already exists")
                return True
            
            # Create super admin user
            admin_user = User(
                email="admin@workforcehub.com",
                username="admin",
                hashed_password=get_password_hash("Admin@123"),
                role=UserRole.SUPER_ADMIN,
                user_type=UserType.PLATFORM_ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)
            
            # Create employee profile for admin
            admin_employee = Employee(
                user_id=admin_user.id,
                employee_id="EMP001",
                first_name="Super",
                last_name="Admin",
                date_of_joining=date.today(),
                designation="Head of HR",
                department="HR",
                is_active=True
            )
            session.add(admin_employee)
            await session.commit()
            
            print("=" * 60)
            print("✓ Super Admin Created Successfully!")
            print("=" * 60)
            print(f"Email: admin@workforcehub.com")
            print(f"Username: admin")
            print(f"Password: Admin@123")
            print("=" * 60)
            print("⚠️  IMPORTANT: Change password after first login!")
            print("=" * 60)
            return True
    except Exception as e:
        print(f"✗ Error creating admin user: {e}")
        return False


async def setup_database():
    """Main setup function"""
    print("=" * 60)
    print("LeaveHub Database Setup")
    print("=" * 60)
    print()
    
    # Step 1: Create database
    print("Step 1: Checking/Creating database...")
    db_created = await create_database()
    if not db_created:
        print("\nPlease create the database manually and run this script again.")
        return
    
    print()
    
    # Step 2: Create tables
    print("Step 2: Creating database tables...")
    tables_created = await create_tables()
    if not tables_created:
        print("\nFailed to create tables. Please check your database connection.")
        await engine.dispose()
        return
    
    print()
    
    # Step 3: Create admin user
    print("Step 3: Creating super admin user...")
    await create_admin_user()
    
    print()
    print("=" * 60)
    print("✓ Database setup completed successfully!")
    print("=" * 60)
    
    await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(setup_database())
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user")
    except Exception as e:
        print(f"\n✗ Setup failed: {e}")
        import traceback
        traceback.print_exc()
