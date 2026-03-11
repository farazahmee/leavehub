"""
Leave and LeaveBalance models
"""
from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, String, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Leave(Base):
    """Leave request model"""
    __tablename__ = "leaves"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(String, nullable=False)  # annual, sick, casual, etc.
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Integer)  # Calculated days
    reason = Column(Text)
    status = Column(String, default="pending")  # pending, approved, rejected
    approved_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    rejected_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="leaves")
    approved_by = relationship("Employee", foreign_keys=[approved_by_id])


class LeaveBalance(Base):
    """Leave balance model"""
    __tablename__ = "leave_balances"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, unique=True)
    annual_leave = Column(Integer, default=0)
    sick_leave = Column(Integer, default=0)
    casual_leave = Column(Integer, default=0)
    used_annual = Column(Integer, default=0)
    used_sick = Column(Integer, default=0)
    used_casual = Column(Integer, default=0)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", back_populates="leave_balances")
