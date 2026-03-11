"""
Authentication schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date
from models.user import UserRole, UserType


class UserCreate(BaseModel):
    """User registration schema"""
    email: EmailStr
    username: str
    password: str
    role: Optional[UserRole] = UserRole.EMPLOYEE


class SignUpCreate(BaseModel):
    """Create account schema - First name, Last name, Company, Email, Password"""
    first_name: str
    last_name: str
    company_name: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User response schema.

    Includes:
    - tenant_roles: RBAC role names so the frontend can gate UI features
    - company_name / company_slug: convenience fields for branding and
      tenant header configuration on the frontend
    """

    id: int
    email: str
    username: str
    role: UserRole
    user_type: UserType = UserType.TENANT_USER
    tenant_id: Optional[int] = None
    is_active: bool
    tenant_roles: Optional[list[str]] = None
    company_name: Optional[str] = None
    company_slug: Optional[str] = None

    class Config:
        from_attributes = True
        use_enum_values = True

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        """Build response, extracting tenant role names and company info."""
        role_names = [r.name for r in getattr(user, "tenant_roles", []) or []]
        company = getattr(user, "company", None)
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            role=user.role,
            user_type=user.user_type or UserType.TENANT_USER,
            tenant_id=user.tenant_id,
            is_active=user.is_active,
            tenant_roles=role_names or None,
            company_name=getattr(company, "name", None),
            company_slug=getattr(company, "slug", None),
        )


class SetPasswordRequest(BaseModel):
    """Set password with token from email"""
    token: str
    new_password: str


class AdminUserCreate(BaseModel):
    """Admin create user - credentials sent to email. Tenant admin can set leave quotas for new employee."""
    email: str
    first_name: str
    last_name: str
    company_name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    date_of_joining: Optional[date] = None  # None = today
    probation_months: Optional[int] = 0  # 0 = no probation; 3, 6, 9, 12 common
    annual_leave: Optional[int] = None  # Leave quota for current year; default 15 if not set
    sick_leave: Optional[int] = None  # Default 6 if not set
    casual_leave: Optional[int] = None  # Default 5 if not set


class TokenResponse(BaseModel):
    """Token response schema"""
    access_token: str
    refresh_token: str
    token_type: str
