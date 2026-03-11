"""
Attendance and Overtime models
"""
from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, String, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Attendance(Base):
    """Attendance model"""
    __tablename__ = "attendances"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    check_in_time = Column(DateTime(timezone=True))
    check_out_time = Column(DateTime(timezone=True))
    is_late = Column(Boolean, default=False)
    is_absent = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", back_populates="attendances")
    
    __table_args__ = (
        {"comment": "Employee attendance records"}
    )


class Overtime(Base):
    """Overtime model"""
    __tablename__ = "overtimes"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    hours = Column(Integer)  # Calculated hours
    status = Column(String, default="pending")  # pending, approved, rejected
    approved_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id])
    approved_by = relationship("Employee", foreign_keys=[approved_by_id])
