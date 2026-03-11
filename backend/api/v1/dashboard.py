"""
Dashboard routes - role-aware (Admin vs Employee)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

from core.database import get_db
from core.config import settings
from core.security import get_current_active_user
from core.responses import SuccessResponse
from models.user import User, UserRole
from models.employee import Employee
from models.team import Team
from models.attendance import Attendance
from models.leave import Leave, LeaveBalance
from models.document import Document
from models.role import Role, UserRoleAssignment

router = APIRouter()


@router.get("/summary", response_model=SuccessResponse)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dashboard summary - role-aware:
    - super_admin / team_lead: org-wide stats
    - employee: personal stats (attendance, leave balance, documents)
    """
    today = date.today()
    is_admin = current_user.role in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
    tenant_id = getattr(current_user, "tenant_id", None)
    # Tenant users: only treat as admin if they have the Company Admin RBAC role
    if not is_admin and tenant_id is not None:
        from core.permissions import _load_user_role_names
        user_role_names = await _load_user_role_names(
            current_user.id, tenant_id, db
        )
        if "Company Admin" in user_role_names:
            is_admin = True

    if is_admin:
        emp_filter = [Employee.is_active == True]
        if tenant_id is not None:
            emp_filter.append(Employee.tenant_id == tenant_id)
        total_employees_result = await db.execute(
            select(func.count(Employee.id)).where(and_(*emp_filter))
        )
        total_employees = total_employees_result.scalar() or 0

        present_q = select(func.count(Attendance.id)).join(
            Employee, Attendance.employee_id == Employee.id
        ).where(
            and_(
                func.date(Attendance.check_in_time) == today,
                Attendance.check_out_time.is_(None),
            )
        )
        if tenant_id is not None:
            present_q = present_q.where(Employee.tenant_id == tenant_id)
        present_today_result = await db.execute(present_q)
        present_today = present_today_result.scalar() or 0

        on_leave_q = select(func.count(Leave.id)).where(
            and_(
                Leave.start_date <= today,
                Leave.end_date >= today,
                Leave.status == "approved",
            )
        )
        if tenant_id is not None:
            on_leave_q = on_leave_q.where(Leave.tenant_id == tenant_id)
        on_leave_today_result = await db.execute(on_leave_q)
        on_leave_today = on_leave_today_result.scalar() or 0

        pending_q = select(func.count(Leave.id)).where(Leave.status == "pending")
        if tenant_id is not None:
            pending_q = pending_q.where(Leave.tenant_id == tenant_id)
        pending_leaves_result = await db.execute(pending_q)
        pending_leaves = pending_leaves_result.scalar() or 0

        teams_q = select(func.count(Team.id))
        if tenant_id is not None:
            teams_q = teams_q.where(Team.tenant_id == tenant_id)
        total_teams_result = await db.execute(teams_q)
        total_teams = total_teams_result.scalar() or 0

        docs_q = select(func.count(Document.id))
        if tenant_id is not None:
            docs_q = docs_q.where(Document.tenant_id == tenant_id)
        total_documents_result = await db.execute(docs_q)
        total_documents = total_documents_result.scalar() or 0

        total_admins = None
        if tenant_id is not None:
            admins_q = (
                select(func.count(func.distinct(UserRoleAssignment.user_id)))
                .join(Role, Role.id == UserRoleAssignment.role_id)
                .where(
                    and_(
                        Role.tenant_id == tenant_id,
                        Role.name == "Company Admin",
                    )
                )
            )
            admins_result = await db.execute(admins_q)
            total_admins = admins_result.scalar() or 0

        data = {
            "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            "is_admin": True,
            "total_employees": total_employees,
            "present_today": present_today,
            "on_leave_today": on_leave_today,
            "pending_leave_requests": pending_leaves,
            "total_teams": total_teams,
            "documents_uploaded": total_documents,
        }
        if total_admins is not None:
            data["total_admins"] = total_admins

        return SuccessResponse(
            message="Dashboard summary retrieved",
            data=data,
        )

    # Employee dashboard - personal stats
    result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    employee = result.scalar_one_or_none()
    if not employee:
        return SuccessResponse(
            message="Dashboard summary retrieved",
            data={
                "role": "employee",
                "is_admin": False,
                "checked_in_today": False,
                "leave_balance": {},
                "my_leave_requests_pending": 0,
                "documents_uploaded": 0,
            }
        )

    checked_in_result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today,
                Attendance.check_out_time.is_(None)
            )
        )
    )
    checked_in_today = checked_in_result.scalar_one_or_none() is not None

    balance_result = await db.execute(
        select(LeaveBalance).where(
            and_(LeaveBalance.employee_id == employee.id, LeaveBalance.year == today.year)
        )
    )
    bal = balance_result.scalar_one_or_none()
    leave_balance = {
        "annual": (bal.annual_leave - bal.used_annual) if bal else 0,
        "sick": (bal.sick_leave - bal.used_sick) if bal else 0,
        "casual": (bal.casual_leave - bal.used_casual) if bal else 0,
    } if bal else {"annual": 0, "sick": 0, "casual": 0}

    pending_result = await db.execute(
        select(func.count(Leave.id)).where(
            and_(Leave.employee_id == employee.id, Leave.status == "pending")
        )
    )
    my_pending = pending_result.scalar() or 0

    docs_result = await db.execute(
        select(func.count(Document.id)).where(Document.employee_id == employee.id)
    )
    my_documents = docs_result.scalar() or 0

    google_calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "") or ""
    return SuccessResponse(
        message="Dashboard summary retrieved",
        data={
            "role": "employee",
            "is_admin": False,
            "checked_in_today": checked_in_today,
            "leave_balance": leave_balance,
            "my_leave_requests_pending": my_pending,
            "documents_uploaded": my_documents,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "employee_designation": employee.designation or "",
            "google_calendar_id": google_calendar_id,
        }
    )


@router.get("/analytics", response_model=SuccessResponse)
async def get_dashboard_analytics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Analytics for dashboard charts - leave by type, headcount. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        return SuccessResponse(message="Analytics", data={})
    today = date.today()
    year = today.year
    leave_q = (
        select(Leave.leave_type, func.count(Leave.id))
        .where(
            and_(
                Leave.status == "approved",
                func.extract("year", Leave.start_date) == year,
            )
        )
    )
    if tenant_id is not None:
        leave_q = leave_q.where(Leave.tenant_id == tenant_id)
    leave_q = leave_q.group_by(Leave.leave_type)
    leave_by_type = await db.execute(leave_q)
    leave_data = {row[0]: row[1] for row in leave_by_type.all()}
    emp_q = select(func.count(Employee.id)).where(Employee.is_active == True)
    if tenant_id is not None:
        emp_q = emp_q.where(Employee.tenant_id == tenant_id)
    headcount = await db.execute(emp_q)
    total = headcount.scalar() or 0
    return SuccessResponse(
        message="Analytics retrieved",
        data={
            "leave_by_type": [
                {"name": k, "count": v} for k, v in leave_data.items()
            ],
            "total_employees": total,
        },
    )


@router.get("/card/employees", response_model=SuccessResponse)
async def get_card_employees(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all employees for dashboard card detail. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    q = select(Employee).where(Employee.is_active == True).order_by(Employee.first_name)
    if tenant_id is not None:
        q = q.where(Employee.tenant_id == tenant_id)
    result = await db.execute(q)
    employees = result.scalars().all()
    from schemas.employee import EmployeeResponse
    return SuccessResponse(
        message="Employees retrieved",
        data=[EmployeeResponse.model_validate(e) for e in employees]
    )


@router.get("/card/present-today", response_model=SuccessResponse)
async def get_card_present_today(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List employees present today. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    today = date.today()
    q = (
        select(Employee)
        .join(Attendance, Attendance.employee_id == Employee.id)
        .where(
            and_(
                func.date(Attendance.check_in_time) == today,
                Attendance.check_out_time.is_(None),
                Employee.is_active == True,
            )
        )
        .distinct()
        .order_by(Employee.first_name)
    )
    if tenant_id is not None:
        q = q.where(Employee.tenant_id == tenant_id)
    result = await db.execute(q)
    employees = result.scalars().all()
    from schemas.employee import EmployeeResponse
    return SuccessResponse(
        message="Present today",
        data=[EmployeeResponse.model_validate(e) for e in employees]
    )


@router.get("/card/on-leave-today", response_model=SuccessResponse)
async def get_card_on_leave_today(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List employees on approved leave today. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    today = date.today()
    q = (
        select(Employee)
        .join(Leave, Leave.employee_id == Employee.id)
        .where(
            and_(
                Leave.start_date <= today,
                Leave.end_date >= today,
                Leave.status == "approved",
                Employee.is_active == True,
            )
        )
        .distinct()
        .order_by(Employee.first_name)
    )
    if tenant_id is not None:
        q = q.where(Employee.tenant_id == tenant_id)
    result = await db.execute(q)
    employees = result.scalars().all()
    from schemas.employee import EmployeeResponse
    return SuccessResponse(
        message="On leave today",
        data=[EmployeeResponse.model_validate(e) for e in employees]
    )


@router.get("/card/pending-leaves", response_model=SuccessResponse)
async def get_card_pending_leaves(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List pending leave requests. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    q = (
        select(Leave, Employee)
        .join(Employee, Leave.employee_id == Employee.id)
        .where(Leave.status == "pending")
        .order_by(Leave.created_at.desc())
    )
    if tenant_id is not None:
        q = q.where(Employee.tenant_id == tenant_id)
    result = await db.execute(q)
    rows = result.all()
    data = [
        {
            "id": l.id,
            "employee_id": e.employee_id,
            "employee_name": f"{e.first_name} {e.last_name}",
            "leave_type": l.leave_type,
            "start_date": str(l.start_date),
            "end_date": str(l.end_date),
            "days": l.days,
            "reason": l.reason,
        }
        for l, e in rows
    ]
    return SuccessResponse(message="Pending leaves", data=data)


@router.get("/card/teams", response_model=SuccessResponse)
async def get_card_teams(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all teams for dashboard card detail. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    q = select(Team).order_by(Team.name)
    if tenant_id is not None:
        q = q.where(Team.tenant_id == tenant_id)
    result = await db.execute(q)
    teams = result.scalars().all()
    from schemas.team import TeamResponse
    return SuccessResponse(
        message="Teams retrieved",
        data=[TeamResponse.model_validate(t) for t in teams]
    )


@router.get("/alerts", response_model=SuccessResponse)
async def get_dashboard_alerts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Alerts for probation ending soon and work anniversaries.
    - Admin: all employees with probation ending in 14 days or anniversary in 7 days
    - Employee: own probation/anniversary alerts
    """
    today = date.today()
    is_admin = current_user.role in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        is_admin = True
    probation_window = today + timedelta(days=14)
    anniversary_window = today + timedelta(days=7)

    emp_q = select(Employee).where(Employee.is_active == True)
    if tenant_id is not None:
        emp_q = emp_q.where(Employee.tenant_id == tenant_id)
    result = await db.execute(emp_q)
    employees = result.scalars().all()

    probation_ending = []
    anniversaries = []

    for e in employees:
        if not e.date_of_joining:
            continue
        doj = e.date_of_joining

        # Probation ending soon (within 14 days)
        prob_months = (e.probation_months or 0)
        if prob_months > 0:
            prob_end = doj + relativedelta(months=prob_months)
            if today <= prob_end <= probation_window:
                probation_ending.append({
                    "employee_id": e.employee_id,
                    "employee_name": f"{e.first_name} {e.last_name}",
                    "designation": e.designation,
                    "date_of_joining": str(doj),
                    "probation_end_date": str(prob_end),
                    "probation_months": prob_months,
                })

        # Work anniversary (same month-day, years >= 1)
        years = (today - doj).days // 365
        if years >= 1:
            anniv_this_year = date(today.year, doj.month, doj.day)
            if today <= anniv_this_year <= anniversary_window:
                anniversaries.append({
                    "employee_id": e.employee_id,
                    "employee_name": f"{e.first_name} {e.last_name}",
                    "designation": e.designation,
                    "date_of_joining": str(doj),
                    "anniversary_date": str(anniv_this_year),
                    "years": years,
                })

    # If employee, filter to own alerts only
    if not is_admin:
        result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = result.scalar_one_or_none()
        if emp:
            emp_id = emp.employee_id
            probation_ending = [p for p in probation_ending if p["employee_id"] == emp_id]
            anniversaries = [a for a in anniversaries if a["employee_id"] == emp_id]
        else:
            probation_ending = []
            anniversaries = []

    return SuccessResponse(
        message="Alerts retrieved",
        data={
            "probation_ending_soon": probation_ending,
            "work_anniversaries": anniversaries,
        },
    )


@router.get("/card/documents", response_model=SuccessResponse)
async def get_card_documents(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List documents summary for dashboard card. Tenant-scoped when applicable."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD) and tenant_id is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    q = (
        select(Document, Employee)
        .outerjoin(Employee, Document.employee_id == Employee.id)
        .order_by(Document.created_at.desc())
        .limit(50)
    )
    if tenant_id is not None:
        q = q.where(Document.tenant_id == tenant_id)
    result = await db.execute(q)
    rows = result.all()
    data = [
        {
            "id": doc.id,
            "name": doc.name,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Company",
            "file_type": doc.file_type or "document",
            "created_at": str(doc.created_at) if doc.created_at else None,
        }
        for doc, emp in rows
    ]
    return SuccessResponse(message="Documents", data=data)
