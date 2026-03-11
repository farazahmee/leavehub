"""
Pydantic schemas for Roles and Permissions
"""
from pydantic import BaseModel
from typing import Optional, List


class PermissionResponse(BaseModel):
    """Permission response"""
    id: int
    codename: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    """Create a new role for a company"""
    name: str
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleUpdate(BaseModel):
    """Update a role"""
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleResponse(BaseModel):
    """Role response"""
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    is_system_default: bool
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True


class CompanyAdminCreate(BaseModel):
    """Create company admin: user receives email with set-password link, then has full company admin rights."""
    email: str
    first_name: str
    last_name: str
    username: Optional[str] = None


class UserRoleAssign(BaseModel):
    """Assign roles to a user within a company (replaces all existing roles)."""
    role_ids: List[int]
