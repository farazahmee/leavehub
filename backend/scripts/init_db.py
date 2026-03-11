"""
Database initialization script (Legacy - use setup_database.py instead)
Creates initial super admin user
Note: This script assumes database and tables already exist
For full setup, use: python scripts/setup_database.py
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from core.config import settings
from core.security import get_password_hash
from models.user import User, UserRole, UserType
from models.employee import Employee
from datetime import date


async def init_db():
    """Initialize database with super admin"""
    print("Note: This script only creates admin user.")
    print("For full database setup, use: python scripts/setup_database.py")
    print()
    
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if super admin exists
        result = await session.execute(
            select(User).where(User.role == UserRole.SUPER_ADMIN)
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("Super admin already exists!")
            return
        
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
        
        print("=" * 50)
        print("Super Admin Created Successfully!")
        print("=" * 50)
        print(f"Email: admin@workforcehub.com")
        print(f"Username: admin")
        print(f"Password: Admin@123")
        print("=" * 50)
        print("Please change the password after first login!")
        print("=" * 50)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
