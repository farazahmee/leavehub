"""
Tenant roles API for company admins.

Allows company admins / team leads to manage roles within their own tenant:
- CRUD for roles (name, description, permissions)
- List platform permissions
- List users in tenant and their roles
- Assign roles to users
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.permissions import require_admin_or_team_lead
from core.responses import SuccessResponse
from models.user import User
from models.role import Role, Permission, RolePermission, UserRoleAssignment
from schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    PermissionResponse,
    UserRoleAssign,
)

router = APIRouter()


def _ensure_tenant(current_user: User) -> int:
  tenant_id = getattr(current_user, "tenant_id", None)
  if not tenant_id:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Current user is not associated with any company/tenant",
    )
  return tenant_id


@router.get("", response_model=SuccessResponse)
async def list_tenant_roles(
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """List all roles for the current tenant (company admin view)."""
  tenant_id = _ensure_tenant(current_user)
  result = await db.execute(
      select(Role)
      .options(selectinload(Role.permissions))
      .where(Role.tenant_id == tenant_id)
      .order_by(Role.name)
  )
  roles: List[Role] = result.scalars().all()
  out: List[RoleResponse] = []
  for r in roles:
    perms = [PermissionResponse.model_validate(p) for p in r.permissions]
    out.append(
        RoleResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            name=r.name,
            description=r.description,
            is_system_default=r.is_system_default,
            permissions=perms,
        )
    )
  return SuccessResponse(message="Roles", data=out)


@router.post("", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant_role(
    body: RoleCreate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """Create a new role within the current tenant."""
  tenant_id = _ensure_tenant(current_user)

  existing = await db.execute(
      select(Role).where(Role.tenant_id == tenant_id, Role.name == body.name.strip())
  )
  if existing.scalar_one_or_none():
    raise HTTPException(status_code=400, detail="Role with this name already exists")

  role = Role(
      tenant_id=tenant_id,
      name=body.name.strip(),
      description=(body.description or "").strip() or None,
      is_system_default=False,
  )
  db.add(role)
  await db.flush()

  if body.permission_ids:
    perms = (
        await db.execute(
            select(Permission).where(Permission.id.in_(body.permission_ids))
        )
    ).scalars().all()
    for p in perms:
      db.add(RolePermission(role_id=role.id, permission_id=p.id))
  await db.commit()
  await db.refresh(role)

  perms = [PermissionResponse.model_validate(p) for p in role.permissions]
  return SuccessResponse(
      message="Role created",
      data=RoleResponse(
          id=role.id,
          tenant_id=role.tenant_id,
          name=role.name,
          description=role.description,
          is_system_default=role.is_system_default,
          permissions=perms,
      ),
  )


@router.put("/{role_id}", response_model=SuccessResponse)
async def update_tenant_role(
    role_id: int,
    body: RoleUpdate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """Update a role in the current tenant."""
  tenant_id = _ensure_tenant(current_user)
  role = await db.get(Role, role_id)
  if not role or role.tenant_id != tenant_id:
    raise HTTPException(status_code=404, detail="Role not found")

  if body.name is not None:
    new_name = body.name.strip()
    if new_name and new_name != role.name:
      existing = await db.execute(
          select(Role).where(Role.tenant_id == tenant_id, Role.name == new_name)
      )
      if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role with this name already exists")
      role.name = new_name
  if body.description is not None:
    role.description = body.description.strip() or None

  if body.permission_ids is not None:
    await db.execute(
        delete(RolePermission).where(RolePermission.role_id == role.id)
    )
    if body.permission_ids:
      perms = (
          await db.execute(
              select(Permission).where(Permission.id.in_(body.permission_ids))
          )
      ).scalars().all()
      for p in perms:
        db.add(RolePermission(role_id=role.id, permission_id=p.id))

  await db.commit()
  await db.refresh(role)

  perms = [PermissionResponse.model_validate(p) for p in role.permissions]
  return SuccessResponse(
      message="Role updated",
      data=RoleResponse(
          id=role.id,
          tenant_id=role.tenant_id,
          name=role.name,
          description=role.description,
          is_system_default=role.is_system_default,
          permissions=perms,
      ),
  )


@router.delete("/{role_id}", response_model=SuccessResponse)
async def delete_tenant_role(
    role_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """Delete a role in the current tenant."""
  tenant_id = _ensure_tenant(current_user)
  role = await db.get(Role, role_id)
  if not role or role.tenant_id != tenant_id:
    raise HTTPException(status_code=404, detail="Role not found")
  if role.is_system_default:
    raise HTTPException(
        status_code=400,
        detail="Cannot delete system default role",
    )
  await db.delete(role)
  await db.commit()
  return SuccessResponse(message="Role deleted", data={"id": role_id})


@router.get("/permissions", response_model=SuccessResponse)
async def list_permissions(
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """List all platform permissions (for assigning to tenant roles)."""
  result = await db.execute(select(Permission).order_by(Permission.codename))
  perms = result.scalars().all()
  return SuccessResponse(
      message="Permissions",
      data=[PermissionResponse.model_validate(p) for p in perms],
  )


@router.get("/users", response_model=SuccessResponse)
async def list_tenant_users_with_roles(
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """List users in the current tenant and their tenant roles. Includes employee_id for edit/deactivate."""
  tenant_id = _ensure_tenant(current_user)
  result = await db.execute(
      select(User)
      .options(selectinload(User.tenant_roles))
      .where(User.tenant_id == tenant_id)
      .order_by(User.username)
  )
  users = result.scalars().all()
  from models.employee import Employee
  out = []
  for u in users:
    role_names = [r.name for r in u.tenant_roles]
    emp_result = await db.execute(select(Employee).where(Employee.user_id == u.id).limit(1))
    emp = emp_result.scalar_one_or_none()
    out.append(
        {
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "tenant_roles": role_names,
            "is_active": u.is_active,
            "employee_id": emp.id if emp else None,
            "first_name": emp.first_name if emp else None,
            "last_name": emp.last_name if emp else None,
        }
    )
  return SuccessResponse(message="Users", data=out)


@router.put("/users/{user_id}/roles", response_model=SuccessResponse)
async def assign_tenant_user_roles(
    user_id: int,
    body: UserRoleAssign,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
  """Replace all roles for a user within the current tenant."""
  tenant_id = _ensure_tenant(current_user)
  user = await db.get(User, user_id)
  if not user or user.tenant_id != tenant_id:
    raise HTTPException(status_code=404, detail="User not found in this company")

  # Validate roles belong to same tenant
  for rid in body.role_ids:
    role = await db.get(Role, rid)
    if not role or role.tenant_id != tenant_id:
      raise HTTPException(
          status_code=400,
          detail=f"Role {rid} not found in this company",
      )

  await db.execute(
      delete(UserRoleAssignment).where(
          UserRoleAssignment.user_id == user_id,
          UserRoleAssignment.role_id.in_(
              select(Role.id).where(Role.tenant_id == tenant_id)
          ),
      )
  )
  for rid in body.role_ids:
    db.add(UserRoleAssignment(user_id=user_id, role_id=rid))
  await db.commit()
  return SuccessResponse(
      message="User roles updated",
      data={"user_id": user_id, "role_ids": body.role_ids},
  )

