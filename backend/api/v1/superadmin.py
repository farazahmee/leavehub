"""
Super Admin API: companies, roles, permissions, user-role assignments, platform stats.
Protected by require_platform_admin. Bypasses tenant resolution.
"""
import re
import secrets
from datetime import datetime, timedelta, timezone, date
from typing import Optional, List
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from core.database import get_db
from core.permissions import require_platform_admin
from core.responses import SuccessResponse, PaginatedResponse
from core.config import settings
from core.security import get_password_hash
from core.email import send_new_user_set_password
from core.validators import validate_email, sanitize_string
from core.employee_id import get_next_employee_id_for_tenant
from models.user import User, UserRole, UserType
from models.company import Company
from models.role import Role, Permission, RolePermission, UserRoleAssignment
from models.employee import Employee
from models.team import Team
from models.leave import Leave, LeaveBalance
from models.attendance import Attendance, Overtime
from models.document import Document, DocumentCategory
from models.letter import Letter
from models.letter_request import LetterRequest
from models.payroll import Payroll
from models.announcement import Announcement
from models.invoice import Invoice, InvoiceStatus
from sqlalchemy import update
from schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from schemas.invoice import InvoiceResponse
from schemas.role import (
    RoleCreate, RoleUpdate, RoleResponse, PermissionResponse,
    CompanyAdminCreate, UserRoleAssign,
)

router = APIRouter(dependencies=[Depends(require_platform_admin)])

DEFAULT_ROLES = [
    ("Company Admin", "Full access to all company resources", None),
    ("HR Manager", "Manage employees, reports, documents, approvals, teams", [
        "manage_employees", "view_reports", "upload_documents", "approve_requests", "manage_teams",
    ]),
    ("Team Lead", "View reports, approve requests, manage own team", [
        "view_reports", "approve_requests", "manage_teams",
    ]),
    ("Employee", "View own data, upload own documents", [
        "view_reports", "upload_documents",
    ]),
    ("Viewer", "Read-only access to allowed resources", [
        "view_reports",
    ]),
]


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.lower())
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s[:100] or "company"


async def _unique_slug(db: AsyncSession, base: str) -> str:
    slug = base
    n = 1
    while True:
        r = await db.execute(select(Company.id).where(Company.slug == slug))
        if r.scalar_one_or_none() is None:
            return slug
        slug = f"{base}-{n}"
        n += 1


# ---------- Companies ----------

@router.get("/companies", response_model=SuccessResponse)
async def list_companies(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=getattr(settings, "MAX_PAGE_SIZE", 100)),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    q = select(Company)
    count_q = select(func.count()).select_from(Company)
    if search:
        like = f"%{search}%"
        q = q.where(Company.name.ilike(like) | Company.slug.ilike(like))
        count_q = count_q.where(Company.name.ilike(like) | Company.slug.ilike(like))
    if is_active is not None:
        q = q.where(Company.is_active == is_active)
        count_q = count_q.where(Company.is_active == is_active)
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(Company.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    companies = result.scalars().all()
    total_pages = (total + page_size - 1) // page_size if page_size else 0
    return SuccessResponse(
        message="Companies list",
        data=PaginatedResponse(
            data=[CompanyResponse.model_validate(c) for c in companies],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ).model_dump(),
    )


@router.post("/companies", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    body: CompanyCreate,
    db: AsyncSession = Depends(get_db),
):
    base_slug = _slugify(body.name)
    slug = await _unique_slug(db, base_slug)
    # Auto-set domain: explicit domain, or derive from admin_contact_email (e.g. admin@timesquarellc.com -> timesquarellc.com)
    domain = body.domain
    if not domain and body.admin_contact_email and "@" in body.admin_contact_email:
        domain = body.admin_contact_email.split("@")[-1].strip().lower()
    company = Company(
        name=body.name,
        slug=slug,
        domain=domain,
        admin_contact_email=body.admin_contact_email,
        admin_contact_name=body.admin_contact_name,
        admin_contact_phone=body.admin_contact_phone,
        subscription_plan=body.subscription_plan or "free",
        is_active=True,
        onboarding_date=body.onboarding_date,
    )
    db.add(company)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        err_msg = str(getattr(e, "orig", e))
        if "column" in err_msg.lower() or "onboarding_date" in err_msg or "admin_contact_phone" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database schema may be missing new columns. Run migration: backend/migrations/add_company_onboarding_date.sql. Error: {err_msg}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err_msg or "Failed to create company",
        )

    # Seed default roles with permissions
    perms_result = await db.execute(select(Permission))
    all_perms = {p.codename: p.id for p in perms_result.scalars().all()}
    try:
        for role_name, role_desc, codenames in DEFAULT_ROLES:
            role = Role(
                tenant_id=company.id,
                name=role_name,
                description=role_desc,
                is_system_default=True,
            )
            db.add(role)
            await db.flush()
            if codenames is None:
                perm_ids = list(all_perms.values())
            else:
                perm_ids = [all_perms[c] for c in codenames if c in all_perms]
            for pid in perm_ids:
                db.add(RolePermission(role_id=role.id, permission_id=pid))
        await db.commit()
        await db.refresh(company)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) if getattr(e, "args", None) else "Failed to create company",
        )
    from core.config import settings
    env = getattr(settings, "ENVIRONMENT", "development")
    if env == "production":
        base = getattr(settings, "BASE_DOMAIN", "workforcehub.com")
        tenant_url_employee = f"https://{slug}.{base}"
        tenant_url_admin = f"https://{slug}-admin.{base}" if base else None
    else:
        tenant_url_employee = f"http://{slug}.localhost:5174"
        tenant_url_admin = f"http://{slug}.localhost:5176"
    return SuccessResponse(
        message="Company created",
        data={
            **CompanyResponse.model_validate(company).model_dump(),
            "tenant_url_employee": tenant_url_employee,
            "tenant_url_admin": tenant_url_admin,
        },
    )


@router.get("/companies/{company_id}", response_model=SuccessResponse)
async def get_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return SuccessResponse(message="Company details", data=CompanyResponse.model_validate(company))


@router.put("/companies/{company_id}", response_model=SuccessResponse)
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    await db.commit()
    await db.refresh(company)
    return SuccessResponse(message="Company updated", data=CompanyResponse.model_validate(company))


@router.patch("/companies/{company_id}", response_model=SuccessResponse)
async def patch_company(
    company_id: int,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if is_active is not None:
        company.is_active = is_active
    await db.commit()
    await db.refresh(company)
    return SuccessResponse(message="Company updated", data=CompanyResponse.model_validate(company))


@router.delete("/companies/{company_id}", response_model=SuccessResponse)
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a company and all its tenant-scoped data. Super admin only."""
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        # Get employee ids for this tenant so we can delete leave_balances by employee_id (FK)
        emp_ids_result = await db.execute(select(Employee.id).where(Employee.tenant_id == company_id))
        employee_ids = [r[0] for r in emp_ids_result.all()]

        role_ids_result = await db.execute(select(Role.id).where(Role.tenant_id == company_id))
        role_ids = [r[0] for r in role_ids_result.all()]
        if role_ids:
            await db.execute(delete(UserRoleAssignment).where(UserRoleAssignment.role_id.in_(role_ids)))
            await db.execute(delete(RolePermission).where(RolePermission.role_id.in_(role_ids)))
        await db.execute(delete(Role).where(Role.tenant_id == company_id))
        await db.execute(delete(Invoice).where(Invoice.tenant_id == company_id))
        # Delete leave_balances by both tenant_id and employee_id so no FK refs remain (employee_id is required)
        await db.execute(delete(LeaveBalance).where(LeaveBalance.tenant_id == company_id))
        if employee_ids:
            await db.execute(delete(LeaveBalance).where(LeaveBalance.employee_id.in_(employee_ids)))
        await db.execute(delete(Leave).where(Leave.tenant_id == company_id))
        # Delete attendances: by tenant_id AND by employee_id (tenant_id can be NULL on some records)
        await db.execute(delete(Attendance).where(Attendance.tenant_id == company_id))
        if employee_ids:
            await db.execute(delete(Attendance).where(Attendance.employee_id.in_(employee_ids)))
        # Delete overtimes: same pattern (approved_by_id also references Employee)
        await db.execute(delete(Overtime).where(Overtime.tenant_id == company_id))
        if employee_ids:
            await db.execute(delete(Overtime).where(Overtime.employee_id.in_(employee_ids)))
        await db.execute(delete(Document).where(Document.tenant_id == company_id))
        await db.execute(delete(DocumentCategory).where(DocumentCategory.tenant_id == company_id))
        await db.execute(delete(LetterRequest).where(LetterRequest.tenant_id == company_id))
        await db.execute(delete(Letter).where(Letter.tenant_id == company_id))
        await db.execute(delete(Payroll).where(Payroll.tenant_id == company_id))
        await db.execute(delete(Announcement).where(Announcement.tenant_id == company_id))
        # Clear employee.reporting_manager_id (Employee→Employee) before deleting employees
        await db.execute(
            update(Employee).where(Employee.reporting_manager_id.in_(
                select(Employee.id).where(Employee.tenant_id == company_id)
            )).values(reporting_manager_id=None)
        )
        # Clear employee.team_id for any employee referencing a team we're about to delete
        team_ids_subq = select(Team.id).where(Team.tenant_id == company_id)
        await db.execute(
            update(Employee).where(Employee.team_id.in_(team_ids_subq)).values(team_id=None)
        )
        await db.execute(update(Team).where(Team.tenant_id == company_id).values(team_lead_id=None))
        await db.execute(delete(Team).where(Team.tenant_id == company_id))
        await db.execute(delete(Employee).where(Employee.tenant_id == company_id))
        await db.execute(update(User).where(User.tenant_id == company_id).values(tenant_id=None))
        await db.delete(company)
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete company: database constraint failed. {str(e.orig)}",
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cannot delete company: {str(e)}",
        )
    return SuccessResponse(message="Company deleted", data={"id": company_id})


# ---------- Roles ----------

@router.get("/companies/{company_id}/roles", response_model=SuccessResponse)
async def list_company_roles(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    result = await db.execute(
        select(Role).where(Role.tenant_id == company_id).order_by(Role.name)
    )
    roles = result.scalars().all()
    out = []
    for r in roles:
        perms = [PermissionResponse.model_validate(p) for p in r.permissions]
        out.append(RoleResponse(id=r.id, tenant_id=r.tenant_id, name=r.name, description=r.description, is_system_default=r.is_system_default, permissions=perms))
    return SuccessResponse(message="Roles", data=out)


@router.post("/companies/{company_id}/roles", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_company_role(
    company_id: int,
    body: RoleCreate,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    r = await db.execute(select(Role).where(Role.tenant_id == company_id, Role.name == body.name))
    if r.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    role = Role(tenant_id=company_id, name=body.name, description=body.description, is_system_default=False)
    db.add(role)
    await db.flush()
    for pid in body.permission_ids or []:
        db.add(RolePermission(role_id=role.id, permission_id=pid))
    await db.commit()
    await db.refresh(role)
    perms = [PermissionResponse.model_validate(p) for p in role.permissions]
    return SuccessResponse(
        message="Role created",
        data=RoleResponse(id=role.id, tenant_id=role.tenant_id, name=role.name, description=role.description, is_system_default=role.is_system_default, permissions=perms),
    )


@router.put("/companies/{company_id}/roles/{role_id}", response_model=SuccessResponse)
async def update_company_role(
    company_id: int,
    role_id: int,
    body: RoleUpdate,
    db: AsyncSession = Depends(get_db),
):
    role = await db.get(Role, role_id)
    if not role or role.tenant_id != company_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name is not None:
        role.name = body.name
    if body.description is not None:
        role.description = body.description
    if body.permission_ids is not None:
        await db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        for pid in body.permission_ids:
            db.add(RolePermission(role_id=role_id, permission_id=pid))
    await db.commit()
    await db.refresh(role)
    perms = [PermissionResponse.model_validate(p) for p in role.permissions]
    return SuccessResponse(
        message="Role updated",
        data=RoleResponse(id=role.id, tenant_id=role.tenant_id, name=role.name, description=role.description, is_system_default=role.is_system_default, permissions=perms),
    )


@router.delete("/companies/{company_id}/roles/{role_id}", response_model=SuccessResponse)
async def delete_company_role(
    company_id: int,
    role_id: int,
    db: AsyncSession = Depends(get_db),
):
    role = await db.get(Role, role_id)
    if not role or role.tenant_id != company_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_default:
        raise HTTPException(status_code=400, detail="Cannot delete system default role")
    await db.delete(role)
    await db.commit()
    return SuccessResponse(message="Role deleted", data={"id": role_id})


# ---------- Users in company ----------

@router.get("/companies/{company_id}/users", response_model=SuccessResponse)
async def list_company_users(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    result = await db.execute(select(User).where(User.tenant_id == company_id).order_by(User.username))
    users = result.scalars().all()
    out = []
    for u in users:
        role_names = [r.name for r in u.tenant_roles]
        out.append({
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "role": u.role.value if u.role else None,
            "user_type": u.user_type.value if u.user_type else None,
            "tenant_roles": role_names,
            "is_active": u.is_active,
        })
    return SuccessResponse(message="Users", data=out)


# ---------- Create company admin ----------

@router.post("/companies/{company_id}/admin", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_company_admin(
    company_id: int,
    body: CompanyAdminCreate,
    db: AsyncSession = Depends(get_db),
):
    from datetime import date

    if not validate_email(body.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    email = sanitize_string(body.email.lower())

    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Reuse existing user with same email when it's not tied to another company,
    # instead of failing with "already exists".
    r = await db.execute(select(User).where(User.email == email))
    existing_user = r.scalar_one_or_none()

    # Username: from body or generated from email
    if existing_user:
        # If the user already exists but is associated with a different company,
        # don't silently reassign them – surface a clear error.
        if existing_user.tenant_id not in (None, company_id):
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists in another company",
            )

        user = existing_user
        # If a username was explicitly provided and is different, ensure it's free.
        if body.username and body.username.strip():
            username = sanitize_string(body.username)
            if username != user.username:
                r2 = await db.execute(select(User).where(User.username == username))
                if r2.scalar_one_or_none():
                    raise HTTPException(status_code=400, detail="Username already taken")
                user.username = username
        else:
            username = user.username
        # Attach user to this company and reactivate
        user.tenant_id = company_id
        user.is_active = True
    else:
        # Generate a fresh set-password token and temporary password for the new user
        token = secrets.token_urlsafe(48)
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        temp_password = secrets.token_urlsafe(32)

        if body.username:
            username = sanitize_string(body.username)
            r2 = await db.execute(select(User).where(User.username == username))
            if r2.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username already taken")
        else:
            base_username = sanitize_string(email.split("@")[0].replace(".", "_")[:30])
            username = base_username
            n = 1
            while True:
                r2 = await db.execute(select(User).where(User.username == username))
                if not r2.scalar_one_or_none():
                    break
                username = f"{base_username}{n}"
                n += 1

        user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash(temp_password),
            role=UserRole.TEAM_LEAD,
            tenant_id=company_id,
            is_active=True,
            password_reset_token=token,
            password_reset_expires=expires,
        )
        db.add(user)
        await db.flush()

    # Always issue a new set-password token so the admin can (re)set credentials
    if existing_user:
        token = secrets.token_urlsafe(48)
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        temp_password = secrets.token_urlsafe(32)
        user.hashed_password = get_password_hash(temp_password)
        user.password_reset_token = token
        user.password_reset_expires = expires

    admin_role = (await db.execute(select(Role).where(Role.tenant_id == company_id, Role.name == "Company Admin"))).scalar_one_or_none()
    if admin_role:
        # Ensure user has the Company Admin role
        existing_assignment = await db.execute(
            select(UserRoleAssignment).where(
                UserRoleAssignment.user_id == user.id,
                UserRoleAssignment.role_id == admin_role.id,
            )
        )
        if existing_assignment.scalar_one_or_none() is None:
            db.add(UserRoleAssignment(user_id=user.id, role_id=admin_role.id))

    # Ensure there is an active employee record for this user.
    # There can only be one Employee per user (unique user_id).
    emp_result = await db.execute(
        select(Employee).where(Employee.user_id == user.id)
    )
    employee = emp_result.scalar_one_or_none()
    if employee:
        # If the employee belongs to another company, don't silently move them.
        if employee.tenant_id not in (None, company_id):
            raise HTTPException(
                status_code=400,
                detail="User already has an employee profile in another company",
            )
        employee.tenant_id = company_id
        employee.first_name = sanitize_string(body.first_name)
        employee.last_name = sanitize_string(body.last_name)
        employee.is_active = True
    else:
        next_emp_id = await get_next_employee_id_for_tenant(db, company_id)
        employee = Employee(
            tenant_id=company_id,
            user_id=user.id,
            employee_id=next_emp_id,
            first_name=sanitize_string(body.first_name),
            last_name=sanitize_string(body.last_name),
            date_of_joining=date.today(),
            is_active=True,
        )
        db.add(employee)
    await db.commit()
    await db.refresh(user)

    # Company admin portal gets its own set-password link so admins land in
    # the correct UI (frontend-admin on port 5176 by default).
    set_password_url = f"{settings.COMPANY_ADMIN_URL}/set-password?token={token}"
    email_sent = send_new_user_set_password(
        to_email=email,
        username=username,
        first_name=body.first_name,
        set_password_url=set_password_url,
    )
    email_msg = "Set-password link sent to their email." if email_sent else "Email not sent (check SMTP settings). Use the set_password_url below."

    return SuccessResponse(
        message=f"Company admin created. {email_msg}",
        data={
            "user_id": user.id,
            "email": user.email,
            "username": username,
            "email_sent": email_sent,
            "set_password_url": set_password_url,
        },
    )


# ---------- Permissions (platform-wide) ----------

@router.get("/permissions", response_model=SuccessResponse)
async def list_permissions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Permission).order_by(Permission.codename))
    perms = result.scalars().all()
    return SuccessResponse(message="Permissions", data=[PermissionResponse.model_validate(p) for p in perms])


# ---------- User-Role Assignments ----------

@router.get("/companies/{company_id}/users/{user_id}/roles", response_model=SuccessResponse)
async def list_user_roles(
    company_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List roles assigned to a user within a company."""
    user = await db.get(User, user_id)
    if not user or user.tenant_id != company_id:
        raise HTTPException(status_code=404, detail="User not found in this company")
    result = await db.execute(
        select(Role)
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .where(UserRoleAssignment.user_id == user_id, Role.tenant_id == company_id)
        .order_by(Role.name)
    )
    roles = result.scalars().all()
    out = []
    for r in roles:
        perms = [PermissionResponse.model_validate(p) for p in r.permissions]
        out.append(RoleResponse(
            id=r.id, tenant_id=r.tenant_id, name=r.name,
            description=r.description, is_system_default=r.is_system_default,
            permissions=perms,
        ))
    return SuccessResponse(message="User roles", data=out)


@router.put("/companies/{company_id}/users/{user_id}/roles", response_model=SuccessResponse)
async def assign_user_roles(
    company_id: int,
    user_id: int,
    body: UserRoleAssign,
    db: AsyncSession = Depends(get_db),
):
    """Replace all roles for a user within a company with the given role_ids."""
    user = await db.get(User, user_id)
    if not user or user.tenant_id != company_id:
        raise HTTPException(status_code=404, detail="User not found in this company")
    for rid in body.role_ids:
        role = await db.get(Role, rid)
        if not role or role.tenant_id != company_id:
            raise HTTPException(status_code=400, detail=f"Role {rid} not found in this company")
    await db.execute(
        delete(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.role_id.in_(
                select(Role.id).where(Role.tenant_id == company_id)
            ),
        )
    )
    for rid in body.role_ids:
        db.add(UserRoleAssignment(user_id=user_id, role_id=rid))
    await db.commit()
    return SuccessResponse(message="User roles updated", data={"user_id": user_id, "role_ids": body.role_ids})


async def _delete_user_and_related(db: AsyncSession, user_id: int, user: User) -> None:
    """Delete employee (and all employee-scoped data), user roles, and user. Caller must commit."""
    emp_result = await db.execute(select(Employee).where(Employee.user_id == user_id))
    employee = emp_result.scalar_one_or_none()
    if employee:
        emp_id = employee.id
        await db.execute(delete(LeaveBalance).where(LeaveBalance.employee_id == emp_id))
        await db.execute(delete(Leave).where(Leave.employee_id == emp_id))
        await db.execute(delete(Attendance).where(Attendance.employee_id == emp_id))
        await db.execute(delete(Overtime).where(Overtime.employee_id == emp_id))
        await db.execute(delete(Document).where(Document.employee_id == emp_id))
        await db.execute(delete(LetterRequest).where(LetterRequest.employee_id == emp_id))
        await db.execute(delete(Letter).where(Letter.employee_id == emp_id))
        await db.execute(delete(Payroll).where(Payroll.employee_id == emp_id))
        await db.execute(update(Team).where(Team.team_lead_id == emp_id).values(team_lead_id=None))
        await db.execute(update(Employee).where(Employee.reporting_manager_id == emp_id).values(reporting_manager_id=None))
        await db.delete(employee)
    await db.execute(delete(UserRoleAssignment).where(UserRoleAssignment.user_id == user_id))
    await db.delete(user)


@router.delete("/companies/{company_id}/users/{user_id}", response_model=SuccessResponse)
async def delete_company_user(
    company_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user from the company and from the database (email is freed for reuse)."""
    user = await db.get(User, user_id)
    if not user or user.tenant_id != company_id:
        raise HTTPException(status_code=404, detail="User not found in this company")
    try:
        await _delete_user_and_related(db, user_id, user)
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete user: {str(e.orig)}",
        )
    return SuccessResponse(message="User removed", data={"user_id": user_id})


@router.delete("/users/by-email", response_model=SuccessResponse)
async def delete_user_by_email(
    email: str = Query(..., description="Email of the user to remove from the database"),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user by email (platform admin). Use this to free an email so it can be used again when creating an admin."""
    email = email.strip().lower()
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email")
    try:
        await _delete_user_and_related(db, user.id, user)
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete user: {str(e.orig)}",
        )
    return SuccessResponse(message="User removed. Email can be used again.", data={"email": email})


# ---------- Invoices ----------

@router.get("/invoices", response_model=SuccessResponse)
async def list_invoices(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=getattr(settings, "MAX_PAGE_SIZE", 100)),
    tenant_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="paid or unpaid"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    tenant_active: Optional[bool] = Query(None, description="Filter by active/inactive tenant"),
):
    """List invoices with filtering by tenant, date range, status and tenant activity."""
    stmt = (
        select(Invoice, Company)
        .join(Company, Company.id == Invoice.tenant_id)
    )
    count_stmt = select(func.count()).select_from(
        Invoice.__table__.join(Company, Company.id == Invoice.tenant_id)
    )

    if tenant_name:
        like = f"%{tenant_name}%"
        stmt = stmt.where(Company.name.ilike(like))
        count_stmt = count_stmt.where(Company.name.ilike(like))
    if status in {"paid", "unpaid"}:
        status_enum = InvoiceStatus.PAID if status == "paid" else InvoiceStatus.UNPAID
        stmt = stmt.where(Invoice.status == status_enum)
        count_stmt = count_stmt.where(Invoice.status == status_enum)
    if start_date:
        stmt = stmt.where(Invoice.due_date >= start_date)
        count_stmt = count_stmt.where(Invoice.due_date >= start_date)
    if end_date:
        stmt = stmt.where(Invoice.due_date <= end_date)
        count_stmt = count_stmt.where(Invoice.due_date <= end_date)
    if tenant_active is not None:
        stmt = stmt.where(Company.is_active == tenant_active)
        count_stmt = count_stmt.where(Company.is_active == tenant_active)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(Invoice.due_date.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    rows = result.all()

    data: List[InvoiceResponse] = []
    for inv, company in rows:
        data.append(
            InvoiceResponse(
                id=inv.id,
                tenant_id=inv.tenant_id,
                company_name=company.name,
                company_slug=company.slug,
                amount=inv.amount,
                due_date=inv.due_date,
                paid_date=inv.paid_date,
                status=inv.status.value if isinstance(inv.status, InvoiceStatus) else str(inv.status),
                company_is_active=company.is_active,
            )
        )

    total_pages = (total + page_size - 1) // page_size if page_size else 0

    return SuccessResponse(
        message="Invoices",
        data=PaginatedResponse(
            data=[item.model_dump() for item in data],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ).model_dump(),
    )


@router.patch("/invoices/{invoice_id}", response_model=SuccessResponse)
async def update_invoice_status(
    invoice_id: int,
    status: Optional[str] = Query(None, description="paid or unpaid"),
    paid_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Update invoice status or paid_date (for marking as paid)."""
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if status in {"paid", "unpaid"}:
        invoice.status = InvoiceStatus.PAID if status == "paid" else InvoiceStatus.UNPAID
    if paid_date is not None:
        invoice.paid_date = paid_date

    await db.commit()
    await db.refresh(invoice)

    company = await db.get(Company, invoice.tenant_id)
    resp = InvoiceResponse(
        id=invoice.id,
        tenant_id=invoice.tenant_id,
        company_name=company.name if company else "",
        company_slug=company.slug if company else "",
        amount=invoice.amount,
        due_date=invoice.due_date,
        paid_date=invoice.paid_date,
        status=invoice.status.value if isinstance(invoice.status, InvoiceStatus) else str(invoice.status),
        company_is_active=company.is_active if company else False,
    )

    return SuccessResponse(message="Invoice updated", data=resp.model_dump())


# ---------- Stats ----------

@router.get("/stats", response_model=SuccessResponse)
async def platform_stats(db: AsyncSession = Depends(get_db)):
    companies_total = (await db.execute(select(func.count()).select_from(Company))).scalar() or 0
    companies_active = (await db.execute(select(func.count()).select_from(Company).where(Company.is_active == True))).scalar() or 0
    companies_inactive = companies_total - companies_active

    # Invoice statistics
    today = date.today()
    end_of_month = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
    coming_from = end_of_month - timedelta(days=7)

    pending_invoices = (
        (await db.execute(
            select(func.count()).select_from(Invoice).where(
                Invoice.status == InvoiceStatus.UNPAID,
                Invoice.due_date < today,
            )
        )).scalar()
        or 0
    )

    coming_invoices = (
        (await db.execute(
            select(func.count()).select_from(Invoice).where(
                Invoice.status == InvoiceStatus.UNPAID,
                Invoice.due_date >= coming_from,
                Invoice.due_date <= end_of_month,
            )
        )).scalar()
        or 0
    )

    return SuccessResponse(
        message="Platform statistics",
        data={
            "companies_total": companies_total,
            "companies_active": companies_active,
            "companies_inactive": companies_inactive,
            "pending_invoices": pending_invoices,
            "coming_invoices": coming_invoices,
        },
    )
