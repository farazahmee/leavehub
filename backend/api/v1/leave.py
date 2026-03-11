"""
Leave management routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date, timedelta
from typing import List, Optional

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_admin_or_team_lead, require_any_authenticated
from core.responses import SuccessResponse
from models.user import User
from models.employee import Employee
from models.leave import Leave, LeaveBalance
from schemas.leave import LeaveCreate, LeaveUpdate, LeaveResponse, LeaveBalanceResponse, LeaveBalanceSet

router = APIRouter()


@router.post("/apply", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def apply_leave(
    leave_data: LeaveCreate,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Apply for leave"""
    # Get employee
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )
    
    # Calculate days
    days = (leave_data.end_date - leave_data.start_date).days + 1
    
    # Check leave balance
    result = await db.execute(
        select(LeaveBalance).where(LeaveBalance.employee_id == employee.id)
    )
    balance = result.scalar_one_or_none()
    
    if balance:
        if leave_data.leave_type == "annual" and balance.used_annual + days > balance.annual_leave:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient annual leave balance"
            )
        elif leave_data.leave_type == "sick" and balance.used_sick + days > balance.sick_leave:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient sick leave balance"
            )
        elif leave_data.leave_type == "casual" and balance.used_casual + days > balance.casual_leave:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient casual leave balance"
            )
    
    leave = Leave(
        employee_id=employee.id,
        leave_type=leave_data.leave_type,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        days=days,
        reason=leave_data.reason,
        tenant_id=getattr(employee, "tenant_id", None),
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    
    return SuccessResponse(
        message="Leave application submitted successfully",
        data=LeaveResponse.model_validate(leave)
    )


@router.get("/balance", response_model=SuccessResponse)
async def get_leave_balance(
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get leave balance"""
    # Get employee
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )
    
    result = await db.execute(
        select(LeaveBalance).where(LeaveBalance.employee_id == employee.id)
    )
    balance = result.scalar_one_or_none()
    
    if not balance:
        # Create default balance: Annual 15, Sick 6, Casual 5 per employee
        balance = LeaveBalance(
            employee_id=employee.id,
            annual_leave=15,
            sick_leave=6,
            casual_leave=5,
            year=date.today().year,
            tenant_id=getattr(employee, "tenant_id", None),
        )
        db.add(balance)
        await db.commit()
        await db.refresh(balance)

    # Return balance with remaining (total - used) for display
    d = LeaveBalanceResponse.model_validate(balance).model_dump()
    d["annual"] = max(0, (balance.annual_leave or 0) - (balance.used_annual or 0))
    d["sick"] = max(0, (balance.sick_leave or 0) - (balance.used_sick or 0))
    d["casual"] = max(0, (balance.casual_leave or 0) - (balance.used_casual or 0))

    return SuccessResponse(
        message="Leave balance retrieved",
        data=d
    )


@router.get("/balance/{employee_id}", response_model=SuccessResponse)
async def get_employee_leave_balance(
    employee_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """Get leave balance for a specific employee (admin/team_lead only). Tenant users only for same company."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    tid = getattr(current_user, "tenant_id", None)
    if tid is not None and employee.tenant_id != tid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == date.today().year,
        )
    )
    balance = result.scalar_one_or_none()
    if not balance:
        balance = LeaveBalance(
            employee_id=employee_id,
            annual_leave=15,
            sick_leave=6,
            casual_leave=5,
            year=date.today().year,
            tenant_id=getattr(employee, "tenant_id", None),
        )
        db.add(balance)
        await db.commit()
        await db.refresh(balance)
    d = LeaveBalanceResponse.model_validate(balance).model_dump()
    d["annual"] = max(0, (balance.annual_leave or 0) - (balance.used_annual or 0))
    d["sick"] = max(0, (balance.sick_leave or 0) - (balance.used_sick or 0))
    d["casual"] = max(0, (balance.casual_leave or 0) - (balance.used_casual or 0))
    return SuccessResponse(message="Leave balance retrieved", data=d)


@router.put("/balance/{employee_id}", response_model=SuccessResponse)
async def set_employee_leave_balance(
    employee_id: int,
    payload: LeaveBalanceSet,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """Set or update leave quota for an employee (admin/tenant admin). Creates balance for current year if missing."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    tid = getattr(current_user, "tenant_id", None)
    if tid is not None and getattr(employee, "tenant_id", None) != tid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    year = payload.year if payload.year is not None else date.today().year
    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
        )
    )
    balance = result.scalar_one_or_none()
    if not balance:
        balance = LeaveBalance(
            employee_id=employee_id,
            year=year,
            annual_leave=payload.annual_leave if payload.annual_leave is not None else 0,
            sick_leave=payload.sick_leave if payload.sick_leave is not None else 0,
            casual_leave=payload.casual_leave if payload.casual_leave is not None else 0,
            tenant_id=getattr(employee, "tenant_id", None),
        )
        db.add(balance)
    else:
        if payload.annual_leave is not None:
            balance.annual_leave = payload.annual_leave
        if payload.sick_leave is not None:
            balance.sick_leave = payload.sick_leave
        if payload.casual_leave is not None:
            balance.casual_leave = payload.casual_leave
    await db.commit()
    await db.refresh(balance)
    d = LeaveBalanceResponse.model_validate(balance).model_dump()
    d["annual"] = max(0, (balance.annual_leave or 0) - (balance.used_annual or 0))
    d["sick"] = max(0, (balance.sick_leave or 0) - (balance.used_sick or 0))
    d["casual"] = max(0, (balance.casual_leave or 0) - (balance.used_casual or 0))
    return SuccessResponse(message="Leave quota updated", data=d)


@router.get("/my-requests", response_model=SuccessResponse)
async def list_my_leave_requests(
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """List current user's leave requests"""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        return SuccessResponse(message="Leave requests retrieved", data=[])

    result = await db.execute(
        select(Leave)
        .where(Leave.employee_id == employee.id)
        .order_by(Leave.created_at.desc())
    )
    leaves = result.scalars().all()
    return SuccessResponse(
        message="Leave requests retrieved",
        data=[LeaveResponse.model_validate(leave) for leave in leaves]
    )


@router.get("/requests", response_model=SuccessResponse)
async def list_leave_requests(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """List leave requests (for admin/team lead). Tenant users see only their company's requests."""
    query = select(Leave, Employee).join(Employee, Leave.employee_id == Employee.id)
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        query = query.where(Employee.tenant_id == tenant_id)
    if status_filter:
        query = query.where(Leave.status == status_filter)
    query = query.order_by(Leave.created_at.desc())
    result = await db.execute(query)
    rows = result.all()
    data = []
    for leave, emp in rows:
        d = LeaveResponse.model_validate(leave).model_dump()
        d["employee_name"] = f"{emp.first_name} {emp.last_name}"
        d["employee_id_display"] = emp.employee_id
        data.append(d)
    return SuccessResponse(message="Leave requests retrieved", data=data)


@router.put("/{leave_id}/approve", response_model=SuccessResponse)
async def approve_leave(
    leave_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Approve leave request. Tenant users may only approve requests in their company."""
    leave = await db.get(Leave, leave_id)
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        emp_result = await db.execute(select(Employee).where(Employee.id == leave.employee_id))
        emp = emp_result.scalar_one_or_none()
        if not emp or emp.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave request not found"
            )
    # Get approver employee
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    approver = result.scalar_one_or_none()
    
    leave.status = "approved"
    if approver:
        leave.approved_by_id = approver.id
    
    # Update leave balance
    result = await db.execute(
        select(LeaveBalance).where(LeaveBalance.employee_id == leave.employee_id)
    )
    balance = result.scalar_one_or_none()
    
    if balance:
        if leave.leave_type == "annual":
            balance.used_annual += leave.days
        elif leave.leave_type == "sick":
            balance.used_sick += leave.days
        elif leave.leave_type == "casual":
            balance.used_casual += leave.days
    
    await db.commit()
    await db.refresh(leave)
    
    return SuccessResponse(
        message="Leave approved successfully",
        data=LeaveResponse.model_validate(leave)
    )


@router.put("/{leave_id}/reject", response_model=SuccessResponse)
async def reject_leave(
    leave_id: int,
    rejection_reason: str,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Reject leave request. Tenant users may only reject requests in their company."""
    from core.validators import sanitize_string

    leave = await db.get(Leave, leave_id)
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        emp_result = await db.execute(select(Employee).where(Employee.id == leave.employee_id))
        emp = emp_result.scalar_one_or_none()
        if not emp or emp.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave request not found"
            )
    leave.status = "rejected"
    leave.rejected_reason = sanitize_string(rejection_reason)
    
    await db.commit()
    await db.refresh(leave)
    
    return SuccessResponse(
        message="Leave rejected",
        data=LeaveResponse.model_validate(leave)
    )
