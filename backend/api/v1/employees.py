"""
Employee management routes
"""
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from typing import Optional

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_super_admin, require_any_authenticated, require_admin_or_team_lead
from core.responses import SuccessResponse
from core.employee_id import get_next_employee_id_for_tenant
from core.pagination import PaginationParams, paginate_response
from models.user import User
from models.employee import Employee
from models.team import Team
from models.leave import LeaveBalance
from schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeSelfUpdate

router = APIRouter()

# Employees inactive for 30+ days are permanently purged and not shown
INACTIVE_PURGE_DAYS = 30


def _build_employee_filters(
    search: Optional[str] = None,
    team_id: Optional[int] = None,
    team_name: Optional[str] = None,
    designation: Optional[str] = None,
    status: Optional[str] = None,
):
    """Build filter clauses for employee listing. Excludes purged (inactive 30+ days)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=INACTIVE_PURGE_DAYS)
    # Exclude employees inactive for 30+ days (purged, not shown)
    purged = and_(
        Employee.is_active == False,
        or_(
            and_(Employee.deactivated_at != None, Employee.deactivated_at <= cutoff),
            and_(
                Employee.deactivated_at == None,
                Employee.updated_at != None,
                Employee.updated_at <= cutoff,
            ),
        ),
    )
    filters = [~purged]

    if search and search.strip():
        q = f"%{search.strip()}%"
        filters.append(
            or_(
                Employee.first_name.ilike(q),
                Employee.last_name.ilike(q),
                Employee.employee_id.ilike(q),
            )
        )
    if team_id is not None:
        filters.append(Employee.team_id == team_id)
    if team_name and team_name.strip():
        filters.append(Team.name.ilike(f"%{team_name.strip()}%"))
    if designation and designation.strip():
        filters.append(Employee.designation.ilike(f"%{designation.strip()}%"))
    if status:
        s = status.lower()
        if s == "active":
            filters.append(Employee.is_active == True)
        elif s == "inactive":
            filters.append(Employee.is_active == False)

    return filters


@router.get("", response_model=SuccessResponse)
async def list_employees(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="Search by name or employee ID"),
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    team_name: Optional[str] = Query(None, description="Filter by team name"),
    designation: Optional[str] = Query(None, description="Filter by designation"),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive"),
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """List employees with filters. Excludes employees inactive for 30+ days (purged). Tenant users see only their company's employees."""
    filters = _build_employee_filters(search, team_id, team_name, designation, status)

    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        filters.append(Employee.tenant_id == tenant_id)

    base_query = select(Employee).where(and_(*filters))
    if team_name and team_name.strip():
        base_query = base_query.join(Team, Employee.team_id == Team.id).distinct()

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get paginated results (with team for team_name filter)
    result = await db.execute(
        base_query.options(selectinload(Employee.team))
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    employees = result.unique().scalars().all()
    
    return SuccessResponse(
        message="Employees retrieved",
        data=paginate_response(
            [EmployeeResponse.model_validate(emp) for emp in employees],
            total,
            pagination.page,
            pagination.page_size
        )
    )


@router.post("", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new employee. Employee ID is auto-assigned per tenant (1, 2, 3...) when not provided."""
    from models.user import User as UserModel
    user_row = await db.get(UserModel, employee_data.user_id)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    tenant_id = getattr(user_row, "tenant_id", None) or getattr(current_user, "tenant_id", None)

    if tenant_id is not None:
        assigned_employee_id = await get_next_employee_id_for_tenant(db, tenant_id)
    elif employee_data.employee_id:
        assigned_employee_id = employee_data.employee_id
        result = await db.execute(select(Employee).where(Employee.employee_id == assigned_employee_id))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee ID already exists")
    else:
        assigned_employee_id = f"EMP{employee_data.user_id:04d}"

    data = employee_data.model_dump(exclude_unset=True)
    data["employee_id"] = assigned_employee_id
    data["tenant_id"] = tenant_id
    employee = Employee(**data)
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    return SuccessResponse(
        message="Employee created successfully",
        data=EmployeeResponse.model_validate(employee)
    )


@router.get("/me", response_model=SuccessResponse)
async def get_my_profile(
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's employee profile (for employee portal)"""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )
    return SuccessResponse(
        message="Profile retrieved",
        data=EmployeeResponse.model_validate(employee)
    )


@router.put("/me", response_model=SuccessResponse)
async def update_my_profile(
    data: EmployeeSelfUpdate,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """Employee updates their own personal info (CNIC, personal email, emergency contact, etc.)"""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )
    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)
    await db.commit()
    await db.refresh(employee)
    return SuccessResponse(
        message="Profile updated successfully",
        data=EmployeeResponse.model_validate(employee),
    )


@router.get("/{employee_id}", response_model=SuccessResponse)
async def get_employee(
    employee_id: int,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get employee by ID. Tenant users may only access employees in their company."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and employee.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    return SuccessResponse(
        message="Employee retrieved",
        data=EmployeeResponse.model_validate(employee)
    )


@router.put("/{employee_id}", response_model=SuccessResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Update employee. Tenant admin may also set leave quotas (annual_leave, sick_leave, casual_leave) for current year."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and employee.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    update_data = employee_data.model_dump(exclude_unset=True)
    leave_fields = {"annual_leave", "sick_leave", "casual_leave"}
    leave_updates = {k: update_data.pop(k) for k in list(update_data.keys()) if k in leave_fields}

    for field, value in update_data.items():
        setattr(employee, field, value)

    if leave_updates:
        current_year = date.today().year
        result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.year == current_year,
            )
        )
        balance = result.scalar_one_or_none()
        if not balance:
            balance = LeaveBalance(
                employee_id=employee_id,
                tenant_id=getattr(employee, "tenant_id", None),
                year=current_year,
                annual_leave=leave_updates.get("annual_leave", 0),
                sick_leave=leave_updates.get("sick_leave", 0),
                casual_leave=leave_updates.get("casual_leave", 0),
            )
            db.add(balance)
        else:
            if "annual_leave" in leave_updates:
                balance.annual_leave = leave_updates["annual_leave"]
            if "sick_leave" in leave_updates:
                balance.sick_leave = leave_updates["sick_leave"]
            if "casual_leave" in leave_updates:
                balance.casual_leave = leave_updates["casual_leave"]

    await db.commit()
    await db.refresh(employee)

    return SuccessResponse(
        message="Employee updated successfully",
        data=EmployeeResponse.model_validate(employee)
    )


@router.delete("/{employee_id}", response_model=SuccessResponse)
async def delete_employee(
    employee_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Soft delete employee (set is_active=False). Company admin may deactivate employees in their company."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and employee.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    employee.is_active = False
    employee.deactivated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(employee)
    return SuccessResponse(
        message="Employee deactivated successfully",
        data=EmployeeResponse.model_validate(employee)
    )
