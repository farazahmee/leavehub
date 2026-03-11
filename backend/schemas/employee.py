"""
Employee schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class EmployeeBase(BaseModel):
    """Base employee schema"""
    employee_id: Optional[str] = None  # Optional; when missing, backend assigns next per-tenant ID (1, 2, 3...)
    first_name: str
    last_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_joining: date
    probation_months: Optional[int] = 0
    designation: Optional[str] = None
    department: Optional[str] = None
    team_id: Optional[int] = None
    reporting_manager_id: Optional[int] = None
    address: Optional[str] = None
    cnic: Optional[str] = None
    personal_email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    """Employee creation schema"""
    user_id: int


class EmployeeUpdate(BaseModel):
    """Employee update schema. Tenant admin can also set leave quotas (annual_leave, sick_leave, casual_leave) for current year."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_joining: Optional[date] = None
    probation_months: Optional[int] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    team_id: Optional[int] = None
    reporting_manager_id: Optional[int] = None
    address: Optional[str] = None
    cnic: Optional[str] = None
    personal_email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    is_active: Optional[bool] = None
    annual_leave: Optional[int] = None
    sick_leave: Optional[int] = None
    casual_leave: Optional[int] = None


class EmployeeSelfUpdate(BaseModel):
    """Schema for employee updating their own personal info (limited fields)"""
    phone: Optional[str] = None
    address: Optional[str] = None
    cnic: Optional[str] = None
    personal_email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    """Employee response schema"""
    id: int
    user_id: int
    is_active: bool
    
    class Config:
        from_attributes = True
