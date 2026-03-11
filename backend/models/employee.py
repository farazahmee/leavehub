"""
Employee model
"""
from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base

# tenant_id links every employee record to a Company

# Import for foreign_keys - avoid circular import (child models use "Employee" string)
from models.leave import Leave
from models.document import Document
from models.letter import Letter
from models.payroll import Payroll


class Employee(Base):
    """Employee model"""
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    employee_id = Column(String, index=True, nullable=False)  # unique per tenant (see migration uq_employees_tenant_employee_id)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    company_name = Column(String)
    phone = Column(String)
    date_of_birth = Column(Date)
    date_of_joining = Column(Date, nullable=False)
    probation_months = Column(Integer, default=0, nullable=False)  # 0 = no probation
    designation = Column(String)
    department = Column(String)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    reporting_manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    address = Column(Text)
    cnic = Column(String)  # National CNIC / ID
    personal_email = Column(String)
    emergency_contact_name = Column(String)
    emergency_contact_phone = Column(String)
    is_active = Column(Boolean, default=True)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)  # When is_active was set to False
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="employee")
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    reporting_manager = relationship("Employee", remote_side=[id], backref="direct_reports")
    attendances = relationship("Attendance", back_populates="employee")
    leaves = relationship("Leave", back_populates="employee", foreign_keys=[Leave.employee_id])
    leave_balances = relationship("LeaveBalance", back_populates="employee")
    documents = relationship("Document", back_populates="employee", foreign_keys=[Document.employee_id])
    letters = relationship("Letter", back_populates="employee", foreign_keys=[Letter.employee_id])
    payrolls = relationship("Payroll", back_populates="employee", foreign_keys=[Payroll.employee_id])
