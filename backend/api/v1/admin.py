"""
Admin-only routes. Super admin creates platform users; company admin creates tenant users.
"""
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from core.database import get_db
from core.security import get_password_hash
from core.permissions import require_super_admin, require_admin_or_team_lead
from core.validators import validate_email, sanitize_string
from core.responses import SuccessResponse
from core.employee_id import get_next_employee_id_for_tenant
from core.email import send_new_user_set_password
from core.config import settings
from models.user import User, UserRole
from models.employee import Employee
from models.company import Company
from models.leave import LeaveBalance
from schemas.auth import AdminUserCreate
from schemas.employee import EmployeeResponse

router = APIRouter()


def _base_url_for_set_password(tenant_id=None, tenant_slug=None):
    """Set-password link: tenant-created users go to employee portal; platform-created to main frontend."""
    if tenant_id is not None and tenant_slug:
        base = getattr(settings, "BASE_DOMAIN", "leavehub.io")
        return f"https://{tenant_slug}.{base}"
    return settings.FRONTEND_URL.rstrip("/")


@router.post("/users", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    data: AdminUserCreate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user/employee. Super admin creates platform users; company admin creates
    tenant users (same company). User receives email with set-password link.
    """
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is None and not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admin can create users without a company context",
        )

    if not validate_email(data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format",
        )

    email = sanitize_string(data.email.lower())

    # Fetch company when in tenant context (used for domain validation and company_name)
    company_row = await db.get(Company, tenant_id) if tenant_id is not None else None

    # Domain validation:
    # - Tenant context: use tenant's own domain only (if set)
    # - Platform context (no tenant): use global USER_EMAIL_DOMAIN (if set)
    allowed_domain = None
    if tenant_id is not None:
        if company_row and company_row.domain:
            allowed_domain = company_row.domain.strip().lower()
    else:
        if hasattr(settings, "USER_EMAIL_DOMAIN") and settings.USER_EMAIL_DOMAIN:
            allowed_domain = settings.USER_EMAIL_DOMAIN.strip().lower()

    if allowed_domain and not email.endswith("@" + allowed_domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email must be on domain @{allowed_domain}",
        )

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    base_username = sanitize_string(email.split("@")[0].replace(".", "_")[:30])
    username = base_username
    counter = 1
    while True:
        result = await db.execute(select(User).where(User.username == username))
        if not result.scalar_one_or_none():
            break
        username = f"{base_username}{counter}"
        counter += 1

    token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    temp_password = secrets.token_urlsafe(32)

    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(temp_password),
        role=UserRole.EMPLOYEE,
        is_active=True,
        password_reset_token=token,
        password_reset_expires=expires,
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    doj = data.date_of_joining if data.date_of_joining is not None else date.today()
    prob_months = data.probation_months if data.probation_months is not None else 0

    company_name = sanitize_string(data.company_name) if data.company_name else None
    if company_row and not company_name:
        company_name = company_row.name

    if tenant_id is not None:
        next_emp_id = await get_next_employee_id_for_tenant(db, tenant_id)
    else:
        next_emp_id = f"EMP{user.id:04d}"
    employee = Employee(
        user_id=user.id,
        employee_id=next_emp_id,
        first_name=sanitize_string(data.first_name),
        last_name=sanitize_string(data.last_name),
        company_name=company_name,
        designation=sanitize_string(data.designation) if data.designation else None,
        department=sanitize_string(data.department) if data.department else company_name,
        phone=sanitize_string(data.phone) if data.phone else None,
        date_of_joining=doj,
        probation_months=max(0, prob_months),
        is_active=True,
        tenant_id=tenant_id,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    # Tenant admin can set leave quotas when creating employee (for all tenants, including future ones).
    current_year = date.today().year
    leave_balance = LeaveBalance(
        employee_id=employee.id,
        tenant_id=tenant_id,
        year=current_year,
        annual_leave=data.annual_leave if data.annual_leave is not None else 15,
        sick_leave=data.sick_leave if data.sick_leave is not None else 6,
        casual_leave=data.casual_leave if data.casual_leave is not None else 5,
    )
    db.add(leave_balance)
    await db.commit()

    tenant_slug = company_row.slug if company_row else None
    base_url = _base_url_for_set_password(tenant_id, tenant_slug)
    set_password_url = f"{base_url}/set-password?token={token}"

    email_sent = send_new_user_set_password(
        to_email=email,
        username=username,
        first_name=data.first_name,
        set_password_url=set_password_url,
    )
    email_msg = (
        "Set-password link sent to email."
        if email_sent
        else "Email not sent. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env and network/DNS."
    )

    return SuccessResponse(
        message=f"User created successfully. {email_msg}",
        data={
            "user_id": user.id,
            "employee": EmployeeResponse.model_validate(employee),
            "username": username,
            "email_sent": email_sent,
        },
    )
