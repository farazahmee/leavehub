"""
Permission classes for role-based access control.

Provides:
- PermissionChecker: Legacy checker that also falls through to RBAC when the
  user has tenant roles assigned.  Existing endpoints work without changes.
- TenantPermissionChecker: Checks RBAC permissions via user_roles table.
- require_platform_admin: Guards Super Admin routes.
- Convenience instances: require_super_admin, require_admin_or_team_lead, etc.
"""
from typing import List, Optional, Set

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_active_user
from models.user import User, UserRole, UserType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load_user_permission_codenames(user_id: int, tenant_id: int, db: AsyncSession) -> Set[str]:
    """Load all RBAC permission codenames for a user within their tenant."""
    from models.role import Role, Permission, UserRoleAssignment, RolePermission

    stmt = (
        select(Permission.codename)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .where(
            UserRoleAssignment.user_id == user_id,
            Role.tenant_id == tenant_id,
        )
    )
    result = await db.execute(stmt)
    return {row[0] for row in result.all()}


async def _load_user_role_names(user_id: int, tenant_id: int, db: AsyncSession) -> Set[str]:
    """Load tenant RBAC role names for a user."""
    from models.role import Role, UserRoleAssignment

    stmt = (
        select(Role.name)
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .where(
            UserRoleAssignment.user_id == user_id,
            Role.tenant_id == tenant_id,
        )
    )
    result = await db.execute(stmt)
    return {row[0] for row in result.all()}


# Mapping from legacy UserRole enum to equivalent RBAC role names
_LEGACY_TO_RBAC = {
    UserRole.SUPER_ADMIN: "Company Admin",
    UserRole.TEAM_LEAD: "Team Lead",
    UserRole.EMPLOYEE: "Employee",
}


# ---------------------------------------------------------------------------
# Legacy permission checker (backward-compatible + RBAC fallthrough)
# ---------------------------------------------------------------------------

class PermissionChecker:
    """Checks the legacy User.role enum column first.  If that fails but the
    user has RBAC roles assigned (via user_roles table), the checker compares
    the RBAC role name against the allowed legacy roles' equivalent names.
    This keeps all existing endpoints working while also honoring the new
    RBAC system for tenant users."""

    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles

    async def __call__(
        self,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if current_user.is_platform_admin:
            return current_user

        if current_user.role in self.allowed_roles:
            return current_user

        # RBAC fallthrough: check if user's tenant roles match any allowed role
        if current_user.tenant_id:
            user_role_names = await _load_user_role_names(
                current_user.id, current_user.tenant_id, db,
            )
            allowed_rbac_names = {_LEGACY_TO_RBAC.get(r, "") for r in self.allowed_roles}
            if user_role_names & allowed_rbac_names:
                return current_user
            # "Company Admin" always passes any check
            if "Company Admin" in user_role_names:
                return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )


require_super_admin = PermissionChecker([UserRole.SUPER_ADMIN])
require_admin_or_team_lead = PermissionChecker([
    UserRole.SUPER_ADMIN,
    UserRole.TEAM_LEAD,
])
require_any_authenticated = PermissionChecker([
    UserRole.SUPER_ADMIN,
    UserRole.TEAM_LEAD,
    UserRole.EMPLOYEE,
])


# ---------------------------------------------------------------------------
# Platform admin guard (checks user_type, not legacy enum)
# ---------------------------------------------------------------------------

async def require_platform_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Only platform admins pass: user_type platform_admin or legacy role super_admin."""
    if current_user.user_type == UserType.PLATFORM_ADMIN:
        return current_user
    if getattr(current_user, "role", None) == UserRole.SUPER_ADMIN:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Platform admin access required",
    )


# ---------------------------------------------------------------------------
# Tenant-aware RBAC permission checker
# ---------------------------------------------------------------------------

class TenantPermissionChecker:
    """Checks whether the current user has specific permission codenames
    within their tenant via user_roles -> role_permissions -> permissions.

    Platform admins bypass all permission checks.
    """

    def __init__(self, required_permissions: List[str]):
        self.required_permissions = required_permissions

    async def __call__(
        self,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if current_user.is_platform_admin:
            return current_user

        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not associated with any tenant",
            )

        user_permissions = await _load_user_permission_codenames(
            current_user.id, current_user.tenant_id, db,
        )

        missing = set(self.required_permissions) - user_permissions
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user


# Convenience instances for common permission checks
require_manage_employees = TenantPermissionChecker(["manage_employees"])
require_view_reports = TenantPermissionChecker(["view_reports"])
require_upload_documents = TenantPermissionChecker(["upload_documents"])
require_approve_requests = TenantPermissionChecker(["approve_requests"])
require_manage_teams = TenantPermissionChecker(["manage_teams"])
require_manage_payroll = TenantPermissionChecker(["manage_payroll"])
require_manage_attendance = TenantPermissionChecker(["manage_attendance"])
require_manage_leave = TenantPermissionChecker(["manage_leave"])
require_manage_letters = TenantPermissionChecker(["manage_letters"])
require_manage_announcements = TenantPermissionChecker(["manage_announcements"])
