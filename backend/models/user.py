"""
User model for authentication
"""
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from core.database import Base


class UserRole(str, enum.Enum):
    """Legacy role enum — kept for backward compatibility with existing code.
    New code should use UserType + tenant RBAC via user_roles table."""
    SUPER_ADMIN = "super_admin"
    TEAM_LEAD = "team_lead"
    EMPLOYEE = "employee"


class UserType(str, enum.Enum):
    """Distinguishes platform-level admins from tenant users"""
    PLATFORM_ADMIN = "platform_admin"
    TENANT_USER = "tenant_user"


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Legacy column kept for backward compat; will be phased out
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE, nullable=False)

    user_type = Column(
        Enum(UserType, values_callable=lambda obj: [e.value for e in obj]),
        default=UserType.TENANT_USER,
        nullable=False,
        server_default=UserType.TENANT_USER.value,
    )
    tenant_id = Column(
        Integer, ForeignKey("companies.id"), nullable=True, index=True
    )

    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    password_reset_token = Column(String, nullable=True, index=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", back_populates="user", uselist=False)
    company = relationship("Company", back_populates="users")
    tenant_roles = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
        lazy="selectin",
    )

    @property
    def is_platform_admin(self) -> bool:
        return self.user_type == UserType.PLATFORM_ADMIN
