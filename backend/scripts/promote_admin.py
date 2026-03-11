"""
Promote a user to super_admin by email.
Usage: python -m scripts.promote_admin user@example.com
"""
import asyncio
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent to path
sys.path.insert(0, str(__file__).rsplit("scripts", 1)[0] or ".")

from core.database import AsyncSessionLocal
from models.user import User, UserRole, UserType


async def promote(email: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User not found: {email}")
            return
        user.role = UserRole.SUPER_ADMIN
        user.user_type = UserType.PLATFORM_ADMIN
        await db.commit()
        print(f"Promoted {email} to platform_admin (super_admin)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.promote_admin user@example.com")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))
