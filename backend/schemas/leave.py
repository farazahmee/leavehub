"""
Leave schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date


class LeaveBase(BaseModel):
    """Base leave schema"""
    leave_type: str
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveCreate(LeaveBase):
    """Leave creation schema"""
    pass


class LeaveUpdate(BaseModel):
    """Leave update schema"""
    status: Optional[str] = None
    rejected_reason: Optional[str] = None


class LeaveResponse(LeaveBase):
    """Leave response schema"""
    id: int
    employee_id: int
    days: Optional[int] = None
    status: str
    approved_by_id: Optional[int] = None
    rejected_reason: Optional[str] = None
    
    class Config:
        from_attributes = True


class LeaveBalanceResponse(BaseModel):
    """Leave balance response schema"""
    id: int
    employee_id: int
    annual_leave: int
    sick_leave: int
    casual_leave: int
    used_annual: int
    used_sick: int
    used_casual: int
    year: int
    
    class Config:
        from_attributes = True


class LeaveBalanceSet(BaseModel):
    """Set leave quota for an employee (admin only)"""
    annual_leave: Optional[int] = None
    sick_leave: Optional[int] = None
    casual_leave: Optional[int] = None
    year: Optional[int] = None
