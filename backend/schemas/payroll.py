"""
Payroll schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class PayrollCreate(BaseModel):
    """Payroll creation schema"""
    employee_id: int
    month: int
    year: int
    basic_salary: Optional[Decimal] = None
    allowances: Optional[Decimal] = None
    deductions: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None


class PayrollResponse(BaseModel):
    """Payroll response schema"""
    id: int
    employee_id: int
    month: int
    year: int
    basic_salary: Optional[Decimal] = None
    allowances: Optional[Decimal] = None
    deductions: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    currency: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
