"""
Attendance routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, date
from typing import List, Optional

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_any_authenticated, require_admin_or_team_lead
from core.responses import SuccessResponse
from models.user import User
from models.employee import Employee
from models.attendance import Attendance, Overtime
from schemas.attendance import (
    AttendanceCheckIn,
    AttendanceCheckOut,
    AttendanceResponse,
    OvertimeCreate,
    OvertimeResponse
)

router = APIRouter()


@router.post("/check-in", response_model=SuccessResponse)
async def check_in(
    check_in_data: AttendanceCheckIn,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Employee check-in"""
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
    
    today = date.today()

    # Check if already checked in today (use date column for consistency)
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Idempotent: already checked in today — return existing record so UI can show Check Out
        return SuccessResponse(
            message="Already checked in today",
            data=AttendanceResponse.model_validate(existing)
        )

    check_in_time = datetime.now()
    attendance = Attendance(
        employee_id=employee.id,
        date=today,
        check_in_time=check_in_time,
        is_late=check_in_data.is_late or False
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)

    return SuccessResponse(
        message="Checked in successfully",
        data=AttendanceResponse.model_validate(attendance)
    )


@router.post("/check-out", response_model=SuccessResponse)
async def check_out(
    check_out_data: AttendanceCheckOut,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Employee check-out"""
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
    
    # Find the latest open attendance (no check-out yet) for this employee.
    result = await db.execute(
        select(Attendance)
        .where(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.check_out_time.is_(None)
            )
        )
        .order_by(Attendance.check_in_time.desc())
        .limit(1)
    )
    attendance = result.scalar_one_or_none()
    if not attendance:
        # Idempotent: already checked out today? Return existing record so UI can show correct state.
        today = date.today()
        result = await db.execute(
            select(Attendance)
            .where(
                and_(
                    Attendance.employee_id == employee.id,
                    Attendance.date == today,
                    Attendance.check_out_time.isnot(None)
                )
            )
            .order_by(Attendance.check_out_time.desc())
            .limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return SuccessResponse(
                message="Already checked out today",
                data=AttendanceResponse.model_validate(existing)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active check-in found. Please check in first."
        )

    attendance.check_out_time = datetime.now()
    await db.commit()
    await db.refresh(attendance)

    return SuccessResponse(
        message="Checked out successfully",
        data=AttendanceResponse.model_validate(attendance)
    )


@router.get("/all", response_model=SuccessResponse)
async def get_all_attendance(
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Get all attendance records (admin/team_lead only). Tenant users see only their company's."""
    from sqlalchemy.orm import joinedload
    query = (
        select(Attendance)
        .options(joinedload(Attendance.employee))
        .join(Employee, Attendance.employee_id == Employee.id)
    )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        query = query.where(Employee.tenant_id == tenant_id)
    if employee_id:
        query = query.where(Attendance.employee_id == employee_id)
    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)
    query = query.order_by(Attendance.date.desc(), Attendance.check_in_time.desc())
    result = await db.execute(query)
    attendances = result.scalars().unique().all()
    data = []
    for att in attendances:
        emp = att.employee
        data.append({
            **AttendanceResponse.model_validate(att).model_dump(),
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else None,
            "employee_id": emp.employee_id if emp else None,
        })
    return SuccessResponse(message="Attendance retrieved", data=data)


@router.get("/history", response_model=SuccessResponse)
async def get_attendance_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance history"""
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
    
    query = select(Attendance).where(Attendance.employee_id == employee.id)
    
    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)
    
    query = query.order_by(Attendance.date.desc())
    
    result = await db.execute(query)
    attendances = result.scalars().all()
    
    return SuccessResponse(
        message="Attendance history retrieved",
        data=[AttendanceResponse.model_validate(att) for att in attendances]
    )


@router.post("/overtime", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def submit_overtime(
    overtime_data: OvertimeCreate,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Submit overtime request"""
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
    
    # Calculate hours
    time_diff = overtime_data.end_time - overtime_data.start_time
    hours = int(time_diff.total_seconds() / 3600)
    
    overtime = Overtime(
        employee_id=employee.id,
        date=overtime_data.date,
        start_time=overtime_data.start_time,
        end_time=overtime_data.end_time,
        hours=hours,
        notes=overtime_data.notes
    )
    db.add(overtime)
    await db.commit()
    await db.refresh(overtime)
    
    return SuccessResponse(
        message="Overtime submitted successfully",
        data=OvertimeResponse.model_validate(overtime)
    )
